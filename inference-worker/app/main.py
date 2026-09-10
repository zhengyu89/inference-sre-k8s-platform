"""FastAPI app for the inference worker.

Only five endpoints are exposed: POST /infer, GET /health/live,
GET /health/ready, GET /metrics, GET+PUT /simulation. See
implementation-plan-services.md §6.
"""

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from . import config, metrics
from .model import classifier
from .schemas import InferRequest, InferResponse, LiveResponse, ReadyResponse, SimulationConfig
from .simulation import simulation_state


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Loaded synchronously and blocking is fine here: readiness must stay
    # false until this completes, and there is nothing useful to serve until
    # it does.
    await asyncio.get_event_loop().run_in_executor(None, classifier.load)
    metrics.inference_model_info.labels(model=config.MODEL_NAME, version=config.MODEL_VERSION).set(1)
    metrics.inference_model_loaded.set(1 if classifier.is_loaded() else 0)
    yield


app = FastAPI(title="inference-worker", lifespan=lifespan)


def _error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


@app.get("/health/live", response_model=LiveResponse)
async def health_live() -> LiveResponse:
    # Only answers "is the process running?" — no model or dependency check,
    # so a slow model load or a degraded simulation config never gets this
    # pod killed by Kubernetes.
    return LiveResponse(status="alive")


@app.get("/health/ready")
async def health_ready():
    loaded = classifier.is_loaded()
    body = ReadyResponse(status="ready" if loaded else "not_ready", modelLoaded=loaded)
    return JSONResponse(status_code=200 if loaded else 503, content=body.model_dump())


@app.get("/metrics")
async def metrics_endpoint() -> Response:
    return Response(content=generate_latest(metrics.registry), media_type=CONTENT_TYPE_LATEST)


@app.get("/simulation", response_model=SimulationConfig)
async def get_simulation() -> SimulationConfig:
    return SimulationConfig(**simulation_state.as_dict())


@app.put("/simulation", response_model=SimulationConfig)
async def put_simulation(body: SimulationConfig) -> SimulationConfig:
    # Pydantic already enforced the bounds in SimulationConfig; resizing goes
    # through the limiter so in-flight requests are never stranded.
    await simulation_state.update(body.additionalLatencyMs, body.errorRate, body.maxConcurrency)
    return SimulationConfig(**simulation_state.as_dict())


@app.post("/infer")
async def infer(body: InferRequest, request: Request):
    model_label = config.MODEL_VERSION_LABEL
    t_enqueue = time.monotonic()

    metrics.inference_queue_depth.inc()
    try:
        acquired = await simulation_state.limiter.acquire(timeout=config.QUEUE_WAIT_TIMEOUT_S)
    finally:
        metrics.inference_queue_depth.dec()

    if not acquired:
        metrics.inference_requests_rejected_total.labels(reason="concurrency").inc()
        return JSONResponse(
            status_code=429,
            content=_error_body("CONCURRENCY_LIMIT_REACHED", "Worker is at max concurrency; try again shortly."),
        )

    metrics.inference_active_requests.inc()
    try:
        t_acquired = time.monotonic()
        queue_time_s = t_acquired - t_enqueue
        metrics.inference_queue_duration_seconds.labels(model=model_label).observe(queue_time_s)

        await simulation_state.apply_latency()

        if simulation_state.roll_injected_error():
            total_time_s = time.monotonic() - t_enqueue
            metrics.inference_requests_total.labels(status="error", model=model_label).inc()
            metrics.inference_request_duration_seconds.labels(model=model_label).observe(total_time_s)
            return JSONResponse(
                status_code=500,
                content=_error_body("SIMULATED_FAILURE", "Injected failure (SRE Lab error-rate simulation)."),
            )

        t_compute_start = time.monotonic()
        prediction, confidence = await asyncio.get_event_loop().run_in_executor(
            None, classifier.predict, body.input
        )
        compute_time_s = time.monotonic() - t_compute_start
        metrics.inference_compute_duration_seconds.labels(model=model_label).observe(compute_time_s)

        total_time_s = time.monotonic() - t_enqueue
        metrics.inference_request_duration_seconds.labels(model=model_label).observe(total_time_s)
        metrics.inference_requests_total.labels(status="success", model=model_label).inc()

        return InferResponse(
            requestId=body.requestId,
            modelVersion=model_label,
            prediction=prediction,
            confidence=confidence,
            queueTimeMs=round(queue_time_s * 1000),
            inferenceTimeMs=round(compute_time_s * 1000),
            totalTimeMs=round(total_time_s * 1000),
            worker=config.WORKER_ID,
        )
    finally:
        metrics.inference_active_requests.dec()
        await simulation_state.limiter.release()
