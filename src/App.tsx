import { useMemo, useState } from "react";

import Sidebar, { type NavId } from "./components/Sidebar";

import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import EstimatesPage from "./pages/EstimatesPage";
import ForecastPage from "./pages/ForecastPage";

function TopBar({ title }: { title: string }) {
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
    </div>
  );
}

export default function App() {
  const titles: Record<NavId, string> = useMemo(
    () => ({
      dashboard: "Dashboard",
      reports: "Reports",
      "forms.estimates": "Estimates",
      "forms.forecast": "Forecast",
    }),
    []
  );

  const [active, setActive] = useState<NavId>("dashboard");
  const [pinned, setPinned] = useState<NavId[]>([]);

  const togglePin = (id: NavId) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        pinned={pinned}
        onNavigate={setActive}
        onTogglePin={togglePin}
      />

      <div className="app-main">
        <TopBar title={titles[active] ?? ""} />
        <div className="app-content">
          {active === "dashboard" && <DashboardPage />}
          {active === "reports" && <ReportsPage />}
          {active === "forms.estimates" && <EstimatesPage />}
          {active === "forms.forecast" && <ForecastPage />}
        </div>
      </div>
    </div>
  );
}
