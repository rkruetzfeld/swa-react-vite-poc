// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowDoubleClickedEvent, ValueParserParams } from "ag-grid-community";

import "./components/StatusPill.css";
import "./App.css";

import type { EstimateHeader, EstimateLine, ItemCatalog, Status } from "./models/estimateModels";
import { estimateDataService } from "./services/estimateDataService";

// ✅ Pages (make sure these files exist in src/pages/)
import ForecastPage from "./pages/ForecastPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import ProjectsPage from "./pages/ProjectsPage";
import HealthPage from "./pages/HealthPage"; // ✅ replace SmokeTestPage with HealthPage
import SignOutButton from "./auth/SignOutButton";

// ✅ Shared component
import StatusPill, { type StatusTone } from "./components/StatusPill";

const PAGE_SIZE = 20;
const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

// Shell navigation types
type TopArea = "Forms" | "Reports" | "Dashboards";
type FormsPage = "Estimates" | "Forecast" | "Projects";
type View = "EstimatesList" | "EstimateDetail" | "Forecast" | "Projects" | "Health";

type PinKey = `Forms:${FormsPage}`;

function uuid(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function formatCurrencyCAD(n: number): string {
  if (!isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function parseNumber(p: ValueParserParams): number {
  const raw = String(p.newValue ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function toIsoDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOnlyToRangeStart(yyyyMmDd: string): Date | null {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDateOnlyToRangeEnd(yyyyMmDd: string): Date | null {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// Status -> tone mapping
function statusToTone(v: Status): StatusTone {
  switch (v) {
    case "Draft":
      return "neutral";
    case "Submitted":
      return "warning";
    case "Approved":
      return "success";
    case "Completed":
      return "info";
    default:
      return "neutral";
  }
}

function loadPins(): Set<PinKey> {
  const allowed: PinKey[] = ["Forms:Estimates", "Forms:Forecast", "Forms:Projects"];
  try {
    const raw = localStorage.getItem("pinnedLinks");
    if (!raw) return new Set(allowed);
    const arr = JSON.parse(raw) as string[];
    const filtered = arr.filter((x) => allowed.includes(x as PinKey)) as PinKey[];
    return new Set(filtered.length ? filtered : allowed);
  } catch {
    return new Set(allowed);
  }
}

function savePins(pins: Set<PinKey>) {
  localStorage.setItem("pinnedLinks", JSON.stringify(Array.from(pins.values())));
}

export default function App() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isDrawer = vp.w <= 900;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [area, setArea] = useState<TopArea>("Forms");
  const [formsExpanded, setFormsExpanded] = useState(true);
  const [formsPage, setFormsPage] = useState<FormsPage>("Estimates");
  const [view, setView] = useState<View>("EstimatesList");

  const [pins, setPins] = useState<Set<PinKey>>(() => loadPins());
  useEffect(() => savePins(pins), [pins]);
  function togglePin(key: PinKey) {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // --- existing Estimates state below (unchanged) ---
  const [headers, setHeaders] = useState<EstimateHeader[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [linesByEstimate, setLinesByEstimate] = useState<Map<string, EstimateLine[]>>(new Map());

  const [loadingHeaders, setLoadingHeaders] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3650);
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDateOnly(new Date()));

  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  // ... keep the rest of your existing Estimates UI code unchanged ...

  // ✅ Wherever you previously rendered SmokeTestPage, render HealthPage instead:
  // Example (your exact switch/render location may differ):
  function renderMain() {
    switch (view) {
      case "Projects":
        return <ProjectsPage />;
      case "Health":
        return <HealthPage />; // ✅ replaces SmokeTestPage
      case "Forecast":
        return <ForecastPage />;
      default:
        return null; // your existing estimates list/detail render likely here
    }
  }

  return (
    <div className="app-shell">
      {/* keep your existing shell layout */}
      {renderMain()}
    </div>
  );
}
