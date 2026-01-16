// src/api/estimatesApi.ts
import { apiGet, apiPost } from "./client";

export type ProjectDto = {
  projectId: string;
  name: string;
  createdUtc?: string;
};

export type EstimateDto = {
  estimateId: string;
  projectId: string;
  name: string;
  status: string;
  createdUtc: string;
};

export type EstimatesResponse = {
  items: EstimateDto[];
  diagnostics?: Record<string, unknown>;
};

export type SeedResponse = {
  ok: boolean;
  seededUtc: string;
};

export async function getProjects(): Promise<ProjectDto[]> {
  return apiGet<ProjectDto[]>("/api/projects");
}

export async function getEstimates(params: {
  projectId: string;
  top?: number;
  includeDiagnostics?: boolean;
}): Promise<EstimatesResponse> {
  const q = new URLSearchParams();
  q.set("projectId", params.projectId);
  if (params.top !== undefined) q.set("top", String(params.top));
  if (params.includeDiagnostics !== undefined) q.set("includeDiagnostics", String(params.includeDiagnostics));
  return apiGet<EstimatesResponse>(`/api/estimates?${q.toString()}`);
}

export async function seedEstimates(): Promise<SeedResponse> {
  return apiPost<SeedResponse>("/api/seed/estimates");
}
