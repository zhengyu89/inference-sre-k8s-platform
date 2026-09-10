import { createClient } from "redis";

export const redisClient = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis client error", err);
});

export async function checkRedis(): Promise<boolean> {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
    return true;
  } catch (err) {
    console.error("Redis health check failed", err);
    return false;
  }
}

// Redis holds only ephemeral state (services plan §10) — every key here must
// be reconstructible or safely absent. This is the only module that touches
// Redis keys directly; everything else goes through these typed helpers.
export const REDIS_KEYS = {
  activeRequests: "inference:requests:active",
  queueDepth: "inference:queue:depth",
  simulationConfig: "simulation:config",
  dashboardSummary: "dashboard:summary",
  loadTestProgress: (id: string): string => `loadtest:${id}:progress`,
} as const;

// A crash mid-request otherwise leaks a permanently elevated gauge — reset
// both counters to 0 on every boot.
export async function resetRequestCounters(): Promise<void> {
  await redisClient.mSet({
    [REDIS_KEYS.activeRequests]: "0",
    [REDIS_KEYS.queueDepth]: "0",
  });
}

export async function incrActiveRequests(): Promise<void> {
  try {
    await redisClient.incr(REDIS_KEYS.activeRequests);
  } catch (err) {
    console.error("Failed to increment active-requests gauge", err);
  }
}

export async function decrActiveRequests(): Promise<void> {
  try {
    await redisClient.decr(REDIS_KEYS.activeRequests);
  } catch (err) {
    console.error("Failed to decrement active-requests gauge", err);
  }
}

// Every read tolerates a missing key/unreachable Redis and falls back to a
// default, per the key-contract rules in the services plan.
export async function getGaugeSafe(key: string): Promise<number> {
  try {
    const value = await redisClient.get(key);
    return value ? parseInt(value, 10) : 0;
  } catch (err) {
    console.error(`Failed to read Redis gauge ${key}`, err);
    return 0;
  }
}

export async function getJsonSafe<T>(key: string): Promise<T | null> {
  try {
    const value = await redisClient.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (err) {
    console.error(`Failed to read Redis key ${key}`, err);
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await redisClient.set(key, payload, { EX: ttlSeconds });
  } else {
    await redisClient.set(key, payload);
  }
}
