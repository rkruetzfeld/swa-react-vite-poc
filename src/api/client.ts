// src/api/client.ts
import { pca } from "../auth/pca";
import { getAccessTokenOrRedirect } from "../auth/getAccessToken";

// Default: off (SWA cookie/session auth usually enough)
const USE_MSAL =
  (import.meta.env.VITE_USE_MSAL ?? "false").toString().toLowerCase() === "true";

export type ApiClientOptions = {
  baseUrl?: string;
};

function normalizeBase(u: string): string {
  return u.trim().replace(/\/+$/, ""); // remove trailing slash(es)
}

function getBaseUrl(explicit?: string) {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const base = (explicit || fromEnv || "").trim();

  // Default: same-origin SWA managed API (ONLY works if you actually deployed a SWA API)
  if (!base) return "/api";

  // Allow either "/api" or full "https://host/api"
  return normalizeBase(base);
}

/**
 * Joins baseUrl + path, and prevents common "/api/api/..." mistakes.
 * Examples:
 *  base="/api", path="projects"                  => "/api/projects"
 *  base="/api", path="/api/projects"             => "/api/projects"
 *  base="https://x.net/api", path="projects"     => "https://x.net/api/projects"
 *  base="https://x.net/api", path="/api/projects"=> "https://x.net/api/projects"
 */
function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBase(baseUrl);
  let p = (path || "").trim();

  // Always ensure a single leading slash
  if (!p.startsWith("/")) p = `/${p}`;

  // If caller passes "/api/..." AND base already ends with "/api", drop the duplicate segment.
  const baseEndsWithApi = /\/api$/i.test(base);
  if (baseEndsWithApi && /^\/api(\/|$)/i.test(p)) {
    p = p.replace(/^\/api/i, "");
    if (!p.startsWith("/")) p = `/${p}`;
  }

  return `${base}${p}`;
}

async function buildHeaders(withJsonBody: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withJsonBody) headers["Content-Type"] = "application/json";

  if (USE_MSAL) {
    const token = await getAccessTokenOrRedirect(pca);
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function readJsonOrThrow<T>(res: Response, url: string): Promise<T> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}: ${text}`);
  }

  // Empty response
  if (res.status === 204) return {} as T;

  // If we got HTML, it usually means: route not found, auth redirected, or wrong base URL.
  if (contentType.includes("text/html")) {
    const text = await res.text().catch(() => "");
    const head = text.slice(0, 160).replace(/\s+/g, " ");
    throw new Error(
      `Expected JSON but got HTML from ${url}. ` +
        `This usually means one of: ` +
        `- the API route does not exist (frontend served index.html), ` +
        `- auth redirected you to an HTML login page, ` +
        `- or the backend is not linked/routing for this path. ` +
        `First 160 chars: ${head}`
    );
  }

  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : ({} as T));
}

export async function apiGet<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    method: "GET",
    headers: await buildHeaders(false),
    credentials: "include",
  });

  return readJsonOrThrow<T>(res, url);
}

export async function apiPost<T>(
  path: string,
  body?: any,
  opts?: ApiClientOptions
): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    method: "POST",
    headers: await buildHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });

  return readJsonOrThrow<T>(res, url);
}

export async function apiDelete<T>(path: string, opts?: ApiClientOptions): Promise<T> {
  const baseUrl = getBaseUrl(opts?.baseUrl);
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    method: "DELETE",
    headers: await buildHeaders(false),
    credentials: "include",
  });

  return readJsonOrThrow<T>(res, url);
}
