import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InferenceListItem, RequestStatus } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { useRequests } from "../hooks/useRequests";
import { formatLatency, formatTime } from "../lib/format";

const PAGE_SIZE = 20;

export default function Requests() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [model, setModel] = useState("");

  const requests = useRequests({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    model: model || undefined,
  });

  const total = requests.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stale = requests.isError && requests.data !== undefined;

  function handleFilterChange(next: { status?: RequestStatus | ""; model?: string }) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.model !== undefined) setModel(next.model);
    setPage(1);
  }

  return (
    <div className="page">
      <h1>Requests</h1>
      <PageIntro>
        Browse the full history of inference requests, filter by status or model, and click into
        any row for a full breakdown of queue time, compute time, and (for failures) the error.
      </PageIntro>

      <div className="filters">
        <label>
          Status
          <select
            value={status}
            onChange={(event) => handleFilterChange({ status: event.target.value as RequestStatus | "" })}
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>
          Model
          <input
            type="text"
            value={model}
            onChange={(event) => handleFilterChange({ model: event.target.value })}
            placeholder="Filter by model…"
          />
        </label>
      </div>

      {requests.isLoading && <p className="page-status">Loading requests…</p>}
      {requests.isError && requests.data === undefined && (
        <p className="page-status page-status-error">Could not load requests.</p>
      )}

      {requests.data && (
        <>
          <DataTable<InferenceListItem>
            columns={[
              { key: "id", header: "Request", render: (row) => row.requestId },
              { key: "model", header: "Model", render: (row) => row.model },
              { key: "prediction", header: "Prediction", render: (row) => row.prediction ?? "—" },
              { key: "status", header: "Status", render: (row) => <span className={`request-status request-status-${row.status}`}>{row.status}</span> },
              { key: "latency", header: "Latency", render: (row) => formatLatency(row.latencyMs) },
              { key: "time", header: "Time", render: (row) => formatTime(row.createdAt) },
            ]}
            rows={requests.data.items}
            rowKey={(row) => row.requestId}
            onRowClick={(row) => navigate(`/requests/${row.requestId}`)}
            emptyMessage="No requests match these filters."
          />

          <div className={`pagination${stale ? " pagination-stale" : ""}`}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
