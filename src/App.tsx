import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowClickedEvent, ValueParserParams } from "ag-grid-community";

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
  lineNo: number;
  section: string;
  costCode: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes?: string;
};

type ItemCatalog = {
  section: string;
  costCode: string;
  description: string;
  uom: string;
  defaultUnitRate: number;
};

const PAGE_SIZE = 20;
const COST_CODE_REGEX = /^\d{2}-[A-Z]{3,10}-\d{3}-\d{3}$/;
const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

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

/** Small but realistic catalog */
const ITEM_CATALOG: ItemCatalog[] = [
  { section: "Mobilization", costCode: "60-MOB-100-001", description: "Mobilization (LS)", uom: "LS", defaultUnitRate: 35000 },
  { section: "Earthworks", costCode: "60-EARTH-210-010", description: "Excavation (m3)", uom: "m3", defaultUnitRate: 18.5 },
  { section: "Earthworks", costCode: "60-EARTH-220-020", description: "Fill import & place (m3)", uom: "m3", defaultUnitRate: 24.0 },
  { section: "Drainage", costCode: "60-DRAIN-310-005", description: "Culvert supply & install (m)", uom: "m", defaultUnitRate: 420.0 },
  { section: "Paving", costCode: "60-PAVE-410-030", description: "Asphalt paving (t)", uom: "t", defaultUnitRate: 155.0 },
  { section: "Structures", costCode: "60-STR-510-001", description: "Concrete placement (m3)", uom: "m3", defaultUnitRate: 420.0 },
  { section: "Traffic", costCode: "60-TRAF-610-010", description: "Traffic control (day)", uom: "day", defaultUnitRate: 3200.0 },
  { section: "General", costCode: "60-GEN-900-001", description: "Project management (day)", uom: "day", defaultUnitRate: 1800.0 }
];

function seedHeaders(): EstimateHeader[] {
  const today = new Date();
  const mk = (id: number, client: string, title: string, status: Status, daysAgo: number, dueIn: number) => {
    const created = new Date(today);
    created.setDate(created.getDate() - daysAgo);
    const due = new Date(created);
    due.setDate(due.getDate() + dueIn);
    return {
      estimateId: String(id),
      client,
      title,
      status,
      dateCreated: created.toISOString(),
      dueDate: due.toISOString(),
      lastUpdated: created.toISOString()
    };
  };

  return [
    mk(1574, "Custom Solutions Inc.", "Bridge deck rehab — Phase 1", "Approved", 18, 20),
    mk(1563, "Camtom Syites", "Road widening — Segment B", "Submitted", 55, 30),
    mk(1544, "Perichen Gretet", "Drainage improvements", "Draft", 7, 21),
    mk(1523, "Gatom Sjites", "Estimate Retire", "Completed", 110, 10),
    mk(1010, "Coculse Serviets", "Corridor pricing", "Completed", 250, 14)
  ];
}

function seedLinesForEstimate(estimateId: string): EstimateLine[] {
  // Give some estimates a larger dataset to mimic reality
  const big = estimateId === "1574" || estimateId === "1523";
  const count = big ? 180 : 35;

  const rows: EstimateLine[] = [];
  for (let i = 0; i < count; i++) {
    const it = ITEM_CATALOG[i % ITEM_CATALOG.length];
    rows.push({
      lineId: uuid(),
      lineNo: i + 1,
      section: it.section,
      costCode: it.costCode,
      description: it.description,
      uom: it.uom,
      qty: big ? (i % 7) + 1 : (i % 4) + 1,
      unitRate: it.defaultUnitRate,
      notes: ""
    });
  }
  return rows;
}

