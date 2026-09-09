import { Pool } from "pg";

// `DATABASE_URL` is preferred (e.g. postgres://user:pass@host:5432/db); the
// individual PG* vars are picked up automatically by `pg` as a fallback.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export async function checkPostgres(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Postgres health check failed", err);
    return false;
  }
}
