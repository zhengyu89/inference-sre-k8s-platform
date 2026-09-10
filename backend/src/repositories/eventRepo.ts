import { pool } from "../db.js";

export type EventSeverity = "info" | "warning" | "error";

export interface ServiceEventRow {
  id: number;
  event_type: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface InsertEventInput {
  eventType: string;
  severity: EventSeverity;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export async function insertEvent(input: InsertEventInput): Promise<void> {
  await pool.query(
    `insert into service_events (event_type, severity, message, metadata)
     values ($1, $2, $3, $4)`,
    [input.eventType, input.severity, input.message, input.metadata ? JSON.stringify(input.metadata) : null],
  );
}

export interface ListEventsParams {
  limit: number;
  severity?: EventSeverity;
}

export async function listEvents(params: ListEventsParams): Promise<ServiceEventRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.severity) {
    values.push(params.severity);
    conditions.push(`severity = $${values.length}`);
  }
  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

  values.push(params.limit);
  const result = await pool.query<ServiceEventRow>(
    `select * from service_events ${where} order by created_at desc limit $${values.length}`,
    values,
  );
  return result.rows;
}
