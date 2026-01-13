import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  RowClickedEvent,
  ValueParserParams
} from "ag-grid-community";

import type { EstimateHeader, EstimateLine, ItemCatalog, Status } from "./models/estimateModels";
import { estimateDataService } from "./services/estimateDataService";

const PAGE_SIZE = 20;
const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

type TopTab = "Forms" | "Reports" | "Dashboards";
type FormsPage = "Estimates" | "Forecast";
type View = "EstimatesList" | "EstimateDetail" | "Forecast";

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

function StatusPill(props: { value: Status }) {
  const v = props.value;
  const colors =
    v === "Draft"
      ? { bg: "#e0f2fe", fg: "#075985" }
      : v === "Submitted"
      ? { bg: "#fef3c7", fg: "#92400e" }
      : v === "Approved"
      ? { bg: "#dcfce7", fg: "#166534" }
      : { bg: "#e5e7eb", fg: "#111827" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        background: colors.bg,
        color: colors.fg,
        whiteSpace: "nowrap"
      }}
    >
      {v}
    </span>
  );
}

function loadPins(): Set<PinKey> {
  try {
    const raw = localStorage.getItem("pinnedLinks");
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr.filter((x) => typeof x === "string") as PinKey[]);
  } catch {
    return new Set();
  }
}

function savePins(pins: Set<PinKey>) {
  localStorage.setItem("pinnedLinks", JSON.stringify(Array.from(pins.values())));
}

