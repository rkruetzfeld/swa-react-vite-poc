// src/api/client.ts

/**
 * SWA-safe API client:
 * - Default baseUrl = "/api" (same-origin)
 * - Safety: when running on azurestaticapps.net, never call *.azurewebsites.net from the browser
 * - credentials: "include" for SWA auth cookies
 * - Robust parsing: if response is HTML (index.html or login), throw a clear error
 * - 401/403: redirect to SWA login with post_login_redirect_uri
 */

import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

const USE_MSAL = (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

export type ApiClientOptions = {
  baseUrl?: string;
  redirectToLoginOnAuthError?: boolean; // default true when not using MSAL
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
  // remove trailing slash
  return u.replace(/\/+$/, "");
}

function getBaseUrl(explicit?: string): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const base = (explicit || envBase || "").trim();

  // ✅ default to same-origin /api
  if (!base) return "/api";

  // ✅ safety net: if we are running on SWA, DO NOT call azurewebsites.net directly (CORS + credentials pain)
  if (runningOnSwa() && isAzureWebsitesUrl(base)) {
    return "/api";
  }

  return normalizeBase(base);
}

function joinUrl(baseUrl: string, path: string): string {
  // If caller passed absolute URL, allow it (rare)
  if (/^https?:\/\//i.test(path)) return path;

  const p = path.startsWith("/") ? path : `/${path}`;

  // If baseUrl is "/api" and path is "/projects" => "/api/projects"
  // If baseUrl is "" => "/projects"
  return `${baseUrl}${p}`;
}

function swaLoginRedirect() {
  const here = window.location.href;
  const url = `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(here)}`;
  window.location.assign(url);
}

async function buildHeaders(isJsonBody: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (isJsonBody) headers["Content-Type"] = "application/json";

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head") || t.startsWith("<body");
}

async function readJsonOrThrow<T>(res: Response, url: string): Promise<T> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text().catch(() => "");

  // empty body is ok for some endpoints
  if (!text) return {} as T;

  // Detect HTML returning (index.html fallback or auth page)
  if (contentType.includes("text/html") || looksLikeHtml(text)) {
    // Provide a very explicit, actionable error
    throw new Error(
      [
        `Expected JSON but got HTML from ${url}.`,
        `This usually means one of:`,
        `- the API route does not exist (SWA served index.html),`,
        `- auth redirected you to an HTML login page,`,
        `- or the backend is not linked/routing for this path.`,
        `First 120 chars: ${text.slice(0, 120).replace(/\s+/g, " ")}`
      ].join("\n")
    );
  }

  // If server replied JSON, parse it
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON from ${url}. First 200 chars: ${text.slice(0, 200)}`);
    }
  }

  // If it isn't JSON content-type, still attempt parse, else return as string-ish error
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON but got non-JSON from ${url}. First 200 chars: ${text.slice(0, 200)}`);
  }
}

async function apiFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: unknown | undefined,
  opts?: ApiClientOptions
): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const headers = await buildHeaders(method === "POST");

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include", // ✅ needed for SWA cookie auth (same-origin /api)
    body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
  });

  // If using SWA cookie auth (not MSAL), handle auth errors via top-level redirect
  const redirectToLoginOnAuthError = opts?.redirectToLoginOnAuthError ?? true;
  if (!USE_MSAL && redirectToLoginOnAuthError && (res.status === 401 || res.status === 403)) {
    swaLoginRedirect();
    throw new Error(`Auth required for ${url}. Redirecting to login...`);
  }

  if (!res.ok) {
    // Try to extract a useful body (but don’t JSON.parse blindly)
    const text = await res.text().catch(() => "");
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("text/html") || looksLikeHtml(text)) {
      throw new Error(
        [
          `${method} ${url} failed: ${res.status} ${res.statusText}`,
          `Response was HTML (likely index.html fallback or auth page).`,
          `First 120 chars: ${text.slice(0, 120).replace(/\s+/g, " ")}`
        ].join("\n")
      );
    }

    throw new Error(`${method} ${url} failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`);
  }

  return await readJsonOrThrow<T>(res, url);
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
