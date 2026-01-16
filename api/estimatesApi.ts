// src/api/estimatesApi.ts

export type ProjectDto = {
  projectId: string;
  name: string;
  updatedUtc?: string;
};

export type EstimateDto = {
  estimateId: string;
  projectId: string;
  name: string;
  status: string;
  createdUtc?: string;
  updatedUtc?: string;
  amount?: number;
  currency?: string;
};

export type GetEstimatesArgs = {
  projectId: string;
  top?: number;
  includeDiagnostics?: boolean;
};

export type GetEstimatesResult = {
  items: EstimateDto[];
  diagnostics?: Record<string, unknown> | null;
};

// For local/dev you can set VITE_API_BASE_URL in .env.local
// Example: VITE_API_BASE_URL=https://pegportal-api-func-cc-001.azurewebsites.net
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL?.trim?.() || "";

function buildUrl(path: string) {
  // If API_BASE is empty, this becomes "/api/..."
  // If API_BASE is set, it becomes "https://.../api/..."
  return `${API_BASE}${path}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`.trim());
  }
  return (await res.json()) as T;
}

function pick<T = any>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (o && typeof o === "object" && k in o) return o[k] as T;
  }
  return undefined;
}

function normalizeProjects(payload: any): ProjectDto[] {
  const raw = Array.isArray(payload) ? payload : pick<any[]>(payload, "items", "Items") || [];
  return raw.map((p: any) => ({
    projectId: pick<string>(p, "projectId", "ProjectId") || "",
    name: pick<string>(p, "name", "Name") || "",
    updatedUtc: pick<string>(p, "updatedUtc", "UpdatedUtc"),
  }));
}

function normalizeEstimates(payload: any): GetEstimatesResult {
  const rawItems = pick<any[]>(payload, "items", "Items") || [];
  const diagnostics =
    pick<Record<string, unknown> | null>(payload, "diagnostics", "Diagnostics") ?? null;

  const items: EstimateDto[] = rawItems.map((e: any) => ({
    estimateId: pick<string>(e, "estimateId", "EstimateId") || "",
    projectId: pick<string>(e, "projectId", "ProjectId") || "",
    name: pick<string>(e, "name", "Name") || "",
    status: pick<string>(e, "status", "Status") || "",
    createdUtc: pick<string>(e, "createdUtc", "CreatedUtc"),
    updatedUtc: pick<string>(e, "updatedUtc", "UpdatedUtc"),
    amount: pick<number>(e, "amount", "Amount"),
    currency: pick<string>(e, "currency", "Currency"),
  }));

  return { items, diagnostics };
}

export async function seedEstimates(): Promise<{ ok: boolean; seededUtc?: string }> {
  return await fetchJson(buildUrl("/api/seed/estimates"), { method: "POST" });
}

export async function getProjects(): Promise<ProjectDto[]> {
  const payload = await fetchJson<any>(buildUrl("/api/projects"));
  return normalizeProjects(payload);
}

export async function getEstimates(args: GetEstimatesArgs): Promise<GetEstimatesResult> {
  const top = args.top ?? 20;
  const includeDiagnostics = args.includeDiagnostics ? "true" : "false";

  const qs = new URLSearchParams({
    projectId: args.projectId,
    top: String(top),
    includeDiagnostics,
  });

  const payload = await fetchJson<any>(buildUrl(`/api/estimates?${qs.toString()}`));
  return normalizeEstimates(payload);
}

// Optional (only if you need it later)
export async function getEstimateById(projectId: string, estimateId: string): Promise<EstimateDto> {
  const payload = await fetchJson<any>(buildUrl(`/api/estimates/${encodeURIComponent(projectId)}/${encodeURIComponent(estimateId)}`));
  // Some APIs might return a single item not wrapped; normalize accordingly
  const one = Array.isArray(payload?.items) ? payload.items[0] : payload;
  const normalized = normalizeEstimates({ items: [one] }).items[0];
  return normalized;
}
