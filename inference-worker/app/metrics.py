"""The nine locked Prometheus metrics — see implementation-plan-services.md §7.

Do not add a metric here without removing one; do not add derived metrics
(success/error rate, RPS, p95/p99) — Prometheus computes those from the
histograms and counters below.
"""

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram

registry = CollectorRegistry()

# Buckets tuned for a tens-of-milliseconds workload (seconds).
LATENCY_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5)

inference_requests_total = Counter(
    "inference_requests_total",
    "Total inference requests handled, by outcome.",
    ["status", "model"],
    registry=registry,
)

inference_request_duration_seconds = Histogram(
    "inference_request_duration_seconds",
    "End-to-end request latency (queue + compute + overhead).",
    ["model"],
    buckets=LATENCY_BUCKETS,
    registry=registry,
)

inference_compute_duration_seconds = Histogram(
    "inference_compute_duration_seconds",
    "Time spent actually running the model.",
    ["model"],
    buckets=LATENCY_BUCKETS,
    registry=registry,
)

inference_queue_duration_seconds = Histogram(
    "inference_queue_duration_seconds",
    "Time spent waiting for a concurrency slot before inference started.",
    ["model"],
    buckets=LATENCY_BUCKETS,
    registry=registry,
)

inference_queue_depth = Gauge(
    "inference_queue_depth",
    "Requests currently waiting for a concurrency slot.",
    registry=registry,
)

inference_active_requests = Gauge(
    "inference_active_requests",
    "Requests currently holding a concurrency slot (queued or computing).",
    registry=registry,
)

inference_requests_rejected_total = Counter(
    "inference_requests_rejected_total",
    "Requests rejected without running inference.",
    ["reason"],
    registry=registry,
)

inference_model_info = Gauge(
    "inference_model_info",
    "Static info about the loaded model. Always 1 when present.",
    ["model", "version"],
    registry=registry,
)

inference_model_loaded = Gauge(
    "inference_model_loaded",
    "1 if the model is loaded and ready to serve, 0 otherwise.",
    registry=registry,
)
