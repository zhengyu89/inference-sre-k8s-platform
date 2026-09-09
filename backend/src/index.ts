import express, { type Request, type Response } from "express";
import { checkPostgres, pool } from "./db.js";
import { checkRedis, redisClient } from "./redis.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

// Liveness: process is up. Must not depend on Postgres/Redis, or a
// transient DB/cache outage would get the pod killed by Kubernetes too.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Readiness: process is up AND its dependencies are reachable. Used for the
// Kubernetes readiness probe, and by the frontend to display connectivity.
app.get("/health/ready", async (_req: Request, res: Response) => {
  const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);
  const ready = postgres && redis;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "error",
    postgres: postgres ? "ok" : "error",
    redis: redis ? "ok" : "error",
  });
});

const server = app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

// Connect to Redis at startup, but don't block/crash the server if it isn't
// reachable yet — /health/ready will report it as down until it connects.
redisClient.connect().catch((err) => {
  console.error("Initial Redis connection failed", err);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    console.log("HTTP server closed");
  });

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (err) {
    console.error("Error closing Redis client", err);
  }

  try {
    await pool.end();
  } catch (err) {
    console.error("Error closing Postgres pool", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
