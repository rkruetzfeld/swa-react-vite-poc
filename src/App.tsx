import { useMemo, useState } from "react";

import Sidebar, { type NavItem } from "./components/Sidebar";

import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import EstimatesPage from "./pages/EstimatesPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";

type ViewKey = "dashboard" | "projects" | "estimates" | "diagnostics";

export default function App() {
  const navItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", section: "core" },
      { key: "projects", label: "Projects", section: "data" },
      { key: "estimates", label: "Estimates", section: "data" },
      { key: "diagnostics", label: "Diagnostics", section: "core" },
    ],
    []
  );

  const [activeKey, setActiveKey] = useState<ViewKey>("dashboard");
  const activeLabel = navItems.find((n) => n.key === activeKey)?.label ?? "";

  return (
    <div className="app-shell">
      <Sidebar items={navItems} activeKey={activeKey} onSelect={(k) => setActiveKey(k as ViewKey)} />

      <div className="app-main">
        <TopBar title={activeLabel} />
        <div className="app-content">
          {activeKey === "dashboard" && <DashboardPage />}
          {activeKey === "projects" && <ProjectsPage />}
          {activeKey === "estimates" && <EstimatesPage />}
          {activeKey === "diagnostics" && <DiagnosticsPage />}
        </div>
      </div>
    </div>
  );
}
