import { useState } from "react";
import { ApiRequestError } from "../api/client";
import { PageIntro } from "../components/PageIntro";
import { DEFAULT_SIMULATION_CONFIG, useSimulation } from "../hooks/useSimulation";

const LATENCY_PRESETS = [0, 100, 300, 500];
const ERROR_RATE_PRESETS = [0, 0.05, 0.1, 0.25];
const CONCURRENCY_PRESETS = [5, 10, 20];

export default function SreLab() {
  const simulation = useSimulation();

  // null = "not touched yet by the user in this session" — display falls back
  // to the loaded config (or the default while it's still loading).
  const [latencyOverride, setLatencyOverride] = useState<number | null>(null);
  const [errorRateOverride, setErrorRateOverride] = useState<number | null>(null);
  const [concurrencyOverride, setConcurrencyOverride] = useState<number | null>(null);

  const additionalLatencyMs =
    latencyOverride ?? simulation.data?.additionalLatencyMs ?? DEFAULT_SIMULATION_CONFIG.additionalLatencyMs;
  const errorRate = errorRateOverride ?? simulation.data?.errorRate ?? DEFAULT_SIMULATION_CONFIG.errorRate;
  const maxConcurrency =
    concurrencyOverride ?? simulation.data?.maxConcurrency ?? DEFAULT_SIMULATION_CONFIG.maxConcurrency;

  function handleApply() {
    simulation.update.mutate({ additionalLatencyMs, errorRate, maxConcurrency });
  }

  function handleReset() {
    setLatencyOverride(DEFAULT_SIMULATION_CONFIG.additionalLatencyMs);
    setErrorRateOverride(DEFAULT_SIMULATION_CONFIG.errorRate);
    setConcurrencyOverride(DEFAULT_SIMULATION_CONFIG.maxConcurrency);
    simulation.update.mutate({ ...DEFAULT_SIMULATION_CONFIG });
  }

  return (
    <div className="page">
      <h1>SRE Lab</h1>
      <PageIntro>
        Dial in artificial latency, failure rate, and concurrency limits to simulate a degraded
        service on demand. Changes apply immediately and affect every request platform-wide — use
        it to rehearse incidents, test alerting, or see autoscaling kick in. This is a controlled
        simulation, not a real outage.
      </PageIntro>

      {simulation.isLoading && <p className="page-status">Loading simulation config…</p>}
      {simulation.isError && simulation.data === undefined && (
        <p className="page-status page-status-error">Could not load the simulation config.</p>
      )}

      <section className="sre-lab-group">
        <h2>Additional latency</h2>
        <div className="preset-buttons">
          {LATENCY_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={additionalLatencyMs === value ? "preset-active" : ""}
              aria-pressed={additionalLatencyMs === value}
              onClick={() => setLatencyOverride(value)}
            >
              {value} ms
            </button>
          ))}
        </div>
      </section>

      <section className="sre-lab-group">
        <h2>Failure probability</h2>
        <div className="preset-buttons">
          {ERROR_RATE_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={errorRate === value ? "preset-active" : ""}
              aria-pressed={errorRate === value}
              onClick={() => setErrorRateOverride(value)}
            >
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
      </section>

      <section className="sre-lab-group">
        <h2>Max concurrent inference</h2>
        <div className="preset-buttons">
          {CONCURRENCY_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={maxConcurrency === value ? "preset-active" : ""}
              aria-pressed={maxConcurrency === value}
              onClick={() => setConcurrencyOverride(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <div className="sre-lab-actions">
        <button type="button" onClick={handleApply} disabled={simulation.update.isPending}>
          {simulation.update.isPending ? "Applying…" : "Apply"}
        </button>
        <button type="button" onClick={handleReset} disabled={simulation.update.isPending}>
          Reset to defaults
        </button>
      </div>

      {simulation.update.isError && (
        <p className="page-status page-status-error">
          {simulation.update.error instanceof ApiRequestError
            ? simulation.update.error.message
            : "Could not apply the simulation config."}
        </p>
      )}

      {simulation.update.isSuccess && (
        <p className="sre-lab-summary">
          Active: +{simulation.update.data.additionalLatencyMs}ms latency,{" "}
          {Math.round(simulation.update.data.errorRate * 100)}% error rate, max concurrency{" "}
          {simulation.update.data.maxConcurrency}.
        </p>
      )}
    </div>
  );
}
