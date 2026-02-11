import { useMemo, useState } from "react";

import Sidebar, { type NavItem } from "./components/Sidebar";

import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import EstimatesPage from "./pages/EstimatesPage";

type ViewKey = "dashboard" | "projects" | "estimates";

function TopBar(props: { title: string }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      {props.title}
    </div>
  );
}

export default function App() {
  const navItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", section: "core" },
      { key: "projects", label: "Projects", section: "data" },
      { key: "estimates", label: "Estimates", section: "data" },
    ],
    []
  );

  const [activeKey, setActiveKey] = useState<ViewKey>("dashboard");
  const activeLabel = navItems.find((n) => n.key === activeKey)?.label ?? "";

  return (
    <div className="app-shell">
      <Sidebar
        items={navItems}
        activeKey={activeKey}
        onSelect={(k) => setActiveKey(k as ViewKey)}
      />

      <div className="app-main">
        <TopBar title={activeLabel} />
        <div className="app-content">
          {activeKey === "dashboard" && <DashboardPage />}
          {activeKey === "projects" && <ProjectsPage />}
          {activeKey === "estimates" && <EstimatesPage />}
        </div>
      </div>
    </div>
  );
}
