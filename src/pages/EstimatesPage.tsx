import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { apiGet } from "../api/client";

// Option A: call Function App host directly (no SWA /api rewrite)
const API_HOST = (import.meta.env.VITE_API_BASE_URL ?? "")
  .toString()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

type ProjectDto = {
  projectId: string;
  name: string;
  updatedUtc: string;
};

type EstimateDto = {
  estimateId: string;
  projectId: string;
  name?: string;
  status?: string;
  amount?: number;
  updatedUtc?: string;
};

type EstimateRow = EstimateDto & {
  projectName?: string;
};

export default function EstimatesPage() {
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState("");

  const colDefs = useMemo<ColDef<EstimateRow>[]>(
    () => [
      { headerName: "Estimate Id", field: "estimateId", sortable: true, filter: true, width: 160 },
      { headerName: "Project Id", field: "projectId", sortable: true, filter: true, width: 150 },
      { headerName: "Project", field: "projectName", sortable: true, filter: true, flex: 1, minWidth: 220 },
      { headerName: "Name", field: "name", sortable: true, filter: true, flex: 1, minWidth: 220 },
      { headerName: "Status", field: "status", sortable: true, filter: true, width: 130 },
      {
        headerName: "Amount",
        field: "amount",
        sortable: true,
        filter: true,
        width: 140,
        valueFormatter: (p) =>
          typeof p.value === "number"
            ? p.value.toLocaleString(undefined, { style: "currency", currency: "CAD" })
            : "",
      },
      { headerName: "Updated (UTC)", field: "updatedUtc", sortable: true, filter: true, width: 190 },
    ],
    []
  );

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      if (!API_HOST) {
        throw new Error("VITE_API_BASE_URL is not set (should be your Function App host).");
      }

      // Load both sets from the Function App host
      const [estimates, projects] = await Promise.all([
        apiGet<EstimateDto[]>("/estimates", { baseUrl: API_HOST }),
        apiGet<ProjectDto[]>("/projects", { baseUrl: API_HOST }),
      ]);

      const projectMap = new Map<string, string>();
      (projects ?? []).forEach((p) => projectMap.set(p.projectId, p.name));

      const enriched: EstimateRow[] = (estimates ?? []).map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? "",
      }));

      setRows(enriched);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div className="panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 260 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Estimates</div>
            <div className="kicker">
              Estimates are joined to Projects by <code>projectId</code>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Filter…"
              style={{ width: 220 }}
            />
            <button className="btn btn-primary" onClick={refresh} disabled={busy}>
              Load Estimates
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ border: "1px solid #ffb5b5" }}>
          {error}
        </div>
      )}

      <div className="panel" style={{ flex: 1, minHeight: 0, padding: 0, overflow: "hidden" }}>
        <div className="ag-theme-quartz-dark" style={{ height: "100%", width: "100%" }}>
          {/* NOTE: the generic parameter MUST be closed with ">" */}
          <AgGridReact<EstimateRow>
            rowData={rows}
            columnDefs={colDefs}
            animateRows
            pagination
            paginationPageSize={50}
            quickFilterText={quickFilter}
            rowSelection={{ mode: "singleRow" }}
          />
        </div>
      </div>

      <div className="kicker">Rows: {rows.length}</div>
    </div>
  );
}