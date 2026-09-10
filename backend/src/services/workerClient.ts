import { config } from "../config/index.js";

/** The Python inference worker is not yet built (services plan, phase W1) —
 * this client talks to its documented contract so the backend is ready the
 * moment `WORKER_URL` points at a real worker. Until then every call fails
 * with WorkerError("unreachable"), which the callers already handle as a
 * normal (502) outcome. */

export interface WorkerInferRequest {
  requestId: string;
  input: string;
}

export interface WorkerInferResponse {
  requestId: string;
  modelVersion: string;
  prediction: string;
  confidence: number;
  queueTimeMs: number;
  inferenceTimeMs: number;
  totalTimeMs: number;
  worker: string;
}

export interface WorkerSimulationConfig {
  additionalLatencyMs: number;
  errorRate: number;
  maxConcurrency: number;
}

export interface WorkerHealth {
  ready: boolean;
  modelLoaded?: boolean;
}

export type WorkerErrorKind = "unreachable" | "timeout" | "rejected" | "http_error";

export class WorkerError extends Error {
  readonly kind: WorkerErrorKind;
  readonly status?: number;

  constructor(kind: WorkerErrorKind, message: string, status?: number) {
    super(message);
    this.name = "WorkerError";
    this.kind = kind;
    this.status = status;
  }
}

/** Maps a WorkerError to the API-facing (status, code, message) triple used
 * across the inference, load-test and simulation routes. */
export function describeWorkerError(err: WorkerError): { httpStatus: number; code: string; message: string } {
  switch (err.kind) {
    case "timeout":
      return { httpStatus: 504, code: "WORKER_TIMEOUT", message: err.message };
    case "rejected":
      return { httpStatus: 429, code: "WORKER_REJECTED", message: err.message };
    case "unreachable":
    case "http_error":
    default:
      return { httpStatus: 502, code: "WORKER_ERROR", message: err.message };
  }
}

async function workerFetch(path: string, init: RequestInit, timeoutMs = config.INFERENCE_TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(`${config.WORKER_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new WorkerError("timeout", `Worker request to ${path} timed out after ${timeoutMs}ms`);
    }
    throw new WorkerError("unreachable", `Worker unreachable at ${path}: ${(err as Error).message}`);
  }
}

export async function inferViaWorker(req: WorkerInferRequest): Promise<WorkerInferResponse> {
  const response = await workerFetch("/infer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });

  if (response.status === 429) {
    throw new WorkerError("rejected", "Worker rejected the request for capacity", 429);
  }
  if (!response.ok) {
    throw new WorkerError("http_error", `Worker returned ${response.status}`, response.status);
  }
  return (await response.json()) as WorkerInferResponse;
}

export async function getWorkerSimulationConfig(): Promise<WorkerSimulationConfig> {
  const response = await workerFetch("/simulation", { method: "GET" });
  if (!response.ok) {
    throw new WorkerError("http_error", `Worker returned ${response.status}`, response.status);
  }
  return (await response.json()) as WorkerSimulationConfig;
}

export async function putWorkerSimulationConfig(cfg: WorkerSimulationConfig): Promise<WorkerSimulationConfig> {
  const response = await workerFetch("/simulation", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!response.ok) {
    throw new WorkerError("http_error", `Worker returned ${response.status}`, response.status);
  }
  return (await response.json()) as WorkerSimulationConfig;
}

let healthCache: { value: WorkerHealth; expiresAt: number } | null = null;

/** `/health/ready`, cached ~2s (backend plan §5.1) so the dashboard endpoint
 * doesn't hammer the worker on every poll. */
export async function getWorkerHealthCached(): Promise<WorkerHealth> {
  if (healthCache && healthCache.expiresAt > Date.now()) {
    return healthCache.value;
  }

  let value: WorkerHealth;
  try {
    const response = await workerFetch("/health/ready", { method: "GET" }, 2000);
    if (!response.ok) {
      value = { ready: false };
    } else {
      const body = (await response.json()) as { status: string; modelLoaded?: boolean };
      value = { ready: body.status === "ready", modelLoaded: body.modelLoaded };
    }
  } catch {
    value = { ready: false };
  }

  healthCache = { value, expiresAt: Date.now() + 2000 };
  return value;
}
