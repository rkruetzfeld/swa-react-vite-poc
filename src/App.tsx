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

/**
 * Structured Cost Code format (PoC):
 *  NN-AAAAA-NNN-NNN  (example: 60-CONS-020-001)
 */
const COST_CODE_REGEX = /^\d{2}-[A-Z]{3,10}-\d{3}-\d{3}$/;

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
  costCode: string;
  description: string;
  uom: string;
  defaultUnitRate: number;
  section: string;
};

type EstimateLine = {
  lineId: string;
  lineNo: number;
  section: string; // grouping
  costCode: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes: string;
};

const LS_HEADERS = "poc_estimate_headers_v8";
const LS_LINES_PREFIX = "poc_estimate_lines_v8__";
const LS_SEEDED = "poc_seeded_v8";

const PAGE_SIZE = 20;

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

function statusColors(s: Status): { bg: string; fg: string } {
  if (s === "Draft") return { bg: "#e0f2fe", fg: "#075985" };
  if (s === "Submitted") return { bg: "#fef3c7", fg: "#92400e" };
  if (s === "Approved") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#e5e7eb", fg: "#111827" }; // Completed
}

/** UOM list for dropdown editor */
const UOM_OPTIONS = [
  "LS",
  "ea",
  "day",
  "km",
  "m",
  "m2",
  "m3",
  "t",
  "kg"
] as const;

/** Sample item catalog using structured cost codes */
const SAMPLE_ITEMS: ItemCatalog[] = [
  // Preliminaries
  { costCode: "60-CONS-010-001", description: "Mobilization", uom: "LS", defaultUnitRate: 12500, section: "Preliminaries" },
  { costCode: "60-CONS-010-002", description: "Traffic Control (daily)", uom: "day", defaultUnitRate: 850, section: "Preliminaries" },
  { costCode: "60-CONS-010-003", description: "Survey & Layout", uom: "LS", defaultUnitRate: 3800, section: "Preliminaries" },

  // Earthworks
  { costCode: "60-CONS-020-001", description: "Excavation (common)", uom: "m3", defaultUnitRate: 22, section: "Earthworks" },
  { costCode: "60-CONS-020-002", description: "Backfill & Compaction", uom: "m3", defaultUnitRate: 18, section: "Earthworks" },
  { costCode: "60-CONS-020-003", description: "Shoulder Grading", uom: "km", defaultUnitRate: 9500, section: "Earthworks" },

  // Roadworks
  { costCode: "60-CONS-030-001", description: "Granular Base Supply", uom: "t", defaultUnitRate: 42, section: "Roadworks" },
  { costCode: "60-CONS-030-002", description: "Asphalt Paving", uom: "t", defaultUnitRate: 155, section: "Roadworks" },
  { costCode: "60-CONS-030-003", description: "Line Painting", uom: "km", defaultUnitRate: 1800, section: "Roadworks" },

  // Structures
  { costCode: "60-CONS-040-001", description: "Concrete Repair", uom: "m2", defaultUnitRate: 310, section: "Structures" },
  { costCode: "60-CONS-040-002", description: "Rebar Replacement", uom: "kg", defaultUnitRate: 6.5, section: "Structures" },

  // Drainage
  { costCode: "60-CONS-050-001", description: "Culvert Supply (typ.)", uom: "ea", defaultUnitRate: 42000, section: "Drainage" },
  { costCode: "60-CONS-050-002", description: "Culvert Install (typ.)", uom: "LS", defaultUnitRate: 28500, section: "Drainage" }
];

