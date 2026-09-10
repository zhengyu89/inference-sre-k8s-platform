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
      <DegradedBanner />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
