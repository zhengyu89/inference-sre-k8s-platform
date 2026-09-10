import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { ApiError } from "./errorHandler.js";

interface ValidateTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Parses `req.body`/`req.query`/`req.params` against the given zod schemas,
 * replacing each with its parsed (and coerced/defaulted) value, or forwards
 * a 400 ApiError describing the first validation failures.
 */
export function validate(targets: ValidateTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.body) {
        req.body = targets.body.parse(req.body);
      }
      if (targets.query) {
        const parsed = targets.query.parse(req.query);
        // Express 5 exposes `req.query` as a getter-only property on its
        // prototype (no setter) — shadow it on this request instance instead
        // of assigning, which would throw in ESM's strict mode.
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (targets.params) {
        req.params = targets.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues
          .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
          .join("; ");
        next(new ApiError(400, "VALIDATION_ERROR", message));
        return;
      }
      next(err);
    }
  };
}
