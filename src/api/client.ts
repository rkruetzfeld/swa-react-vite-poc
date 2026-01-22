// src/api/client.ts
import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

/**
 * SWA (Azure Static Web Apps) guidance:
 * - If your API is hosted as a SWA Managed Function App (or proxied by SWA), call it via same-origin '/api/...'
 *   so you avoid CORS and auth-redirect issues.
 * - Only use MSAL/Bearer tokens if you are calling an external API that requires Authorization headers.
 */

// Default OFF to avoid MSAL silent-token timeouts / complexity for SWA cookie-based auth.
const USE_MSAL = (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

// Base URL resolution:
// - Prefer VITE_API_BASE_URL (or VITE_API_BASE) when set
// - Else default to '/api' (same-origin SWA API route)
function getBaseUrl(explicit?: string) {
  const fromEnv =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE as string | undefined);

  const base = (explicit || fromEnv || "/api").trim();
  // allow empty string intentionally (rare), but normalize slashes when present
  return base === "" ? "" : base.replace(/\/+$/, "");
}

export type ApiClientOptions = {
  baseUrl?: string;
  /** When true, auto-redirect to SWA login on 401/403 (default true). */
  redirectToLoginOnAuthError?: boolean;
};

function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl || "";
  const p = path.startsWith("/") ? path : `/${path}`;
  // If base is empty, keep path absolute (same-origin)
  return base ? `${base}${p}` : p;
}

function swaLoginRedirect() {
  const here = window.location.href;
  const url = `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(here)}`;
  window.location.assign(url);
}

async function makeHeaders(isJsonBody: boolean) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (isJsonBody) headers["Content-Type"] = "application/json";

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleErrorResponse(res: Response, url: string) {
  const contentType = res.headers.get("content-type") || "";
  const bodyText = await res.text().catch(() => "");
  // keep error compact but useful
  const details =
    contentType.includes("application/json") && bodyText
      ? bodyText
      : (bodyText || "").slice(0, 2000);

  throw new Error(`${res.status} ${res.statusText} for ${url}${details ? ` — ${details}` : ""}`);
}

async function apiFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: unknown | undefined,
  opts?: ApiClientOptions
): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);
  const redirectToLoginOnAuthError = opts?.redirectToLoginOnAuthError ?? true;

  const res = await fetch(url, {
    method,
    headers: await makeHeaders(method === "POST"),
    body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
    // Important for SWA cookie/session auth
    credentials: "include",
  });

  // Common SWA pattern: protected API returns 401/403. Redirect user to login.
  if ((res.status === 401 || res.status === 403) && redirectToLoginOnAuthError && !USE_MSAL) {
    swaLoginRedirect();
    throw new Error(`Auth required for ${url}. Redirecting to login...`);
  }

  if (!res.ok) {
    await handleErrorResponse(res, url);
  }

  // Some endpoints return empty responses (204, or empty body). Handle both.
  const txt = await res.text().catch(() => "");
  if (!txt) return {} as T;

  try {
    return JSON.parse(txt) as T;
  } catch {
    // If server returns plain text, still return something useful
    return txt as unknown as T;
  }
}

export function apiGet<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  return apiFetch<T>("GET", path, undefined, opts);
}

export function apiPost<T>(path: string, body?: unknown, opts?: ApiClientOptions): Promise<T> {
  return apiFetch<T>("POST", path, body, opts);
}

export function apiDelete<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  return apiFetch<T>("DELETE", path, undefined, opts);
}
