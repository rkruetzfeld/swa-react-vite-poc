// src/pages/ApiEstimatesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { getEstimates, getProjects, seedEstimates, type EstimateDto, type ProjectDto } from "../api/estimatesApi";

export default function ApiEstimatesPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectId, setProjectId] = useState<string>("PROJ-001");
  const [items, setItems] = useState<EstimateDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  const canLoad = useMemo(() => !!projectId?.trim(), [projectId]);

  async function loadProjects() {
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
      // If current projectId isn’t in list, default to first
      if (data.length > 0 && !data.some(p => p.projectId === projectId)) {
        setProjectId(data[0].projectId);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load projects");
    }
  }

  async function loadEstimates() {
    if (!canLoad) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getEstimates({ projectId, top: 20, includeDiagnostics: true });
      setItems(res.items || []);
      setDiag((res as any).diagnostics ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load estimates");
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    setError(null);
    try {
      await seedEstimates();
      await loadProjects();
      await loadEstimates();
    } catch (e: any) {
      setError(e?.message || "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div style={{ padding: 16 }}>
      <h2>API Estimates</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label>
          Project:&nbsp;
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={busy}
            style={{ minWidth: 220 }}
          >
            {/* fallback option if projects fails */}
            {projects.length === 0 ? <option value="PROJ-001">PROJ-001</option> : null}
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectId} — {p.name}
              </option>
            ))}
          </select>
        </label>

        <button onClick={loadEstimates} disabled={busy || !canLoad}>
          Refresh
        </button>

        <button onClick={seed} disabled={busy}>
          Seed
        </button>

        {busy ? <span>Working…</span> : null}
      </div>

      {error ? (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Results ({items.length})</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>EstimateId</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>ProjectId</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>CreatedUtc</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={`${x.projectId}-${x.estimateId}`}>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{x.estimateId}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{x.projectId}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{x.name}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{x.status}</td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{x.createdUtc}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12 }}>
                  No results
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {diag ? (
          <details style={{ marginTop: 12 }}>
            <summary>Diagnostics</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(diag, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
