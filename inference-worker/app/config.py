"""Environment configuration for the inference worker.

Parsed once at import time so a bad value fails at startup rather than mid-request.
"""

import os


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return float(raw)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return int(raw)


MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "classifier.onnx"),
)
MODEL_NAME = os.environ.get("MODEL_NAME", "classifier")
MODEL_VERSION = os.environ.get("MODEL_VERSION", "v1")
WORKER_ID = os.environ.get("WORKER_ID", "worker-01")

# Default simulation config — all "off" until an operator turns them on via PUT /simulation.
DEFAULT_ADDITIONAL_LATENCY_MS = _env_int("DEFAULT_ADDITIONAL_LATENCY_MS", 0)
DEFAULT_ERROR_RATE = _env_float("DEFAULT_ERROR_RATE", 0.0)
DEFAULT_MAX_CONCURRENCY = _env_int("DEFAULT_MAX_CONCURRENCY", 10)

# Bounds enforced on PUT /simulation — see implementation-plan-services.md §6.
MAX_ADDITIONAL_LATENCY_MS = 5000
MAX_ERROR_RATE = 1.0
MIN_MAX_CONCURRENCY = 1
MAX_MAX_CONCURRENCY = 100

# Requests that can't acquire the concurrency semaphore within this window are
# rejected (429) rather than queued indefinitely.
QUEUE_WAIT_TIMEOUT_S = _env_float("QUEUE_WAIT_TIMEOUT_S", 2.0)

MODEL_VERSION_LABEL = f"{MODEL_NAME}-{MODEL_VERSION}"
