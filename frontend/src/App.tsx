import { Outlet } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { isDefaultSimulation, useSimulation } from "./hooks/useSimulation";

function DegradedBanner() {
  const simulation = useSimulation();

  if (isDefaultSimulation(simulation.data)) {
    return null;
  }

  const config = simulation.data!;
  return (
    <div className="degraded-banner">
      SRE Lab simulation is active — latency +{config.additionalLatencyMs}ms, error rate{" "}
      {Math.round(config.errorRate * 100)}%, max concurrency {config.maxConcurrency}. This is not a
      real incident.
    </div>
  );
}

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="workspace">
      <header className="workspace-header"><span>Workspace <span className="header-slash">/</span> <strong>Inference operations</strong></span><span className="header-tag">Kubernetes platform</span></header>
      <DegradedBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="workspace-footer"><span>Inference SRE Platform</span><span>Observe · Experiment · Improve</span></footer>
      </div>
    </div>
  );
}

export default App;
