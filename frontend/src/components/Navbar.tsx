import { NavLink } from "react-router-dom";
import { useSummary } from "../hooks/useSummary";
import { StatusPill } from "./StatusPill";
import { Icon, type IconName } from "./Icon";

const LINKS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: "overview", end: true },
  { to: "/inference", label: "Inference", icon: "inference" },
  { to: "/load-test", label: "Load Test", icon: "load" },
  { to: "/sre-lab", label: "SRE Lab", icon: "lab" },
  { to: "/requests", label: "Requests", icon: "requests" },
];

export function Navbar() {
  const summary = useSummary();
  const status = summary.data?.serviceStatus ?? "unknown";
  const stale = summary.isError && summary.data !== undefined;
  return (
    <aside className="navbar">
      <NavLink to="/" className="navbar-brand"><span className="brand-mark"><Icon name="layers" /></span><span>Inference<span className="brand-subtitle">SRE PLATFORM</span></span></NavLink>
      <span className="nav-label">WORKSPACE</span>
      <nav className="navbar-links" aria-label="Main navigation">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => isActive ? "navbar-link navbar-link-active" : "navbar-link"}>
            <Icon name={link.icon} />{link.label}<span className="nav-active-dot" />
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note"><Icon name="pulse" /><strong>Built for reliability.</strong><p>Observe performance.<br />Test limits. Stay resilient.</p></div>
      <div className="sidebar-status"><span className="nav-label">SERVICE HEALTH</span><StatusPill status={status} stale={stale} /></div>
    </aside>
  );
}
