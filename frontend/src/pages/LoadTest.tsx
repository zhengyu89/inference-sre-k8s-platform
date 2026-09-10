import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../api/client";
import { Field } from "../components/Field";
import { PageIntro } from "../components/PageIntro";
import { useLoadTest } from "../hooks/useLoadTest";
import { formatLatency } from "../lib/format";

const BOUNDS = {
  requestsPerSecond: { min: 1, max: 200, default: 20 },
  durationSeconds: { min: 1, max: 300, default: 60 },
  concurrency: { min: 1, max: 50, default: 5 },
};

export default function LoadTest() {
  const { start, progress, reset } = useLoadTest();
  const [requestsPerSecond, setRequestsPerSecond] = useState(BOUNDS.requestsPerSecond.default);
  const [durationSeconds, setDurationSeconds] = useState(BOUNDS.durationSeconds.default);
  const [concurrency, setConcurrency] = useState(BOUNDS.concurrency.default);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const isRunning = progress.data?.status === "running";

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startedAtRef.current = Date.now();
    setElapsed(0);
    start.mutate({ requestsPerSecond, durationSeconds, concurrency });
  }

  function handleRunAgain() {
    startedAtRef.current = null;
    setElapsed(0);
    reset();
  }

  const started = start.isSuccess || isRunning || progress.data !== undefined;

  return (
    <div className="page">
      <h1>Load Testing</h1>
      <PageIntro>
        Generate synthetic traffic against the inference service to see how it holds up under
        load — set a target rate, duration, and concurrency, then watch throughput, failures, and
        latency update as the test runs.
      </PageIntro>

      {!started && (
        <form className="form" onSubmit={handleSubmit}>
          <Field label="Requests per second" htmlFor="rps" hint={`${BOUNDS.requestsPerSecond.min}–${BOUNDS.requestsPerSecond.max}`}>
            <input
              id="rps"
              type="number"
              min={BOUNDS.requestsPerSecond.min}
              max={BOUNDS.requestsPerSecond.max}
              value={requestsPerSecond}
              onChange={(event) => setRequestsPerSecond(Number(event.target.value))}
            />
          </Field>
          <Field label="Duration (sec)" htmlFor="duration" hint={`${BOUNDS.durationSeconds.min}–${BOUNDS.durationSeconds.max}`}>
            <input
              id="duration"
              type="number"
              min={BOUNDS.durationSeconds.min}
              max={BOUNDS.durationSeconds.max}
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Number(event.target.value))}
            />
          </Field>
          <Field label="Concurrency" htmlFor="concurrency" hint={`${BOUNDS.concurrency.min}–${BOUNDS.concurrency.max}`}>
            <input
              id="concurrency"
              type="number"
              min={BOUNDS.concurrency.min}
              max={BOUNDS.concurrency.max}
              value={concurrency}
              onChange={(event) => setConcurrency(Number(event.target.value))}
            />
          </Field>
          <button type="submit" disabled={start.isPending}>
            {start.isPending ? "Starting…" : "Start Test"}
          </button>
        </form>
      )}

      {start.isError && (
        <p className="page-status page-status-error">
          {start.error instanceof ApiRequestError ? start.error.message : "Could not start the load test."}
        </p>
      )}

      {started && progress.data && (
        <section className="result-panel">
          <p className="load-test-status">Status: {progress.data.status.toUpperCase()}</p>
          <dl className="result-grid">
            <dt>Elapsed</dt>
            <dd>{elapsed} sec</dd>
            <dt>Sent</dt>
            <dd>{progress.data.sent}</dd>
            <dt>Succeeded</dt>
            <dd>{progress.data.successful}</dd>
            <dt>Failed</dt>
            <dd>{progress.data.failed}</dd>
            <dt>Current RPS</dt>
            <dd>{progress.data.currentRps.toFixed(1)}</dd>
            <dt>Avg latency</dt>
            <dd>{formatLatency(progress.data.averageLatencyMs)}</dd>
          </dl>

          {!isRunning && (
            <button type="button" onClick={handleRunAgain}>
              Run again
            </button>
          )}
        </section>
      )}

      {started && progress.isLoading && !progress.data && <p className="page-status">Starting…</p>}
    </div>
  );
}
