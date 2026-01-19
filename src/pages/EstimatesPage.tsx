import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

type ProjectDto = {
  projectId: string;
  name: string;
};

type EstimateDto = {
  estimateId: string;
  projectId: string;
  name: string;
  status: string;
  createdUtc?: string;
};

export default function EstimatesPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [estimates, setEstimates] = useState<EstimateDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedProject = useMemo(
    () => projects.find((p) => p.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  async function loadProjects() {
    setBusy(true);
    setError("");
    try {
      const data = await apiGet<{ items: any[] }>("/api/projects");
      const raw = Array.isArray(data?.items) ? data.items : [];

      const mapped: ProjectDto[] = raw
        .map((x) => ({
          projectId: x.projectId ?? x.ProjectId ?? "",
          name: x.name ?? x.Name ?? "",
        }))
        .filter((p) => p.projectId);

      setProjects(mapped);

      const first = mapped.length > 0 ? mapped[0].projectId : "";
      setSelectedProjectId((prev) => prev || first);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadEstimates(projectId: string) {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiGet<any>(
        `/api/estimates?projectId=${encodeURIComponent(projectId)}&top=50`
      );

      // tolerate either { items: [...] } or [...]
      const raw = Array.isArray(data) ? data : (data?.items ?? []);
      const mapped: EstimateDto[] = (Array.isArray(raw) ? raw : []).map((x) => ({
        estimateId: x.estimateId ?? x.EstimateId ?? "",
        projectId: x.projectId ?? x.ProjectId ?? projectId,
        name: x.name ?? x.Name ?? "",
        status: x.status ?? x.Status ?? "",
        createdUtc: x.createdUtc ?? x.CreatedUtc,
      })).filter(e => e.estimateId);

      setEstimates(mapped);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // initial load
  useEffect(() => {
    void loadProjects();
  }, []);

  // reload estimates when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    void loadEstimates(selectedProjectId);
  }, [selectedProjectId]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Estimates</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={loadProjects} disabled={busy}>Reload Projects</button>
        <button onClick={() => loadEstimates(selectedProjectId)} disabled={busy || !selectedProjectId}>
          Reload Estimates
        </button>
        {busy ? <span>Working…</span> : null}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <label>
          Project:&nbsp;
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={busy}
          >
            <option value="">(select)</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectId} — {p.name}
              </option>
            ))}
          </select>
        </label>

        {selectedProject ? (
          <span style={{ opacity: 0.85 }}>
            Selected: <strong>{selectedProject.name}</strong>
          </span>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: "1px solid rgba(255,0,0,0.35)" }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Estimates</div>
        <div style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: 12, maxHeight: 420, overflow: "auto" }}>
          {estimates.length === 0 ? (
            <div style={{ opacity: 0.75 }}>(none loaded)</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>Estimate</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>Name</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>Status</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e) => (
                  <tr key={e.estimateId}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{e.estimateId}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{e.name}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{e.status}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {e.createdUtc ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
