import { apiGet, apiPost } from "./client";

export type CreateEstimateRequest = {
  projectId: string;
  estimateNumber?: string;
  name: string;
};

export type EstimateDoc = {
  id: string;
  pk: string;
  docType: "estimate";
  tenantId: string;
  estimateId: string;
  projectId: string;
  estimateNumber: string;
  name: string;
  status: string;
  createdUtc: string;
  createdBy: string;
  updatedUtc: string;
  updatedBy: string;
};

export type EstimateVersionDoc = {
  id: string;
  pk: string;
  docType: "version";
  tenantId: string;
  estimateId: string;
  versionId: string;
  versionNumber: number;
  state: string;
  createdUtc: string;
  createdBy: string;
};

export type EstimateLineItemDoc = {
  id: string;
  pk: string;
  docType: "lineItem";
  tenantId: string;
  estimateId: string;
  versionId: string;
  lineItemId: string;
  lineNumber: number;
  costCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  amount: number;
  notes?: string;
  updatedUtc: string;
  updatedBy: string;
};

export type UpsertLineItem = {
  lineItemId?: string;
  lineNumber: number;
  costCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  notes?: string;
};

export async function coreCreateEstimate(body: CreateEstimateRequest) {
  return apiPost<EstimateDoc>("/api/core/estimates", body);
}

export async function coreListEstimates(projectId: string, top = 50) {
  return apiGet<{ items: EstimateDoc[] }>(
    `/api/core/estimates?projectId=${encodeURIComponent(projectId)}&top=${top}`
  );
}

export async function coreListVersions(estimateId: string) {
  return apiGet<{ items: EstimateVersionDoc[] }>(
    `/api/core/estimates/${encodeURIComponent(estimateId)}/versions`
  );
}

export async function coreCreateDraftVersion(estimateId: string) {
  return apiPost<EstimateVersionDoc>(
    `/api/core/estimates/${encodeURIComponent(estimateId)}/versions`,
    {}
  );
}

export async function coreListLineItems(
  estimateId: string,
  versionId: string,
  top = 200,
  cursor?: string
) {
  const cursorPart = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return apiGet<{ items: EstimateLineItemDoc[]; nextCursor?: string }>(
    `/api/core/estimates/${encodeURIComponent(
      estimateId
    )}/versions/${encodeURIComponent(versionId)}/line-items?top=${top}${cursorPart}`
  );
}

export async function coreBatchUpsertLineItems(
  estimateId: string,
  versionId: string,
  items: UpsertLineItem[]
) {
  return apiPost<string>(
    `/api/core/estimates/${encodeURIComponent(
      estimateId
    )}/versions/${encodeURIComponent(versionId)}/line-items:batchUpsert`,
    { items }
  );
}
