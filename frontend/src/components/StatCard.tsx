interface StatCardProps {
  label: string;
  value: string;
  stale?: boolean;
}

export function StatCard({ label, value, stale }: StatCardProps) {
  return (
    <div className={`stat-card${stale ? " stat-card-stale" : ""}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
    </div>
  );
}
