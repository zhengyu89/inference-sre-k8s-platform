import { randomUUID } from "node:crypto";
import { REDIS_KEYS, setJson } from "../redis.js";
import {
  abortStaleRunningLoadTests,
  finalizeLoadTest,
  getLoadTestById,
  insertLoadTest,
  listLoadTests,
  type LoadTestRow,
} from "../repositories/loadTestRepo.js";
import { recordEvent } from "./eventService.js";
import { runInference } from "./inferenceService.js";

export class LoadTestConflictError extends Error {}

export interface StartLoadTestInput {
  requestsPerSecond: number;
  durationSeconds: number;
  concurrency: number;
}

export interface LoadTestProgress {
  status: "running" | "completed" | "aborted" | "failed";
  sent: number;
  successful: number;
  failed: number;
  currentRps: number;
  averageLatencyMs: number;
}

interface RunningLoadTest {
  id: string;
  status: "running" | "completed" | "aborted" | "failed";
  concurrency: number;
  sent: number;
  successful: number;
  failed: number;
  latencies: number[];
  inFlight: number;
  startedAt: number;
  ticker: NodeJS.Timeout;
  progressTicker: NodeJS.Timeout;
  safetyTimer: NodeJS.Timeout;
}

// One active load test at a time (backend plan §5.4).
let active: RunningLoadTest | null = null;

export function hasActiveLoadTest(): boolean {
  return active !== null && active.status === "running";
}

function generateLoadTestId(): string {
  return `loadtest-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export async function startLoadTest(input: StartLoadTestInput): Promise<{ id: string; status: "running" }> {
  if (hasActiveLoadTest()) {
    throw new LoadTestConflictError("A load test is already running");
  }

  const id = generateLoadTestId();
  await insertLoadTest({
    id,
    requestsPerSecond: input.requestsPerSecond,
    durationSeconds: input.durationSeconds,
    concurrency: input.concurrency,
  });

  await recordEvent({
    eventType: "LOAD_TEST_STARTED",
    severity: "info",
    message: `Load test ${id} started: ${input.requestsPerSecond} rps, ${input.durationSeconds}s, concurrency ${input.concurrency}`,
    metadata: { ...input },
  });

  const test: RunningLoadTest = {
    id,
    status: "running",
    concurrency: input.concurrency,
    sent: 0,
    successful: 0,
    failed: 0,
    latencies: [],
    inFlight: 0,
    startedAt: Date.now(),
    ticker: null as unknown as NodeJS.Timeout,
    progressTicker: null as unknown as NodeJS.Timeout,
    safetyTimer: null as unknown as NodeJS.Timeout,
  };
  active = test;

  const endAt = test.startedAt + input.durationSeconds * 1000;
  const intervalMs = 1000 / input.requestsPerSecond;

  test.ticker = setInterval(() => {
    dispatchTick(test, endAt);
  }, intervalMs);

  test.progressTicker = setInterval(() => {
    writeProgress(test).catch((err) => console.error(`Load test ${id} progress write failed`, err));
  }, 1000);

  // Belt-and-braces: guarantee the test finalizes even if a tick is missed
  // right at the boundary.
  test.safetyTimer = setTimeout(() => {
    finishTest(test, "completed").catch((err) => console.error(`Load test ${id} finalize failed`, err));
  }, input.durationSeconds * 1000 + 1000);

  return { id, status: "running" };
}

function dispatchTick(test: RunningLoadTest, endAt: number): void {
  if (test.status !== "running") {
    return;
  }
  if (Date.now() >= endAt) {
    finishTest(test, "completed").catch((err) => console.error(`Load test ${test.id} finalize failed`, err));
    return;
  }
  if (test.inFlight >= test.concurrency) {
    // Semaphore full — skip this tick rather than queue unboundedly.
    return;
  }

  test.inFlight++;
  test.sent++;
  const dispatchedAt = Date.now();

  // Goes through the same inferenceService path as the playground, so this
  // traffic is real and gets persisted like any other request.
  runInference("load-test synthetic input")
    .then(() => {
      test.successful++;
      test.latencies.push(Date.now() - dispatchedAt);
    })
    .catch(() => {
      test.failed++;
      test.latencies.push(Date.now() - dispatchedAt);
    })
    .finally(() => {
      test.inFlight--;
    });
}

async function writeProgress(test: RunningLoadTest): Promise<void> {
  const elapsedSeconds = Math.max(1, (Date.now() - test.startedAt) / 1000);
  const progress: LoadTestProgress = {
    status: test.status,
    sent: test.sent,
    successful: test.successful,
    failed: test.failed,
    currentRps: Number((test.sent / elapsedSeconds).toFixed(2)),
    averageLatencyMs: average(test.latencies),
  };
  await setJson(REDIS_KEYS.loadTestProgress(test.id), progress, 3600).catch((err) => {
    console.error(`Failed to write load test progress for ${test.id}`, err);
  });
}

async function finishTest(test: RunningLoadTest, status: "completed" | "aborted"): Promise<void> {
  if (test.status !== "running") {
    return;
  }
  test.status = status;
  clearInterval(test.ticker);
  clearInterval(test.progressTicker);
  clearTimeout(test.safetyTimer);

  // Give in-flight requests a brief window to settle before finalizing totals.
  const settleDeadline = Date.now() + 5000;
  while (test.inFlight > 0 && Date.now() < settleDeadline) {
    await sleep(100);
  }

  await writeProgress(test);
  await finalizeLoadTest(test.id, {
    status,
    sent: test.sent,
    successful: test.successful,
    failed: test.failed,
    averageLatencyMs: test.latencies.length > 0 ? average(test.latencies) : null,
  });

  await recordEvent({
    eventType: "LOAD_TEST_COMPLETED",
    severity: status === "aborted" ? "warning" : "info",
    message: `Load test ${test.id} ${status}: ${test.sent} sent, ${test.successful} successful, ${test.failed} failed`,
    metadata: { sent: test.sent, successful: test.successful, failed: test.failed },
  });

  if (active?.id === test.id) {
    active = null;
  }
}

/** Called on SIGTERM/SIGINT so a running test lands as `aborted` rather than
 * being left `running` forever (backend plan §5.4). */
export async function abortActiveLoadTest(): Promise<void> {
  if (!active || active.status !== "running") {
    return;
  }
  await finishTest(active, "aborted");
}

/** Marks any test left `running` by a crashed previous process as `aborted`. */
export async function recoverStaleLoadTests(): Promise<void> {
  await abortStaleRunningLoadTests();
}

export async function getLoadTestStatus(id: string): Promise<LoadTestProgress | null> {
  if (active?.id === id) {
    const elapsedSeconds = Math.max(1, (Date.now() - active.startedAt) / 1000);
    return {
      status: active.status,
      sent: active.sent,
      successful: active.successful,
      failed: active.failed,
      currentRps: Number((active.sent / elapsedSeconds).toFixed(2)),
      averageLatencyMs: average(active.latencies),
    };
  }

  const row = await getLoadTestById(id);
  return row ? toProgress(row) : null;
}

export async function listLoadTestHistory(limit = 50): Promise<LoadTestRow[]> {
  return listLoadTests(limit);
}

function toProgress(row: LoadTestRow): LoadTestProgress {
  return {
    status: row.status,
    sent: row.requests_sent,
    successful: row.requests_successful,
    failed: row.requests_failed,
    currentRps: 0,
    averageLatencyMs: row.average_latency_ms ?? 0,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
