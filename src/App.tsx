import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  RowClickedEvent,
  ValueParserParams
} from "ag-grid-community";

import {
  estimateDataService,
  EstimateHeader,
  EstimateLine,
  ItemCatalog,
  Status
} from "./services/estimateDataService";

import { StatusPill } from "./components/StatusPill";

const PAGE_SIZE = 20;
const COST_CODE_REGEX = /^\d{2}-[A-Z]{3,10}-\d{3}-\d{3}$/;

const UOM_OPTIONS = ["LS", "ea", "day", "km", "m", "m2", "m3", "t", "kg"];

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

export default function App() {
  // --- viewport responsive flags ---
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

  // --- loading state ---
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- data ---
  const [headers, setHeaders] = useState<EstimateHeader[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const itemByCode = useMemo(() => new Map(items.map((i) => [i.costCode, i])), [items]);
  const itemCodes = useMemo(() => items.map((i) => i.costCode), [items]);

  // --- selection ---
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  const [lines, setLines] = useState<EstimateLine[]>([]);
  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // --- list filters ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 730);
    return toIsoDateOnly(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDateOnly(new Date()));

  // --- detail add-item selector ---
  const [selectedItemCode, setSelectedItemCode] = useState<string>("");

  // --- view ---
  const [view, setView] = useState<"EstimatesList" | "EstimateDetail">("EstimatesList");

  // Load headers + item catalog on startup (runtime fetch, not bundled)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const [h, it] = await Promise.all([
          estimateDataService.getEstimateHeaders(),
          estimateDataService.getItemCatalog()
        ]);

        if (cancelled) return;

        setHeaders(h);
        setItems(it);

        const firstId = h[0]?.estimateId ?? null;
        setSelectedEstimateId(firstId);

        if (it.length > 0) setSelectedItemCode(it[0].costCode);

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(e?.message || "Failed to load sample data.");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function openEstimate(id: string) {
    setSelectedEstimateId(id);
    setView("EstimateDetail");
    if (isDrawer) setSidebarOpen(false);

    try {
      const loaded = await estimateDataService.getEstimateLines(id);
      setLines(loaded);
    } catch (e: any) {
      alert(e?.message || "Failed to load estimate lines.");
      setLines([]);
    }
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

    setLines((prev) => [...prev, newRow]);

    setTimeout(() => {
      detailApiRef.current?.applyTransaction({ add: [newRow] });
      detailApiRef.current?.paginationGoToLastPage();
    }, 0);
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

  function createEstimate() {
    // Front-end only: create a new estimate in memory and open it.
    const nextId = String(
      Math.max(...headers.map((h) => Number(h.estimateId) || 0), 1000) + 1
    );

    const created = nowIso();
    const due = new Date();
    due.setDate(due.getDate() + 14);

    const newHeader: EstimateHeader = {
      estimateId: nextId,
      client: "New Client (PoC)",
      title: "New Estimate",
      status: "Draft",
      dateCreated: created,
      dueDate: due.toISOString(),
      lastUpdated: created
    };

    // Default 20 lines (page)
    const defaultItem = items[0];
    const initialLines: EstimateLine[] = Array.from({ length: 20 }).map((_, idx) => {
      const it = items[(idx + 1) % items.length] || defaultItem;
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
    setSelectedEstimateId(nextId);
    setLines(initialLines);
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

  if (loading) {
    return (
      <div style={{ padding: 16, fontWeight: 900 }}>
        <style>{styles}</style>
        Loading sample data from <code>/public/sample-data</code>…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 16 }}>
        <style>{styles}</style>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Failed to load sample data</div>
        <div style={{ color: "#b91c1c", fontWeight: 800 }}>{loadError}</div>
        <div style={{ marginTop: 10, fontWeight: 800 }}>
          Ensure you ran: <code>npm run gen:data</code>
        </div>
      </div>
    );
  }

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
          <div>Portal PoC — Runtime JSON data</div>

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
                Data loaded from <code>/sample-data/*.json</code>
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
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "1fr 380px auto auto" }}>
                  <select
                    value={selectedItemCode}
                    onChange={(e) => setSelectedItemCode(e.target.value)}
                    style={{ padding: 10, fontWeight: 800 }}
                  >
                    {items.map((it) => (
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
                      rowData={lines}
                      columnDefs={estimateDetailCols}
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
