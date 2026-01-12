import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowClickedEvent } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type TopNav = "Dashboard" | "Estimates" | "Reports" | "Settings";
type View = "EstimatesList" | "EstimateDetail" | "CreateEstimate";
type Status = "Draft" | "Submitted" | "Approved" | "Completed";

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

const LS_HEADERS = "poc_estimate_headers_v4";
const LS_LINES_PREFIX = "poc_estimate_lines_v4__";

function uuid(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function nowIso(): string {
  return new Date().toISOString();
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

  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day).toISOString();

  const headers: EstimateHeader[] = [
    { estimateId: "1574", client: "Custom Solutions Inc.", title: "Estimate Custom Solutions", status: "Draft", dateCreated: d(2024, 9, 3), dueDate: d(2024, 12, 20), lastUpdated: nowIso() },
    { estimateId: "1533", client: "Anting Detiming", title: "Estimated Drops", status: "Submitted", dateCreated: d(2024, 9, 1), dueDate: d(2024, 11, 15), lastUpdated: nowIso() },
    { estimateId: "1535", client: "Supply A", title: "Office X", status: "Approved", dateCreated: d(2024, 9, 2), dueDate: d(2024, 10, 30), lastUpdated: nowIso() },

    // “real-ish” projects
    { estimateId: "2001", client: "Highway 1 Resurfacing", title: "Class D Estimate", status: "Draft", dateCreated: d(2025, 1, 5), dueDate: d(2025, 2, 10), lastUpdated: nowIso() },
    { estimateId: "2002", client: "Bridge Rehab - Segment B", title: "Initial Estimate", status: "Submitted", dateCreated: d(2025, 1, 12), dueDate: d(2025, 2, 15), lastUpdated: nowIso() },
    { estimateId: "2003", client: "Drainage Improvements", title: "Revised Estimate", status: "Approved", dateCreated: d(2024, 12, 18), dueDate: d(2025, 1, 20), lastUpdated: nowIso() },

    // Completed estimates (view/search/edit same as others)
    { estimateId: "1801", client: "Culvert Replacement - Site 12", title: "Final Estimate", status: "Completed", dateCreated: d(2024, 5, 14), dueDate: d(2024, 6, 30), lastUpdated: nowIso() },
    { estimateId: "1802", client: "Road Shoulder Widening", title: "As-Built Estimate", status: "Completed", dateCreated: d(2023, 10, 2), dueDate: d(2023, 12, 15), lastUpdated: nowIso() },
    { estimateId: "1803", client: "Bridge Paint & Rehab", title: "Closeout Estimate", status: "Completed", dateCreated: d(2022, 8, 20), dueDate: d(2022, 10, 1), lastUpdated: nowIso() },
    { estimateId: "1804", client: "Retaining Wall Repair", title: "Completed Scope", status: "Completed", dateCreated: d(2021, 4, 12), dueDate: d(2021, 6, 1), lastUpdated: nowIso() }
  ];

  saveHeaders(headers);

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
    { item: "1010", description: "Mobilization", uom: "LS", qty: 1, unitRate: 12500 },
    { item: "1020", description: "Traffic control", uom: "day", qty: 12, unitRate: 850 },
    { item: "1030", description: "Survey & layout", uom: "LS", qty: 1, unitRate: 3800 }
  ]);

  seedLines("2001", [
    { description: "Asphalt paving", uom: "t", qty: 450, unitRate: 145 },
    { description: "Line painting", uom: "km", qty: 12, unitRate: 1800 },
    { description: "Shoulder grading", uom: "km", qty: 8, unitRate: 9500 }
  ]);

  seedLines("2002", [
    { description: "Concrete repair", uom: "m2", qty: 120, unitRate: 310 },
    { description: "Rebar replacement", uom: "kg", qty: 900, unitRate: 6.5 }
  ]);

  seedLines("1801", [
    { description: "Culvert supply", uom: "ea", qty: 1, unitRate: 42000, notes: "Delivered" },
    { description: "Excavation & install", uom: "LS", qty: 1, unitRate: 28500, notes: "Completed" },
    { description: "Backfill & compaction", uom: "LS", qty: 1, unitRate: 9800, notes: "Completed" }
  ]);

  seedLines("1802", [
    { description: "Granular base", uom: "t", qty: 620, unitRate: 42 },
    { description: "Paving (wear course)", uom: "t", qty: 300, unitRate: 155 }
  ]);

  seedLines("1803", [
    { description: "Containment setup", uom: "LS", qty: 1, unitRate: 12000 },
    { description: "Surface prep", uom: "m2", qty: 850, unitRate: 28 },
    { description: "Coating system", uom: "m2", qty: 850, unitRate: 35 }
  ]);

  seedLines("1804", [
    { description: "Concrete patch", uom: "m2", qty: 60, unitRate: 320 },
    { description: "Drainage improvements", uom: "LS", qty: 1, unitRate: 7800 }
  ]);
}

