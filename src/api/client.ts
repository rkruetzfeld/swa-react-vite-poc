// src/api/client.ts
import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

// Default: off (SWA cookie/session auth usually enough)
const USE_MSAL = (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

export type ApiClientOptions = {
  baseUrl?: string;
};

function runningOnSwa(): boolean {
  try {
    return window.location.hostname.includes("azurestaticapps.net");
  } catch {
    return false;
  }
}

function isAzureWebsitesUrl(u: string): boolean {
  return /^https?:\/\/[^/]+\.azurewebsites\.net\/?$/i.test(u.trim());
}

function normalizeBase(u: string): string {
  return u.replace(/\/+$/, ""); // remove trailing slash
}

function getBaseUrl(explicit?: string) {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const base = (explicit || fromEnv || "").trim();

  // ✅ SWA default: same-origin /api
  if (!base) return "/api";

  // ✅ Safety net: if we're running on SWA, never call azurewebsites.net from the browser
  // (that forces CORS + credentials pain)
  if (runningOnSwa() && isAzureWebsitesUrl(base)) {
    return "/api";
  }

  // Support either "/api" or full "https://host/api"
  return normalizeBase(base);
}

function joinUrl(baseUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${p}`;
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiGet<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    method: "GET",
    headers: await buildHeaders(),
    credentials: "include", // ✅ SWA cookies
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${body}`);
  }

  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const headers = await buildHeaders();
  headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include", // ✅ SWA cookies
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText} ${text}`);
  }

  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : ({} as T));
}

export async function apiDelete<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    method: "DELETE",
    headers: await buildHeaders(),
    credentials: "include", // ✅ SWA cookies
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} ${text}`);
  }

  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : ({} as T));
}
