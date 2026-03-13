import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";

// Auth gate + sign out (exists per your folder structure)
import AuthGate from "./auth/AuthGate";
import SignOutButton from "./auth/SignOutButton";

// Pages (exists per your /src/pages screenshot)
import ProjectsPage from "./pages/ProjectsPage";
import EstimatesPage from "./pages/EstimatesPage";
import ForecastPage from "./pages/ForecastPage";
import HealthPage from "./pages/HealthPage";
import ApiEstimatesPage from "./pages/ApiEstimatesPage";
import SmokeTestPage from "./pages/SmokeTestPage";
import ReportsPage from "./pages/ReportsPage";
import DashboardPage from "./pages/DashboardPage";

/**
 * App.tsx
 *
 * Goals:
 * - Provide a single authenticated shell layout (top bar + left navigation) for all app pages.
 * - Keep page-specific actions inside page toolbars (e.g., Create/Delete Estimate stay on Estimates page).
 * - Provide a consistent nav collapse control (and persist preference).
 */

type NavSection = "Forms" | "Tools" | "Reports" | "Dashboards" | "Pinned";

type NavItem = {
  label: string;
  to: string;
  section: NavSection;
  /** Optional badge text (e.g., "NEW") */
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  // Forms
  { section: "Forms", label: "Projects", to: "/projects" },
  { section: "Forms", label: "Estimates", to: "/estimates" },
  { section: "Forms", label: "Forecast", to: "/forecast" },

  // Tools
  { section: "Tools", label: "API Test", to: "/api-test" },
  { section: "Tools", label: "Smoke Test", to: "/smoke-test" },

  // Reports / Dashboards
  { section: "Reports", label: "Reports", to: "/reports" },
  { section: "Dashboards", label: "Dashboards", to: "/dashboards" },

  // Pinned (shortcuts)
  { section: "Pinned", label: "Estimates", to: "/estimates" },
  { section: "Pinned", label: "Forecast", to: "/forecast" },
];

const LS_KEY_NAV_COLLAPSED = "portal.navCollapsed";

function useNavCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(LS_KEY_NAV_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY_NAV_COLLAPSED, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((v) => !v);
  return [collapsed, toggle];
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [navCollapsed, toggleNavCollapsed] = useNavCollapsed();

  const sections = useMemo(() => {
    const order: NavSection[] = ["Forms", "Tools", "Reports", "Dashboards", "Pinned"];
    const groups = new Map<NavSection, NavItem[]>();
    for (const s of order) groups.set(s, []);
    for (const item of NAV_ITEMS) {
      const list = groups.get(item.section) ?? [];
      list.push(item);
      groups.set(item.section, list);
    }
    return { order, groups };
  }, []);

  const currentPathLabel = useMemo(() => {
    // Normalize "root" into default route for display.
    const p = location.pathname === "/" ? "/projects" : location.pathname;
    return p;
  }, [location.pathname]);

  return (
    <div className={classNames("app-root", navCollapsed && "nav-collapsed")}> 
      <header className="app-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-btn"
            onClick={toggleNavCollapsed}
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {navCollapsed ? "Expand" : "Collapse"}
          </button>

          <span className="topbar-sep" aria-hidden="true">|</span>
          <span className="topbar-location" title={currentPathLabel}>
            {currentPathLabel}
          </span>
        </div>

        <div className="topbar-right">
          <NavLink className="topbar-link" to="/health">
            Health
          </NavLink>
          <span className="topbar-sep" aria-hidden="true">|</span>
          <SignOutButton />
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidenav" aria-label="Navigation">
          <div className="sidenav-title">NAVIGATION</div>

          {sections.order.map((sectionName) => {
            const items = sections.groups.get(sectionName) ?? [];
            if (items.length === 0) return null;
            return (
              <div className="sidenav-section" key={sectionName}>
                <div className="sidenav-section-title">{sectionName}</div>
                <div className="sidenav-section-items">
                  {items.map((it) => (
                    <NavLink
                      key={`${sectionName}:${it.label}:${it.to}`}
                      to={it.to}
                      className={({ isActive }) =>
                        classNames("sidenav-item", isActive && "active")
                      }
                      end={it.to === "/projects" || it.to === "/estimates" || it.to === "/forecast"}
                    >
                      <span className="sidenav-item-label">{it.label}</span>
                      {it.badge ? <span className="sidenav-item-badge">{it.badge}</span> : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="sidenav-footer">
            <small>Tip: use Collapse to minimize the sidebar.</small>
          </div>
        </aside>

        <main className="app-content" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppShell>
        <Routes>
          {/* Default route */}
          <Route path="/" element={<Navigate to="/projects" replace />} />

          {/* Forms */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/forecast" element={<ForecastPage />} />

          {/* Tools */}
          <Route path="/api-test" element={<ApiEstimatesPage />} />
          <Route path="/smoke-test" element={<SmokeTestPage />} />

          {/* Reports & Dashboards */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/dashboards" element={<DashboardPage />} />

          {/* Utilities */}
          <Route path="/health" element={<HealthPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </AppShell>
    </AuthGate>
  );
}
