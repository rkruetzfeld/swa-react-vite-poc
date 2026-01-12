import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowClickedEvent } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type TopNav = "Dashboard" | "Estimates" | "Reports" | "Settings";
type View = "EstimatesList" | "EstimateDetail" | "CreateEstimate";
type Status = "Draft" | "Submitted" | "Approved";

type EstimateHeader = {
  estimateId: string;
  client: string;
  title: string;
  status: Status;
  dateCreated: string; // ISO
  dueDate: string; // ISO
  lastUpdated: string; // ISO
};

type EstimateLine = {
  lineId: string;
  item: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes: string;
};

const LS_HEADERS = "poc_estimate_headers_v3";
const LS_LINES_PREFIX = "poc_estimate_lines_v3__";

function uuid(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function nowIso(): string {
  return new Date().toISOString();
}
function toIsoDateOnly(d: Date): string {
  // yyyy-mm-dd in local time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function parseDateOnlyToRangeStart(yyyyMmDd: string): Date | null {
  if (!yyyyMmDd) return null;
  // local midnight
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function parseDateOnlyToRangeEnd(yyyyMmDd: string): Date | null {
  if (!yyyyMmDd) return null;
  // local end of day
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
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
function loadHeaders(): EstimateHeader[] {
  const raw = localStorage.getItem(LS_HEADERS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EstimateHeader[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveHeaders(headers: EstimateHeader[]) {
  localStorage.setItem(LS_HEADERS, JSON.stringify(headers));
}
function loadLines(estimateId: string): EstimateLine[] {
  const raw = localStorage.getItem(LS_LINES_PREFIX + estimateId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EstimateLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveLines(estimateId: string, lines: EstimateLine[]) {
  localStorage.setItem(LS_LINES_PREFIX + estimateId, JSON.stringify(lines));
}

function seedIfEmpty() {
  const existing = loadHeaders();
  if (existing.length > 0) return;

  // helper to make ISO dates
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day).toISOString();

  const headers: EstimateHeader[] = [
    { estimateId: "1574", client: "Custom Solutions Inc.", title: "Estimate Custom Solutions", status: "Draft", dateCreated: d(2024, 9, 3), dueDate: d(2024, 12, 20), lastUpdated: nowIso() },
    { estimateId: "1533", client: "Anting Detiming", title: "Estimated Drops", status: "Submitted", dateCreated: d(2024, 9, 1), dueDate: d(2024, 11, 15), lastUpdated: nowIso() },
    { estimateId: "1535", client: "Supply A", title: "Office X", status: "Approved", dateCreated: d(2024, 9, 2), dueDate: d(2024, 10, 30), lastUpdated: nowIso() },
    { estimateId: "1523", client: "Custom Sites", title: "Estimate Retire", status: "Draft", dateCreated: d(2023, 7, 7), dueDate: d(2023, 12, 1), lastUpdated: nowIso() },
    { estimateId: "1643", client: "Committed Dregens", title: "Estimate Started", status: "Submitted", dateCreated: d(2023, 10, 10), dueDate: d(2024, 3, 9), lastUpdated: nowIso() },
    { estimateId: "0144", client: "Perichen Greet", title: "Pleasee Seatrms", status: "Draft", dateCreated: d(2022, 4, 7), dueDate: d(2022, 5, 31), lastUpdated: nowIso() },
    { estimateId: "1010", client: "Console Services", title: "Circular Pricing", status: "Approved", dateCreated: d(2023, 9, 9), dueDate: d(2023, 12, 31), lastUpdated: nowIso() },
    { estimateId: "2001", client: "Highway 1 Resurfacing", title: "Class D Estimate", status: "Draft", dateCreated: d(2025, 1, 5), dueDate: d(2025, 2, 10), lastUpdated: nowIso() },
    { estimateId: "2002", client: "Bridge Rehab - Segment B", title: "Initial Estimate", status: "Submitted", dateCreated: d(2025, 1, 12), dueDate: d(2025, 2, 15), lastUpdated: nowIso() },
    { estimateId: "2003", client: "Drainage Improvements", title: "Revised Estimate", status: "Approved", dateCreated: d(2024, 12, 18), dueDate: d(2025, 1, 20), lastUpdated: nowIso() }
  ];

  saveHeaders(headers);

  // Seed line items so Amount column isn't blank
  const seedLines = (estimateId: string, rows: Array<Partial<EstimateLine>>) => {
    saveLines(
      estimateId,
      rows.map((r, i) => ({
        lineId: uuid(),
        item: r.item ?? String(1000 + i * 10),
        description: r.description ?? "",
        uom: r.uom ?? "LS",
        qty: r.qty ?? 1,
        unitRate: r.unitRate ?? 0,
        notes: r.notes ?? ""
      }))
    );
  };

  seedLines("1574", [
    { item: "1010", description: "Online marketing proposal", uom: "LS", qty: 1, unitRate: 90 },
    { item: "1020", description: "Mobilization", uom: "LS", qty: 1, unitRate: 12500 },
    { item: "1030", description: "Traffic control", uom: "day", qty: 12, unitRate: 850 }
  ]);

  seedLines("1533", [
    { description: "Engineering review", uom: "LS", qty: 1, unitRate: 3800 },
    { description: "QA/QC checks", uom: "hr", qty: 24, unitRate: 140 }
  ]);

  seedLines("1535", [
    { description: "Materials", uom: "LS", qty: 1, unitRate: 6000 },
    { description: "Labour", uom: "hr", qty: 40, unitRate: 115 }
  ]);

  seedLines("2001", [
    { description: "Asphalt paving", uom: "t", qty: 450, unitRate: 145 },
    { description: "Line painting", uom: "km", qty: 12, unitRate: 1800 }
  ]);

  seedLines("2002", [
    { description: "Concrete repair", uom: "m2", qty: 120, unitRate: 310 },
    { description: "Rebar replacement", uom: "kg", qty: 900, unitRate: 6.5 }
  ]);

  seedLines("2003", [
    { description: "Culvert install", uom: "ea", qty: 2, unitRate: 22000 }
  ]);
}

export default function App() {
  useMemo(() => {
    seedIfEmpty();
    return null;
  }, []);

  // responsive state
  const [isNarrow, setIsNarrow] = useState<boolean>(() => window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 900);

  useEffect(() => {
    // Auto-collapse sidebar on narrow screens
    if (isNarrow) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isNarrow]);

  // app state
  const [topNav, setTopNav] = useState<TopNav>("Estimates");
  const [view, setView] = useState<View>("EstimatesList");

  const [headers, setHeaders] = useState<EstimateHeader[]>(() => loadHeaders());
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(
    headers[0]?.estimateId ?? null
  );
  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  const [lines, setLines] = useState<EstimateLine[]>(() =>
    selectedEstimateId ? loadLines(selectedEstimateId) : []
  );

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");

  // Default date range: last 365 days (for a nicer PoC feel)
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState<string>(() => toIsoDateOnly(new Date()));

  const filteredHeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = parseDateOnlyToRangeStart(fromDate);
    const to = parseDateOnlyToRangeEnd(toDate);

    return headers.filter((h) => {
      if (statusFilter !== "All" && h.status !== statusFilter) return false;

      const created = new Date(h.dateCreated);
      if (from && created < from) return false;
      if (to && created > to) return false;

      if (!q) return true;
      const hay = `${h.estimateId} ${h.client} ${h.title} ${h.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [headers, search, statusFilter, fromDate, toDate]);

  const estimateTotal = useMemo(() => {
    return lines.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0), 0);
  }, [lines]);

  function updateHeaderLastUpdated(estimateId: string) {
    const updated = headers.map((h) =>
      h.estimateId === estimateId ? { ...h, lastUpdated: nowIso() } : h
    );
    setHeaders(updated);
    saveHeaders(updated);
  }

  function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setLines(loadLines(id));
    setView("EstimateDetail");
    setTopNav("Estimates");
    if (isNarrow) setSidebarOpen(false);
  }

  function saveCurrentEstimate() {
    if (!selectedEstimateId) return;
    saveLines(selectedEstimateId, lines);
    updateHeaderLastUpdated(selectedEstimateId);
    alert("Saved (localStorage).");
  }

  // Create estimate
  const [newClient, setNewClient] = useState("");
  const [newTitle, setNewTitle] = useState("");

  function createEstimate() {
    const id = String(Math.floor(1000 + Math.random() * 9000));
    const header: EstimateHeader = {
      estimateId: id,
      client: (newClient || "New Client").trim(),
      title: (newTitle || "New Estimate").trim(),
      status: "Draft",
      dateCreated: nowIso(),
      dueDate: nowIso(),
      lastUpdated: nowIso()
    };
    const updated = [header, ...headers];
    setHeaders(updated);
    saveHeaders(updated);
    saveLines(id, []);
    setSelectedEstimateId(id);
    setLines([]);
    setNewClient("");
    setNewTitle("");
    setView("EstimateDetail");
    if (isNarrow) setSidebarOpen(false);
  }

  // grids
  const estimatesListCols = useMemo<ColDef<EstimateHeader>[]>(() => {
    return [
      { field: "estimateId", headerName: "ID", width: 90 },
      { field: "client", headerName: "Client", flex: 1, minWidth: 180 },
      { field: "title", headerName: "Title", flex: 1, minWidth: 200 },
      {
        field: "dateCreated",
        headerName: "Date Created",
        width: 140,
        valueFormatter: (p) => formatDate(String(p.value || ""))
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        cellRenderer: (p: any) => {
          const v = p.value as Status;
          const bg = v === "Draft" ? "#e0f2fe" : v === "Submitted" ? "#fef3c7" : "#dcfce7";
          const fg = v === "Draft" ? "#075985" : v === "Submitted" ? "#92400e" : "#166534";
          return `<span style="
              display:inline-flex;align-items:center;
              padding:3px 8px;border-radius:999px;
              font-weight:800;font-size:12px;
              background:${bg};color:${fg};
            ">${v}</span>`;
        }
      },
      {
        headerName: "Amount",
        width: 140,
        valueGetter: (p) => {
          const id = p.data?.estimateId;
          if (!id) return 0;
          const rows = loadLines(id);
          return rows.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0), 0);
        },
        valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0)
      },
      {
        field: "dueDate",
        headerName: "Due Date",
        width: 120,
        valueFormatter: (p) => formatDate(String(p.value || ""))
      }
    ];
  }, []);

  const estimateDetailCols = useMemo<ColDef<EstimateLine>[]>(() => {
    return [
      { field: "item", headerName: "Item", editable: true, width: 90 },
      { field: "description", headerName: "Description", editable: true, flex: 1, minWidth: 260 },
      { field: "uom", headerName: "UOM", editable: true, width: 90 },
      {
        field: "qty",
        headerName: "Qty",
        editable: true,
        width: 110,
        valueParser: (p) => Number(p.newValue)
      },
      {
        field: "unitRate",
        headerName: "Price",
        editable: true,
        width: 140,
        valueParser: (p) => Number(p.newValue),
        valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0)
      },
      {
        headerName: "Total",
        width: 140,
        valueGetter: (p) => (Number(p.data?.qty) || 0) * (Number(p.data?.unitRate) || 0),
        valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0)
      },
      { field: "notes", headerName: "Notes", editable: true, width: 220 }
    ];
  }, []);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { lineId: uuid(), item: "", description: "", uom: "", qty: 0, unitRate: 0, notes: "" }
    ]);
  }
  function deleteSelectedLines() {
    const api = detailApiRef.current;
    if (!api) return;
    const selected = api.getSelectedRows() as EstimateLine[];
    if (!selected.length) {
      alert("Select one or more rows first.");
      return;
    }
    const ids = new Set(selected.map((r) => r.lineId));
    setLines((prev) => prev.filter((r) => !ids.has(r.lineId)));
  }
  function exportDetailCsv() {
    const api = detailApiRef.current;
    if (!api) return;
    const fileName = selectedEstimateId ? `estimate-${selectedEstimateId}.csv` : "estimate.csv";
    api.exportDataAsCsv({ fileName });
  }

  // Shared UI styles (with responsive CSS)
  const styles = `
    :root {
      --bg: #f3f6fb;
      --card: #ffffff;
      --border: #e5e7eb;
      --text: #0f172a;
      --muted: #64748b;
      --primary: #2563eb;
      --primarySoft: #eef2ff;
      --shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }

    html, body, #root { height: 100%; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    * { box-sizing: border-box; }

    .app {
      height: 100vh;
      display: grid;
      grid-template-rows: 56px 1fr;
      font-family: system-ui, Segoe UI, Arial;
    }

    .topbar {
      background: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      gap: 12px;
      min-width: 0;
    }

    .brand { display: flex; align-items: center; gap: 10px; font-weight: 900; }
    .logo {
      width: 26px; height: 26px; border-radius: 6px;
      background: var(--primary); color: white;
      display: grid; place-items: center;
      font-weight: 900;
    }

    .hamburger {
      display: none;
      border: 1px solid var(--border);
      background: white;
      border-radius: 10px;
      padding: 8px 10px;
      font-weight: 900;
      cursor: pointer;
    }

    .topnav { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .topnav-item {
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
      color: #334155;
      white-space: nowrap;
    }
    .topnav-item.active { color: #1d4ed8; background: var(--primarySoft); }

    .main {
      display: grid;
      grid-template-columns: 240px 1fr;
      min-height: 0;
      min-width: 0;
    }

    .sidebar {
      background: var(--card);
      border-right: 1px solid var(--border);
      padding: 12px;
      min-height: 0;
    }

    .side-item {
      padding: 10px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 13px;
      color: #334155;
      margin-bottom: 6px;
    }
    .side-item.active { color: #1d4ed8; background: var(--primarySoft); }

    .content {
      padding: 16px;
      min-height: 0;
      min-width: 0;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .title { font-size: 22px; font-weight: 900; margin: 2px 0 10px 0; }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
    }

    .btn-primary {
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 9px 12px;
      cursor: pointer;
      font-weight: 900;
      font-size: 13px;
      white-space: nowrap;
    }

    .btn-ghost {
      background: transparent;
      color: #1f2937;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 9px 12px;
      cursor: pointer;
      font-weight: 900;
      font-size: 13px;
      white-space: nowrap;
    }

    .filters {
      display: grid;
      grid-template-columns: 1fr 160px 160px 160px auto;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }

    .input, .select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      outline: none;
      background: white;
      font-weight: 700;
      color: #0f172a;
    }

    .subtle { font-size: 12px; color: var(--muted); }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    /* Narrow / mobile */
    @media (max-width: 900px) {
      .hamburger { display: inline-flex; }
      .main { grid-template-columns: 1fr; }

      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: 260px;
        z-index: 20;
        transform: translateX(-110%);
        transition: transform 180ms ease;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
      }
      .sidebar.open { transform: translateX(0); }

      .overlay {
        position: fixed;
        top: 56px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.25);
        z-index: 10;
      }

      .content { padding: 12px; }

      .filters {
        grid-template-columns: 1fr 1fr;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  const statusPillStyle = (status: Status): React.CSSProperties => {
    let bg = "#e5e7eb";
    let fg = "#111827";
    if (status === "Draft") {
      bg = "#e0f2fe";
      fg = "#075985";
    } else if (status === "Submitted") {
      bg = "#fef3c7";
      fg = "#92400e";
    } else {
      bg = "#dcfce7";
      fg = "#166534";
    }
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 8px",
      borderRadius: 999,
      background: bg,
      color: fg,
      fontWeight: 900,
      fontSize: 12
    };
  };

  // Height calculations: make grids fill the viewport sensibly
  const listGridHeight = isNarrow ? "calc(100vh - 56px - 16px - 54px - 16px - 140px)" : "calc(100vh - 56px - 16px - 54px - 16px - 96px)";
  const detailGridHeight = isNarrow ? "calc(100vh - 56px - 16px - 140px - 180px)" : "calc(100vh - 56px - 16px - 110px - 110px)";

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        {/* Top bar */}
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              className="hamburger"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Menu"
            >
              ☰
            </button>

            <div className="brand">
              <div className="logo">▦</div>
              <div>Portal</div>
            </div>

            <div className="topnav" style={{ overflow: "auto" }}>
              {(["Dashboard", "Estimates", "Reports", "Settings"] as TopNav[]).map((t) => (
                <div
                  key={t}
                  className={`topnav-item ${topNav === t ? "active" : ""}`}
                  onClick={() => {
                    setTopNav(t);
                    if (t === "Estimates") setView("EstimatesList");
                    else setView("EstimatesList"); // keep PoC simple
                    if (isNarrow) setSidebarOpen(false);
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#334155" }}>
            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>
              Welcome, John
            </div>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: "#e2e8f0",
                display: "grid",
                placeItems: "center",
                fontWeight: 900
              }}
              title="Mock user"
            >
              J
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="main">
          {/* Mobile overlay */}
          {isNarrow && sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

          {/* Sidebar */}
          <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <div
              className="side-item"
              onClick={() => {
                setTopNav("Dashboard");
                setView("EstimatesList");
                if (isNarrow) setSidebarOpen(false);
              }}
            >
              ▢ Dashboard
            </div>

            <div
              className={`side-item ${topNav === "Estimates" ? "active" : ""}`}
              onClick={() => {
                setTopNav("Estimates");
                setView("EstimatesList");
                if (isNarrow) setSidebarOpen(false);
              }}
            >
              ▦ Estimates
            </div>

            <div className="side-item" onClick={() => alert("PoC: not implemented")}>
              ▤ Reports
            </div>

            <div className="side-item" onClick={() => alert("PoC: not implemented")}>
              ◷ Analytics
            </div>

            <div className="side-item" onClick={() => alert("PoC: not implemented")}>
              ⚙ Settings
            </div>

            <div style={{ marginTop: 10 }} className="subtle">
              PoC: localStorage only
            </div>
          </div>

          {/* Content */}
          <div className="content">
            {/* Estimates List */}
            {view === "EstimatesList" && (
              <>
                <div className="page-header">
                  <div className="title">Estimates</div>

                  <button
                    className="btn-primary"
                    onClick={() => setView("CreateEstimate")}
                  >
                    Create Estimate
                  </button>
                </div>

                <div className="card" style={{ padding: 12 }}>
                  <div className="filters">
                    <input
                      className="input"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                    />

                    <select
                      className="select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      title="Status"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                    </select>

                    <input
                      className="input"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      title="From"
                    />

                    <input
                      className="input"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      title="To"
                    />

                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("All");
                        const d = new Date();
                        d.setDate(d.getDate() - 365);
                        setFromDate(toIsoDateOnly(d));
                        setToDate(toIsoDateOnly(new Date()));
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="ag-theme-quartz" style={{ height: listGridHeight, minHeight: 360 }}>
                    <AgGridReact<EstimateHeader>
                      rowData={filteredHeaders}
                      columnDefs={estimatesListCols}
                      defaultColDef={{ resizable: true, sortable: true, filter: true }}
                      rowSelection="single"
                      onGridReady={(e) => (listApiRef.current = e.api)}
                      onRowClicked={(e: RowClickedEvent<EstimateHeader>) => {
                        const id = e.data?.estimateId;
                        if (id) openEstimate(id);
                      }}
                    />
                  </div>

                  <div className="subtle" style={{ paddingTop: 10 }}>
                    Click a row to open the estimate detail. Amount is calculated from stored line items.
                  </div>
                </div>
              </>
            )}

            {/* Create Estimate */}
            {view === "CreateEstimate" && (
              <>
                <div className="page-header">
                  <div className="title">Create Estimate</div>
                  <button className="btn-ghost" onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>

                <div className="card" style={{ padding: 14, maxWidth: 760 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Client</div>
                      <input
                        className="input"
                        value={newClient}
                        onChange={(e) => setNewClient(e.target.value)}
                        placeholder="Custom Solutions Inc."
                      />
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Title</div>
                      <input
                        className="input"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Estimate Starter"
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn-primary" onClick={createEstimate}>
                        Create
                      </button>
                      <button className="btn-ghost" onClick={() => setView("EstimatesList")}>
                        Cancel
                      </button>
                    </div>

                    <div className="subtle">Creates a Draft estimate in localStorage.</div>
                  </div>
                </div>
              </>
            )}

            {/* Estimate Detail */}
            {view === "EstimateDetail" && selectedHeader && (
              <>
                <div className="detail-header">
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 900 }}>
                      ID {selectedHeader.estimateId}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedHeader.client}</div>
                    <div style={{ fontSize: 13, color: "#334155", fontWeight: 800 }}>
                      {selectedHeader.title}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Total</div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>
                        {formatCurrencyCAD(estimateTotal)}
                      </div>
                    </div>
                    <button className="btn-ghost" onClick={() => setView("EstimatesList")}>
                      Back
                    </button>
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Estimate Date</div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{formatDate(selectedHeader.dateCreated)}</div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Due Date</div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{formatDate(selectedHeader.dueDate)}</div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Status</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={statusPillStyle(selectedHeader.status)}>{selectedHeader.status}</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 12, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                    <div style={{ fontWeight: 900 }}>Estimate Line Items</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn-ghost" onClick={exportDetailCsv}>Export</button>
                      <button className="btn-ghost" onClick={deleteSelectedLines}>Delete</button>
                      <button className="btn-primary" onClick={addLine}>Add Item</button>
                      <button className="btn-primary" onClick={saveCurrentEstimate}>Save</button>
                    </div>
                  </div>

                  <div className="ag-theme-quartz" style={{ height: detailGridHeight, minHeight: 360 }}>
                    <AgGridReact<EstimateLine>
                      rowData={lines}
                      columnDefs={estimateDetailCols}
                      defaultColDef={{ resizable: true, sortable: true, filter: true }}
                      rowSelection="multiple"
                      getRowId={(p) => p.data.lineId}
                      singleClickEdit={true}
                      stopEditingWhenCellsLoseFocus={true}
                      onGridReady={(e) => (detailApiRef.current = e.api)}
                      onCellValueChanged={() => updateHeaderLastUpdated(selectedHeader.estimateId)}
                    />
                  </div>

                  <div className="subtle" style={{ paddingTop: 10 }}>
                    Edit Qty/Price to update totals. Click Save to persist (localStorage).
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
