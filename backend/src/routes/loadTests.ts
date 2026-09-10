import { Router } from "express";
import { z } from "zod";
import { LOAD_TEST_BOUNDS } from "../config/index.js";
import { ApiError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import type { LoadTestRow } from "../repositories/loadTestRepo.js";
import { LoadTestConflictError, getLoadTestStatus, listLoadTestHistory, startLoadTest } from "../services/loadTestRunner.js";

export const loadTestsRouter = Router();

const startLoadTestSchema = z.object({
  requestsPerSecond: z.coerce
    .number()
    .int()
    .min(LOAD_TEST_BOUNDS.requestsPerSecond.min)
    .max(LOAD_TEST_BOUNDS.requestsPerSecond.max),
  durationSeconds: z.coerce
    .number()
    .int()
    .min(LOAD_TEST_BOUNDS.durationSeconds.min)
    .max(LOAD_TEST_BOUNDS.durationSeconds.max),
  concurrency: z.coerce
    .number()
    .int()
    .min(LOAD_TEST_BOUNDS.concurrency.min)
    .max(LOAD_TEST_BOUNDS.concurrency.max),
});

loadTestsRouter.post("/", validate({ body: startLoadTestSchema }), async (req, res, next) => {
  try {
    const result = await startLoadTest(req.body);
    res.json(result);
  } catch (err) {
    if (err instanceof LoadTestConflictError) {
      next(new ApiError(409, "LOAD_TEST_IN_PROGRESS", err.message));
      return;
    }
    next(err);
  }
});

loadTestsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listLoadTestHistory();
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

const idParamsSchema = z.object({ id: z.string().min(1) });

loadTestsRouter.get("/:id", validate({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const status = await getLoadTestStatus(id);
    if (!status) {
      next(new ApiError(404, "NOT_FOUND", `No load test with id ${id}`));
      return;
    }
    res.json(status);
  } catch (err) {
    next(err);
  }
});

function toDto(row: LoadTestRow) {
  return {
    id: row.id,
    requestsPerSecond: row.requests_per_second,
    durationSeconds: row.duration_seconds,
    concurrency: row.concurrency,
    status: row.status,
    sent: row.requests_sent,
    successful: row.requests_successful,
    failed: row.requests_failed,
    averageLatencyMs: row.average_latency_ms,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
