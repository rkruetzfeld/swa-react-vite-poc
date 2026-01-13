import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  RowClickedEvent,
  ValueParserParams
} from "ag-grid-community";

type TopNav = "Dashboard" | "Estimates" | "Reports" | "Settings";
type View = "EstimatesList" | "EstimateDetail" | "CreateEstimate";
type Status = "Draft" | "Submitted" | "Approved" | "Completed";

<div className="card" style={{ padding: 12 }}>
  <div style={{ fontWeight: 900, marginBottom: 8 }}>AG Grid Render Test</div>

  <div className="ag-theme-quartz" style={{ height: 320, width: "100%" }}>
    <AgGridReact rowData={testRows} columnDefs={testCols as any} />
  </div>
</div>



type EstimateHeader = {
  estimateId: string;
  client: string;
  title: string;
  status: Status;
  dateCreated: string; // ISO
  dueDate: string; // ISO
  lastUpdated: string; // ISO
};

type ItemCatalog = {
  itemCode: string;
  description: string;
  uom: string;
  defaultUnitRate: number;
};

type EstimateLine = {
  lineId: string;
  lineNo: number; // for ordering/display
  item: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes: string;
};

const LS_HEADERS = "poc_estimate_headers_v6";
const LS_LINES_PREFIX = "poc_estimate_lines_v6__";
const LS_SEEDED = "poc_seeded_v6";

const PAGE_SIZE = 20;

const testRows = [
  { a: "Row 1", b: 10, c: "Open" },
  { a: "Row 2", b: 20, c: "Draft" },
];

