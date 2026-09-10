import { Router } from "express";
import { z } from "zod";
import { SIMULATION_BOUNDS } from "../config/index.js";
import { ApiError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { getSimulationConfig, updateSimulationConfig } from "../services/simulationService.js";
import { describeWorkerError, WorkerError } from "../services/workerClient.js";

export const simulationRouter = Router();

simulationRouter.get("/", async (_req, res, next) => {
  try {
    const config = await getSimulationConfig();
    res.json(config);
  } catch (err) {
    next(toApiError(err));
  }
});

const updateSimulationSchema = z.object({
  additionalLatencyMs: z.coerce
    .number()
    .min(SIMULATION_BOUNDS.additionalLatencyMs.min)
    .max(SIMULATION_BOUNDS.additionalLatencyMs.max),
  errorRate: z.coerce.number().min(SIMULATION_BOUNDS.errorRate.min).max(SIMULATION_BOUNDS.errorRate.max),
  maxConcurrency: z.coerce
    .number()
    .int()
    .min(SIMULATION_BOUNDS.maxConcurrency.min)
    .max(SIMULATION_BOUNDS.maxConcurrency.max),
});

simulationRouter.put("/", validate({ body: updateSimulationSchema }), async (req, res, next) => {
  try {
    const config = await updateSimulationConfig(req.body);
    res.json(config);
  } catch (err) {
    next(toApiError(err));
  }
});

function toApiError(err: unknown): unknown {
  if (err instanceof WorkerError) {
    const { httpStatus, code, message } = describeWorkerError(err);
    return new ApiError(httpStatus, code, message);
  }
  return err;
}
