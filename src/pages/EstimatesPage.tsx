import { useEffect, useState } from "react";

type LoadState = "idle" | "loading" | "success" | "error";

export default function EstimatesPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState("loading");
        setError("");

        const res = await fetch("/api/estimates", {
          headers: { Accept: "application/json" },
        });

        const text = await res.text(); // capture body even on errors

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}\n\n${text}`);
        }

        const json = text ? JSON.parse(text) : null;

        if (!cancelled) {
          setData(json);
          setState("success");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setState("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Estimates API Probe</h2>

      <div style={{ marginBottom: 12 }}>
        <strong>Status:</strong> {state}
      </div>

      {state === "error" && (
        <pre style={{ whiteSpace: "pre-wrap", color: "crimson" }}>
          {error}
        </pre>
      )}

      {state === "success" && (
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      {state === "loading" && <div>Loading…</div>}
    </div>
  );
}
