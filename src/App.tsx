// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowClickedEvent, ValueParserParams } from "ag-grid-community";
import "./components/StatusPill.css";

import "./App.css";

import type { EstimateHeader, EstimateLine, ItemCatalog, Status } from "./models/estimateModels";
import { estimateDataService } from "./services/estimateDataService";

// ✅ Mock pages (static screens)
import ForecastPage from "./pages/ForecastPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";

// ✅ Shared component (replaces inline pill)
import StatusPill, { type StatusTone } from "./components/StatusPill";

const PAGE_SIZE = 20;
const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

// Existing shell navigation types
type TopArea = "Forms" | "Reports" | "Dashboards";
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

// ✅ Central mapping: Status -> tone
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
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isDrawer = vp.w <= 900;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

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
      notes: "",
    };
    return [pinned];
  }, []);

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
    setArea("Forms");
    setFormsExpanded(true);
    setFormsPage("Estimates");
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
    await ensureLinesLoaded(id);
  }

  function nextLineNo(): number {
    return currentLines.reduce((m, r) => Math.max(m, r.lineNo || 0), 0) + 1;
  }

  function addItemLine() {
    if (!selectedEstimateId) return;
    const item = itemByCode.get(selectedItemCode);
    if (!item) return;

    const newRow: EstimateLine = {
      lineId: uuid(),
      lineNo: nextLineNo(),
      section: item.section,
      costCode: item.costCode,
      description: item.description,
      uom: item.uom,
      qty: 1,
      unitRate: item.defaultUnitRate,
      notes: "",
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
    if (!selected.length) return;
    const ids = new Set(selected.map((r) => r.lineId));

    setLinesByEstimate((prev) => {
      const m = new Map(prev);
      const existing = m.get(selectedEstimateId) ?? [];
      m.set(selectedEstimateId, existing.filter((r) => !ids.has(r.lineId)));
      return m;
    });
  }

  function createEstimate() {
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
      lastUpdated: created.toISOString(),
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
        notes: "",
      };
    });

    setHeaders((prev) => [newHeader, ...prev]);
    setLinesByEstimate((prev) => {
      const m = new Map(prev);
      m.set(nextId, initialLines);
      return m;
    });

    setSelectedEstimateId(nextId);
    setArea("Forms");
    setFormsExpanded(true);
    setFormsPage("Estimates");
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
  }

  function updateEstimateStatus(id: string, newStatus: Status) {
    const now = new Date().toISOString();
    setHeaders((prev) => prev.map((h) => (h.estimateId === id ? { ...h, status: newStatus, lastUpdated: now } : h)));
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
      { field: "dateCreated", headerName: "Date Created", width: 140, valueFormatter: (p) => formatDate(String(p.value || "")) },
      {
        field: "status",
        headerName: "Status",
        width: 150,
        // ✅ use shared component (grid variant)
        cellRenderer: (p: any) => {
          const s = p.value as Status;
          return <StatusPill label={s} tone={statusToTone(s)} variant="grid" />;
        },
      },
      { field: "dueDate", headerName: "Due Date", width: 120, valueFormatter: (p) => formatDate(String(p.value || "")) },
      { field: "lastUpdated", headerName: "Updated", width: 120, valueFormatter: (p) => formatDate(String(p.value || "")) },
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
          highlightMatch: true,
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
        },
      },
      { field: "description", headerName: "Description", editable: true, flex: 1, minWidth: 320 },
      { field: "uom", headerName: "UOM", width: 100, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: UOM_OPTIONS } },
      { field: "qty", headerName: "Qty", width: 110, editable: true, valueParser: parseNumber },
      { field: "unitRate", headerName: "Unit Rate", width: 150, editable: true, valueParser: parseNumber },
     {
  headerName: "Line Total",
  width: 170,
  valueGetter: (p) =>
    p.node?.rowPinned
      ? estimateTotal
      : (Number(p.data?.qty) || 0) * (Number(p.data?.unitRate) || 0),
  valueFormatter: (p) => formatCurrencyCAD(Number(p.value) || 0),
  cellStyle: (p) => (p.node?.rowPinned ? { fontWeight: "950" } : undefined),
}
,
      { field: "notes", headerName: "Notes", editable: true, width: 240 },
    ];
  }, [estimateTotal, itemCodes, itemByCode]);

  function goEstimates() {
    setArea("Forms");
    setFormsExpanded(true);
    setFormsPage("Estimates");
    setView("EstimatesList");
    if (isDrawer) setSidebarOpen(false);
  }

  function goForecast() {
    setArea("Forms");
    setFormsExpanded(true);
    setFormsPage("Forecast");
    setView("Forecast");
    if (isDrawer) setSidebarOpen(false);
  }

  const gridTemplateColumns = isDrawer ? "1fr" : "320px 1fr";

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="brand">
          <div className="brandMark" />
          <div>Portal</div>
          <div className="kicker" style={{ marginLeft: 10 }}>
            {area === "Forms"
              ? view === "Forecast"
                ? "Forecast"
                : view === "EstimateDetail"
                ? `Estimate ${selectedHeader?.estimateId ?? ""}`
                : "Estimates"
              : area}
          </div>
        </div>

        <div className="topRight">
          {area === "Forms" && view === "EstimatesList" && (
            <button className="primaryBtn" onClick={createEstimate} disabled={loadingHeaders || loadingItems}>
              Create Estimate
            </button>
          )}

          {isDrawer && (
            <button className="ghostBtn" onClick={() => setSidebarOpen((v) => !v)}>
              {sidebarOpen ? "Close" : "Menu"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="panel" style={{ margin: 12, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)" }}>
          <div style={{ fontWeight: 950 }}>Error</div>
          <div style={{ color: "rgba(255,255,255,0.80)", fontWeight: 850, marginTop: 6 }}>{error}</div>
          <div className="kicker" style={{ marginTop: 8 }}>
            Quick check: open <code>/sample-data/estimates.json</code> directly in the browser.
          </div>
        </div>
      )}

      <div className="bodyGrid" style={{ gridTemplateColumns }}>
        {(!isDrawer || sidebarOpen) && (
          <div className="sidebar">
            <div className="sectionTitle">Navigation</div>

            <button
              className={`navBtn ${area === "Forms" ? "navBtnActive" : ""}`}
              onClick={() => {
                setArea("Forms");
                setFormsExpanded((v) => !v);
              }}
            >
              Forms {formsExpanded ? "▾" : "▸"}
            </button>

            {area === "Forms" && formsExpanded && (
              <div className="navIndented" style={{ marginTop: 8 }}>
                <div className="navRow">
                  <button className={`navBtn ${formsPage === "Estimates" && view !== "Forecast" ? "navBtnActive" : ""}`} onClick={goEstimates}>
                    Estimates
                  </button>
                  <button className="pinBtn" onClick={() => togglePin("Forms:Estimates")} title={pins.has("Forms:Estimates") ? "Unpin" : "Pin"}>
                    {pins.has("Forms:Estimates") ? "★" : "☆"}
                  </button>
                </div>

                <div className="navRow">
                  <button className={`navBtn ${formsPage === "Forecast" ? "navBtnActive" : ""}`} onClick={goForecast}>
                    Forecast
                  </button>
                  <button className="pinBtn" onClick={() => togglePin("Forms:Forecast")} title={pins.has("Forms:Forecast") ? "Unpin" : "Pin"}>
                    {pins.has("Forms:Forecast") ? "★" : "☆"}
                  </button>
                </div>
              </div>
            )}

            <button className={`navBtn ${area === "Reports" ? "navBtnActive" : ""}`} style={{ marginTop: 10 }} onClick={() => setArea("Reports")}>
              Reports
            </button>

            <button className={`navBtn ${area === "Dashboards" ? "navBtnActive" : ""}`} style={{ marginTop: 10 }} onClick={() => setArea("Dashboards")}>
              Dashboards
            </button>

            <div className="sectionTitle" style={{ marginTop: 18 }}>
              Pinned
            </div>
            <div className="navIndented">
              {pins.size === 0 && <div className="kicker">Pin Estimates/Forecast to keep them here.</div>}

              {pins.has("Forms:Estimates") && (
                <button className="navBtn" onClick={goEstimates}>
                  Estimates
                </button>
              )}
              {pins.has("Forms:Forecast") && (
                <button className="navBtn" onClick={goForecast}>
                  Forecast
                </button>
              )}
            </div>

            <div className="kicker" style={{ marginTop: 16 }}>
              Data: <code>/public/sample-data</code>
            </div>
          </div>
        )}

        <div className="main">
          {(loadingHeaders || loadingItems) && area === "Forms" && (
            <div className="panel" style={{ fontWeight: 950 }}>
              Loading runtime JSON…
            </div>
          )}

          {area === "Reports" && (
            <div className="panel" style={{ flex: 1, minHeight: 0 }}>
              <ReportsPage />
            </div>
          )}

          {area === "Dashboards" && (
            <div className="panel" style={{ flex: 1, minHeight: 0 }}>
              <DashboardPage />
            </div>
          )}

          {area === "Forms" && view === "Forecast" && (
            <div className="panel" style={{ flex: 1, minHeight: 0 }}>
              <ForecastPage />
            </div>
          )}

          {area === "Forms" && view === "EstimatesList" && !loadingHeaders && (
            <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Estimates</div>
                <div className="kicker">Search, filter, and open estimates.</div>
              </div>

              <div className="toolbarGrid" style={{ gridTemplateColumns: vp.w <= 1024 ? "1fr" : "1fr 180px 170px 170px" }}>
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />

                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="All">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                </select>

                <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <div className="agHost ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
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

          {area === "Forms" && view === "EstimateDetail" && selectedHeader && (
            <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span>Estimate {selectedHeader.estimateId}</span>

                    {/* ✅ shared pill (default variant) */}
                    <StatusPill label={selectedHeader.status} tone={statusToTone(selectedHeader.status)} />

                    <span className="kicker">{selectedHeader.client}</span>
                  </div>
                  <div className="kicker" style={{ marginTop: 4 }}>
                    Created {formatDate(selectedHeader.dateCreated)} • Due {formatDate(selectedHeader.dueDate)} • Updated {formatDate(selectedHeader.lastUpdated)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 950 }}>Total: {formatCurrencyCAD(estimateTotal)}</div>

                  {selectedHeader.status === "Draft" ? (
                    <button className="primaryBtn" onClick={submitEstimate}>
                      Submit
                    </button>
                  ) : selectedHeader.status === "Submitted" ? (
                    <button className="primaryBtn" onClick={returnToDraft}>
                      Approve / Return
                    </button>
                  ) : null}

                  <button className="ghostBtn" onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>
              </div>

              {loadingLines && <div className="kicker" style={{ fontWeight: 950 }}>Loading estimate lines…</div>}

              <div className="toolbarGrid" style={{ gridTemplateColumns: vp.w <= 1024 ? "1fr" : "1fr 160px 170px" }}>
                <select className="input" value={selectedItemCode} onChange={(e) => setSelectedItemCode(e.target.value)}>
                  {items.map((it) => (
                    <option key={it.costCode} value={it.costCode}>
                      {it.costCode} — {it.description} ({it.uom})
                    </option>
                  ))}
                </select>

                <button className="primaryBtn" onClick={addItemLine} disabled={!selectedItemCode}>
                  Add Item
                </button>

                <button className="ghostBtn" onClick={deleteSelectedLines}>
                  Delete Selected
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <div className="agHost ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
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
