import type { NextFunction, Request, Response } from "express";

/**
 * A known, expected failure with an HTTP status and a stable machine-readable
 * code. Anything else falling into the error handler is treated as a bug and
 * reported as a generic 500 (never leaking internal details to the client).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Cannot ${req.method} ${req.path}` },
  });
}

// Express 5 forwards rejected promises from async route handlers here
// automatically, so routes/services can simply `throw`/reject. The unused
// `_req` parameter is required — Express only treats a 4-arg function as
// error-handling middleware.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error("Unhandled error", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
