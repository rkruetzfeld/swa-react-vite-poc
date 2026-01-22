import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { apiGet, apiPost } from "../api/client";

type ProjectDto = {
  projectId: string;
  name: string;
  updatedUtc: string;
};

type HealthResponse = {
  entity: string;
  latest?: {
    runId: string;
    startedUtc: string;
    endedUtc: string;
    durationMs: number;
    recordCount: number;
    succeeded: boolean;
    error?: string | null;
  } | null;
};

export default function ProjectsPage() {
  const [rows, setRows] = useState<ProjectDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const colDefs = useMemo<ColDef<ProjectDto>[]>(
    () => [
      { headerName: "Project Id", field: "projectId", sortable: true, filter: true, width: 160 },
      { headerName: "Name", field: "name", sortable: true, filter: true, flex: 1, minWidth: 240 },
      { headerName: "Updated (UTC)", field: "updatedUtc", sortable: true, filter: true, width: 190 },
    ],
    []
  );

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const data = await apiGet<ProjectDto[]>("/projects");
      setRows(data ?? []);
      const h = await apiGet<HealthResponse>("/health/projects");
      setHealth(h ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSyncNow() {
    setBusy(true);
    setError("");
    try {
      await apiPost("/sync/projects", {});
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Projects</div>
          <div className="kicker">
            Synced Projects from PMWeb into storage. Joins to Estimates will be by <code>projectId</code>.
          </div>
          {health?.latest && (
            <div className="kicker" style={{ marginTop: 6 }}>
              Last sync: {health.latest.succeeded ? "✅" : "❌"} {new Date(health.latest.startedUtc).toISOString()} •{" "}
              {health.latest.durationMs} ms • {health.latest.recordCount} projects
              {health.latest.error ? ` • ${health.latest.error}` : ""}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Filter…"
            style={{ width: 220 }}
          />
          <button className="btn" onClick={refresh} disabled={busy}>
            Refresh
          </button>
          <button className="btn" onClick={runSyncNow} disabled={busy}>
            Run Sync Now
          </button>
        </div>
      </div>

      {error && <div className="panel" style={{ border: "1px solid #ffb5b5" }}>{error}</div>}

      <div className="panel" style={{ flex: 1, minHeight: 0, padding: 0 }}>
        <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
          <AgGridReact<ProjectDto>
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