export default function App() {
  // viewport
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isPhone = vp.w <= 480;
  const isTablet = vp.w > 480 && vp.w <= 900;
  const isDrawer = isPhone || isTablet;
  const isNarrow = vp.w <= 1024;

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

  // top nav
  const [topTab, setTopTab] = useState<TopTab>("Forms");
  const [formsPage, setFormsPage] = useState<FormsPage>("Estimates");

  // view within Forms
  const [view, setView] = useState<View>("EstimatesList");

  // pinned shortcuts
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

  const pinnedForms = useMemo(() => {
    const entries: { key: PinKey; label: string; action: () => void }[] = [];
    if (pins.has("Forms:Estimates")) {
      entries.push({
        key: "Forms:Estimates",
        label: "Estimates",
        action: () => {
          setTopTab("Forms");
          setFormsPage("Estimates");
          setView("EstimatesList");
          if (isDrawer) setSidebarOpen(false);
        }
      });
    }
    if (pins.has("Forms:Forecast")) {
      entries.push({
        key: "Forms:Forecast",
        label: "Forecast",
        action: () => {
          setTopTab("Forms");
          setFormsPage("Forecast");
          setView("Forecast");
          if (isDrawer) setSidebarOpen(false);
        }
      });
    }
    return entries;
  }, [pins, isDrawer]);

  // runtime data
  const [headers, setHeaders] = useState<EstimateHeader[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [linesByEstimate, setLinesByEstimate] = useState<Map<string, EstimateLine[]>>(new Map());

  // state
  const [loadingHeaders, setLoadingHeaders] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);

  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 730);
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDateOnly(new Date()));

  // detail add selector
  const [selectedItemCode, setSelectedItemCode] = useState<string>("");
  const itemByCode = useMemo(() => new Map(items.map((i) => [i.costCode, i])), [items]);
  const itemCodes = useMemo(() => items.map((i) => i.costCode), [items]);

  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  const currentLines = useMemo(() => {
    if (!selectedEstimateId) return [];
    return linesByEstimate.get(selectedEstimateId) ?? [];
  }, [linesByEstimate, selectedEstimateId]);

  const estimateTotal = useMemo(() => {
    return currentLines.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0), 0);
  }, [currentLines]);

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
  }, [estimateTotal]);

  // initial load
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
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
        setError(e?.message ?? "Failed to load runtime JSON data.");
        setLoadingHeaders(false);
        setLoadingItems(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function ensureLinesLoaded(estimateId: string) {
    if (linesByEstimate.has(estimateId)) return;
    setLoadingLines(true);
    try {
      const lines = await estimateDataService.getEstimateLines(estimateId);
      setLinesByEstimate((prev) => {
        const m = new Map(prev);
        m.set(estimateId, lines);
        return m;
      });
    } catch (e: any) {
      setError(e?.message ?? `Failed to load lines for ${estimateId}`);
    } finally {
      setLoadingLines(false);
    }
  }

  async function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
    await ensureLinesLoaded(id);
  }

  function nextLineNo(): number {
    return currentLines.reduce((m, r) => Math.max(m, r.lineNo || 0), 0) + 1;
  }

  function addItemLine() {
    if (!selectedEstimateId) {
      alert("Open an estimate first.");
      return;
    }
    const item = itemByCode.get(selectedItemCode);
    if (!item) {
      alert("Select an item first.");
      return;
    }

    const newRow: EstimateLine = {
      lineId: uuid(),
      lineNo: nextLineNo(),
      section: item.section,
      costCode: item.costCode,
      description: item.description,
      uom: item.uom,
      qty: 1,
      unitRate: item.defaultUnitRate,
      notes: ""
    };

    setLinesByEstimate((prev) => {
      const m = new Map(prev);
      const existing = m.get(selectedEstimateId) ?? [];
      m.set(selectedEstimateId, [...existing, newRow]);
      return m;
    });

    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);
  }

  function deleteSelectedLines() {
    if (!selectedEstimateId) return;
    const api = detailApiRef.current;
    if (!api) return;

    const selected = api.getSelectedRows() as EstimateLine[];
    if (!selected.length) {
      alert("Select one or more rows first.");
      return;
    }
    const ids = new Set(selected.map((r) => r.lineId));

    setLinesByEstimate((prev) => {
      const m = new Map(prev);
      const existing = m.get(selectedEstimateId) ?? [];
      m.set(selectedEstimateId, existing.filter((r) => !ids.has(r.lineId)));
      return m;
    });
  }

  function createEstimate() {
    // front-end only; not persisted
    const maxId = Math.max(...headers.map((h) => Number(h.estimateId) || 0), 1000);
    const nextId = String(maxId + 1);

    const created = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 14);

    const newHeader: EstimateHeader = {
      estimateId: nextId,
      client: "New Client (PoC)",
      title: "New Estimate",
      status: "Draft",
      dateCreated: created.toISOString(),
      dueDate: due.toISOString(),
      lastUpdated: created.toISOString()
    };

    const initialLines: EstimateLine[] = Array.from({ length: 20 }).map((_, idx) => {
      const it = items[(idx + 1) % Math.max(items.length, 1)];
      return {
        lineId: uuid(),
        lineNo: idx + 1,
        section: it?.section ?? "General",
        costCode: it?.costCode ?? "60-GEN-900-001",
        description: it?.description ?? "New line item",
        uom: it?.uom ?? "ea",
        qty: 1,
        unitRate: it?.defaultUnitRate ?? 0,
        notes: ""
      };
    });

    setHeaders((prev) => [newHeader, ...prev]);
    setLinesByEstimate((prev) => {
      const m = new Map(prev);
      m.set(nextId, initialLines);
      return m;
    });

    setSelectedEstimateId(nextId);
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
  }

  function updateEstimateStatus(id: string, newStatus: Status) {
    const now = new Date().toISOString();
    setHeaders((prev) =>
      prev.map((h) =>
        h.estimateId === id
          ? {
              ...h,
              status: newStatus,
              lastUpdated: now
            }
          : h
      )
    );
  }

  function submitEstimate() {
    if (!selectedEstimateId) return;
    updateEstimateStatus(selectedEstimateId, "Submitted");
    setView("EstimatesList");
  }

  function returnToDraft() {
    if (!selectedEstimateId) return;
    updateEstimateStatus(selectedEstimateId, "Draft");
    setView("EstimatesList");
  }

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
        width: 140,
        cellRenderer: StatusPill
      },
      {
        field: "dueDate",
        headerName: "Due Date",
        width: 120,
        valueFormatter: (p) => formatDate(String(p.value || ""))
      },
      {
        field: "lastUpdated",
        headerName: "Updated",
        width: 120,
        valueFormatter: (p) => formatDate(String(p.value || ""))
      }
    ];
  }, []);

  const detailCols = useMemo<ColDef<EstimateLine>[]>(() => {
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
          values: itemCodes,
          searchType: "matchAny",
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },
        valueSetter: (p) => {
          const newCode = String(p.newValue ?? "").trim().toUpperCase();
          p.data.costCode = newCode;

          const found = itemByCode.get(newCode);
          if (found) {
            p.data.description = found.description;
            p.data.uom = found.uom;
            p.data.unitRate = found.defaultUnitRate;
            p.data.section = found.section;
          }
          return true;
        }
      },
      { field: "description", headerName: "Description", editable: true, flex: 1, minWidth: 320 },
      {
        field: "uom",
        headerName: "UOM",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: UOM_OPTIONS }
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
        }
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
  }, [estimateTotal, itemCodes, itemByCode]);

  // navigation helpers
  function goFormsEstimates() {
    setTopTab("Forms");
    setFormsPage("Estimates");
    setView("EstimatesList");
    if (isDrawer) setSidebarOpen(false);
  }

  function goFormsForecast() {
    setTopTab("Forms");
    setFormsPage("Forecast");
    setView("Forecast");
    if (isDrawer) setSidebarOpen(false);
  }

  const headerTitle = useMemo(() => {
    if (topTab === "Reports") return "Reports (PoC)";
    if (topTab === "Dashboards") return "Dashboards (PoC)";
    // Forms
    if (view === "EstimateDetail" && selectedHeader) return `Estimate ${selectedHeader.estimateId}`;
    if (view === "Forecast") return "Forecast (PoC)";
    return "Estimates";
  }, [topTab, view, selectedHeader]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid #e5e7eb",
          fontWeight: 900,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950 }}>Portal PoC</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              style={{ fontWeight: 900, padding: "8px 10px" }}
              onClick={() => setTopTab("Forms")}
            >
              Forms
            </button>
            <button
              style={{ fontWeight: 900, padding: "8px 10px" }}
              onClick={() => setTopTab("Reports")}
            >
              Reports
            </button>
            <button
              style={{ fontWeight: 900, padding: "8px 10px" }}
              onClick={() => setTopTab("Dashboards")}
            >
              Dashboards
            </button>
          </div>

          <div style={{ fontWeight: 900, color: "#334155" }}>{headerTitle}</div>
        </div>

        {/* Pinned shortcuts in header */}
        {topTab === "Forms" && pinnedForms.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Pinned:</div>
            {pinnedForms.map((p) => (
              <button key={p.key} style={{ fontWeight: 900, padding: "8px 10px" }} onClick={p.action}>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Right-side action */}
        {topTab === "Forms" && view === "EstimatesList" && (
          <button
            style={{ fontWeight: 900, padding: "8px 10px" }}
            onClick={createEstimate}
            disabled={loadingItems || loadingHeaders}
          >
            Create Estimate
          </button>
        )}
      </div>

      {/* error */}
      {error && (
        <div style={{ padding: 10, background: "#fee2e2", borderBottom: "1px solid #fecaca", fontWeight: 900 }}>
          Error: {error}
          <div style={{ fontWeight: 700, marginTop: 6, fontSize: 12 }}>
            Quick check: open <code>/sample-data/estimates.json</code> in the browser and confirm it loads.
          </div>
        </div>
      )}

      {/* layout */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: isDrawer ? "1fr" : "300px 1fr"
        }}
      >
        {/* Sidebar */}
        {!isDrawer || sidebarOpen ? (
          <div style={{ borderRight: isDrawer ? "none" : "1px solid #e5e7eb", padding: 10, minHeight: 0, overflow: "auto" }}>
            {isDrawer && (
              <button style={{ marginBottom: 10, padding: "8px 10px", fontWeight: 900 }} onClick={() => setSidebarOpen(false)}>
                Close
              </button>
            )}

            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>Top level</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              <button style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }} onClick={() => setTopTab("Forms")}>
                Forms
              </button>
              <button style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }} onClick={() => setTopTab("Reports")}>
                Reports
              </button>
              <button style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }} onClick={() => setTopTab("Dashboards")}>
                Dashboards
              </button>
            </div>

            {topTab === "Forms" && (
              <>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>Forms</div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <button
                      style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }}
                      onClick={goFormsEstimates}
                    >
                      Estimates
                    </button>
                    <button
                      title={pins.has("Forms:Estimates") ? "Unpin" : "Pin"}
                      style={{ padding: "10px 12px", fontWeight: 900 }}
                      onClick={() => togglePin("Forms:Estimates")}
                    >
                      {pins.has("Forms:Estimates") ? "★" : "☆"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <button
                      style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }}
                      onClick={goFormsForecast}
                    >
                      Forecast
                    </button>
                    <button
                      title={pins.has("Forms:Forecast") ? "Unpin" : "Pin"}
                      style={{ padding: "10px 12px", fontWeight: 900 }}
                      onClick={() => togglePin("Forms:Forecast")}
                    >
                      {pins.has("Forms:Forecast") ? "★" : "☆"}
                    </button>
                  </div>
                </div>

                {pins.size > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginTop: 16, marginBottom: 6 }}>
                      Pinned
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {pins.has("Forms:Estimates") && (
                        <button style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }} onClick={goFormsEstimates}>
                          Estimates (Pinned)
                        </button>
                      )}
                      {pins.has("Forms:Forecast") && (
                        <button style={{ width: "100%", padding: "10px 12px", fontWeight: 900 }} onClick={goFormsForecast}>
                          Forecast (Pinned)
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, marginTop: 16 }}>
                  Data files: <code>/public/sample-data</code>
                </div>
              </>
            )}

            {topTab === "Reports" && (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Reports placeholder (next).
              </div>
            )}

            {topTab === "Dashboards" && (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Dashboards placeholder (next).
              </div>
            )}
          </div>
        ) : null}

        {/* Main */}
        <div style={{ minHeight: 0, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {isDrawer && !sidebarOpen && (
            <button style={{ width: 120, padding: "8px 10px", fontWeight: 900 }} onClick={() => setSidebarOpen(true)}>
              Menu
            </button>
          )}

          {(loadingHeaders || loadingItems) && topTab === "Forms" && (
            <div style={{ padding: 10, fontWeight: 900 }}>Loading runtime JSON…</div>
          )}

          {topTab === "Reports" && (
            <div style={{ padding: 12, fontWeight: 900 }}>
              Reports (PoC placeholder). Next: wire reports to data service and saved views.
            </div>
          )}

          {topTab === "Dashboards" && (
            <div style={{ padding: 12, fontWeight: 900 }}>
              Dashboards (PoC placeholder). Next: add summary cards + charts.
            </div>
          )}

          {/* Forms: Forecast */}
          {topTab === "Forms" && view === "Forecast" && (
            <div style={{ padding: 12, fontWeight: 900 }}>
              Forecast (PoC placeholder). Next: similar grid UX to estimates but by period/cost code.
            </div>
          )}

          {/* Forms: Estimates list */}
          {topTab === "Forms" && view === "EstimatesList" && !loadingHeaders && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* quick pinned shortcuts on main screen */}
              {pinnedForms.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Quick:</div>
                  {pinnedForms.map((p) => (
                    <button key={p.key} style={{ fontWeight: 900, padding: "8px 10px" }} onClick={p.action}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "1fr 180px 160px 160px" }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ padding: 10, fontWeight: 800 }} />

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ padding: 10, fontWeight: 800 }}>
                  <option value="All">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                </select>

                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: 10, fontWeight: 800 }} />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: 10, fontWeight: 800 }} />
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
                  <AgGridReact<EstimateHeader>
                    rowData={filteredHeaders}
                    columnDefs={estimatesListCols}
                    defaultColDef={{ resizable: true, sortable: true, filter: true }}
                    rowSelection="single"
                    onGridReady={(e) => {
                      listApiRef.current = e.api;
                      setTimeout(() => e.api.sizeColumnsToFit(), 50);
                    }}
                    onGridSizeChanged={(e) => e.api.sizeColumnsToFit()}
                    onRowClicked={async (e: RowClickedEvent<EstimateHeader>) => {
                      const id = e.data?.estimateId;
                      if (id) await openEstimate(id);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Forms: Estimate detail */}
          {topTab === "Forms" && view === "EstimateDetail" && selectedHeader && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900 }}>
                  {selectedHeader.estimateId} — {selectedHeader.client}{" "}
                  <span style={{ marginLeft: 6 }}>
                    <StatusPill value={selectedHeader.status} />
                  </span>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                    Created {formatDate(selectedHeader.dateCreated)} • Due {formatDate(selectedHeader.dueDate)} • Updated{" "}
                    {formatDate(selectedHeader.lastUpdated)}
                  </div>
                </div>

                <div style={{ fontWeight: 900 }}>Total: {formatCurrencyCAD(estimateTotal)}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* Submit / Approve-Return logic */}
                  {selectedHeader.status === "Draft" ? (
                    <button style={{ padding: "8px 10px", fontWeight: 900 }} onClick={submitEstimate}>
                      Submit
                    </button>
                  ) : selectedHeader.status === "Submitted" ? (
                    <button style={{ padding: "8px 10px", fontWeight: 900 }} onClick={returnToDraft}>
                      Approve / Return
                    </button>
                  ) : null}

                  <button style={{ padding: "8px 10px", fontWeight: 900 }} onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>
              </div>

              {loadingLines && <div style={{ padding: 10, fontWeight: 900 }}>Loading estimate lines…</div>}

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "1fr 160px 160px" }}>
                <select value={selectedItemCode} onChange={(e) => setSelectedItemCode(e.target.value)} style={{ padding: 10, fontWeight: 800 }}>
                  {items.map((it) => (
                    <option key={it.costCode} value={it.costCode}>
                      {it.costCode} — {it.description} ({it.uom})
                    </option>
                  ))}
                </select>

                <button style={{ padding: "10px 12px", fontWeight: 900 }} onClick={addItemLine} disabled={!selectedItemCode}>
                  Add Item
                </button>

                <button style={{ padding: "10px 12px", fontWeight: 900 }} onClick={deleteSelectedLines}>
                  Delete Selected
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
                  <AgGridReact<EstimateLine>
                    rowData={currentLines}
                    columnDefs={detailCols}
                    getRowId={(p) => p.data.lineId}
                    defaultColDef={{ resizable: true, sortable: true, filter: true, editable: true }}
                    rowSelection="multiple"
                    suppressRowClickSelection={true}
                    pinnedBottomRowData={pinnedBottomRow}
                    pagination={true}
                    paginationPageSize={PAGE_SIZE}
                    enterNavigatesVertically={true}
                    enterNavigatesVerticallyAfterEdit={true}
                    stopEditingWhenCellsLoseFocus={true}
                    undoRedoCellEditing={true}
                    undoRedoCellEditingLimit={50}
                    enableRangeSelection={true}
                    onGridReady={(e) => {
                      detailApiRef.current = e.api;
                      setTimeout(() => e.api.sizeColumnsToFit(), 80);
                    }}
                    onGridSizeChanged={(e) => e.api.sizeColumnsToFit()}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
