// src/api/client.ts
import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

// In Azure Static Web Apps, auth is typically handled by SWA itself (cookie/session).
// MSAL is only needed if you are calling an API that requires an explicit Bearer token.
// Default: off, to avoid MSAL silent-token timeouts in SWA deployments.
const USE_MSAL = (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

export type ApiClientOptions = {
  baseUrl?: string;
};

function getBaseUrl(explicit?: string) {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const base = (explicit || fromEnv || "").trim();
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set. Add it to .env.local (or Azure SWA app settings).");
  }
  return base.replace(/\/+$/, ""); // remove trailing slash
}

export async function apiGet<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  // console.log("apiGet URL:", url);

  const headers: Record<string, string> = {
    "Accept": "application/json",
  };

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
  });


  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${body}`);
  }

  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText} ${text}`);
  }

  // Some endpoints might return empty; handle both
  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : ({} as T));
}

export async function apiDelete<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    "Accept": "application/json",
  };

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} ${text}`);
  }

  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : ({} as T));
}
