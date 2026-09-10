import type { ServiceStatus } from "../api/types";

interface StatusPillProps {
  status: ServiceStatus | "unknown";
  stale?: boolean;
}

const LABELS: Record<ServiceStatus | "unknown", string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

export function StatusPill({ status, stale }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill-${status}`}>
      <span className="status-pill-dot" aria-hidden="true" />
      Service &bull; {LABELS[status]}
      {stale && <span className="status-pill-stale"> (stale)</span>}
    </span>
  );
}
