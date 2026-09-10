import { NavLink } from "react-router-dom";
import { useSummary } from "../hooks/useSummary";
import { StatusPill } from "./StatusPill";

const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/inference", label: "Inference" },
  { to: "/load-test", label: "Load Test" },
  { to: "/sre-lab", label: "SRE Lab" },
  { to: "/requests", label: "Requests" },
];

export function Navbar() {
  const summary = useSummary();
  const status = summary.data?.serviceStatus ?? "unknown";
  const stale = summary.isError && summary.data !== undefined;

  return (
    <header className="navbar">
      <span className="navbar-brand">Inference SRE</span>
      <nav className="navbar-links">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? "navbar-link navbar-link-active" : "navbar-link")}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <StatusPill status={summary.isError && summary.data === undefined ? "down" : status} stale={stale} />
    </header>
  );
}
