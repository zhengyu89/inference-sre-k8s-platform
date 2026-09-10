import { EVENT_THRESHOLDS } from "../config/index.js";
import {
  insertEvent,
  listEvents,
  type EventSeverity,
  type ListEventsParams,
  type ServiceEventRow,
} from "../repositories/eventRepo.js";
import { getWindowedStats } from "../repositories/inferenceRepo.js";

export interface RecordEventInput {
  eventType: string;
  severity: EventSeverity;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await insertEvent(input);
  } catch (err) {
    console.error(`Failed to record event ${input.eventType}`, err);
  }
}

export async function getEvents(params: ListEventsParams): Promise<ServiceEventRow[]> {
  return listEvents(params);
}

// --- Periodic health evaluator (backend plan §5.6) -------------------------
//
// Every 30s, looks at the trailing window and emits HIGH_ERROR_RATE /
// HIGH_LATENCY / SERVICE_RECOVERED. Separate "warning" and "clear" thresholds
// give it hysteresis so a value hovering right at the line doesn't flap.

type HealthState = "ok" | "high_error_rate" | "high_latency";

let currentState: HealthState = "ok";

export function startEventEvaluator(): () => void {
  const timer = setInterval(() => {
    evaluateHealth().catch((err) => console.error("Health evaluator failed", err));
  }, EVENT_THRESHOLDS.evaluationIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

async function evaluateHealth(): Promise<void> {
  const stats = await getWindowedStats(EVENT_THRESHOLDS.windowMinutes);
  if (stats.requestCount === 0) {
    return; // nothing in the window yet — don't flap into "recovered" from silence
  }

  const errorRate = 1 - stats.successCount / stats.requestCount;
  const p95 = stats.p95LatencyMs ?? 0;

  if (currentState === "ok" && errorRate >= EVENT_THRESHOLDS.errorRateWarning) {
    currentState = "high_error_rate";
    await recordEvent({
      eventType: "HIGH_ERROR_RATE",
      severity: "warning",
      message: `Error rate ${(errorRate * 100).toFixed(1)}% over the trailing ${EVENT_THRESHOLDS.windowMinutes}m`,
      metadata: { errorRate, requestCount: stats.requestCount },
    });
    return;
  }

  if (currentState === "ok" && p95 >= EVENT_THRESHOLDS.p95LatencyWarningMs) {
    currentState = "high_latency";
    await recordEvent({
      eventType: "HIGH_LATENCY",
      severity: "warning",
      message: `P95 latency ${p95.toFixed(0)}ms over the trailing ${EVENT_THRESHOLDS.windowMinutes}m`,
      metadata: { p95LatencyMs: p95 },
    });
    return;
  }

  const cleared = errorRate <= EVENT_THRESHOLDS.errorRateClear && p95 <= EVENT_THRESHOLDS.p95LatencyClearMs;
  if (currentState !== "ok" && cleared) {
    currentState = "ok";
    await recordEvent({
      eventType: "SERVICE_RECOVERED",
      severity: "info",
      message: "Error rate and latency are back within normal thresholds",
      metadata: { errorRate, p95LatencyMs: p95 },
    });
  }
}
