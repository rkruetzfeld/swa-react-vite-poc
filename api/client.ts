// src/api/client.ts
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

  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
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
