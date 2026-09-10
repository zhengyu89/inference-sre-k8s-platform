import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
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
      <div className="overview-heading"><div><span className="eyebrow">PLATFORM INTELLIGENCE</span><h1>Service overview</h1></div><span className="refresh-label">Auto-refresh enabled</span></div>
      <PageIntro>Your inference service at a glance. Monitor health, explore requests, and put reliability to the test.</PageIntro>
      <section className="overview-hero">
        <div className="hero-copy"><span className="hero-kicker"><Icon name="pulse" /> INFERENCE OPERATIONS</span><h2>Performance in focus.<br />Reliability by design.</h2><p>From the first prediction to peak traffic.<br />One workspace to understand every request.</p><Link className="hero-button" to="/inference">Try an inference <Icon name="arrow" /></Link><Link className="hero-secondary" to="/load-test">Run a load test ↗</Link></div>
        <div className="hero-diagram" aria-label="Inference flow: request to model to response"><div className="diagram-orbit" /><div className="diagram-node node-input"><Icon name="requests" /><span>Request</span></div><div className="diagram-core"><Icon name="layers" /><strong>Inference</strong><span>MODEL ENGINE</span></div><div className="diagram-node node-output"><Icon name="inference" /><span>Response</span></div><span className="diagram-caption">REQUEST → PROCESS → PREDICT</span></div>
      </section>
      <div className="section-heading"><h2>Service metrics</h2><span>Latest snapshot{summaryStale ? " · stale" : ""}</span></div>

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
            rows={events.data.items}
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
              { key: "status", header: "Status", render: (row) => <span className={`request-status request-status-${row.status}`}>{row.status}</span> },
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
