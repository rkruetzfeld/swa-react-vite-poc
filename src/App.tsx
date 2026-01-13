import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  RowClickedEvent,
  ValueParserParams
} from "ag-grid-community";

import "./App.css";

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

function StatusPill({ value }: { value: Status }) {
  const v = value;
  const colors =
    v === "Draft"
      ? { bg: "rgba(34,211,238,0.18)", fg: "rgba(186,230,253,0.98)", border: "rgba(34,211,238,0.25)" }
      : v === "Submitted"
      ? { bg: "rgba(245,158,11,0.18)", fg: "rgba(253,230,138,0.98)", border: "rgba(245,158,11,0.25)" }
      : v === "Approved"
      ? { bg: "rgba(34,197,94,0.18)", fg: "rgba(187,247,208,0.98)", border: "rgba(34,197,94,0.25)" }
      : { bg: "rgba(148,163,184,0.18)", fg: "rgba(226,232,240,0.98)", border: "rgba(148,163,184,0.22)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontWeight: 950,
        fontSize: 12,
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
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

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

  // top nav
  const [topTab, setTopTab] = useState<TopTab>("Forms");
  const [formsPage, setFormsPage] = useState<FormsPage>("Estimates");
  const [view, setView] = useState<View>("EstimatesList");

  // Forms flyout
  const [formsFlyoutOpen, setFormsFlyoutOpen] = useState(false);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!formsFlyoutOpen) return;
      const t = e.target as Node;
      if (flyoutRef.current && !flyoutRef.current.contains(t)) setFormsFlyoutOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [formsFlyoutOpen]);

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
        action: () => goFormsEstimates()
      });
    }
    if (pins.has("Forms:Forecast")) {
      entries.push({
        key: "Forms:Forecast",
        label: "Forecast",
        action: () => goFormsForecast()
      });
    }
    return entries;
  }, [pins]);

  // runtime data
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
    setTopTab("Forms");
    setFormsPage("Estimates");
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
    setTopTab("Forms");
    setFormsPage("Estimates");
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
  }

  function updateEstimateStatus(id: string, newStatus: Status) {
    const now = new Date().toISOString();
    setHeaders((prev) =>
      prev.map((h) =>
        h.estimateId === id
          ? { ...h, status: newStatus, lastUpdated: now }
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
        width: 150,
        cellRenderer: (p: any) => <StatusPill value={p.value as Status} />
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
        cellStyle: (p) => (p.node.rowPinned ? { fontWeight: "950" } : undefined)
      },
      { field: "notes", headerName: "Notes", editable: true, width: 240 }
    ];
  }, [estimateTotal, itemCodes, itemByCode]);

  function goFormsEstimates() {
    setTopTab("Forms");
    setFormsPage("Estimates");
    setView("EstimatesList");
    setFormsFlyoutOpen(false);
    if (isDrawer) setSidebarOpen(false);
  }

  function goFormsForecast() {
    setTopTab("Forms");
    setFormsPage("Forecast");
    setView("Forecast");
    setFormsFlyoutOpen(false);
    if (isDrawer) setSidebarOpen(false);
  }

  // layout column count
  const gridTemplateColumns = isDrawer ? "1fr" : "320px 1fr";

  const headerTitle = useMemo(() => {
    if (topTab === "Reports") return "Reports";
    if (topTab === "Dashboards") return "Dashboards";
    if (view === "EstimateDetail" && selectedHeader) return `Estimate ${selectedHeader.estimateId}`;
    if (view === "Forecast") return "Forecast";
    return "Estimates";
  }, [topTab, view, selectedHeader]);

  return (
    <div className="appShell">
      {/* Top bar */}
      <div className="topBar">
        <div className="brand">
          <div className="brandMark" />
          <div>Portal</div>

          <div className="topTabs">
            {/* Forms flyout */}
            <div className="flyoutWrap" ref={flyoutRef}>
              <button
                className={`tabBtn ${topTab === "Forms" ? "tabBtnActive" : ""}`}
                onClick={() => setFormsFlyoutOpen((v) => !v)}
                title="Forms"
              >
                Forms ▾
              </button>

              {formsFlyoutOpen && (
                <div className="flyout">
                  <div className="flyoutHeader">Forms</div>

                  <div
                    className="flyoutItem"
                    onClick={() => goFormsEstimates()}
                    role="button"
                  >
                    <div>
                      <div className="flyoutTitle">Estimates</div>
                      <div className="flyoutSub">Create, edit, submit estimates</div>
                    </div>
                    <button
                      className="pinBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin("Forms:Estimates");
                      }}
                      title={pins.has("Forms:Estimates") ? "Unpin" : "Pin"}
                    >
                      {pins.has("Forms:Estimates") ? "★" : "☆"}
                    </button>
                  </div>

                  <div
                    className="flyoutItem"
                    onClick={() => goFormsForecast()}
                    role="button"
                  >
                    <div>
                      <div className="flyoutTitle">Forecast</div>
                      <div className="flyoutSub">Forward-looking forecast entry (PoC)</div>
                    </div>
                    <button
                      className="pinBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin("Forms:Forecast");
                      }}
                      title={pins.has("Forms:Forecast") ? "Unpin" : "Pin"}
                    >
                      {pins.has("Forms:Forecast") ? "★" : "☆"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className={`tabBtn ${topTab === "Reports" ? "tabBtnActive" : ""}`}
              onClick={() => {
                setTopTab("Reports");
                setFormsFlyoutOpen(false);
              }}
            >
              Reports
            </button>

            <button
              className={`tabBtn ${topTab === "Dashboards" ? "tabBtnActive" : ""}`}
              onClick={() => {
                setTopTab("Dashboards");
                setFormsFlyoutOpen(false);
              }}
            >
              Dashboards
            </button>
          </div>

          <div className="kicker">{headerTitle}</div>
        </div>

        <div className="topRight">
          {topTab === "Forms" && view === "EstimatesList" && (
            <button
              className="primaryBtn"
              onClick={createEstimate}
              disabled={loadingHeaders || loadingItems}
              title="Create a new estimate (PoC)"
            >
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
          <div style={{ color: "rgba(255,255,255,0.80)", fontWeight: 850, marginTop: 6 }}>
            {error}
          </div>
          <div className="kicker" style={{ marginTop: 8 }}>
            Quick check: open <code>/sample-data/estimates.json</code> directly in the browser.
          </div>
        </div>
      )}

      {/* Body */}
      <div className="bodyGrid" style={{ gridTemplateColumns }}>
        {/* Sidebar */}
        {(!isDrawer || sidebarOpen) && (
          <div className="sidebar">
            <div className="sectionTitle">Navigation</div>

            <button
              className={`navBtn ${topTab === "Forms" ? "navBtnActive" : ""}`}
              onClick={() => setTopTab("Forms")}
            >
              Forms
            </button>
            <button
              className={`navBtn ${topTab === "Reports" ? "navBtnActive" : ""}`}
              onClick={() => setTopTab("Reports")}
              style={{ marginTop: 8 }}
            >
              Reports
            </button>
            <button
              className={`navBtn ${topTab === "Dashboards" ? "navBtnActive" : ""}`}
              onClick={() => setTopTab("Dashboards")}
              style={{ marginTop: 8 }}
            >
              Dashboards
            </button>

            {/* Pinned under Forms (indented) */}
            {topTab === "Forms" && (
              <>
                <div className="sectionTitle" style={{ marginTop: 16 }}>
                  Forms (Pinned)
                </div>

                {pinnedForms.length === 0 ? (
                  <div className="kicker">
                    Nothing pinned yet. Use the Forms flyout in the top bar to pin Estimates or Forecast.
                  </div>
                ) : (
                  <div className="navIndented" style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {pins.has("Forms:Estimates") && (
                      <div className="navRow">
                        <button
                          className={`navBtn ${formsPage === "Estimates" && view !== "Forecast" ? "navBtnActive" : ""}`}
                          onClick={goFormsEstimates}
                        >
                          Estimates
                        </button>
                        <button className="pinBtn" title="Unpin" onClick={() => togglePin("Forms:Estimates")}>
                          ★
                        </button>
                      </div>
                    )}

                    {pins.has("Forms:Forecast") && (
                      <div className="navRow">
                        <button
                          className={`navBtn ${formsPage === "Forecast" ? "navBtnActive" : ""}`}
                          onClick={goFormsForecast}
                        >
                          Forecast
                        </button>
                        <button className="pinBtn" title="Unpin" onClick={() => togglePin("Forms:Forecast")}>
                          ★
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="kicker" style={{ marginTop: 16 }}>
              Data: <code>/public/sample-data</code>
            </div>
          </div>
        )}

        {/* Main */}
        <div className="main">
          {/* Loading */}
          {(loadingHeaders || loadingItems) && topTab === "Forms" && (
            <div className="panel" style={{ fontWeight: 950 }}>
              Loading runtime JSON…
            </div>
          )}

          {/* Reports / Dashboards placeholders */}
          {topTab === "Reports" && (
            <div className="panel">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Reports</div>
              <div className="kicker" style={{ marginTop: 6 }}>
                Placeholder. Next we can add saved report definitions + export formats.
              </div>
            </div>
          )}

          {topTab === "Dashboards" && (
            <div className="panel">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Dashboards</div>
              <div className="kicker" style={{ marginTop: 6 }}>
                Placeholder. Next we can add summary cards + charts.
              </div>
            </div>
          )}

          {/* Forecast placeholder */}
          {topTab === "Forms" && view === "Forecast" && (
            <div className="panel">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Forecast</div>
              <div className="kicker" style={{ marginTop: 6 }}>
                Placeholder. Next: forecast grid by period / cost code.
              </div>
            </div>
          )}

          {/* Estimates list */}
          {topTab === "Forms" && view === "EstimatesList" && !loadingHeaders && (
            <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>Estimates</div>
                  <div className="kicker">Search, filter, and open estimates.</div>
                </div>

                {/* pinned quick access (optional) */}
                {pinnedForms.length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div className="kicker">Pinned:</div>
                    {pinnedForms.map((p) => (
                      <button key={p.key} className="ghostBtn" onClick={p.action}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="toolbarGrid"
                style={{
                  gridTemplateColumns: vp.w <= 1024 ? "1fr" : "1fr 180px 170px 170px"
                }}
              >
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

          {/* Estimate detail */}
          {topTab === "Forms" && view === "EstimateDetail" && selectedHeader && (
            <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span>Estimate {selectedHeader.estimateId}</span>
                    <StatusPill value={selectedHeader.status} />
                    <span className="kicker">{selectedHeader.client}</span>
                  </div>
                  <div className="kicker" style={{ marginTop: 4 }}>
                    Created {formatDate(selectedHeader.dateCreated)} • Due {formatDate(selectedHeader.dueDate)} • Updated {formatDate(selectedHeader.lastUpdated)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 950 }}>Total: {formatCurrencyCAD(estimateTotal)}</div>

                  {selectedHeader.status === "Draft" ? (
                    <button className="primaryBtn" onClick={submitEstimate}>Submit</button>
                  ) : selectedHeader.status === "Submitted" ? (
                    <button className="primaryBtn" onClick={returnToDraft}>Approve / Return</button>
                  ) : null}

                  <button className="ghostBtn" onClick={() => setView("EstimatesList")}>Back</button>
                </div>
              </div>

              {loadingLines && <div className="kicker" style={{ fontWeight: 950 }}>Loading estimate lines…</div>}

              <div
                className="toolbarGrid"
                style={{
                  gridTemplateColumns: vp.w <= 1024 ? "1fr" : "1fr 160px 170px"
                }}
              >
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
