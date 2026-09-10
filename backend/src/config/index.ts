import { z } from "zod";

// Parsed and validated once at process start. Fail fast on a missing/invalid
// required value rather than surfacing it later as a confusing runtime error.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  WORKER_URL: z.string().url().default("http://localhost:8000"),
  INFERENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  LOAD_TEST_MAX_RPS: z.coerce.number().int().positive().default(200),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    console.error("Invalid environment configuration:", details);
    throw new Error(`Invalid environment configuration: ${details.join("; ")}`);
  }
  return parsed.data;
}

export const config = loadConfig();

// Bounds enforced at the API edge (zod) and defended again in the services
// that act on them, per the backend implementation plan §5.4/§5.5.
export const LOAD_TEST_BOUNDS = {
  requestsPerSecond: { min: 1, max: config.LOAD_TEST_MAX_RPS },
  durationSeconds: { min: 1, max: 300 },
  concurrency: { min: 1, max: 50 },
} as const;

export const SIMULATION_BOUNDS = {
  additionalLatencyMs: { min: 0, max: 5000 },
  errorRate: { min: 0, max: 1 },
  maxConcurrency: { min: 1, max: 100 },
} as const;

// The worker's simulation defaults (no injected latency/errors, default
// concurrency) — used by the dashboard to decide whether the service counts
// as "degraded" because someone left simulation active.
export const SIMULATION_DEFAULTS = {
  additionalLatencyMs: 0,
  errorRate: 0,
  maxConcurrency: 10,
} as const;

// Thresholds for the periodic health evaluator (backend plan §5.6). Separate
// "warning" and "clear" values give it hysteresis so it doesn't flap between
// HIGH_ERROR_RATE/HIGH_LATENCY and SERVICE_RECOVERED on every tick.
export const EVENT_THRESHOLDS = {
  windowMinutes: 5,
  evaluationIntervalMs: 30_000,
  errorRateWarning: 0.05,
  errorRateClear: 0.02,
  p95LatencyWarningMs: 500,
  p95LatencyClearMs: 250,
} as const;
