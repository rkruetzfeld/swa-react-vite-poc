import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { apiGet } from "../api/client";

type SyncRunDto = {
  entity: string;
  runId: string;
  startedUtc: string;
  endedUtc: string;
  durationMs: number;
  recordCount: number;
  succeeded: boolean;
  error?: string | null;
};

type HealthResponse = {
  entity: string;
  latest?: SyncRunDto | null;
  recent: SyncRunDto[];
};

export default function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const colDefs = useMemo<ColDef<SyncRunDto>[]>(
    () => [
      { headerName: "Started (UTC)", field: "startedUtc", sortable: true, filter: true, width: 220 },
      { headerName: "Duration (ms)", field: "durationMs", sortable: true, filter: true, width: 140 },
      { headerName: "Count", field: "recordCount", sortable: true, filter: true, width: 110 },
      {
        headerName: "OK",
        field: "succeeded",
        sortable: true,
        filter: true,
        width: 90,
        valueFormatter: (p) => (p.value ? "Yes" : "No"),
      },
      { headerName: "Error", field: "error", flex: 1, minWidth: 260 },
    ],
    []
  );

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const h = await apiGet<HealthResponse>("/health/projects");
      setData(h ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = data?.recent ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Health</div>
          <div className="kicker">Operational run stats (sync duration, counts, failures).</div>
          {data?.latest && (
            <div className="kicker" style={{ marginTop: 6 }}>
              Latest Projects sync: {data.latest.succeeded ? "✅" : "❌"} {new Date(data.latest.startedUtc).toISOString()} •{" "}
              {data.latest.durationMs} ms • {data.latest.recordCount} records
              {data.latest.error ? ` • ${data.latest.error}` : ""}
            </div>
          )}
        </div>

        <button className="btn" onClick={refresh} disabled={busy}>
          Refresh
        </button>
      </div>

      {error && <div className="panel" style={{ border: "1px solid #ffb5b5" }}>{error}</div>}

      <div className="panel" style={{ flex: 1, minHeight: 0, padding: 0 }}>
        <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
          <AgGridReact<SyncRunDto>
            rowData={rows}
            columnDefs={colDefs}
            animateRows
            pagination
            paginationPageSize={25}
          />
        </div>
      </div>
    </div>
  );
}
