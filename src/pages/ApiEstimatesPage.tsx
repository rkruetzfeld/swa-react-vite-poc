import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  getEstimates,
  getProjects,
  seedEstimates,
  type EstimateDto,
  type ProjectDto,
  type GetEstimatesResponse
} from "../api/estimatesApi";

export default function ApiEstimatesPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("PROJ-001");

  const [rowData, setRowData] = useState<EstimateDto[]>([]);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const colDefs = useMemo(
    () => [
      { field: "estimateId", headerName: "Estimate Id", flex: 1 },
      { field: "projectId", headerName: "Project Id", flex: 1 },
      { field: "name", headerName: "Name", flex: 2 },
      { field: "status", headerName: "Status", width: 140 },
      { field: "createdUtc", headerName: "Created (UTC)", flex: 1 }
    ],
    []
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true
    }),
    []
  );

  async function loadProjects() {
    setError(null);
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
      // Keep whatever is selected unless empty
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
      const resp: GetEstimatesResponse = await getEstimates({
        projectId,
        top: 50,
        includeDiagnostics: true
      });

      // ✅ Explicitly use resp.items (array) — avoid e.map crash
      const items = resp?.items;
      setRowData(Array.isArray(items) ? items : []);

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
    if (selectedProjectId) {
      loadEstimates(selectedProjectId);
    }
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
            {/* keep selected value even if projects list is empty */}
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
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          theme="legacy"          // ✅ silences error #239 while keeping your CSS imports
          rowSelection={{ mode: "singleRow" }}  // ✅ avoid deprecated string form warning
        />
      </div>
    </div>
  );
}
