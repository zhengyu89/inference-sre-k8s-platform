import express, { type Request, type Response } from "express";
import { config } from "./config/index.js";
import { checkPostgres, pool } from "./db.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { checkRedis, redisClient, resetRequestCounters } from "./redis.js";
import { apiRouter } from "./routes/index.js";
import { startEventEvaluator } from "./services/eventService.js";
import { abortActiveLoadTest, recoverStaleLoadTests } from "./services/loadTestRunner.js";

const app = express();
const port = config.PORT;

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

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

// Connect to Redis at startup, but don't block/crash the server if it isn't
// reachable yet — /health/ready will report it as down until it connects.
// Once connected, reset the ephemeral counters this process owns: a prior
// crash mid-request can otherwise leave inference:requests:active (or
// inference:queue:depth) permanently elevated. See services plan §10.
redisClient
  .connect()
  .then(() => resetRequestCounters())
  .catch((err) => {
    console.error("Initial Redis connection failed", err);
  });

// A load test left `running` by a crashed previous process should not
// linger forever — mark it `aborted` on boot.
recoverStaleLoadTests().catch((err) => {
  console.error("Failed to recover stale load tests", err);
});

const stopEventEvaluator = startEventEvaluator();

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    console.log("HTTP server closed");
  });

  stopEventEvaluator();

  try {
    await abortActiveLoadTest();
  } catch (err) {
    console.error("Error aborting active load test", err);
  }

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
