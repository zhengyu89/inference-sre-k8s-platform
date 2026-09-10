import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import type { InferenceRequestRow } from "../repositories/inferenceRepo.js";
import { getInferenceById, getInferenceHistory, InferenceFailure, runInference } from "../services/inferenceService.js";

export const inferenceRouter = Router();

const createInferenceSchema = z.object({
  input: z.string().trim().min(1, "input must not be empty").max(4096, "input must be at most 4KB"),
});

inferenceRouter.post("/", validate({ body: createInferenceSchema }), async (req, res, next) => {
  try {
    const result = await runInference(req.body.input);
    res.json(result);
  } catch (err) {
    if (err instanceof InferenceFailure) {
      next(new ApiError(err.httpStatus, err.code, err.message));
      return;
    }
    next(err);
  }
});

const listInferenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["success", "failed"]).optional(),
  model: z.string().min(1).optional(),
});

inferenceRouter.get("/", validate({ query: listInferenceQuerySchema }), async (req, res, next) => {
  try {
    const { page, limit, status, model } = req.query as unknown as z.infer<typeof listInferenceQuerySchema>;
    const { items, total } = await getInferenceHistory({ page, limit, status, model });
    res.json({ items: items.map(toSummaryDto), page, limit, total });
  } catch (err) {
    next(err);
  }
});

const idParamsSchema = z.object({ id: z.string().min(1) });

inferenceRouter.get("/:id", validate({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await getInferenceById(id);
    if (!row) {
      next(new ApiError(404, "NOT_FOUND", `No inference request with id ${id}`));
      return;
    }
    res.json(toDetailDto(row));
  } catch (err) {
    next(err);
  }
});

function toSummaryDto(row: InferenceRequestRow) {
  return {
    requestId: row.id,
    model: row.model_version,
    prediction: row.prediction,
    confidence: row.confidence,
    status: row.status,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

function toDetailDto(row: InferenceRequestRow) {
  return {
    requestId: row.id,
    model: row.model_version,
    input: row.input,
    prediction: row.prediction,
    confidence: row.confidence,
    status: row.status,
    queueTimeMs: row.queue_time_ms,
    computeTimeMs: row.compute_time_ms,
    latencyMs: row.latency_ms,
    worker: row.worker,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
