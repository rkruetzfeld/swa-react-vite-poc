// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  RowClickedEvent,
  ValueParserParams,
} from "ag-grid-community";

import "./App.css";

import type {
  EstimateHeader,
  EstimateLine,
  ItemCatalog,
  Status,
} from "./models/estimateModels";
import { estimateDataService } from "./services/estimateDataService";

/* Pages */
import ForecastPage from "./pages/ForecastPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";

/* Shared components */
import StatusPill, {
  type StatusTone,
} from "./components/StatusPill";

/* ---------------- constants ---------------- */

const PAGE_SIZE = 20;
const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

type TopArea = "Forms" | "Reports" | "Dashboards";
type FormsPage = "Estimates" | "Forecast";
type View = "EstimatesList" | "EstimateDetail" | "Forecast";

type PinKey = `Forms:${FormsPage}`;

/* ---------------- helpers ---------------- */

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
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "CAD",
  });
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

function parseDateOnlyToRangeStart(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDateOnlyToRangeEnd(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function statusToTone(s: Status): StatusTone {
  switch (s) {
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

/* ---------------- pins ---------------- */

function loadPins(): Set<PinKey> {
  try {
    const raw = localStorage.getItem("pinnedLinks");
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function savePins(pins: Set<PinKey>) {
  localStorage.setItem(
    "pinnedLinks",
    JSON.stringify(Array.from(pins.values()))
  );
}

/* ================== APP ================== */

export default function App() {
  /* ---------- viewport ---------- */

  const [vp, setVp] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isDrawer = vp.w <= 900;
  const [sidebarOpen, setSidebarOpen] = useState(!isDrawer);

  useEffect(() => {
    setSidebarOpen(!isDrawer);
  }, [isDrawer]);

  /* ---------- navigation ---------- */

  const [area, setArea] = useState<TopArea>("Forms");
  const [formsExpanded, setFormsExpanded] = useState(true);
  const [formsPage, setFormsPage] = useState<FormsPage>("Estimates");
  const [view, setView] = useState<View>("EstimatesList");

  const [pins, setPins] = useState<Set<PinKey>>(loadPins);
  useEffect(() => savePins(pins), [pins]);

  function togglePin(key: PinKey) {
    setPins((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  /* ---------- data ---------- */

  const [headers, setHeaders] = useState<EstimateHeader[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [linesByEstimate, setLinesByEstimate] = useState<
    Map<string, EstimateLine[]>
  >(new Map());

  const [loadingHeaders, setLoadingHeaders] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEstimateId, setSelectedEstimateId] =
    useState<string | null>(null);

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  /* ---------- filters ---------- */

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"All" | Status>("All");

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 730);
    return toIsoDateOnly(d);
  });

  const [toDate, setToDate] = useState(() =>
    toIsoDateOnly(new Date())
  );

  const [selectedItemCode, setSelectedItemCode] = useState("");

  /* ---------- derived ---------- */

  const itemByCode = useMemo(
    () => new Map(items.map((i) => [i.costCode, i])),
    [items]
  );

  const itemCodes = useMemo(
    () => items.map((i) => i.costCode),
    [items]
  );

  const selectedHeader = useMemo(
    () =>
      headers.find((h) => h.estimateId === selectedEstimateId) ??
      null,
    [headers, selectedEstimateId]
  );

  const currentLines = useMemo(() => {
    if (!selectedEstimateId) return [];
    return linesByEstimate.get(selectedEstimateId) ?? [];
  }, [linesByEstimate, selectedEstimateId]);

  const estimateTotal = useMemo(
    () =>
      currentLines.reduce(
        (sum, r) =>
          sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0),
        0
      ),
    [currentLines]
  );

  const pinnedBottomRow = useMemo<EstimateLine[]>(
    () => [
      {
        lineId: "PINNED_TOTAL",
        lineNo: 0,
        section: "",
        costCode: "",
        description: "TOTAL",
        uom: "",
        qty: 0,
        unitRate: 0,
        notes: "",
      },
    ],
    []
  );

  /* ---------- load ---------- */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);

        setLoadingHeaders(true);
        const h = await estimateDataService.getEstimateHeaders();
        if (cancelled) return;
        setHeaders(h);
        setSelectedEstimateId(h[0]?.estimateId ?? null);
        setLoadingHeaders(false);

        setLoadingItems(true);
        const it = await estimateDataService.getItemCatalog();
        if (cancelled) return;
        setItems(it);
        setSelectedItemCode(it[0]?.costCode ?? "");
        setLoadingItems(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load data.");
        setLoadingHeaders(false);
        setLoadingItems(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- grid columns ---------- */

  const estimatesListCols = useMemo<
    ColDef<EstimateHeader>[]
  >(
    () => [
      { field: "estimateId", headerName: "ID", width: 90 },
      { field: "client", headerName: "Client", flex: 1 },
      { field: "title", headerName: "Title", flex: 1 },
      {
        field: "dateCreated",
        headerName: "Created",
        width: 140,
        valueFormatter: (p) => formatDate(String(p.value)),
      },
      {
        field: "status",
        headerName: "Status",
        width: 150,
        cellRenderer: (p: any) => {
          const s = p.value as Status;
          return (
            <StatusPill
              label={s}
              tone={statusToTone(s)}
              variant="grid"
            />
          );
        },
      },
      {
        field: "lastUpdated",
        headerName: "Updated",
        width: 140,
        valueFormatter: (p) => formatDate(String(p.value)),
      },
    ],
    []
  );

  const detailCols = useMemo<ColDef<EstimateLine>[]>(
    () => [
      { field: "section", rowGroup: true, hide: true },
      { field: "lineNo", headerName: "#", width: 70 },
      {
        field: "costCode",
        headerName: "Cost Code",
        width: 190,
        editable: true,
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: { values: itemCodes },
        valueSetter: (p) => {
          const code = String(p.newValue ?? "").toUpperCase();
          p.data.costCode = code;
          const it = itemByCode.get(code);
          if (it) {
            p.data.description = it.description;
            p.data.uom = it.uom;
            p.data.unitRate = it.defaultUnitRate;
            p.data.section = it.section;
          }
          return true;
        },
      },
      { field: "description", flex: 1, editable: true },
      {
        field: "uom",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: UOM_OPTIONS },
      },
      {
        field: "qty",
        width: 110,
        editable: true,
        valueParser: parseNumber,
      },
      {
        field: "unitRate",
        width: 150,
        editable: true,
        valueParser: parseNumber,
      },
      {
        headerName: "Line Total",
        width: 170,
        valueGetter: (p) =>
          p.node.rowPinned
            ? estimateTotal
            : (Number(p.data.qty) || 0) *
              (Number(p.data.unitRate) || 0),
        valueFormatter: (p) =>
          formatCurrencyCAD(Number(p.value)),
        cellStyle: (p) =>
          p.node.rowPinned ? { fontWeight: "900" } : undefined,
      },
      { field: "notes", width: 240, editable: true },
    ],
    [estimateTotal, itemCodes, itemByCode]
  );

  /* ---------- render ---------- */

  const gridTemplateColumns = isDrawer ? "1fr" : "320px 1fr";

  return (
    <div className="appShell">
      {/* TOP BAR */}
      <div className="topBar">
        <div className="brand">
          <div className="brandMark" />
          <div>Portal</div>
        </div>

        {isDrawer && (
          <button
            className="ghostBtn"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? "Close" : "Menu"}
          </button>
        )}
      </div>

      <div
        className="bodyGrid"
        style={{ gridTemplateColumns }}
      >
        {/* SIDEBAR (unchanged, inline) */}
        {(!isDrawer || sidebarOpen) && (
          <div className="sidebar">
            <div className="sectionTitle">Navigation</div>

            <button
              className={`navBtn ${
                area === "Forms" ? "navBtnActive" : ""
              }`}
              onClick={() => {
                setArea("Forms");
                setFormsExpanded((v) => !v);
              }}
            >
              Forms {formsExpanded ? "▾" : "▸"}
            </button>

            {area === "Forms" && formsExpanded && (
              <div className="navIndented">
                <div className="navRow">
                  <button
                    className={`navBtn ${
                      formsPage === "Estimates"
                        ? "navBtnActive"
                        : ""
                    }`}
                    onClick={() => {
                      setFormsPage("Estimates");
                      setView("EstimatesList");
                    }}
                  >
                    Estimates
                  </button>
                  <button
                    className="pinBtn"
                    onClick={() =>
                      togglePin("Forms:Estimates")
                    }
                  >
                    {pins.has("Forms:Estimates")
                      ? "★"
                      : "☆"}
                  </button>
                </div>

                <div className="navRow">
                  <button
                    className={`navBtn ${
                      formsPage === "Forecast"
                        ? "navBtnActive"
                        : ""
                    }`}
                    onClick={() => {
                      setFormsPage("Forecast");
                      setView("Forecast");
                    }}
                  >
                    Forecast
                  </button>
                  <button
                    className="pinBtn"
                    onClick={() =>
                      togglePin("Forms:Forecast")
                    }
                  >
                    {pins.has("Forms:Forecast")
                      ? "★"
                      : "☆"}
                  </button>
                </div>
              </div>
            )}

            <button
              className={`navBtn ${
                area === "Reports" ? "navBtnActive" : ""
              }`}
              onClick={() => setArea("Reports")}
            >
              Reports
            </button>

            <button
              className={`navBtn ${
                area === "Dashboards" ? "navBtnActive" : ""
              }`}
              onClick={() => setArea("Dashboards")}
            >
              Dashboards
            </button>
          </div>
        )}

        {/* MAIN */}
        <div className="main">
          {area === "Reports" && (
            <div className="panel">
              <ReportsPage />
            </div>
          )}

          {area === "Dashboards" && (
            <div className="panel">
              <DashboardPage />
            </div>
          )}

          {area === "Forms" && view === "Forecast" && (
            <div className="panel">
              <ForecastPage />
            </div>
          )}

          {area === "Forms" && view === "EstimatesList" && (
            <div className="panel">
              <AgGridReact
                rowData={headers}
                columnDefs={estimatesListCols}
                onRowClicked={(
                  e: RowClickedEvent<EstimateHeader>
                ) => {
                  setSelectedEstimateId(
                    e.data?.estimateId ?? null
                  );
                  setView("EstimateDetail");
                }}
              />
            </div>
          )}

          {area === "Forms" &&
            view === "EstimateDetail" &&
            selectedHeader && (
              <div className="panel">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <h3>
                    Estimate {selectedHeader.estimateId}
                  </h3>
                  <StatusPill
                    label={selectedHeader.status}
                    tone={statusToTone(
                      selectedHeader.status
                    )}
                  />
                </div>

                <div className="agHost ag-theme-quartz">
                  <AgGridReact
                    rowData={currentLines}
                    columnDefs={detailCols}
                    getRowId={(p) => p.data.lineId}
                    pinnedBottomRowData={pinnedBottomRow}
                    pagination
                    paginationPageSize={PAGE_SIZE}
                  />
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