const ITEM_BY_CODE = new Map(SAMPLE_ITEMS.map((i) => [i.costCode, i]));
const ITEM_CODES = SAMPLE_ITEMS.map((i) => i.costCode);

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

  const patterns: Record<string, string[]> = {
    "2001": ["60-CONS-010-001", "60-CONS-010-002", "60-CONS-030-001", "60-CONS-030-002", "60-CONS-030-003"],
    "2002": ["60-CONS-010-001", "60-CONS-010-003", "60-CONS-040-001", "60-CONS-040-002"],
    "1801": ["60-CONS-050-001", "60-CONS-050-002", "60-CONS-020-001", "60-CONS-020-002"]
  };

  const makeLines = (estimateId: string, pattern: string[]): EstimateLine[] => {
    const lines: EstimateLine[] = [];
    for (let i = 1; i <= 25; i++) {
      const code = pattern[(i - 1) % pattern.length];
      const item = ITEM_BY_CODE.get(code)!;

      const qty = i % 5 === 0 ? 1 : i % 3 === 0 ? 10 : i % 2 === 0 ? 25 : 5;

      lines.push({
        lineId: uuid(),
        lineNo: i,
        section: item.section,
        costCode: item.costCode,
        description: item.description,
        uom: item.uom,
        qty,
        unitRate: item.defaultUnitRate,
        notes: i % 7 === 0 ? "Review quantity" : ""
      });
    }
    return lines;
  };

  saveLines("2001", makeLines("2001", patterns["2001"]));
  saveLines("2002", makeLines("2002", patterns["2002"]));
  saveLines("1801", makeLines("1801", patterns["1801"]));

  localStorage.setItem(LS_SEEDED, "1");
}

