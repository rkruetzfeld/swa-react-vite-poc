import { useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";

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

export default function SmokeTestPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [estimates, setEstimates] = useState<EstimateDto[]>([]);
  const [createdEstimateId, setCreatedEstimateId] = useState<string>("");
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  function append(msg: string) {
    setLog((prev) => {
      const line = `${new Date().toISOString()}  ${msg}`;
      return prev ? `${prev}\n${line}` : line;
    });
  }

  async function seedEstimates() {
    setBusy(true);
    try {
      append("POST /api/seed/estimates");
      await apiPost("/api/seed/estimates", {});
      append("Seed response: OK");
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadProjects() {
    setBusy(true);
    try {
      append("GET /api/projects");

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
      if (first) setSelectedProjectId(first);

      append(`Loaded ${mapped.length} projects`);
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createEstimate() {
    if (!selectedProjectId) {
      append("Select a project first.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        projectId: selectedProjectId,
        name: `SmokeTest ${new Date().toISOString()}`,
        status: "Draft",
      };

      append("POST /api/estimates");
      const raw = await apiPost<any>("/api/estimates", payload);

      const created: EstimateDto = {
        estimateId: raw?.estimateId ?? raw?.EstimateId ?? "",
        projectId: raw?.projectId ?? raw?.ProjectId ?? selectedProjectId,
        name: raw?.name ?? raw?.Name ?? payload.name,
        status: raw?.status ?? raw?.Status ?? payload.status,
        createdUtc: raw?.createdUtc ?? raw?.CreatedUtc,
      };

      if (!created.estimateId) {
        append(
          `ERROR: Create returned no estimateId. Raw keys: ${Object.keys(raw ?? {}).join(", ")}`
        );
        return;
      }

      setCreatedEstimateId(created.estimateId);
      append(`Created estimate ${created.estimateId}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadEstimates() {
    if (!selectedProjectId) {
      append("Select a project first.");
      return;
    }

    setBusy(true);
    try {
      append(`GET /api/estimates?projectId=${selectedProjectId}`);

      const data = await apiGet<{ items: any[] } | any[]>(
        `/api/estimates?projectId=${encodeURIComponent(selectedProjectId)}`
      );

      const raw = Array.isArray(data) ? data : data?.items ?? [];

      const mapped: EstimateDto[] = raw
        .map((x) => ({
          estimateId: x.estimateId ?? x.EstimateId ?? "",
          projectId: x.projectId ?? x.ProjectId ?? selectedProjectId,
          name: x.name ?? x.Name ?? "",
          status: x.status ?? x.Status ?? "",
          createdUtc: x.createdUtc ?? x.CreatedUtc,
        }))
        .filter((e) => e.estimateId);

      setEstimates(mapped);
      append(`Loaded ${mapped.length} estimates`);
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadEstimateById() {
    if (!createdEstimateId) {
      append("Create an estimate first.");
      return;
    }

    setBusy(true);
    try {
      append(`GET /api/estimates/${createdEstimateId}`);

      const raw = await apiGet<any>(
        `/api/estimates/${encodeURIComponent(createdEstimateId)}`
      );

      const mapped: EstimateDto = {
        estimateId: raw?.estimateId ?? raw?.EstimateId ?? createdEstimateId,
        projectId: raw?.projectId ?? raw?.ProjectId ?? "",
        name: raw?.name ?? raw?.Name ?? "",
        status: raw?.status ?? raw?.Status ?? "",
        createdUtc: raw?.createdUtc ?? raw?.CreatedUtc,
      };

      append(`Loaded estimate. name=${mapped.name || "(no name)"}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Auth + Cosmos Smoke Test</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <button onClick={loadProjects} disabled={busy}>
          Load Projects
        </button>
        <button onClick={seedEstimates} disabled={busy}>
          Seed Estimates
        </button>
        <button onClick={createEstimate} disabled={busy || !selectedProjectId}>
          Create Estimate
        </button>
        <button onClick={loadEstimates} disabled={busy || !selectedProjectId}>
          Load Estimates
        </button>
        <button onClick={loadEstimateById} disabled={busy || !createdEstimateId}>
          Load Created By Id
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

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Estimates</div>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: 12,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {estimates.length === 0 ? (
            <div style={{ opacity: 0.75 }}>(none loaded)</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {estimates.map((e) => (
                <li key={e.estimateId}>
                  {e.estimateId} — {e.name} ({e.status})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Log</div>
        <textarea
          value={log}
          readOnly
          style={{
            width: "100%",
            minHeight: 220,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          }}
        />
      </div>
    </div>
  );
}
