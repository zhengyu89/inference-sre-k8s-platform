import { useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import { useEvents } from "../hooks/useEvents";
import { useRequests } from "../hooks/useRequests";
import { useSummary } from "../hooks/useSummary";
import { formatLatency, formatNumber, formatPercent, formatTime } from "../lib/format";
import type { InferenceListItem, ServiceEvent } from "../api/types";

export default function Overview() {
  const navigate = useNavigate();
  const summary = useSummary();
  const events = useEvents({ limit: 10 });
  const requests = useRequests({ limit: 10 });

  const summaryStale = summary.isError && summary.data !== undefined;

  return (
    <div className="page">
      <h1>Overview</h1>

      {summary.isLoading && <p className="page-status">Loading summary…</p>}
      {summary.isError && summary.data === undefined && (
        <p className="page-status page-status-error">Could not load the dashboard summary.</p>
      )}

      {summary.data && (
        <div className={`stat-grid${summaryStale ? " stat-grid-stale" : ""}`}>
          <StatCard label="Service Status" value={summary.data.serviceStatus} stale={summaryStale} />
          <StatCard label="Total Requests" value={formatNumber(summary.data.totalRequests)} stale={summaryStale} />
          <StatCard label="Success Rate" value={formatPercent(summary.data.successRate)} stale={summaryStale} />
          <StatCard label="Model" value={summary.data.modelVersion} stale={summaryStale} />
          <StatCard label="Requests/sec" value={summary.data.requestsPerSecond.toFixed(1)} stale={summaryStale} />
          <StatCard label="P95 Latency" value={formatLatency(summary.data.p95LatencyMs)} stale={summaryStale} />
          <StatCard label="Worker Replicas" value={formatNumber(summary.data.workerReplicas)} stale={summaryStale} />
          <StatCard label="Active Requests" value={formatNumber(summary.data.activeRequests)} stale={summaryStale} />
          <StatCard label="Queue Depth" value={formatNumber(summary.data.queueDepth)} stale={summaryStale} />
        </div>
      )}

      <section className="page-section">
        <h2>Recent events</h2>
        {events.isLoading && <p className="page-status">Loading events…</p>}
        {events.isError && events.data === undefined && (
          <p className="page-status page-status-error">Could not load recent events.</p>
        )}
        {events.data && (
          <DataTable<ServiceEvent>
            columns={[
              { key: "time", header: "Time", render: (row) => formatTime(row.createdAt) },
              { key: "message", header: "Message", render: (row) => row.message },
            ]}
            rows={events.data}
            rowKey={(row) => String(row.id)}
            emptyMessage="No events yet."
          />
        )}
      </section>

      <section className="page-section">
        <h2>Recent requests</h2>
        {requests.isLoading && <p className="page-status">Loading requests…</p>}
        {requests.isError && requests.data === undefined && (
          <p className="page-status page-status-error">Could not load recent requests.</p>
        )}
        {requests.data && (
          <DataTable<InferenceListItem>
            columns={[
              { key: "id", header: "Request", render: (row) => row.requestId },
              { key: "model", header: "Model", render: (row) => row.model },
              { key: "status", header: "Status", render: (row) => row.status },
              { key: "latency", header: "Latency", render: (row) => formatLatency(row.latencyMs) },
            ]}
            rows={requests.data.items}
            rowKey={(row) => row.requestId}
            onRowClick={(row) => navigate(`/requests/${row.requestId}`)}
            emptyMessage="No requests yet."
          />
        )}
      </section>
    </div>
  );
}