export default function App() {
  useMemo(() => {
    seedIfNeeded();
    return null;
  }, []);

  // Viewport state for smart responsive decisions (not just CSS)
  const [vp, setVp] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight
  }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Breakpoints (practical, not fancy):
  const isPhone = vp.w <= 480;
  const isTablet = vp.w > 480 && vp.w <= 900;
  const isNarrow = vp.w <= 1024; // small laptop portrait / split screen
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

  const [items] = useState<ItemCatalog[]>(() => SAMPLE_ITEMS);
  const [selectedItemCode, setSelectedItemCode] = useState<string>(() => ITEM_CODES[0] ?? "");
  const selectedItem = useMemo(
    () => items.find((i) => i.costCode === selectedItemCode) ?? null,
    [items, selectedItemCode]
  );

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // List filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 730);
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
    return lines.reduce(
      (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0),
      0
    );
  }, [lines]);

  const pinnedBottomRow = useMemo(() => {
    const pinned: EstimateLine = {
      lineId: "PINNED_TOTAL",
      lineNo: 0,
      section: "",
      costCode: "",
      description: "TOTAL",
      uom: "",
      qty: 0,
      unitRate: 0,
      notes: ""
    };
    return [pinned];
  }, []);

  function nextLineNo(): number {
    const max = lines.reduce((m, r) => Math.max(m, r.lineNo || 0), 0);
    return max + 1;
  }

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
      section: selectedItem.section,
      costCode: selectedItem.costCode,
      description: selectedItem.description,
      uom: selectedItem.uom,
      qty: 1,
      unitRate: selectedItem.defaultUnitRate,
      notes: ""
    };

    setLines((prev) => {
      const updated = [...prev, newRow];
      saveLines(selectedEstimateId, updated);
      return updated;
    });

    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);
  }

  function addBlankLine() {
    if (!selectedEstimateId) {
      alert("Open an estimate first.");
      return;
    }

    const newRow: EstimateLine = {
      lineId: uuid(),
      lineNo: nextLineNo(),
      section: "General",
      costCode: "",
      description: "",
      uom: "",
      qty: 0,
      unitRate: 0,
      notes: ""
    };

    setLines((prev) => {
      const updated = [...prev, newRow];
      saveLines(selectedEstimateId, updated);
      return updated;
    });

    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);
  }

  function deleteSelectedLines() {
    const api = detailApiRef.current;
    if (!api || !selectedEstimateId) return;
    const selected = api.getSelectedRows() as EstimateLine[];
    if (!selected.length) {
      alert("Select one or more rows first.");
      return;
    }
    const ids = new Set(selected.map((r) => r.lineId));
    const updated = lines.filter((r) => !ids.has(r.lineId));
    setLines(updated);
    saveLines(selectedEstimateId, updated);
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

    const seedLines: EstimateLine[] = [];
    for (let i = 1; i <= 25; i++) {
      const item = SAMPLE_ITEMS[(i - 1) % SAMPLE_ITEMS.length];
      seedLines.push({
        lineId: uuid(),
        lineNo: i,
        section: item.section,
        costCode: item.costCode,
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
          return rows.reduce(
            (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0),
            0
          );
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
      { field: "section", headerName: "Section", rowGroup: true, hide: true },

      { field: "lineNo", headerName: "#", width: 70, editable: false },

      {
        field: "costCode",
        headerName: "Cost Code",
        width: 190,
        editable: true,

        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: {
          values: ITEM_CODES,
          searchType: "matchAny",
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },

        valueSetter: (p) => {
          const newCode = String(p.newValue ?? "").trim().toUpperCase();
          p.data.costCode = newCode;

          const found = ITEM_BY_CODE.get(newCode);
          if (found) {
            p.data.description = found.description;
            p.data.uom = found.uom;
            p.data.unitRate = found.defaultUnitRate;
            p.data.section = found.section;
          } else {
            p.data.section = "General";
          }
          return true;
        },

        cellClassRules: {
          "cell-invalid": (p) => {
            if (p.node.rowPinned) return false;
            const v = String(p.value ?? "").trim().toUpperCase();
            if (!v) return false;
            return !COST_CODE_REGEX.test(v);
          }
        }
      },

      {
        field: "description",
        headerName: "Description",
        editable: true,
        flex: 1,
        minWidth: 320,
        cellStyle: (p) => (p.node.rowPinned ? { fontWeight: "900" } : undefined)
      },

      {
        field: "uom",
        headerName: "UOM",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: Array.from(UOM_OPTIONS) }
      },

      {
        field: "qty",
        headerName: "Qty",
        width: 110,
        editable: true,
        valueParser: parseNumber,
        valueSetter: (p) => {
          const n = Number(p.newValue);
          p.data.qty = isFinite(n) ? Math.max(0, n) : 0;
          return true;
        }
      },

      {
        field: "unitRate",
        headerName: "Unit Rate",
        width: 150,
        editable: true,
        valueParser: parseNumber,
        valueSetter: (p) => {
          const n = Number(p.newValue);
          p.data.unitRate = isFinite(n) ? Math.max(0, n) : 0;
          return true;
        },
        valueFormatter: (p) => (p.node.rowPinned ? "" : formatCurrencyCAD(Number(p.value) || 0))
      },

      {
        headerName: "Line Total",
        width: 170,
        valueGetter: (p) => {
          if (p.node.rowPinned) return estimateTotal;
          return (Number(p.data?.qty) || 0) * (Number(p.data?.unitRate) || 0);
        },
        valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0),
        cellStyle: (p) => (p.node.rowPinned ? { fontWeight: "900" } : undefined)
      },

      { field: "notes", headerName: "Notes", editable: true, width: 240 }
    ];
  }, [estimateTotal]);

  // ---- STYLES (focus: full viewport usage + responsive) ----
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

    .cell-invalid {
      background: #fee2e2 !important;
      border: 1px solid #ef4444 !important;
    }

    /* Full-screen app */
    .app {
      height: 100%;
      width: 100%;
      display: grid;
      grid-template-rows: 56px 1fr;
      min-height: 0;
      min-width: 0;
      background: var(--bg);
      color: var(--text);
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

    /* Main area uses full remaining space */
    .main {
      min-height: 0;
      min-width: 0;
      display: grid;
      grid-template-columns: 280px 1fr;
    }

    .sidebar {
      background: var(--card);
      border-right: 1px solid var(--border);
      padding: 12px;
      min-height: 0;
      overflow: auto;
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

    /* Content must be allowed to stretch full height */
    .content {
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;

      /* key: allow full width + let inner panels scroll */
      padding: 12px 14px;
      overflow: hidden;
    }

    .pageHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .title { font-size: 22px; font-weight: 900; margin: 0; }

    /* Cards stretch to width. Height handled by layout */
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

    /* Estimates list layout: filters + grid fills available height */
    .listCard {
      display: flex;
      flex-direction: column;
      gap: 10px;

      /* key: let it grow to fill content space */
      flex: 1;
      min-height: 0;
      padding: 12px;
      overflow: hidden;
    }

    .filters {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) 180px 160px 160px auto;
      gap: 10px;
      align-items: center;
    }

    .gridWrap {
      flex: 1;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }

    /* Detail view: summary + grid fills remaining height */
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
      display: flex;
      flex-direction: column;
      gap: 10px;

      /* key: take all remaining space */
      flex: 1;
      min-height: 0;
      padding: 12px;
      overflow: hidden;
    }

    .detailToolbar {
      display: grid;
      grid-template-columns: 1fr 380px;
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

    /* Tablet / narrow screens */
    @media (max-width: 1024px) {
      .filters { grid-template-columns: 1fr 1fr; }
      .summaryGrid { grid-template-columns: 1fr; }
      .detailToolbar { grid-template-columns: 1fr; }
      .toolbarRight { grid-template-columns: 1fr 1fr; }
    }

    /* Drawer sidebar for tablet/phone */
    @media (max-width: 900px) {
      .hamburger { display: inline-flex; }
      .main { grid-template-columns: 1fr; }

      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: 280px;
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

    /* Phone polish: reduce topbar clutter a bit */
    @media (max-width: 480px) {
      .topnav { display: none; }
      .title { font-size: 20px; }
      .toolbarRight { grid-template-columns: 1fr; }
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
            {!isPhone && (
              <div style={{ fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                Welcome, John
              </div>
            )}
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
          {isDrawer && sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

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
                Object.keys(localStorage)
                  .filter((k) => k.startsWith(LS_LINES_PREFIX) || k === LS_SEEDED)
                  .forEach((k) => localStorage.removeItem(k));
                localStorage.removeItem(LS_SEEDED);

                seedIfNeeded();

                const reloaded = loadHeaders();
                setHeaders(reloaded);
                const first = reloaded[0]?.estimateId ?? null;
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
                        d.setDate(d.getDate() - 730);
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
                        columnDefs={useMemo<ColDef<EstimateHeader>[]>(() => [
                          { field: "estimateId", headerName: "ID", width: isPhone ? 90 : 90 },
                          { field: "client", headerName: "Client", flex: 1, minWidth: 220 },
                          { field: "title", headerName: "Title", flex: 1, minWidth: 240 },
                          {
                            field: "dateCreated",
                            headerName: "Date Created",
                            width: isPhone ? 120 : 140,
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
                            width: isPhone ? 140 : 160,
                            valueGetter: (p) => {
                              const id = p.data?.estimateId;
                              if (!id) return 0;
                              const rows = loadLines(id);
                              return rows.reduce(
                                (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0),
                                0
                              );
                            },
                            valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0)
                          },
                          {
                            field: "dueDate",
                            headerName: "Due Date",
                            width: isPhone ? 110 : 120,
                            valueFormatter: (p) => formatDate(String(p.value || ""))
                          }
                        ], [isPhone])}
                        defaultColDef={{ resizable: true, sortable: true, filter: true }}
                        rowSelection="single"
                        onGridReady={(e) => {
                          listApiRef.current = e.api;
                          setTimeout(() => e.api.sizeColumnsToFit(), 50);
                        }}
                        onGridSizeChanged={(e) => e.api.sizeColumnsToFit()}
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
                    <div style={{ fontSize: isPhone ? 18 : 22, fontWeight: 900 }}>
                      {selectedHeader.client}
                    </div>
                    {!isPhone && (
                      <div style={{ fontSize: 13, color: "#334155", fontWeight: 900 }}>
                        {selectedHeader.title}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {!isPhone && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Total</div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>
                          {formatCurrencyCAD(estimateTotal)}
                        </div>
                      </div>
                    )}

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
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 12,
                          background: statusColors(selectedHeader.status).bg,
                          color: statusColors(selectedHeader.status).fg
                        }}
                      >
                        {selectedHeader.status}
                      </span>

                      <select
                        className="select"
                        style={{ width: isPhone ? "100%" : 180 }}
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

                      {isPhone && (
                        <div style={{ fontWeight: 900, marginLeft: "auto" }}>
                          {formatCurrencyCAD(estimateTotal)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card detailCard">
                  <div className="detailToolbar">
                    <div style={{ fontWeight: 900 }}>
                      Estimate Line Items — page size {PAGE_SIZE}
                      <div className="subtle">
                        Double-click to edit. Copy/paste supported. Grouped by Section. Uses full viewport.
                      </div>
                    </div>

                    <div className="toolbarRight">
                      <select
                        className="select"
                        value={selectedItemCode}
                        onChange={(e) => setSelectedItemCode(e.target.value)}
                        title="Select a cost code to add"
                      >
                        {items.map((it) => (
                          <option key={it.costCode} value={it.costCode}>
                            {it.costCode} — {it.description} ({it.uom})
                          </option>
                        ))}
                      </select>

                      <button className="btn-primary" onClick={addItemLine}>
                        Add Item
                      </button>

                      {!isNarrow && (
                        <button className="btn-ghost" onClick={addBlankLine}>
                          Add Blank
                        </button>
                      )}

                      {!isPhone && (
                        <button className="btn-ghost" onClick={exportDetailCsv}>
                          Export
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="gridWrap">
                    <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
                      <AgGridReact<EstimateLine>
                        rowData={lines}
                        columnDefs={estimateDetailCols}
                        defaultColDef={{ resizable: true, sortable: true, filter: true, editable: true }}
                        getRowId={(p) => p.data.lineId}
                        rowSelection="multiple"
                        suppressRowClickSelection={true}

                        /* grouping */
                        groupDisplayType={"groupRows"}
                        autoGroupColumnDef={{
                          headerName: "Section",
                          minWidth: 240,
                          cellRendererParams: { suppressCount: false }
                        }}
                        groupDefaultExpanded={isPhone ? 0 : 1}

                        /* pinned total row */
                        pinnedBottomRowData={pinnedBottomRow}

                        /* Excel-ish editing/navigation */
                        enterNavigatesVertically={true}
                        enterNavigatesVerticallyAfterEdit={true}
                        stopEditingWhenCellsLoseFocus={true}
                        undoRedoCellEditing={true}
                        undoRedoCellEditingLimit={50}

                        /* Excel-ish copy/paste */
                        enableRangeSelection={true}
                        suppressClipboardPaste={false}
                        copyHeadersToClipboard={false}
                        processDataFromClipboard={(params) => params.data}

                        pagination={true}
                        paginationPageSize={PAGE_SIZE}

                        onGridReady={(e) => {
                          detailApiRef.current = e.api;
                          setTimeout(() => e.api.sizeColumnsToFit(), 80);
                        }}
                        onFirstDataRendered={(e) => e.api.sizeColumnsToFit()}
                        onGridSizeChanged={(e) => e.api.sizeColumnsToFit()}

                        onCellValueChanged={() => {
                          if (!selectedEstimateId) return;
                          setLines((prev) => {
                            const updated = [...prev];
                            saveLines(selectedEstimateId, updated);
                            updateHeader(selectedEstimateId, {});
                            return updated;
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="subtle">
                      Paste from Excel: copy a rectangular block and paste into the focused cell.
                      Invalid cost codes highlight in red.
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
