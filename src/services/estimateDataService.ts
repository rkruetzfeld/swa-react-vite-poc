// src/services/estimateDataService.ts
import type { EstimateHeader, EstimateLine, ItemCatalog } from "../models/estimateModels";

type Cache = {
  headers?: EstimateHeader[];
  items?: ItemCatalog[];
  linesByEstimate: Map<string, EstimateLine[]>;
};

const cache: Cache = {
  linesByEstimate: new Map<string, EstimateLine[]>()
};

// Later: switch BASE to "/api" without changing UI code
const BASE = "/sample-data";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return (await res.json()) as T;
}

export const estimateDataService = {
  async getEstimateHeaders(forceRefresh = false): Promise<EstimateHeader[]> {
    if (!forceRefresh && cache.headers) return cache.headers;
    const data = await fetchJson<EstimateHeader[]>(`${BASE}/estimates.json`);
    cache.headers = data;
    return data;
  },

  async getItemCatalog(forceRefresh = false): Promise<ItemCatalog[]> {
    if (!forceRefresh && cache.items) return cache.items;
    const data = await fetchJson<ItemCatalog[]>(`${BASE}/items.json`);
    cache.items = data;
    return data;
  },

  async getEstimateLines(estimateId: string, forceRefresh = false): Promise<EstimateLine[]> {
    if (!forceRefresh) {
      const existing = cache.linesByEstimate.get(estimateId);
      if (existing) return existing;
    }
    const data = await fetchJson<EstimateLine[]>(
      `${BASE}/estimate-lines/${encodeURIComponent(estimateId)}.json`
    );
    cache.linesByEstimate.set(estimateId, data);
    return data;
  },

  clearCache(): void {
    cache.headers = undefined;
    cache.items = undefined;
    cache.linesByEstimate.clear();
  }
};
