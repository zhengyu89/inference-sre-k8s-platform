import { Link, useParams } from "react-router-dom";
import { useRequest } from "../hooks/useRequest";
import { formatLatency, formatTime } from "../lib/format";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const request = useRequest(id);

  return (
    <div className="page">
      <p className="breadcrumb">
        <Link to="/requests">&larr; Back to Requests</Link>
      </p>
      <h1>Request {id}</h1>

      {request.isLoading && <p className="page-status">Loading request…</p>}
      {request.isError && <p className="page-status page-status-error">Could not load this request.</p>}

      {request.data && (
        <dl className="result-grid">
          <dt>Request</dt>
          <dd>{request.data.requestId}</dd>
          <dt>Model</dt>
          <dd>{request.data.model}</dd>
          <dt>Status</dt>
          <dd>{request.data.status}</dd>
          <dt>Input</dt>
          <dd className="result-grid-wide">{request.data.input}</dd>
          <dt>Prediction</dt>
          <dd>{request.data.prediction ?? "—"}</dd>
          <dt>Confidence</dt>
          <dd>{request.data.confidence !== null ? `${(request.data.confidence * 100).toFixed(1)}%` : "—"}</dd>
          <dt>Queue time</dt>
          <dd>{formatLatency(request.data.queueTimeMs)}</dd>
          <dt>Compute time</dt>
          <dd>{formatLatency(request.data.computeTimeMs)}</dd>
          <dt>Total latency</dt>
          <dd>{formatLatency(request.data.latencyMs)}</dd>
          <dt>Worker</dt>
          <dd>{request.data.worker ?? "—"}</dd>
          <dt>Time</dt>
          <dd>{formatTime(request.data.createdAt)}</dd>
          {request.data.status === "failed" && (
            <>
              <dt>Error</dt>
              <dd className="result-grid-wide result-error">{request.data.errorMessage ?? "Unknown error"}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
