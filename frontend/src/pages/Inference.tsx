import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, ApiRequestError } from "../api/client";
import type { InferenceResult } from "../api/types";
import { Field } from "../components/Field";
import { PageIntro } from "../components/PageIntro";
import { useSummary } from "../hooks/useSummary";
import { formatLatency } from "../lib/format";

export default function Inference() {
  const summary = useSummary();
  const [input, setInput] = useState("");

  const submit = useMutation({
    mutationFn: (body: { input: string }) => apiClient.post<InferenceResult>("/inference", body),
  });

  const modelOptions = summary.data ? [summary.data.modelVersion] : [];

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    submit.mutate({ input });
  }

  return (
    <div className="page">
      <h1>Inference Playground</h1>
      <PageIntro>
        Send a single request straight to the model and see exactly what comes back — prediction,
        confidence, and latency — without generating any background traffic. Useful for quickly
        trying an input or verifying the service is responding correctly.
      </PageIntro>

      <form className="form" onSubmit={handleSubmit}>
        <Field label="Model" htmlFor="model">
          <select id="model" disabled={modelOptions.length === 0}>
            {modelOptions.length === 0 ? (
              <option value="">Unknown</option>
            ) : (
              modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            )}
          </select>
        </Field>

        <Field label="Input" htmlFor="input">
          <textarea
            id="input"
            rows={6}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter inference input…"
          />
        </Field>

        <button type="submit" disabled={submit.isPending || !input.trim()}>
          {submit.isPending ? "Submitting…" : "Submit"}
        </button>
      </form>

      {submit.isError && (
        <p className="page-status page-status-error">
          {submit.error instanceof ApiRequestError ? submit.error.message : "Request failed."}
        </p>
      )}

      {submit.isSuccess && (
        <section className="result-panel">
          <h2>Result</h2>
          <dl className="result-grid">
            <dt>Prediction</dt>
            <dd>{submit.data.prediction}</dd>
            <dt>Confidence</dt>
            <dd>{(submit.data.confidence * 100).toFixed(1)}%</dd>
            <dt>Latency</dt>
            <dd>{formatLatency(submit.data.latencyMs)}</dd>
            <dt>Model</dt>
            <dd>{submit.data.model}</dd>
            <dt>Request</dt>
            <dd>
              <Link to={`/requests/${submit.data.requestId}`}>{submit.data.requestId}</Link>
            </dd>
          </dl>
        </section>
      )}
    </div>
  );
}
