import { Router } from "express";
import { EVENT_THRESHOLDS, SIMULATION_DEFAULTS } from "../config/index.js";
import { getGaugeSafe, REDIS_KEYS } from "../redis.js";
import { getActiveModelVersion, getTotalRequestCount, getWindowedStats } from "../repositories/inferenceRepo.js";
import { getSimulationConfig } from "../services/simulationService.js";
import { getWorkerHealthCached } from "../services/workerClient.js";
import type { WorkerSimulationConfig } from "../services/workerClient.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    const [totalRequests, windowed, activeRequests, queueDepth, workerHealth, modelVersion, simulationConfig] =
      await Promise.all([
        getTotalRequestCount(),
        getWindowedStats(EVENT_THRESHOLDS.windowMinutes),
        getGaugeSafe(REDIS_KEYS.activeRequests),
        getGaugeSafe(REDIS_KEYS.queueDepth),
        getWorkerHealthCached(),
        getActiveModelVersion(),
        getSimulationConfig().catch(() => null),
      ]);

    const successRate = windowed.requestCount > 0 ? windowed.successCount / windowed.requestCount : 1;
    const errorRate = 1 - successRate;

    let serviceStatus: "healthy" | "degraded" | "down";
    if (!workerHealth.ready) {
      serviceStatus = "down";
    } else if (
      errorRate >= EVENT_THRESHOLDS.errorRateWarning ||
      (simulationConfig !== null && !isDefaultSimulation(simulationConfig))
    ) {
      serviceStatus = "degraded";
    } else {
      serviceStatus = "healthy";
    }

    res.json({
      serviceStatus,
      modelVersion: modelVersion ?? "unknown",
      workerReplicas: 1, // until Kubernetes (backend plan §5.1)
      requestsPerSecond: Number(windowed.requestsPerSecond.toFixed(2)),
      totalRequests,
      successRate: Number(successRate.toFixed(4)),
      p95LatencyMs: windowed.p95LatencyMs != null ? Math.round(windowed.p95LatencyMs) : 0,
      activeRequests,
      queueDepth,
    });
  } catch (err) {
    next(err);
  }
});

function isDefaultSimulation(cfg: WorkerSimulationConfig): boolean {
  return (
    cfg.additionalLatencyMs === SIMULATION_DEFAULTS.additionalLatencyMs &&
    cfg.errorRate === SIMULATION_DEFAULTS.errorRate &&
    cfg.maxConcurrency === SIMULATION_DEFAULTS.maxConcurrency
  );
}
