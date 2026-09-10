import { getJsonSafe, REDIS_KEYS, setJson } from "../redis.js";
import { recordEvent } from "./eventService.js";
import {
  getWorkerSimulationConfig,
  putWorkerSimulationConfig,
  type WorkerSimulationConfig,
} from "./workerClient.js";

/** The worker is the source of truth; Redis only caches its last-known value
 * so GET is cheap. If the cache is cold (e.g. after a Redis restart), fall
 * back to asking the worker directly. */
export async function getSimulationConfig(): Promise<WorkerSimulationConfig> {
  const cached = await getJsonSafe<WorkerSimulationConfig>(REDIS_KEYS.simulationConfig);
  if (cached) {
    return cached;
  }
  return getWorkerSimulationConfig();
}

export async function updateSimulationConfig(input: WorkerSimulationConfig): Promise<WorkerSimulationConfig> {
  const applied = await putWorkerSimulationConfig(input);

  // Only cache on a successful worker update — a cached value must never
  // outrun what the worker actually applied.
  await setJson(REDIS_KEYS.simulationConfig, applied).catch((err) => {
    console.error("Failed to cache simulation config in Redis", err);
  });

  await recordEvent({
    eventType: "SIMULATION_UPDATED",
    severity: "info",
    message: `Simulation config updated: latency=${applied.additionalLatencyMs}ms, errorRate=${applied.errorRate}, maxConcurrency=${applied.maxConcurrency}`,
    metadata: { ...applied },
  });

  return applied;
}
