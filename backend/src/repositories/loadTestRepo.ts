import { pool } from "../db.js";

export type LoadTestStatus = "running" | "completed" | "aborted" | "failed";

export interface LoadTestRow {
  id: string;
  requests_per_second: number;
  duration_seconds: number;
  concurrency: number;
  status: LoadTestStatus;
  requests_sent: number;
  requests_successful: number;
  requests_failed: number;
  average_latency_ms: number | null;
  started_at: Date;
  completed_at: Date | null;
}

export interface InsertLoadTestInput {
  id: string;
  requestsPerSecond: number;
  durationSeconds: number;
  concurrency: number;
}

export async function insertLoadTest(input: InsertLoadTestInput): Promise<void> {
  await pool.query(
    `insert into load_tests (id, requests_per_second, duration_seconds, concurrency, status)
     values ($1, $2, $3, $4, 'running')`,
    [input.id, input.requestsPerSecond, input.durationSeconds, input.concurrency],
  );
}

export interface FinalizeLoadTestInput {
  status: Exclude<LoadTestStatus, "running">;
  sent: number;
  successful: number;
  failed: number;
  averageLatencyMs: number | null;
}

export async function finalizeLoadTest(id: string, data: FinalizeLoadTestInput): Promise<void> {
  await pool.query(
    `update load_tests
     set status = $2, requests_sent = $3, requests_successful = $4,
         requests_failed = $5, average_latency_ms = $6, completed_at = now()
     where id = $1`,
    [id, data.status, data.sent, data.successful, data.failed, data.averageLatencyMs],
  );
}

export async function getLoadTestById(id: string): Promise<LoadTestRow | null> {
  const result = await pool.query<LoadTestRow>(`select * from load_tests where id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listLoadTests(limit = 50): Promise<LoadTestRow[]> {
  const result = await pool.query<LoadTestRow>(
    `select * from load_tests order by started_at desc limit $1`,
    [limit],
  );
  return result.rows;
}

/** Any test still `running` at boot means the previous process died mid-test. */
export async function abortStaleRunningLoadTests(): Promise<void> {
  await pool.query(
    `update load_tests set status = 'aborted', completed_at = now() where status = 'running'`,
  );
}