export default function App() {
  useMemo(() => {
    seedIfEmpty();
    return null;
  }, []);

  // breakpoints: iPhone-ish, tablet, small desktop, large desktop
  const [vp, setVp] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight
  }));

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isPhone = vp.w <= 480;
  const isTablet = vp.w > 480 && vp.w <= 768;
  const isSmallDesktop = vp.w > 768 && vp.w < 1400;
  const isLargeDesktop = vp.w >= 1400;

  // Sidebar behavior:
  // - phone/tablet: drawer
  // - desktop: always visible
  const isDrawer = isPhone || isTablet;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);

  useEffect(() => {
    setSidebarOpen(!isDrawer);
  }, [isDrawer]);

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

  // Default date range:
  // - desktop: 2 years
  // - phone: 1 year (less scrolling)
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - (isPhone ? 365 : 730));
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

  function updateHeader(estimateId: string, patch: Partial<EstimateHeader>) {
    const updated = headers.map((h) =>
      h.estimateId === estimateId ? { ...h, ...patch, lastUpdated: nowIso() } : h
    );
    setHeaders(updated);
    saveHeaders(updated);
  }

  function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setLines(loadLines(id));
    setView("EstimateDetail");
    setTopNav("Estimates");
    if (isDrawer) setSidebarOpen(false);
  }

  function saveCurrentEstimate() {
    if (!selectedEstimateId) return;
    saveLines(selectedEstimateId, lines);
    updateHeader(selectedEstimateId, {});
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
    if (isDrawer) setSidebarOpen(false);
  }

  // Grid columns
  const estimatesListCols = useMemo<ColDef<EstimateHeader>[]>(() => {
    return [
      { field: "estimateId", headerName: "ID", width: 90 },
      { field: "client", headerName: "Client", flex: 1, minWidth: 200 },
      { field: "title", headerName: "Title", flex: 1, minWidth: 220 },
      {
        field: "dateCreated",
        headerName: "Date Created",
        width: 140,
        valueFormatter: (p) => formatDate(String(p.value || ""))
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        cellRenderer: (p: any) => {
          const v = p.value as Status;
          const { bg, fg } = statusColors(v);
          return `<span style="
              display:inline-flex;align-items:center;
              padding:3px 8px;border-radius:999px;
              font-weight:900;font-size:12px;
              background:${bg};color:${fg};
            ">${v}</span>`;
        }
      },
      {
        headerName: "Amount",
        width: 150,
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
      { field: "description", headerName: "Description", editable: true, flex: 1, minWidth: 300 },
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
        width: 150,
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

  // Status colors (light theme)
  function statusColors(s: Status): { bg: string; fg: string } {
    if (s === "Draft") return { bg: "#e0f2fe", fg: "#075985" };
    if (s === "Submitted") return { bg: "#fef3c7", fg: "#92400e" };
    if (s === "Approved") return { bg: "#dcfce7", fg: "#166534" };
    return { bg: "#e5e7eb", fg: "#111827" }; // Completed
  }

  const styles = `
    :root {
      --bg: #f3f6fb;
      --card: #ffffff;
      --border: #e5e7eb;
      --text: #0f172a;
      --muted: #64748b;
      --primary: #2563eb;
      --primarySoft: #eef2ff;
      --shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
    }

    html, body, #root { height: 100%; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    * { box-sizing: border-box; }

    .app {
      height: 100vh;
      display: grid;
      grid-template-rows: 56px 1fr;
      font-family: system-ui, Segoe UI, Arial;
      min-width: 0;
      min-height: 0;
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

    .leftTop {
      display: flex;
      align-items: center;
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

    .topnav {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      overflow: auto;
    }
    .topnav-item {
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 900;
      color: #334155;
      white-space: nowrap;
    }
    .topnav-item.active { color: #1d4ed8; background: var(--primarySoft); }

    /* Main layout:
       - desktop: sidebar + content
       - large desktop: slightly wider sidebar and content breathing room
    */
    .main {
      display: grid;
      grid-template-columns: ${isLargeDesktop ? "280px 1fr" : "250px 1fr"};
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
      font-weight: 900;
      font-size: 13px;
      color: #334155;
      margin-bottom: 6px;
    }
    .side-item.active { color: #1d4ed8; background: var(--primarySoft); }

    .content {
      padding: ${isLargeDesktop ? "18px 22px" : "14px 16px"};
      min-height: 0;
      min-width: 0;

      /* key: allow children to use height and fill the screen */
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pageHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .title { font-size: 22px; font-weight: 900; margin: 0; }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);

      /* key: card can expand */
      min-height: 0;
      min-width: 0;
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

    .input, .select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      outline: none;
      background: white;
      font-weight: 800;
      color: #0f172a;
    }

    .subtle { font-size: 12px; color: var(--muted); }

    /* Filters: desktop uses a wider grid, large desktop uses more columns */
    .filters {
      display: grid;
      grid-template-columns: ${isLargeDesktop
        ? "minmax(260px, 1fr) 200px 180px 180px auto"
        : "minmax(220px, 1fr) 180px 160px 160px auto"};
      gap: 10px;
      align-items: center;
    }

    /* List page layout: filters + grid fill remaining height */
    .listCard {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }
    .gridWrap {
      flex: 1;
      min-height: 360px;
      min-width: 0;
    }

    /* Detail page: header + summary + grid fill remaining height */
    .detailHeader {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .summaryGrid {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr));
      gap: 12px;
    }

    .detailCard {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }

    .detailToolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 900;
      font-size: 12px;
    }

    /* Drawer behavior for phone/tablet */
    @media (max-width: 768px) {
      .hamburger { display: inline-flex; }
      .main { grid-template-columns: 1fr; }

      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: 270px;
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

      .filters { grid-template-columns: 1fr 1fr; }

      .summaryGrid { grid-template-columns: 1fr; }

      .gridWrap { min-height: 420px; } /* phone: keep grid usable */
    }

    @media (max-width: 480px) {
      .filters { grid-template-columns: 1fr; }
    }
  `;

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        {/* Top bar */}
        <div className="topbar">
          <div className="leftTop">
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

            <div className="topnav">
              {(["Dashboard", "Estimates", "Reports", "Settings"] as TopNav[]).map((t) => (
                <div
                  key={t}
                  className={`topnav-item ${topNav === t ? "active" : ""}`}
                  onClick={() => {
                    setTopNav(t);
                    if (t === "Estimates") setView("EstimatesList");
                    else setView("EstimatesList");
                    if (isDrawer) setSidebarOpen(false);
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#334155" }}>
            <div style={{ fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
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
          {/* Overlay for drawer */}
          {isDrawer && sidebarOpen && (
            <div className="overlay" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <div
              className="side-item"
              onClick={() => {
                setTopNav("Dashboard");
                setView("EstimatesList");
                if (isDrawer) setSidebarOpen(false);
              }}
            >
              ▢ Dashboard
            </div>

            <div
              className={`side-item ${topNav === "Estimates" ? "active" : ""}`}
              onClick={() => {
                setTopNav("Estimates");
                setView("EstimatesList");
                if (isDrawer) setSidebarOpen(false);
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
                <div className="pageHeader">
                  <div className="title">Estimates</div>
                  <button
                    className="btn-primary"
                    onClick={() => setView("CreateEstimate")}
                  >
                    Create Estimate
                  </button>
                </div>

                <div className="card listCard">
                  <div className="filters">
                    <input
                      className="input"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search… (client, title, ID, status)"
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
                      <option value="Completed">Completed</option>
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
                        d.setDate(d.getDate() - (isPhone ? 365 : 730));
                        setFromDate(toIsoDateOnly(d));
                        setToDate(toIsoDateOnly(new Date()));
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="gridWrap">
                    <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
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
                  </div>

                  <div className="subtle">
                    Tip: Filter by **Completed** to see closed-out estimates. Click any row to open and edit.
                  </div>
                </div>
              </>
            )}

            {/* Create Estimate */}
            {view === "CreateEstimate" && (
              <>
                <div className="pageHeader">
                  <div className="title">Create Estimate</div>
                  <button className="btn-ghost" onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>

                <div className="card" style={{ padding: 14, maxWidth: isSmallDesktop ? 880 : 980 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Client</div>
                      <input
                        className="input"
                        value={newClient}
                        onChange={(e) => setNewClient(e.target.value)}
                        placeholder="Example: Bridge Rehab - Segment B"
                      />
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Title</div>
                      <input
                        className="input"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Example: Initial Estimate"
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
                <div className="detailHeader">
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 900 }}>
                      ID {selectedHeader.estimateId}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedHeader.client}</div>
                    <div style={{ fontSize: 13, color: "#334155", fontWeight: 900 }}>
                      {selectedHeader.title}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

                <div className="summaryGrid">
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
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <span
                        className="pill"
                        style={{
                          background: statusColors(selectedHeader.status).bg,
                          color: statusColors(selectedHeader.status).fg
                        }}
                      >
                        {selectedHeader.status}
                      </span>

                      <select
                        className="select"
                        style={{ width: 180 }}
                        value={selectedHeader.status}
                        onChange={(e) => updateHeader(selectedHeader.estimateId, { status: e.target.value as Status })}
                        title="Change status"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Approved">Approved</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card detailCard">
                  <div className="detailToolbar">
                    <div style={{ fontWeight: 900 }}>Estimate Line Items</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn-ghost" onClick={exportDetailCsv}>Export</button>
                      <button className="btn-ghost" onClick={deleteSelectedLines}>Delete</button>
                      <button className="btn-primary" onClick={addLine}>Add Item</button>
                      <button className="btn-primary" onClick={saveCurrentEstimate}>Save</button>
                    </div>
                  </div>

                  <div className="gridWrap">
                    <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
                      <AgGridReact<EstimateLine>
                        rowData={lines}
                        columnDefs={estimateDetailCols}
                        defaultColDef={{ resizable: true, sortable: true, filter: true }}
                        rowSelection="multiple"
                        getRowId={(p) => p.data.lineId}
                        singleClickEdit={true}
                        stopEditingWhenCellsLoseFocus={true}
                        onGridReady={(e) => (detailApiRef.current = e.api)}
                        onCellValueChanged={() => updateHeader(selectedHeader.estimateId, {})}
                      />
                    </div>
                  </div>

                  <div className="subtle">
                    Completed estimates are still editable in this PoC (front-end only). Later we can lock editing based on status.
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
