import { useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type Screen =
  | "login"
  | "selectEstimate"
  | "overview"
  | "estimateDetail"
  | "newEstimate";

type EstimateHeader = {
  estimateId: string;
  projectName: string;
  estimateName: string;
  status: "Draft" | "Submitted";
  lastUpdated: string; // ISO string
};

type EstimateLine = {
  lineId: string;
  costCode: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes: string;
};

const LS_KEY_HEADERS = "poc_estimate_headers_v1";
const LS_KEY_LINES_PREFIX = "poc_estimate_lines_v1__"; // + estimateId

function formatCurrency(n: number): string {
  if (!isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuid(): string {
  // good enough for PoC
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function loadHeaders(): EstimateHeader[] {
  const raw = localStorage.getItem(LS_KEY_HEADERS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EstimateHeader[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHeaders(headers: EstimateHeader[]) {
  localStorage.setItem(LS_KEY_HEADERS, JSON.stringify(headers));
}

function loadLines(estimateId: string): EstimateLine[] {
  const raw = localStorage.getItem(LS_KEY_LINES_PREFIX + estimateId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EstimateLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLines(estimateId: string, lines: EstimateLine[]) {
  localStorage.setItem(LS_KEY_LINES_PREFIX + estimateId, JSON.stringify(lines));
}

function seedIfEmpty() {
  const headers = loadHeaders();
  if (headers.length > 0) return;

  const seed: EstimateHeader[] = [
    {
      estimateId: "EST-1001",
      projectName: "Highway 1 Resurfacing",
      estimateName: "Initial Estimate",
      status: "Draft",
      lastUpdated: nowIso()
    },
    {
      estimateId: "EST-1002",
      projectName: "Bridge Rehab - Segment B",
      estimateName: "Class D Estimate",
      status: "Draft",
      lastUpdated: nowIso()
    }
  ];
  saveHeaders(seed);

  saveLines("EST-1001", [
    {
      lineId: uuid(),
      costCode: "60-CONS-010",
      description: "Mobilization",
      uom: "LS",
      qty: 1,
      unitRate: 25000,
      notes: ""
    },
    {
      lineId: uuid(),
      costCode: "60-CONS-120",
      description: "Asphalt paving",
      uom: "t",
      qty: 450,
      unitRate: 145,
      notes: ""
    }
  ]);

  saveLines("EST-1002", [
    {
      lineId: uuid(),
      costCode: "60-CONS-210",
      description: "Concrete repair",
      uom: "m2",
      qty: 120,
      unitRate: 310,
      notes: ""
    }
  ]);
}

export default function App() {
  // Seed once per browser
  useMemo(() => {
    seedIfEmpty();
    return null;
  }, []);

  const [screen, setScreen] = useState<Screen>("login");

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

  const gridApiRef = useRef<GridApi | null>(null);

  const total = useMemo(() => {
    return lines.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitRate) || 0), 0);
  }, [lines]);

  const gridCols = useMemo<ColDef<EstimateLine>[]>(() => {
    return [
      {
        field: "costCode",
        headerName: "Cost Code",
        editable: true,
        width: 160
      },
      {
        field: "description",
        headerName: "Description",
        editable: true,
        flex: 1,
        minWidth: 220
      },
      {
        field: "uom",
        headerName: "UOM",
        editable: true,
        width: 90
      },
      {
        field: "qty",
        headerName: "Qty",
        editable: true,
        width: 110,
        valueParser: (p) => Number(p.newValue)
      },
      {
        field: "unitRate",
        headerName: "Unit Rate",
        editable: true,
        width: 140,
        valueParser: (p) => Number(p.newValue),
        valueFormatter: (p) => formatCurrency(Number(p.value) || 0)
      },
      {
        headerName: "Amount",
        width: 150,
        valueGetter: (p) => (Number(p.data?.qty) || 0) * (Number(p.data?.unitRate) || 0),
        valueFormatter: (p) => formatCurrency(Number(p.value) || 0)
      },
      {
        field: "notes",
        headerName: "Notes",
        editable: true,
        width: 220
      }
    ];
  }, []);

  function nav(to: Screen) {
    setScreen(to);
  }

  function openEstimate(estimateId: string) {
    setSelectedEstimateId(estimateId);
    const loaded = loadLines(estimateId);
    setLines(loaded);
    nav("overview");
  }

  function updateHeaderLastUpdated(estimateId: string) {
    const updated = headers.map((h) =>
      h.estimateId === estimateId ? { ...h, lastUpdated: nowIso() } : h
    );
    setHeaders(updated);
    saveHeaders(updated);
  }

  function saveCurrentEstimate() {
    if (!selectedEstimateId) return;
    saveLines(selectedEstimateId, lines);
    updateHeaderLastUpdated(selectedEstimateId);
    alert("Saved (localStorage).");
  }

  function addRow() {
    setLines((prev) => [
      ...prev,
      {
        lineId: uuid(),
        costCode: "",
        description: "",
        uom: "",
        qty: 0,
        unitRate: 0,
        notes: ""
      }
    ]);
  }

  function deleteSelectedRows() {
    const api = gridApiRef.current;
    if (!api) return;

    const selected = api.getSelectedRows() as EstimateLine[];
    if (!selected.length) {
      alert("Select one or more rows first.");
      return;
    }

    const selectedIds = new Set(selected.map((r) => r.lineId));
    setLines((prev) => prev.filter((r) => !selectedIds.has(r.lineId)));
  }

  function exportCsv() {
    const api = gridApiRef.current;
    if (!api) return;
    api.exportDataAsCsv({ fileName: `${selectedEstimateId ?? "estimate"}.csv` });
  }

  // --- UI helpers ---
  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0b1220",
    color: "white"
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    color: "#111827",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)"
  };

  const topBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.10)"
  };

  const buttonStyle: React.CSSProperties = {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 600
  };

  const buttonGhost: React.CSSProperties = {
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 600
  };

  // --- Screens ---
  if (screen === "login") {
    return (
      <div style={shellStyle}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "22px 18px" }}>
          <div style={{ ...topBarStyle, borderBottom: "none", padding: 0 }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>
              Estimates Portal (PoC)
            </div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Front-end only • SWA</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: 18,
              marginTop: 18
            }}
          >
            <div style={{ padding: 24 }}>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>
                Cost Estimate Entry
              </h1>
              <p style={{ marginTop: 10, opacity: 0.85, fontSize: 15, maxWidth: 520 }}>
                This is a simple PoC experience that mimics Entra login and the estimate
                workflow. No real authentication yet.
              </p>

              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={buttonStyle}
                  onClick={() => nav("selectEstimate")}
                  title="Mock sign-in"
                >
                  Sign in with Microsoft (mock)
                </button>
                <button
                  style={buttonGhost}
                  onClick={() => {
                    // quick bypass to demo
                    nav("selectEstimate");
                  }}
                >
                  Continue (demo)
                </button>
              </div>

              <div style={{ marginTop: 18, opacity: 0.75, fontSize: 13 }}>
                Demo storage: localStorage only. Data is saved per browser.
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>PoC Flow</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                <li>Login (mock Entra)</li>
                <li>Select estimate</li>
                <li>Overview</li>
                <li>Estimate detail (dense grid entry)</li>
              </ol>
              <div style={{ marginTop: 14, fontSize: 13, color: "#374151" }}>
                Next steps later: real Entra auth, API, persistence, validation rules, approvals.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "selectEstimate") {
    return (
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ fontWeight: 800 }}>Estimates Portal (PoC)</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={buttonGhost} onClick={() => nav("login")}>
              Sign out
            </button>
            <button style={buttonStyle} onClick={() => nav("newEstimate")}>
              Create new estimate
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 18px" }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Select estimate</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {headers.map((h) => (
                <div
                  key={h.estimateId}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {h.projectName} — {h.estimateName}
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                      {h.estimateId} • {h.status} • Updated{" "}
                      {new Date(h.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                  <button style={buttonStyle} onClick={() => openEstimate(h.estimateId)}>
                    Open selected
                  </button>
                </div>
              ))}
              {headers.length === 0 && (
                <div style={{ color: "#374151" }}>
                  No estimates yet. Click “Create new estimate”.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "newEstimate") {
    // simple create flow
    const [projectName, setProjectName] = useState("New Project");
    const [estimateName, setEstimateName] = useState("New Estimate");

    return (
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ fontWeight: 800 }}>Create new estimate</div>
          <button style={buttonGhost} onClick={() => nav("selectEstimate")}>
            Back
          </button>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 18px" }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Project name</span>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db"
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Estimate name</span>
                <input
                  value={estimateName}
                  onChange={(e) => setEstimateName(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db"
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  style={buttonStyle}
                  onClick={() => {
                    const newId = "EST-" + Math.floor(1000 + Math.random() * 9000);
                    const newHeader: EstimateHeader = {
                      estimateId: newId,
                      projectName: projectName.trim() || "New Project",
                      estimateName: estimateName.trim() || "New Estimate",
                      status: "Draft",
                      lastUpdated: nowIso()
                    };
                    const updated = [newHeader, ...headers];
                    setHeaders(updated);
                    saveHeaders(updated);

                    saveLines(newId, []);
                    setSelectedEstimateId(newId);
                    setLines([]);
                    nav("overview");
                  }}
                >
                  Create
                </button>
                <button style={buttonGhost} onClick={() => nav("selectEstimate")}>
                  Cancel
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#374151" }}>
                This creates an estimate in localStorage only.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "overview") {
    if (!selectedHeader) {
      return (
        <div style={shellStyle}>
          <div style={topBarStyle}>
            <div style={{ fontWeight: 800 }}>Overview</div>
            <button style={buttonGhost} onClick={() => nav("selectEstimate")}>
              Back
            </button>
          </div>
          <div style={{ padding: 18 }}>No estimate selected.</div>
        </div>
      );
    }

    return (
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ fontWeight: 800 }}>
            {selectedHeader.projectName} — {selectedHeader.estimateName}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={buttonGhost} onClick={() => nav("selectEstimate")}>
              Back
            </button>
            <button style={buttonStyle} onClick={() => nav("estimateDetail")}>
              Open estimate
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Summary</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 14 }}>
                <div>
                  <b>Estimate ID:</b> {selectedHeader.estimateId}
                </div>
                <div>
                  <b>Status:</b> {selectedHeader.status}
                </div>
                <div>
                  <b>Lines:</b> {lines.length}
                </div>
                <div>
                  <b>Total:</b> {formatCurrency(total)}
                </div>
                <div style={{ fontSize: 13, color: "#4b5563" }}>
                  Updated {new Date(selectedHeader.lastUpdated).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Next actions</div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={buttonStyle} onClick={() => nav("estimateDetail")}>
                  Edit line items
                </button>
                <button style={buttonGhost} onClick={saveCurrentEstimate}>
                  Save (localStorage)
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#4b5563" }}>
                (PoC) No approvals or workflow yet.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // estimateDetail
  if (!selectedHeader || !selectedEstimateId) {
    return (
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ fontWeight: 800 }}>Estimate Detail</div>
          <button style={buttonGhost} onClick={() => nav("selectEstimate")}>
            Back
          </button>
        </div>
        <div style={{ padding: 18 }}>No estimate selected.</div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={topBarStyle}>
        <div style={{ display: "grid" }}>
          <div style={{ fontWeight: 900 }}>
            {selectedHeader.projectName} — {selectedHeader.estimateName}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {selectedHeader.estimateId} • Dense grid entry (PoC)
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={buttonGhost} onClick={() => nav("overview")}>
            Back
          </button>
          <button style={buttonGhost} onClick={exportCsv}>
            Export CSV
          </button>
          <button style={buttonGhost} onClick={deleteSelectedRows}>
            Delete row(s)
          </button>
          <button style={buttonStyle} onClick={addRow}>
            Add row
          </button>
          <button style={buttonStyle} onClick={saveCurrentEstimate}>
            Save
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 18px" }}>
        <div style={{ ...cardStyle, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 800 }}>Estimate line items</div>
            <div style={{ fontWeight: 800 }}>Total: {formatCurrency(total)}</div>
          </div>

          <div className="ag-theme-quartz" style={{ height: 520 }}>
            <AgGridReact<EstimateLine>
              rowData={lines}
              columnDefs={gridCols}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              rowSelection="multiple"
              getRowId={(p) => p.data.lineId}
              singleClickEdit={true}
              stopEditingWhenCellsLoseFocus={true}
              onGridReady={(e) => {
                gridApiRef.current = e.api;
              }}
              onCellValueChanged={() => {
                // Keep UI responsive; persist on explicit Save button.
                updateHeaderLastUpdated(selectedEstimateId);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
