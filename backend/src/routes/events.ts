import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import type { ServiceEventRow } from "../repositories/eventRepo.js";
import { getEvents } from "../services/eventService.js";

export const eventsRouter = Router();

const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  severity: z.enum(["info", "warning", "error"]).optional(),
});

eventsRouter.get("/", validate({ query: listEventsQuerySchema }), async (req, res, next) => {
  try {
    const { limit, severity } = req.query as unknown as z.infer<typeof listEventsQuerySchema>;
    const rows = await getEvents({ limit, severity });
    res.json({ items: rows.map(toDto) });
  } catch (err) {
    next(err);
  }
});

function toDto(row: ServiceEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    severity: row.severity,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}
