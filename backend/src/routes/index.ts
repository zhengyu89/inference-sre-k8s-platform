import { Router } from "express";
import { dashboardRouter } from "./dashboard.js";
import { eventsRouter } from "./events.js";
import { inferenceRouter } from "./inference.js";
import { loadTestsRouter } from "./loadTests.js";
import { simulationRouter } from "./simulation.js";

// Mounted at /api/v1 in index.ts. /health and /health/ready stay at the
// root — Kubernetes probes them directly, not through this router.
export const apiRouter = Router();

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/inference", inferenceRouter);
apiRouter.use("/load-tests", loadTestsRouter);
apiRouter.use("/simulation", simulationRouter);
apiRouter.use("/events", eventsRouter);
