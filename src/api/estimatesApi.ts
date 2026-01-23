export type PmwebEstimateHeader = {
  estimateId: string;
  projectId?: string | null;
  revisionId?: string | null;
  revisionNumber?: number | null;
  revisionDate?: string | null;
  description?: string | null;
  reference?: string | null;
  docStatusId?: string | null;
  currencyId?: string | null;
  isActive?: boolean | null;
  categoryId?: string | null;
  uomId?: string | null;
  estimateUnit?: number | null;
  totalCostValue?: number | null;
  totalExtCostValue?: number | null;
  createdDate?: string | null;
  createdBy?: string | null;
  updatedDate?: string | null;
  updatedBy?: string | null;
};

export type PmwebEstimateDetail = {
  detailId: string;
  estimateId: string;
  lineNumber?: number | null;
  itemCode?: string | null;
  description?: string | null;
  costCodeId?: string | null;
  costTypeId?: string | null;
  uomId?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  extCost?: number | null;
  year?: number | null;
  periodId?: string | null;
  notes1?: string | null;
};

export async function getPmwebEstimates(apiBaseUrl: string, projectId?: string): Promise<PmwebEstimateHeader[]> {
  const url = new URL(`${apiBaseUrl}/estimates`);
  if (projectId) url.searchParams.set("projectId", projectId);

  const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!resp.ok) {
    throw new Error(`GET /estimates failed: ${resp.status} ${resp.statusText}`);
  }

  const json = (await resp.json()) as { ok?: boolean; estimates?: PmwebEstimateHeader[] };
  return json.estimates ?? [];
}

export async function getPmwebEstimateDetails(apiBaseUrl: string, estimateId: string): Promise<PmwebEstimateDetail[]> {
  const url = new URL(`${apiBaseUrl}/estimates/${encodeURIComponent(estimateId)}/details`);

  const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!resp.ok) {
    throw new Error(`GET /estimates/${estimateId}/details failed: ${resp.status} ${resp.statusText}`);
  }

  const json = (await resp.json()) as { ok?: boolean; details?: PmwebEstimateDetail[] };
  return json.details ?? [];
}

export async function syncPmwebEstimates(apiBaseUrl: string, sinceUtc?: string | null, includeInactive?: boolean | null) {
  const resp = await fetch(`${apiBaseUrl}/sync/estimates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sinceUtc: sinceUtc ?? null, includeInactive: includeInactive ?? null }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`POST /sync/estimates failed: ${resp.status} ${resp.statusText} :: ${text}`);
  }

  return resp.json();
}
