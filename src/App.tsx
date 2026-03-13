import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";

// Auth gate (existing in repo per earlier context)
import AuthGate from "./auth/AuthGate";
import SignOutButton from "./auth/SignOutButton";

// Pages (these should exist in /src/pages)
import ProjectsPage from "./pages/ProjectsPage";
import EstimatesPage from "./pages/EstimatesPage";
import ForecastPage from "./pages/ForecastPage";
import HealthPage from "./pages/HealthPage";

/**
 * App.tsx
 *
 * Purpose:
 * - Provide a single authenticated shell layout (top bar + left nav) for all app pages.
 * - Restore the navigation collapse toggle consistently across routes.
 * - Keep page-specific actions inside page toolbars (not the global header).
 */

type NavItem = {
  label: string;
  to: string;
  section: "Forms" | "Utilities" | "Pinned";
};

const NAV_ITEMS: NavItem[] = [
  { section: "Forms", label: "Projects", to: "/projects" },
  { section: "Forms", label: "Estimates", to: "/estimates" },
  { section: "Forms", label: "Forecast", to: "/forecast" },
  { section: "Utilities", label: "Health", to: "/health" },
];

const LS_KEY_NAV_COLLAPSED = "portal.navCollapsed";

function useNavCollapsed(): [boolean, (v: boolean) => void, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem(LS_KEY_NAV_COLLAPSED);
      return v === "1";
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

  const toggle = () => setCollapsed(!collapsed);
  return [collapsed, setCollapsed, toggle];
}

function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [navCollapsed, , toggleNavCollapsed] = useNavCollapsed();

  const sections = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of NAV_ITEMS) {
      groups[item.section] ??= [];
      groups[item.section].push(item);
    }
    return groups;
  }, []);

  return (
    <div className={"app-root" + (navCollapsed ? " nav-collapsed" : "")}> 
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

          {/* Simple breadcrumb/title */}
          <span className="topbar-sep" aria-hidden="true">|</span>
          <span className="topbar-location" title={location.pathname}>
            {location.pathname === "/" ? "/projects" : location.pathname}
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

          {Object.entries(sections).map(([sectionName, items]) => (
            <div className="sidenav-section" key={sectionName}>
              <div className="sidenav-section-title">{sectionName}</div>
              <div className="sidenav-section-items">
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) =>
                      "sidenav-item" + (isActive ? " active" : "")
                    }
                  >
                    <span className="sidenav-item-label">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="sidenav-footer">
            <div className="sidenav-hint">
              <small>Tip: use Collapse to minimize the sidebar.</small>
            </div>
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
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </AppShell>
    </AuthGate>
  );
}
