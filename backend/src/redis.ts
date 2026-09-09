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
