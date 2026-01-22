// src/api/client.ts
import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

// When calling an external Function App, SWA cookies do NOT apply.
// Use MSAL bearer tokens when VITE_USE_MSAL=true (recommended for external APIs).
const USE_MSAL = (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

export type ApiClientOptions = {
  baseUrl?: string;
};

function normalizeBaseUrl(baseUrl: string) {
  // allow "/api" or "https://host/api"
  return baseUrl.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string) {
  const b = normalizeBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function isHtmlResponse(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("text/html");
}

function looksLikeLoginRedirectHtml(bodyStart: string) {
  const s = bodyStart.toLowerCase();
  return s.includes("<!doctype html") || s.includes("<html");
}

async function buildAuthHeaders(url: string): Promise<Record<string, string>> {
  // Only attach bearer tokens if:
  // - explicitly enabled AND
  // - we have a scope configured
  // This avoids breaking SWA-managed same-origin calls.
  const scope = (import.meta.env.VITE_AAD_API_SCOPE ?? "").toString().trim();
  if (!USE_MSAL || !scope) return {};

  // Acquire token (interactive redirect if needed)
  const token = await getAccessTokenOrRedirect(pca, scope);
  if (!token) return {};

  return { Authorization: `Bearer ${token}` };
}

async function apiFetch(path: string, init?: RequestInit, opts?: ApiClientOptions) {
  const baseUrl = (opts?.baseUrl ?? (import.meta.env.VITE_API_BASE_URL as string) ?? "/api").toString();
  const url = joinUrl(baseUrl, path);

  const authHeaders = await buildAuthHeaders(url);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string>),
    ...authHeaders,
  };

  // IMPORTANT for external Function App calls:
  // - do NOT send SWA cookies cross-origin (causes CORS credential rules to bite)
  // - use bearer tokens instead (above)
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "omit",
  });

  // If EasyAuth is redirecting to an HTML login page, you'll see HTML here.
  if (isHtmlResponse(res)) {
    const text = await res.text();
    const first120 = text.slice(0, 120).replace(/\s+/g, " ");
    const hint = looksLikeLoginRedirectHtml(first120)
      ? `Expected JSON but got HTML from ${url}. This usually means the Function App auth is redirecting you to login (302 -> HTML) or the route is wrong. First 120 chars: ${first120}`
      : `Expected JSON but got non-JSON response from ${url}. First 120 chars: ${first120}`;
    throw new Error(hint);
  }

  return res;
}

async function readJsonOrThrow<T>(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const first120 = text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`Expected JSON but got: ${first120}`);
  }
}

// Convenience wrappers
export async function apiGet<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const res = await apiFetch(path, { method: "GET" }, opts);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  return await readJsonOrThrow<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown, opts?: ApiClientOptions): Promise<T> {
  const res = await apiFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    opts
  );
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  return await readJsonOrThrow<T>(res);
}
