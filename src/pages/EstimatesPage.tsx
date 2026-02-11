import React, { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridReadyEvent, SelectionChangedEvent } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { apiGet, apiPost } from "../api/client";

type PmwebEstimateHeader = {
  estimateId: string;
  projectId: string;
  revisionId: string | null;
  revisionNumber: number | null;
  revisionDateUtc: string | null;
  description: string | null;
  uomId: string | null;
  estimateUnit: number | null;
  docStatusId: string | null;
  currencyId: string | null;
  isActive: boolean | null;
  specificationGroupId: string | null;
  categoryId: string | null;
  reference: string | null;
  totalCostValue: number | null;
  totalExtCostValue: number | null;
  updatedUtc: string | null;
};

type PmwebEstimateDetail = {
  estimateDetailId: string;
  estimateId: string;
  lineNumber: number | null;
  itemCode: string | null;
  description: string | null;
  costCodeId: string | null;
  costTypeId: string | null;
  uomId: string | null;
  quantity: number | null;
  unitCost: number | null;
  totalCost: number | null;
  notes1: string | null;
};

type EstimatesResponse = {
  ok: boolean;
  count: number;
  estimates: PmwebEstimateHeader[];
};

type DetailsResponse = {
  ok: boolean;
  count: number;
  details: PmwebEstimateDetail[];
};

const EstimatesPage: React.FC = () => {
  const [estimates, setEstimates] = useState<PmwebEstimateHeader[]>([]);
  const [details, setDetails] = useState<PmwebEstimateDetail[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<PmwebEstimateHeader | null>(null);

  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const estimatesColDefs = useMemo<ColDef<PmwebEstimateHeader>[]>(
    () => [
      { headerName: "EstimateId", field: "estimateId", minWidth: 260 },
      { headerName: "ProjectId", field: "projectId", minWidth: 220 },
      { headerName: "Rev#", field: "revisionNumber", width: 90 },
      { headerName: "Revision Date (UTC)", field: "revisionDateUtc", minWidth: 190 },
      { headerName: "Description", field: "description", flex: 1, minWidth: 260 },
      { headerName: "Reference", field: "reference", minWidth: 140 },
      { headerName: "Total Cost", field: "totalCostValue", minWidth: 130 },
      { headerName: "Total Ext Cost", field: "totalExtCostValue", minWidth: 150 },
      { headerName: "Active", field: "isActive", width: 90 },
      { headerName: "Updated (UTC)", field: "updatedUtc", minWidth: 190 },
    ],
    []
  );

  const detailsColDefs = useMemo<ColDef<PmwebEstimateDetail>[]>(
    () => [
      { headerName: "Line", field: "lineNumber", width: 90 },
      { headerName: "Item Code", field: "itemCode", minWidth: 140 },
      { headerName: "Description", field: "description", flex: 1, minWidth: 260 },
      { headerName: "CostCodeId", field: "costCodeId", minWidth: 160 },
      { headerName: "CostTypeId", field: "costTypeId", minWidth: 160 },
      { headerName: "UOM", field: "uomId", minWidth: 110 },
      { headerName: "Qty", field: "quantity", minWidth: 110 },
      { headerName: "Unit Cost", field: "unitCost", minWidth: 120 },
      { headerName: "Total Cost", field: "totalCost", minWidth: 120 },
      { headerName: "Notes", field: "notes1", flex: 1, minWidth: 220 },
    ],
    []
  );

  async function loadEstimates() {
    setLoadingEstimates(true);
    setStatus(null);
    try {
      const res = await apiGet<EstimatesResponse>("/estimates");
      setEstimates(res.estimates ?? []);
      if (!res.estimates?.length) {
        setStatus("No Estimates in Cosmos yet. Run Sync to pull from PMWeb.");
      }
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to load estimates.");
    } finally {
      setLoadingEstimates(false);
    }
  }

  async function loadDetails(estimateId: string) {
    setLoadingDetails(true);
    setStatus(null);
    try {
      const res = await apiGet<DetailsResponse>(`/estimates/${encodeURIComponent(estimateId)}/details`);
      setDetails(res.details ?? []);
    } catch (err: any) {
      setDetails([]);
      setStatus(err?.message ?? "Failed to load estimate details.");
    } finally {
      setLoadingDetails(false);
    }
  }

  async function syncEstimates() {
    setSyncing(true);
    setStatus(null);
    try {
      // Optional body fields supported by the backend: sinceUtc, includeInactive
      const res = await apiPost<any>("/sync/estimates", { sinceUtc: null, includeInactive: true });
      const upserted = res?.upserted ?? res?.Upserted ?? res?.data?.upserted;
      const elapsedMs = res?.elapsedMs ?? res?.ElapsedMs;
      setStatus(`Sync complete. upserted=${upserted ?? "?"}${elapsedMs ? ` • elapsedMs=${elapsedMs}` : ""}`);
      await loadEstimates();
    } catch (err: any) {
      setStatus(err?.message ?? "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEstimatesSelectionChanged = async (evt: SelectionChangedEvent<PmwebEstimateHeader>) => {
    const row = evt.api.getSelectedRows()[0] ?? null;
    setSelectedEstimate(row);
    setDetails([]);
    if (row?.estimateId) {
      await loadDetails(row.estimateId);
    }
  };

  const onGridReady = (evt: GridReadyEvent) => {
    evt.api.sizeColumnsToFit();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={loadEstimates} disabled={loadingEstimates || syncing}>
          Refresh
        </button>
        <button onClick={syncEstimates} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync from PMWeb"}
        </button>
        {loadingEstimates && <span>Loading estimates…</span>}
        {loadingDetails && <span>Loading details…</span>}
        {status && <span style={{ marginLeft: 8 }}>{status}</span>}
      </div>

      <div className="ag-theme-quartz" style={{ height: 420, width: "100%" }}>
        <AgGridReact<PmwebEstimateHeader>
          rowData={estimates}
          columnDefs={estimatesColDefs}
          rowSelection="single"
          onSelectionChanged={onEstimatesSelectionChanged}
          onGridReady={onGridReady}
          pagination
          paginationPageSize={50}
          suppressRowClickSelection={false}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <strong>Estimate Details</strong>
          {selectedEstimate?.estimateId ? (
            <span style={{ marginLeft: 8 }}>
              for {selectedEstimate.estimateId}
            </span>
          ) : (
            <span style={{ marginLeft: 8 }}>Select an estimate above.</span>
          )}
        </div>

        <div className="ag-theme-quartz" style={{ height: 360, width: "100%" }}>
          <AgGridReact<PmwebEstimateDetail>
            rowData={details}
            columnDefs={detailsColDefs}
            rowSelection="multiple"
            pagination
            paginationPageSize={100}
          />
        </div>
      </div>
    </div>
  );
};


export default EstimatesPage;
