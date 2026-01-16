import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  getEstimates,
  getProjects,
  seedEstimates,
  type ProjectDto,
  // If you chose Option A, use GetEstimatesResult instead.
  type GetEstimatesResult,
  // If you chose Option B (alias), you can import GetEstimatesResponse instead.
  // type GetEstimatesResponse,
} from "../api/estimatesApi";

type EstimateRow = {
  estimateId: string;
  projectId: string;
  name: string;
  status: string;
  createdUtc: string;
};

export default function ApiEstimatesPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("PROJ-001");

  const [rowData, setRowData] = useState<EstimateRow[]>([]);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const colDefs = useMemo<ColDef<EstimateRow>[]>(
    () => [
      { field: "estimateId", headerName: "Estimate Id", flex: 1, filter: true },
      { field: "projectId", headerName: "Project Id", flex: 1, filter: true },
      { field: "name", headerName: "Name", flex: 2, filter: true },
      { field: "status", headerName: "Status", width: 140, filter: true },
      { field: "createdUtc", headerName: "Created (UTC)", flex: 1, filter: true },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef<EstimateRow>>(
    () => ({ sortable: true, resizable: true, filter: true }),
    []
  );

  async function loadProjects() {
    setError(null);
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
      if (!selectedProjectId && data.length > 0) setSelectedProjectId(data[0].projectId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function loadEstimates(projectId: string) {
    setLoading(true);
    setError(null);
    setDiagnostics(null);

    try {
      const resp: GetEstimatesResult = await getEstimates({
        projectId,
        top: 50,
        includeDiagnostics: true,
      });

      const items = resp?.items;
      const transformed: EstimateRow[] = Array.isArray(items)
        ? items.map((item) => ({
            estimateId: item.estimateId,
            projectId: item.projectId,
            name: item.name,
            status: item.status,
            createdUtc: item.createdUtc ?? "",
          }))
        : [];

      setRowData(transformed);
      setDiagnostics(resp?.diagnostics ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRowData([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setLoading(true);
    setError(null);
    try {
      await seedEstimates();
      await loadProjects();
      await loadEstimates(selectedProjectId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadEstimates(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>API Test Page</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>
          Project:&nbsp;
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loading}
          >
            {projects.length === 0 ? (
              <option value={selectedProjectId}>{selectedProjectId || "(none)"}</option>
            ) : (
              projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectId} — {p.name}
                </option>
              ))
            )}
          </select>
        </label>

        <button onClick={() => loadEstimates(selectedProjectId)} disabled={loading || !selectedProjectId}>
          Refresh
        </button>

        <button onClick={handleSeed} disabled={loading}>
          Seed
        </button>

        {loading ? <span>Loading…</span> : null}
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: 12, border: "1px solid #cc0000" }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {diagnostics ? (
        <details style={{ marginBottom: 12 }}>
          <summary>Diagnostics</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(diagnostics, null, 2)}</pre>
        </details>
      ) : null}

      <div className="ag-theme-quartz" style={{ height: 520, width: "100%" }}>
        <AgGridReact<EstimateRow>
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          rowSelection={{ mode: "singleRow" }}
        />
      </div>
    </div>
  );
}
