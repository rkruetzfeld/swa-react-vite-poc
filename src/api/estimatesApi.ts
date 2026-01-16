// src/api/estimatesApi.ts

const DEFAULT_API_BASE = "https://pegportal-api-func-cc-001.azurewebsites.net";

// Allow override via Vite env var later (SWA env setting -> VITE_API_BASE_URL)
function apiBase(): string {
  const v = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  return v && v.trim() ? v.trim().replace(/\/+$/, "") : DEFAULT_API_BASE;
}

export type EstimateDto = {
  estimateId: string;
  projectId: string;
  name: string;
  status: string;
  createdUtc: string;
};

export type ProjectDto = {
  projectId: string;
  name: string;
};

export type GetEstimatesResponse = {
  items: EstimateDto[];
  diagnostics?: Record<string, unknown>;
};

async function ensureOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;

  const body = await res.text().catch(() => "");
  const msg = body?.trim()
    ? `${action} failed (${res.status}): ${body}`
    : `${action} failed (${res.status})`;

  throw new Error(msg);
}

export async function getProjects(): Promise<ProjectDto[]> {
  const url = `${apiBase()}/api/projects`;
  const res = await fetch(url, { method: "GET" });
  await ensureOk(res, "GET /api/projects");
  return (await res.json()) as ProjectDto[];
}

export async function getEstimates(args: {
  projectId: string;
  top?: number;
  includeDiagnostics?: boolean;
}): Promise<GetEstimatesResponse> {
  const qs = new URLSearchParams();
  qs.set("projectId", args.projectId);
  if (typeof args.top === "number") qs.set("top", String(args.top));
  if (args.includeDiagnostics) qs.set("includeDiagnostics", "true");

  const url = `${apiBase()}/api/estimates?${qs.toString()}`;
  const res = await fetch(url, { method: "GET" });
  await ensureOk(res, "GET /api/estimates");

  return (await res.json()) as GetEstimatesResponse;
}

export async function seedEstimates(): Promise<void> {
  const url = `${apiBase()}/api/seed/estimates`;
  const res = await fetch(url, { method: "POST" });
  await ensureOk(res, "POST /api/seed/estimates");
}