export default function App() {
  // viewport flags
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isPhone = vp.w <= 480;
  const isTablet = vp.w > 480 && vp.w <= 900;
  const isNarrow = vp.w <= 1024;
  const isDrawer = isPhone || isTablet;

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isDrawer);
  useEffect(() => setSidebarOpen(!isDrawer), [isDrawer]);

  // data (in-memory)
  const [headers, setHeaders] = useState<EstimateHeader[]>(() => seedHeaders());
  const [linesByEstimate, setLinesByEstimate] = useState<Map<string, EstimateLine[]>>(() => {
    const m = new Map<string, EstimateLine[]>();
    for (const h of seedHeaders()) m.set(h.estimateId, seedLinesForEstimate(h.estimateId));
    return m;
  });

  // selection + view
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(() => seedHeaders()[0]?.estimateId ?? null);
  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  const [view, setView] = useState<"EstimatesList" | "EstimateDetail">("EstimatesList");
  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // list filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 730);
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDateOnly(new Date()));

  // detail add selector
  const [selectedItemCode, setSelectedItemCode] = useState<string>(() => ITEM_CATALOG[0].costCode);
  const itemByCode = useMemo(() => new Map(ITEM_CATALOG.map((i) => [i.costCode, i])), []);
  const itemCodes = useMemo(() => ITEM_CATALOG.map((i) => i.costCode), []);

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
  }, []);

  function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);
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
    const nextId = String(Math.max(...headers.map((h) => Number(h.estimateId) || 0), 1000) + 1);

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

    // Default 20 lines
    const initialLines: EstimateLine[] = Array.from({ length: 20 }).map((_, idx) => {
      const it = ITEM_CATALOG[(idx + 1) % ITEM_CATALOG.length];
      return {
        lineId: uuid(),
        lineNo: idx + 1,
        section: it.section,
        costCode: it.costCode,
        description: it.description,
        uom: it.uom,
        qty: 1,
        unitRate: it.defaultUnitRate,
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

  const styles = `
    .cell-invalid {
      background: #fee2e2 !important;
      border: 1px solid #ef4444 !important;
    }
  `;

  return (
    <>
      <style>{styles}</style>

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
            gap: 10
          }}
        >
          <div>Portal PoC — In-memory data (JSON later)</div>

          {view === "EstimatesList" && (
            <button style={{ fontWeight: 900 }} onClick={createEstimate}>
              Create Estimate
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: isDrawer ? "1fr" : "280px 1fr"
          }}
        >
          {/* Sidebar */}
          {!isDrawer || sidebarOpen ? (
            <div style={{ borderRight: isDrawer ? "none" : "1px solid #e5e7eb", padding: 10 }}>
              {isDrawer && (
                <button
                  style={{ marginBottom: 10, padding: "8px 10px", fontWeight: 900 }}
                  onClick={() => setSidebarOpen(false)}
                >
                  Close
                </button>
              )}

              <button
                style={{ width: "100%", padding: "10px 12px", fontWeight: 900, marginBottom: 8 }}
                onClick={() => setView("EstimatesList")}
              >
                Estimates
              </button>

              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                Next step: swap to runtime JSON under <code>/public/sample-data</code>.
              </div>
            </div>
          ) : null}

          {/* Content */}
          <div style={{ minHeight: 0, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {isDrawer && !sidebarOpen && (
              <button style={{ width: 120, padding: "8px 10px", fontWeight: 900 }} onClick={() => setSidebarOpen(true)}>
                Menu
              </button>
            )}

            {view === "EstimatesList" && (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Filters */}
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: isNarrow ? "1fr" : "1fr 180px 160px 160px"
                  }}
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    style={{ padding: 10, fontWeight: 800 }}
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{ padding: 10, fontWeight: 800 }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Approved">Approved</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: 10, fontWeight: 800 }} />
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: 10, fontWeight: 800 }} />
                </div>

                {/* Grid */}
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
                      onRowClicked={(e: RowClickedEvent<EstimateHeader>) => {
                        const id = e.data?.estimateId;
                        if (id) openEstimate(id);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {view === "EstimateDetail" && selectedHeader && (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {selectedHeader.estimateId} — {selectedHeader.client} ({selectedHeader.status})
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                      Created {formatDate(selectedHeader.dateCreated)} • Due {formatDate(selectedHeader.dueDate)}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900 }}>Total: {formatCurrencyCAD(estimateTotal)}</div>

                  <button style={{ padding: "8px 10px", fontWeight: 900 }} onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>

                {/* Toolbar */}
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "1fr 260px auto auto" }}>
                  <select
                    value={selectedItemCode}
                    onChange={(e) => setSelectedItemCode(e.target.value)}
                    style={{ padding: 10, fontWeight: 800 }}
                  >
                    {ITEM_CATALOG.map((it) => (
                      <option key={it.costCode} value={it.costCode}>
                        {it.costCode} — {it.description} ({it.uom})
                      </option>
                    ))}
                  </select>

                  <button style={{ padding: "10px 12px", fontWeight: 900 }} onClick={addItemLine}>
                    Add Item
                  </button>

                  <button style={{ padding: "10px 12px", fontWeight: 900 }} onClick={deleteSelectedLines}>
                    Delete Selected
                  </button>
                </div>

                {/* Detail grid */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
                    <AgGridReact<EstimateLine>
                      rowData={currentLines}
                      columnDefs={detailCols}
                      getRowId={(p) => p.data.lineId}
                      defaultColDef={{ resizable: true, sortable: true, filter: true, editable: true }}
                      rowSelection="multiple"
                      suppressRowClickSelection={true}
                      groupDisplayType={"groupRows"}
                      autoGroupColumnDef={{
                        headerName: "Section",
                        minWidth: 240,
                        cellRendererParams: { suppressCount: false }
                      }}
                      groupDefaultExpanded={isPhone ? 0 : 1}
                      pinnedBottomRowData={pinnedBottomRow}
                      pagination={true}
                      paginationPageSize={PAGE_SIZE}
                      enterNavigatesVertically={true}
                      enterNavigatesVerticallyAfterEdit={true}
                      stopEditingWhenCellsLoseFocus={true}
                      undoRedoCellEditing={true}
                      undoRedoCellEditingLimit={50}
                      enableRangeSelection={true}
                      suppressClipboardPaste={false}
                      processDataFromClipboard={(params) => params.data}
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

            {!selectedHeader && <div style={{ fontWeight: 900, padding: 10 }}>No estimate selected.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
