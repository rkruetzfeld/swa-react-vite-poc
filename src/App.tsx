import { useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, RowClickedEvent } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type TopNav = "Dashboard" | "Estimates" | "Reports" | "Settings";
type View = "EstimatesList" | "EstimateDetail" | "CreateEstimate";

type EstimateHeader = {
  estimateId: string;
  client: string;
  title: string;
  status: "Draft" | "Submitted" | "Approved";
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

const LS_HEADERS = "poc_estimate_headers_v2";
const LS_LINES_PREFIX = "poc_estimate_lines_v2__";

function uuid(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function nowIso(): string {
  return new Date().toISOString();
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

  const headers: EstimateHeader[] = [
    {
      estimateId: "1001",
      client: "Custom Solutions Inc.",
      title: "Estimate Starter",
      status: "Draft",
      dateCreated: new Date(2022, 0, 1).toISOString(),
      dueDate: new Date(2023, 2, 1).toISOString(),
      lastUpdated: nowIso()
    },
    {
      estimateId: "1002",
      client: "Project Solutions Inc.",
      title: "Custom Solutions Inc.",
      status: "Submitted",
      dateCreated: new Date(2022, 0, 1).toISOString(),
      dueDate: new Date(2023, 2, 4).toISOString(),
      lastUpdated: nowIso()
    },
    {
      estimateId: "1003",
      client: "Preferreds Tranne",
      title: "Project Software Inc.",
      status: "Approved",
      dateCreated: new Date(2022, 0, 1).toISOString(),
      dueDate: new Date(2023, 3, 1).toISOString(),
      lastUpdated: nowIso()
    }
  ];

  saveHeaders(headers);

  saveLines("1001", [
    {
      lineId: uuid(),
      item: "1010",
      description: "Online marketing proposal",
      uom: "LS",
      qty: 1,
      unitRate: 90,
      notes: ""
    },
    {
      lineId: uuid(),
      item: "1020",
      description: "Mobilization",
      uom: "LS",
      qty: 1,
      unitRate: 12500,
      notes: ""
    },
    {
      lineId: uuid(),
      item: "1030",
      description: "Traffic control",
      uom: "day",
      qty: 12,
      unitRate: 850,
      notes: ""
    }
  ]);

  saveLines("1002", [
    {
      lineId: uuid(),
      item: "2010",
      description: "Site survey & layout",
      uom: "LS",
      qty: 1,
      unitRate: 3800,
      notes: ""
    }
  ]);

  saveLines("1003", [
    {
      lineId: uuid(),
      item: "3010",
      description: "Concrete repair",
      uom: "m2",
      qty: 120,
      unitRate: 310,
      notes: ""
    }
  ]);
}

export default function App() {
  // seed once
  useMemo(() => {
    seedIfEmpty();
    return null;
  }, []);

  // ---- app state
  const [topNav, setTopNav] = useState<TopNav>("Estimates");
  const [view, setView] = useState<View>("EstimatesList");

  const [headers, setHeaders] = useState<EstimateHeader[]>(() => loadHeaders());
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(
    headers[0]?.estimateId ?? null
  );

  const [search, setSearch] = useState("");
  const filteredHeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return headers;
    return headers.filter((h) => {
      const hay = `${h.estimateId} ${h.client} ${h.title} ${h.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [headers, search]);

  const selectedHeader = useMemo(
    () => headers.find((h) => h.estimateId === selectedEstimateId) ?? null,
    [headers, selectedEstimateId]
  );

  const [lines, setLines] = useState<EstimateLine[]>(() =>
    selectedEstimateId ? loadLines(selectedEstimateId) : []
  );

  // ---- grid refs
  const listApiRef = useRef<GridApi | null>(null);
  const detailApiRef = useRef<GridApi | null>(null);

  // ---- derived totals
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
  }

  function saveCurrentEstimate() {
    if (!selectedEstimateId) return;
    saveLines(selectedEstimateId, lines);
    updateHeaderLastUpdated(selectedEstimateId);
    alert("Saved (localStorage).");
  }

  // ---- styling (light theme PoC)
  const appWrap: React.CSSProperties = {
    height: "100vh",
    background: "#f3f6fb",
    color: "#0f172a",
    fontFamily: "system-ui, Segoe UI, Arial",
    display: "grid",
    gridTemplateRows: "56px 1fr"
  };

  const topBar: React.CSSProperties = {
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px"
  };

  const brand: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800
  };

  const logo: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "#2563eb",
    display: "grid",
    placeItems: "center",
    color: "white",
    fontSize: 14,
    fontWeight: 900
  };

  const topNavWrap: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginLeft: 14
  };

  const topNavItem = (active: boolean): React.CSSProperties => ({
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    color: active ? "#1d4ed8" : "#334155",
    background: active ? "#eef2ff" : "transparent"
  });

  const main: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    minHeight: 0
  };

  const side: React.CSSProperties = {
    background: "white",
    borderRight: "1px solid #e5e7eb",
    padding: 12
  };

  const sideItem = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    color: active ? "#1d4ed8" : "#334155",
    background: active ? "#eef2ff" : "transparent",
    marginBottom: 6
  });

  const content: React.CSSProperties = {
    minHeight: 0,
    padding: 16
  };

  const pageTitle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 900,
    margin: "2px 0 10px 0"
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)"
  };

  const buttonPrimary: React.CSSProperties = {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13
  };

  const buttonGhost: React.CSSProperties = {
    background: "transparent",
    color: "#1f2937",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13
  };

  const pill = (status: EstimateHeader["status"]): React.CSSProperties => {
    let bg = "#e5e7eb";
    let fg = "#111827";
    if (status === "Draft") {
      bg = "#e0f2fe";
      fg = "#075985";
    } else if (status === "Submitted") {
      bg = "#fef3c7";
      fg = "#92400e";
    } else if (status === "Approved") {
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
      fontWeight: 800,
      fontSize: 12
    };
  };

  // ---- grids
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
          const v = p.value as EstimateHeader["status"];
          return `<span style="
              display:inline-flex;align-items:center;
              padding:3px 8px;border-radius:999px;
              font-weight:800;font-size:12px;
              background:${v === "Draft" ? "#e0f2fe" : v === "Submitted" ? "#fef3c7" : "#dcfce7"};
              color:${v === "Draft" ? "#075985" : v === "Submitted" ? "#92400e" : "#166534"};
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
          const total = rows.reduce(
            (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0),
            0
          );
          return total;
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

  // ---- Create estimate (simple)
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
  }

  // ---- Render
  return (
    <div style={appWrap}>
      {/* Top bar */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={brand}>
            <div style={logo}>▦</div>
            <div>Portal</div>
          </div>

          <div style={topNavWrap}>
            {(["Dashboard", "Estimates", "Reports", "Settings"] as TopNav[]).map((t) => (
              <div
                key={t}
                style={topNavItem(topNav === t)}
                onClick={() => {
                  setTopNav(t);
                  if (t === "Estimates") setView("EstimatesList");
                  else setView("EstimatesList"); // keep simple PoC
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#334155" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Welcome, John</div>
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
      <div style={main}>
        {/* Sidebar */}
        <div style={side}>
          <div
            style={sideItem(false)}
            onClick={() => {
              setTopNav("Dashboard");
              setView("EstimatesList");
            }}
          >
            ▢ Dashboard
          </div>

          <div
            style={sideItem(true)}
            onClick={() => {
              setTopNav("Estimates");
              setView("EstimatesList");
            }}
          >
            ▦ Estimates
          </div>

          <div style={sideItem(false)} onClick={() => alert("PoC: not implemented")}>
            ▤ Reports
          </div>

          <div style={sideItem(false)} onClick={() => alert("PoC: not implemented")}>
            ◷ Analytics
          </div>

          <div style={sideItem(false)} onClick={() => alert("PoC: not implemented")}>
            ⚙ Settings
          </div>
        </div>

        {/* Content */}
        <div style={content}>
          {/* Estimates List */}
          {view === "EstimatesList" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={pageTitle}>Estimates</div>
                <button
                  style={buttonPrimary}
                  onClick={() => {
                    setView("CreateEstimate");
                  }}
                >
                  Create Estimate
                </button>
              </div>

              <div style={{ ...card, padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      outline: "none"
                    }}
                  />
                  <button
                    style={buttonGhost}
                    onClick={() => {
                      setSearch("");
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div className="ag-theme-quartz" style={{ height: 520 }}>
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

                <div style={{ paddingTop: 10, fontSize: 12, color: "#64748b" }}>
                  Click a row to open the estimate. (PoC: localStorage only)
                </div>
              </div>
            </div>
          )}

          {/* Create Estimate */}
          {view === "CreateEstimate" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={pageTitle}>Create Estimate</div>
                <button style={buttonGhost} onClick={() => setView("EstimatesList")}>
                  Back
                </button>
              </div>

              <div style={{ ...card, padding: 14, maxWidth: 720 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Client</div>
                    <input
                      value={newClient}
                      onChange={(e) => setNewClient(e.target.value)}
                      placeholder="Custom Solutions Inc."
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Title</div>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Estimate Starter"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={buttonPrimary} onClick={createEstimate}>
                      Create
                    </button>
                    <button style={buttonGhost} onClick={() => setView("EstimatesList")}>
                      Cancel
                    </button>
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Creates a draft estimate in localStorage.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Estimate Detail */}
          {view === "EstimateDetail" && selectedHeader && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 14, color: "#64748b", fontWeight: 800 }}>
                    ID {selectedHeader.estimateId}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedHeader.client}</div>
                  <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
                    {selectedHeader.title}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Total</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{formatCurrencyCAD(estimateTotal)}</div>
                  </div>
                  <button style={buttonGhost} onClick={() => setView("EstimatesList")}>
                    Back
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                <div style={{ ...card, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Estimate Date</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{formatDate(selectedHeader.dateCreated)}</div>
                </div>

                <div style={{ ...card, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Due Date</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{formatDate(selectedHeader.dueDate)}</div>
                </div>

                <div style={{ ...card, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Status</div>
                  <div>{/* pill */}<span style={pill(selectedHeader.status)}>{selectedHeader.status}</span></div>
                </div>
              </div>

              <div style={{ ...card, padding: 12, marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>Estimate Line Items</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button style={buttonGhost} onClick={exportDetailCsv}>Export</button>
                    <button style={buttonGhost} onClick={deleteSelectedLines}>Delete</button>
                    <button style={buttonPrimary} onClick={addLine}>Add Item</button>
                    <button style={buttonPrimary} onClick={saveCurrentEstimate}>Save</button>
                  </div>
                </div>

                <div className="ag-theme-quartz" style={{ height: 520 }}>
                  <AgGridReact<EstimateLine>
                    rowData={lines}
                    columnDefs={estimateDetailCols}
                    defaultColDef={{ resizable: true, sortable: true, filter: true }}
                    rowSelection="multiple"
                    getRowId={(p) => p.data.lineId}
                    singleClickEdit={true}
                    stopEditingWhenCellsLoseFocus={true}
                    onGridReady={(e) => (detailApiRef.current = e.api)}
                    onCellValueChanged={() => {
                      if (selectedHeader.estimateId) updateHeaderLastUpdated(selectedHeader.estimateId);
                    }}
                  />
                </div>

                <div style={{ paddingTop: 10, fontSize: 12, color: "#64748b" }}>
                  Edit Qty/Price to see totals update. Click Save to persist (localStorage).
                </div>
              </div>
            </div>
          )}

          {view === "EstimateDetail" && !selectedHeader && (
            <div style={{ ...card, padding: 12 }}>
              No estimate selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
