import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { apiGet } from "../api/client";

// IMPORTANT:
// This should be the Function App HOST (no /api prefix unless your Functions use it).
// Example: https://pegportal-api-func-cc-001.azurewebsites.net
const API_HOST = (import.meta.env.VITE_API_BASE_URL ?? "").toString().replace(/\/+$/, "");

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

type SqlPingResponse = {
  ok?: boolean;
  elapsedMs?: number;
  traceId?: string;
  payload?: string;
};

export default function ProjectsPage() {
  const [rows, setRows] = useState<ProjectDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [pingResult, setPingResult] = useState<string>("");

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
      if (!API_HOST) throw new Error("VITE_API_BASE_URL is not set (should be your Function App host).");

      const data = await apiGet<ProjectDto[]>("/projects", { baseUrl: API_HOST });
      setRows(Array.isArray(data) ? data : []);

      // optional health (don't break UI if it errors)
      try {
        const h = await apiGet<HealthResponse>("/health/projects", { baseUrl: API_HOST });
        setHealth(h ?? null);
      } catch {
        setHealth(null);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pingSql() {
    setBusy(true);
    setError("");
    try {
      if (!API_HOST) throw new Error("VITE_API_BASE_URL is not set (should be your Function App host).");

      const result = await apiGet<SqlPingResponse>("/diag/sql-ping", { baseUrl: API_HOST });

      const elapsed = result?.elapsedMs ?? "?";
      const trace = result?.traceId ? ` • traceId=${result.traceId}` : "";
      setPingResult(`Ping OK • elapsedMs=${elapsed}${trace} • ${new Date().toISOString()}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPingResult("");
    } finally {
      setBusy(false);
    }
  }


  async function pingProjects() {
    setBusy(true);
    setError("");
    try {
      if (!API_HOST) throw new Error("VITE_API_BASE_URL is not set (should be your Function App host).");

      const result = await apiGet<any>("/diag/projects-ping", { baseUrl: API_HOST });

      const elapsed = result?.elapsedMs ?? "?";
      const trace = result?.traceId ? ` • traceId=${result.traceId}` : "";
      setPingResult(`Projects Ping OK • elapsedMs=${elapsed}${trace} • ${new Date().toISOString()}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPingResult("");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Optional: comment this out while you're focused only on sql-ping
    refresh();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Projects</div>
          <div className="kicker">
            Synced Projects from PMWeb into storage. Joins to Estimates will be by <code>projectId</code>.
          </div>

          {pingResult && <div className="kicker" style={{ marginTop: 6 }}>{pingResult}</div>}

          {health?.latest && (
            <div className="kicker" style={{ marginTop: 6 }}>
              Last sync: {health.latest.succeeded ? "✅" : "❌"}{" "}
              {new Date(health.latest.startedUtc).toISOString()} • {health.latest.durationMs} ms •{" "}
              {health.latest.recordCount} projects
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
            Load Projects
          </button>
          <button className="btn" onClick={pingSql} disabled={busy}>
            Ping SQL
          </button>
          <button className="btn" onClick={pingProjects} disabled={busy}>
            Ping Projects
          </button>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ border: "1px solid #ffb5b5" }}>
          {error}
        </div>
      )}

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