const testCols = [
  { field: "a", headerName: "Col A" },
  { field: "b", headerName: "Col B" },
  { field: "c", headerName: "Status" },
];



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
function parseNumber(p: ValueParserParams): number {
  const raw = String(p.newValue ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
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

/** Simple item catalog (can be expanded later) */
const SAMPLE_ITEMS: ItemCatalog[] = [
  { itemCode: "1010", description: "Mobilization", uom: "LS", defaultUnitRate: 12500 },
  { itemCode: "1020", description: "Traffic control", uom: "day", defaultUnitRate: 850 },
  { itemCode: "1030", description: "Survey & layout", uom: "LS", defaultUnitRate: 3800 },
  { itemCode: "2010", description: "Excavation (common)", uom: "m3", defaultUnitRate: 22 },
  { itemCode: "2020", description: "Granular base supply", uom: "t", defaultUnitRate: 42 },
  { itemCode: "2030", description: "Asphalt paving", uom: "t", defaultUnitRate: 155 },
  { itemCode: "2040", description: "Concrete repair", uom: "m2", defaultUnitRate: 310 },
  { itemCode: "2050", description: "Rebar replacement", uom: "kg", defaultUnitRate: 6.5 },
  { itemCode: "2060", description: "Line painting", uom: "km", defaultUnitRate: 1800 },
  { itemCode: "2070", description: "Shoulder grading", uom: "km", defaultUnitRate: 9500 },
  { itemCode: "3010", description: "Culvert supply (typ.)", uom: "ea", defaultUnitRate: 42000 },
  { itemCode: "3020", description: "Culvert install (typ.)", uom: "LS", defaultUnitRate: 28500 },
  { itemCode: "3030", description: "Backfill & compaction", uom: "LS", defaultUnitRate: 9800 }
];

function statusColors(s: Status): { bg: string; fg: string } {
  if (s === "Draft") return { bg: "#e0f2fe", fg: "#075985" };
  if (s === "Submitted") return { bg: "#fef3c7", fg: "#92400e" };
  if (s === "Approved") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#e5e7eb", fg: "#111827" }; // Completed
}

/**
 * Seed:
 * - creates sample estimate headers
 * - creates lines for each estimate (>= 20 rows each)
 * - ensures user sees sample data immediately
 */
function seedIfNeeded() {
  const already = localStorage.getItem(LS_SEEDED);
  if (already === "1") return;

  const existingHeaders = loadHeaders();
  if (existingHeaders.length > 0) {
    localStorage.setItem(LS_SEEDED, "1");
    return;
  }

  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day).toISOString();

  const headers: EstimateHeader[] = [
    {
      estimateId: "2001",
      client: "Highway 1 Resurfacing",
      title: "Class D Estimate",
      status: "Draft",
      dateCreated: d(2025, 1, 5),
      dueDate: d(2025, 2, 10),
      lastUpdated: nowIso()
    },
    {
      estimateId: "2002",
      client: "Bridge Rehab - Segment B",
      title: "Initial Estimate",
      status: "Submitted",
      dateCreated: d(2025, 1, 12),
      dueDate: d(2025, 2, 15),
      lastUpdated: nowIso()
    },
    {
      estimateId: "1801",
      client: "Culvert Replacement - Site 12",
      title: "Final Estimate",
      status: "Completed",
      dateCreated: d(2024, 5, 14),
      dueDate: d(2024, 6, 30),
      lastUpdated: nowIso()
    }
  ];

  saveHeaders(headers);

  const pick = (code: string) => SAMPLE_ITEMS.find((i) => i.itemCode === code)!;

  const makeLines = (estimateId: string, pattern: string[]): EstimateLine[] => {
    const lines: EstimateLine[] = [];
    for (let i = 1; i <= 25; i++) {
      const item = pick(pattern[(i - 1) % pattern.length]);
      const qty = i % 5 === 0 ? 1 : (i % 3 === 0 ? 10 : (i % 2 === 0 ? 25 : 5));
      const unitRate = item.defaultUnitRate;
      lines.push({
        lineId: uuid(),
        lineNo: i,
        item: item.itemCode,
        description: item.description,
        uom: item.uom,
        qty,
        unitRate,
        notes: i % 7 === 0 ? "Review quantity" : ""
      });
    }
    return lines;
  };

  saveLines("2001", makeLines("2001", ["1010", "1020", "2020", "2030", "2060", "2070"]));
  saveLines("2002", makeLines("2002", ["1010", "1030", "2040", "2050", "2060"]));
  saveLines("1801", makeLines("1801", ["3010", "3020", "3030", "1020", "2010"]));

  localStorage.setItem(LS_SEEDED, "1");
}

export default function App() {
  useMemo(() => {
    seedIfNeeded();
    return null;
  }, []);

  // Responsive
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
  const isDrawer = isPhone || isTablet;

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

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

  // Estimate list filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - (isPhone ? 365 : 730));
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState<string>(() => toIsoDateOnly(new Date()));

  // Catalog selector for adding lines
  const [items] = useState<ItemCatalog[]>(() => SAMPLE_ITEMS);
  const [selectedItemCode, setSelectedItemCode] = useState<string>(() => SAMPLE_ITEMS[0]?.itemCode ?? "");
  const selectedItem = useMemo(() => items.find((i) => i.itemCode === selectedItemCode) ?? null, [items, selectedItemCode]);

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

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

  function persistHeaders(updated: EstimateHeader[]) {
    setHeaders(updated);
    saveHeaders(updated);
  }

  function updateHeader(estimateId: string, patch: Partial<EstimateHeader>) {
    const updated = headers.map((h) =>
      h.estimateId === estimateId ? { ...h, ...patch, lastUpdated: nowIso() } : h
    );
    persistHeaders(updated);
  }

  function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setLines(loadLines(id));
    setView("EstimateDetail");
    setTopNav("Estimates");
    if (isDrawer) setSidebarOpen(false);
  }

  const estimateTotal = useMemo(() => {
    return lines.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0), 0);
  }, [lines]);

  function saveCurrentEstimate(silent?: boolean) {
    if (!selectedEstimateId) return;
    saveLines(selectedEstimateId, lines);
    updateHeader(selectedEstimateId, {});
    if (!silent) alert("Saved (localStorage).");
  }

  function nextLineNo(): number {
    const max = lines.reduce((m, r) => Math.max(m, r.lineNo || 0), 0);
    return max + 1;
  }

  /** This is the button you care about: it always inserts a real row */
  function addItemLine() {
    if (!selectedEstimateId) {
      alert("Open an estimate first.");
      return;
    }
    if (!selectedItem) {
      alert("Select an item first.");
      return;
    }

    const newRow: EstimateLine = {
      lineId: uuid(),
      lineNo: nextLineNo(),
      item: selectedItem.itemCode,
      description: selectedItem.description,
      uom: selectedItem.uom,
      qty: 1,
      unitRate: selectedItem.defaultUnitRate,
      notes: ""
    };

    setLines((prev) => {
      const updated = [...prev, newRow];
      return updated;
    });

    // Ensure the grid shows it immediately and persists
    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);

    setTimeout(() => saveCurrentEstimate(true), 0);
  }

  function addBlankLine() {
    if (!selectedEstimateId) {
      alert("Open an estimate first.");
      return;
    }
    const newRow: EstimateLine = {
      lineId: uuid(),
      lineNo: nextLineNo(),
      item: "",
      description: "",
      uom: "",
      qty: 0,
      unitRate: 0,
      notes: ""
    };

    setLines((prev) => [...prev, newRow]);
    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);

    setTimeout(() => saveCurrentEstimate(true), 0);
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
    const updated = lines.filter((r) => !ids.has(r.lineId));
    setLines(updated);
    if (selectedEstimateId) saveLines(selectedEstimateId, updated);
  }

  function exportDetailCsv() {
    const api = detailApiRef.current;
    if (!api) return;
    const fileName = selectedEstimateId ? `estimate-${selectedEstimateId}.csv` : "estimate.csv";
    api.exportDataAsCsv({ fileName });
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

    const updatedHeaders = [header, ...headers];
    persistHeaders(updatedHeaders);

    // Pre-fill 25 lines (Excel-like grid)
    const seedLines: EstimateLine[] = [];
    for (let i = 1; i <= 25; i++) {
      const item = SAMPLE_ITEMS[(i - 1) % SAMPLE_ITEMS.length];
      seedLines.push({
        lineId: uuid(),
        lineNo: i,
        item: item.itemCode,
        description: item.description,
        uom: item.uom,
        qty: i % 4 === 0 ? 1 : 5,
        unitRate: item.defaultUnitRate,
        notes: ""
      });
    }

    saveLines(id, seedLines);
    setSelectedEstimateId(id);
    setLines(seedLines);
    setNewClient("");
    setNewTitle("");
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
  }

  // Grids
  const estimatesListCols = useMemo<ColDef<EstimateHeader>[]>(() => {
    return [
      { field: "estimateId", headerName: "ID", width: 90 },
      { field: "client", headerName: "Client", flex: 1, minWidth: 220 },
      { field: "title", headerName: "Title", flex: 1, minWidth: 240 },
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
        width: 160,
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
      { field: "lineNo", headerName: "#", width: 70, editable: false },
      { field: "item", headerName: "Item", editable: true, width: 100 },
      { field: "description", headerName: "Description", editable: true, flex: 1, minWidth: 340 },
      { field: "uom", headerName: "UOM", editable: true, width: 90 },
      { field: "qty", headerName: "Qty", editable: true, width: 110, valueParser: parseNumber },
      { field: "unitRate", headerName: "Price", editable: true, width: 150, valueParser: parseNumber, valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0) },
      { headerName: "Total", width: 160, valueGetter: (p) => (Number(p.data?.qty) || 0) * (Number(p.data?.unitRate) || 0), valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0) },
      { field: "notes", headerName: "Notes", editable: true, width: 220 }
    ];
  }, []);

  // Styles: key change = content uses full width, grid fills remaining height, no fixed calc() heights.
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
      min-width: 0;
      min-height: 0;
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

    .main {
      display: grid;
      grid-template-columns: 260px 1fr;
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
      padding: 12px 14px;
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;

      /* this is what makes it expand to full browser width */
      width: 100%;
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
      min-height: 0;
      min-width: 0;
      width: 100%;
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

    .filters {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) 180px 160px 160px auto;
      gap: 10px;
      align-items: center;
    }

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
      min-height: 0;
      min-width: 0;
      height: 100%;
    }

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
      width: 100%;
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
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 10px;
      align-items: end;
    }

    .toolbarRight {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 10px;
      align-items: center;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 900;
      font-size: 12px;
    }

    @media (max-width: 1024px) {
      .detailToolbar { grid-template-columns: 1fr; }
      .toolbarRight { grid-template-columns: 1fr 1fr; }
      .filters { grid-template-columns: 1fr 1fr; }
      .summaryGrid { grid-template-columns: 1fr; }
    }

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
            <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} title="Menu">
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
          {isDrawer && sidebarOpen && (
            <div className="overlay" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="side-item" onClick={() => alert("PoC: Dashboard not implemented")}>
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

            <div className="side-item" onClick={() => alert("PoC: Reports not implemented")}>
              ▤ Reports
            </div>

            <div className="side-item" onClick={() => alert("PoC: Settings not implemented")}>
              ⚙ Settings
            </div>

            <div style={{ marginTop: 10 }} className="subtle">
              PoC: data is saved in browser localStorage
            </div>

            <button
              className="btn-ghost"
              style={{ marginTop: 10, width: "100%" }}
              onClick={() => {
                localStorage.removeItem(LS_HEADERS);
                // wipe all known estimates lines by wiping prefix keys (simple approach: full clear PoC)
                // safer for PoC: clear everything we wrote
                Object.keys(localStorage)
                  .filter((k) => k.startsWith(LS_LINES_PREFIX) || k === LS_SEEDED)
                  .forEach((k) => localStorage.removeItem(k));
                localStorage.removeItem(LS_SEEDED);
                seedIfNeeded();
                setHeaders(loadHeaders());
                const first = loadHeaders()[0]?.estimateId ?? null;
                setSelectedEstimateId(first);
                setLines(first ? loadLines(first) : []);
                setView("EstimatesList");
                alert("Reset sample data.");
              }}
            >
              Reset Sample Data
            </button>
          </div>

          {/* Content */}
          <div className="content">
            {/* Estimates List */}
            {view === "EstimatesList" && (
              <>
                <div className="pageHeader">
                  <div className="title">Estimates</div>
                  <button className="btn-primary" onClick={() => setView("CreateEstimate")}>
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
                    Click an estimate row to open the Excel-like line-entry grid.
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

                <div className="card" style={{ padding: 14, maxWidth: 980 }}>
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
                        Create (pre-fills 25 lines)
                      </button>
                      <button className="btn-ghost" onClick={() => setView("EstimatesList")}>
                        Cancel
                      </button>
                    </div>

                    <div className="subtle">Creates a Draft estimate with sample lines.</div>
                  </div>
                </div>
              </>
            )}

            {/* Estimate Detail */}
            {view === "EstimateDetail" && selectedHeader && (
              <>
                <div className="detailHeader">
                  <div style={{ display: "grid", gap: 4, minWidth: 260 }}>
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
                        onChange={(e) =>
                          updateHeader(selectedHeader.estimateId, { status: e.target.value as Status })
                        }
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
                    <div style={{ fontWeight: 900 }}>
                      Estimate Line Items (Excel-style) — page size {PAGE_SIZE}
                      <div className="subtle">Double-click to edit. Changes auto-save.</div>
                    </div>

                    {/* Right: Add item + action buttons */}
                    <div className="toolbarRight">
                      <select
                        className="select"
                        value={selectedItemCode}
                        onChange={(e) => setSelectedItemCode(e.target.value)}
                        title="Select an item to add"
                      >
                        {items.map((it) => (
                          <option key={it.itemCode} value={it.itemCode}>
                            {it.itemCode} — {it.description} ({it.uom})
                          </option>
                        ))}
                      </select>

                      <button className="btn-primary" onClick={addItemLine} title="Adds selected item as a new line">
                        Add Item
                      </button>

                      <button className="btn-ghost" onClick={addBlankLine} title="Adds an empty editable row">
                        Add Blank
                      </button>

                      <button className="btn-ghost" onClick={exportDetailCsv}>
                        Export
                      </button>
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
                        singleClickEdit={false}
                        stopEditingWhenCellsLoseFocus={true}
                        pagination={true}
                        paginationPageSize={PAGE_SIZE}
                        onGridReady={(e) => {
                          detailApiRef.current = e.api;
                          // Ensure it sizes to full width on load
                          setTimeout(() => e.api.sizeColumnsToFit(), 50);
                        }}
                        onFirstDataRendered={(e) => {
                          // Fit columns to available width (desktop + resize-friendly)
                          e.api.sizeColumnsToFit();
                        }}
                        onGridSizeChanged={(e) => {
                          // Make it expand when browser resizes
                          e.api.sizeColumnsToFit();
                        }}
                        onCellValueChanged={() => {
                          // Auto-save on any edit
                          if (!selectedEstimateId) return;
                          saveLines(selectedEstimateId, lines);
                          updateHeader(selectedHeader.estimateId, {});
                        }}
                        onRowValueChanged={() => {
                          if (!selectedEstimateId) return;
                          saveLines(selectedEstimateId, lines);
                          updateHeader(selectedHeader.estimateId, {});
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="subtle">
                      Select rows and use the grid’s built-in filter/sort. Multi-select rows to delete.
                    </div>
                    <button className="btn-ghost" onClick={deleteSelectedLines}>
                      Delete Selected
                    </button>
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
