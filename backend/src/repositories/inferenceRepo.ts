import { pool } from "../db.js";

export type InferenceStatus = "success" | "failed";

export interface InferenceRequestRow {
  id: string;
  model_version: string;
  input: string;
  prediction: string | null;
  confidence: number | null;
  status: InferenceStatus;
  queue_time_ms: number | null;
  compute_time_ms: number | null;
  latency_ms: number | null;
  worker: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface InsertInferenceRequestInput {
  id: string;
  modelVersion: string;
  input: string;
  status: InferenceStatus;
  prediction?: string | null;
  confidence?: number | null;
  queueTimeMs?: number | null;
  computeTimeMs?: number | null;
  latencyMs?: number | null;
  worker?: string | null;
  errorMessage?: string | null;
}

export async function insertInferenceRequest(data: InsertInferenceRequestInput): Promise<void> {
  await pool.query(
    `insert into inference_requests
       (id, model_version, input, prediction, confidence, status,
        queue_time_ms, compute_time_ms, latency_ms, worker, error_message)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      data.id,
      data.modelVersion,
      data.input,
      data.prediction ?? null,
      data.confidence ?? null,
      data.status,
      data.queueTimeMs ?? null,
      data.computeTimeMs ?? null,
      data.latencyMs ?? null,
      data.worker ?? null,
      data.errorMessage ?? null,
    ],
  );
}

export interface ListInferenceRequestsParams {
  page: number;
  limit: number;
  status?: InferenceStatus;
  model?: string;
}

export interface ListInferenceRequestsResult {
  items: InferenceRequestRow[];
  total: number;
}

export async function listInferenceRequests(
  params: ListInferenceRequestsParams,
): Promise<ListInferenceRequestsResult> {
  const conditions: string[] = [];
  const filterValues: unknown[] = [];

  if (params.status) {
    filterValues.push(params.status);
    conditions.push(`status = $${filterValues.length}`);
  }
  if (params.model) {
    filterValues.push(params.model);
    conditions.push(`model_version = $${filterValues.length}`);
  }
  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const offset = (params.page - 1) * params.limit;

  const itemsValues = [...filterValues, params.limit, offset];
  const limitPlaceholder = filterValues.length + 1;
  const offsetPlaceholder = filterValues.length + 2;

  const [itemsResult, countResult] = await Promise.all([
    pool.query<InferenceRequestRow>(
      `select * from inference_requests ${where}
       order by created_at desc
       limit $${limitPlaceholder} offset $${offsetPlaceholder}`,
      itemsValues,
    ),
    pool.query<{ count: number }>(
      `select count(*)::int as count from inference_requests ${where}`,
      filterValues,
    ),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0]?.count ?? 0,
  };
}

export async function getInferenceRequestById(id: string): Promise<InferenceRequestRow | null> {
  const result = await pool.query<InferenceRequestRow>(
    `select * from inference_requests where id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export interface WindowedStats {
  requestCount: number;
  successCount: number;
  p95LatencyMs: number | null;
  requestsPerSecond: number;
}

/** Aggregates over a trailing window, used for the dashboard and the health evaluator. */
export async function getWindowedStats(windowMinutes: number): Promise<WindowedStats> {
  const result = await pool.query<{
    request_count: number;
    success_count: number;
    p95_latency_ms: number | null;
  }>(
    `select
       count(*)::int as request_count,
       count(*) filter (where status = 'success')::int as success_count,
       percentile_cont(0.95) within group (order by latency_ms)
         filter (where latency_ms is not null) as p95_latency_ms
     from inference_requests
     where created_at >= now() - make_interval(mins => $1::int)`,
    [windowMinutes],
  );

  const row = result.rows[0];
  const requestCount = row?.request_count ?? 0;

  return {
    requestCount,
    successCount: row?.success_count ?? 0,
    p95LatencyMs: row?.p95_latency_ms != null ? Number(row.p95_latency_ms) : null,
    requestsPerSecond: requestCount / (windowMinutes * 60),
  };
}

export async function getTotalRequestCount(): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `select count(*)::int as count from inference_requests`,
  );
  return result.rows[0]?.count ?? 0;
}

/** Most recently created active model version, formatted as e.g. "classifier-v1". */
export async function getActiveModelVersion(): Promise<string | null> {
  const result = await pool.query<{ name: string; version: string }>(
    `select name, version from model_versions
     where status = 'active'
     order by created_at desc
     limit 1`,
  );
  const row = result.rows[0];
  return row ? `${row.name}-${row.version}` : null;
}
