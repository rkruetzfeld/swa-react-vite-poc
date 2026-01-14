import { useEffect, useState } from "react";

type ApiEstimatesResponse = {
  ok: boolean;
  utc: string;
  items: unknown[];
};

export default function ApiEstimatesPage() {
  const [data, setData] = useState<ApiEstimatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch("/api/estimates", {
          headers: { Accept: "application/json" },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);

        const json = (text ? JSON.parse(text) : null) as ApiEstimatesResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to call /api/estimates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 950, fontSize: 18 }}>/api/estimates</div>
        <div className="kicker">Live call to your Azure Function (local or deployed).</div>
      </div>

      {loading && (
        <div className="kicker" style={{ fontWeight: 950 }}>
          Loading…
        </div>
      )}

      {err && (
        <div
          className="panel"
          style={{
            borderColor: "rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
          }}
        >
          <div style={{ fontWeight: 950 }}>API error</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>{err}</pre>
        </div>
      )}

      {data && (
        <div className="panel" style={{ overflow: "auto" }}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
