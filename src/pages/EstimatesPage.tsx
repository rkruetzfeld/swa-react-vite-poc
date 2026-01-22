import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";

import "ag-grid-community/styles/ag-theme-quartz.css";

import { apiGet } from "../api/client";
import {
  coreBatchUpsertLineItems,
  coreCreateDraftVersion,
  coreCreateEstimate,
  coreDeleteLineItem,
  coreListEstimates,
  coreListLineItems,
  coreListVersions,
  type EstimateDoc,
  type EstimateVersionDoc,
  type UpsertLineItem,
} from "../api/coreEstimatesApi";

type ProjectDto = {
  projectId: string;
  name: string;
};

type EstimateRow = {
  estimateId: string;
  estimateNumber: string;
  projectId: string;
  name: string;
  status: string;
  updatedUtc: string;
  // Computed client-side (we only know totals when a specific estimate/version is loaded)
  totalAmount?: number;
};

type LineItemRow = {
  lineItemId?: string; // undefined for unsaved rows
  lineNumber: number;
  costCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  amount: number; // computed client-side for UX; server recomputes on save
  notes?: string;
};

function normalizeEstimate(x: any): EstimateRow {
  const estimateId = x?.estimateId ?? x?.EstimateId ?? "";
  return {
    estimateId,
    estimateNumber: x?.estimateNumber ?? x?.EstimateNumber ?? estimateId.slice(0, 8),
    projectId: x?.projectId ?? x?.ProjectId ?? "",
    name: x?.name ?? x?.Name ?? "",
    status: x?.status ?? x?.Status ?? "",
    updatedUtc: (x?.updatedUtc ?? x?.UpdatedUtc ?? x?.createdUtc ?? x?.CreatedUtc ?? "") as string,
  };
}

function normalizeVersion(x: any): EstimateVersionDoc {
  // keep the original shape for API calls; normalize minimum fields
  return {
    id: x?.id ?? x?.Id ?? "",
    pk: x?.pk ?? x?.Pk ?? "",
    docType: "version",
    tenantId: x?.tenantId ?? x?.TenantId ?? "",
    estimateId: x?.estimateId ?? x?.EstimateId ?? "",
    versionId: x?.versionId ?? x?.VersionId ?? "",
    versionNumber: Number(x?.versionNumber ?? x?.VersionNumber ?? 0),
    state: x?.state ?? x?.State ?? "",
    createdUtc: (x?.createdUtc ?? x?.CreatedUtc ?? "") as any,
    createdBy: x?.createdBy ?? x?.CreatedBy ?? "",
  };
}

function normalizeLineItem(x: any): LineItemRow {
  const quantity = Number(x?.quantity ?? x?.Quantity ?? 0);
  const unitPrice = Number(x?.unitPrice ?? x?.UnitPrice ?? 0);
  const amount = Number(x?.amount ?? x?.Amount ?? quantity * unitPrice);
  return {
    lineItemId: x?.lineItemId ?? x?.LineItemId,
    lineNumber: Number(x?.lineNumber ?? x?.LineNumber ?? 0),
    costCode: (x?.costCode ?? x?.CostCode ?? "") as string,
    description: (x?.description ?? x?.Description ?? "") as string,
    quantity,
    uom: (x?.uom ?? x?.Uom ?? "") as string,
    unitPrice,
    amount,
    notes: (x?.notes ?? x?.Notes) as string | undefined,
  };
}

export default function EstimatesPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  // search / typeahead
  const [projectSearchText, setProjectSearchText] = useState<string>("");
  const [estimatesSearchText, setEstimatesSearchText] = useState<string>("");
  const [lineItemsSearchText, setLineItemsSearchText] = useState<string>("");

  // estimates
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");

  // versions
  const [versions, setVersions] = useState<EstimateVersionDoc[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  // line items
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [dirty, setDirty] = useState(false);

  // totals (computed client-side from current line items grid)
  const [selectedEstimateTotal, setSelectedEstimateTotal] = useState<number>(0);
  const [estimateTotalsById, setEstimateTotalsById] = useState<Record<string, number>>({});

  // create estimate form
  const [newEstimateName, setNewEstimateName] = useState<string>("");

  const estimatesGridApi = useRef<GridApi | null>(null);
  const lineItemsGridApi = useRef<GridApi | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedEstimate = useMemo(
    () => estimates.find((e) => e.estimateId === selectedEstimateId) ?? null,
    [estimates, selectedEstimateId]
  );

  const selectedVersion = useMemo(
    () => versions.find((v) => v.versionId === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  const estimateColDefs = useMemo<ColDef<EstimateRow>[]>(
    () => [
      { field: "estimateNumber", headerName: "Estimate #", width: 150, filter: true },
      { field: "name", headerName: "Name", flex: 2, filter: true },
      { field: "status", headerName: "Status", width: 140, filter: true },
      {
        headerName: "Total",
        width: 140,
        valueGetter: (p) => {
          const id = p.data?.estimateId;
          if (!id) return "";
          const v = estimateTotalsById[id];
          return typeof v === "number" ? v : "";
        },
        valueFormatter: (p) => {
          const v = p.value;
          if (v === "" || v === null || v === undefined) return "";
          const n = Number(v);
          if (!Number.isFinite(n)) return "";
          return n.toFixed(2);
        },
      },
      { field: "updatedUtc", headerName: "Updated (UTC)", flex: 1, filter: true },
      { field: "estimateId", headerName: "Estimate Id", flex: 1, filter: true },
    ],
    []
  );

  const lineItemColDefs = useMemo<ColDef<LineItemRow>[]>(
    () => [
      { field: "lineNumber", headerName: "#", width: 90, editable: true },
      { field: "costCode", headerName: "Cost Code", width: 140, editable: true },
      { field: "description", headerName: "Description", flex: 2, editable: true },
      {
        field: "quantity",
        headerName: "Qty",
        width: 110,
        editable: true,
        valueParser: (p) => Number(p.newValue),
      },
      {
        field: "uom",
        headerName: "UOM",
        width: 110,
        editable: true,
        // Typeahead: rich select lets users start typing to jump/search.
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: {
          values: ["EA", "HR", "DAY", "WK", "MO", "M", "M2", "M3", "FT", "FT2", "FT3", "TON", "KG", "L", "LS"],
          searchType: "match",
          allowTyping: true,
          filterList: true,
          highlightMatch: true,
        },
      },
      {
        field: "unitPrice",
        headerName: "Unit Price",
        width: 140,
        editable: true,
        valueParser: (p) => Number(p.newValue),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        editable: false,
        valueGetter: (p) => {
          const q = Number(p.data?.quantity ?? 0);
          const up = Number(p.data?.unitPrice ?? 0);
          return Math.round(q * up * 100) / 100;
        },
      },
      { field: "notes", headerName: "Notes", flex: 1, editable: true },
      { field: "lineItemId", headerName: "Line Item Id", flex: 1, editable: false },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    // floating filters give an immediate "type to filter" experience per column
    () => ({ sortable: true, resizable: true, filter: true, floatingFilter: true }),
    []
  );

  function applyQuickFilter(api: GridApi | null, text: string) {
    if (!api) return;
    const t = text || "";
    // AG Grid API varies slightly by major version; support both.
    try {
      (api as any).setQuickFilter?.(t);
    } catch {
      // ignore
    }
    try {
      (api as any).setGridOption?.("quickFilterText", t);
    } catch {
      // ignore
    }
  }

  function round2(n: number) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function recomputeSelectedTotalsFromGrid() {
    // Use the grid as the source of truth so totals reflect unsaved edits.
    let total = 0;
    lineItemsGridApi.current?.forEachNode((n) => {
      const d = n.data as LineItemRow | undefined;
      if (!d) return;
      const q = Number(d.quantity ?? 0);
      const up = Number(d.unitPrice ?? 0);
      total += q * up;
    });
    total = round2(total);
    setSelectedEstimateTotal(total);

    if (selectedEstimateId) {
      setEstimateTotalsById((prev) => ({ ...prev, [selectedEstimateId]: total }));
    }
  }

  async function loadProjects() {
    setBusy(true);
    setError("");
    try {
      const data = await apiGet<{ items: any[] }>("/api/projects");
      const raw = Array.isArray(data?.items) ? data.items : [];

      const mapped: ProjectDto[] = raw
        .map((x) => ({
          projectId: x.projectId ?? x.ProjectId ?? "",
          name: x.name ?? x.Name ?? "",
        }))
        .filter((p) => p.projectId);

      setProjects(mapped);
      const first = mapped.length > 0 ? mapped[0].projectId : "";
      setSelectedProjectId((prev) => prev || first);
      setProjectSearchText((prev) => prev || first);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadEstimates(projectId: string) {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const res = await coreListEstimates(projectId, 200);
      const raw = Array.isArray(res?.items) ? res.items : [];
      const mapped = raw.map(normalizeEstimate).filter((x) => x.estimateId);
      setEstimates(mapped);

      // keep selection stable where possible
      const stillExists = mapped.some((x) => x.estimateId === selectedEstimateId);
      const nextEstimateId = stillExists
        ? selectedEstimateId
        : (mapped.length > 0 ? mapped[0].estimateId : "");
      setSelectedEstimateId(nextEstimateId);

      // keep estimate name typeahead list useful
      // (no action needed here; input is wired to datalist)
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setEstimates([]);
      setSelectedEstimateId("");
    } finally {
      setBusy(false);
    }
  }

  async function loadVersions(estimateId: string) {
    if (!estimateId) return;
    setBusy(true);
    setError("");
    try {
      const res = await coreListVersions(estimateId);
      const raw = Array.isArray(res?.items) ? res.items : [];
      const mapped = raw.map(normalizeVersion).filter((x) => x.versionId);
      setVersions(mapped);

      // prefer latest draft; else latest by versionNumber
      const draft = mapped.find((v) => (v.state || "").toLowerCase() === "draft");
      const best = draft ?? mapped.sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0))[0];
      setSelectedVersionId(best?.versionId ?? "");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setVersions([]);
      setSelectedVersionId("");
    } finally {
      setBusy(false);
    }
  }

  async function ensureDraftVersion(estimateId: string): Promise<string> {
    const existing = versions.find((v) => (v.state || "").toLowerCase() === "draft");
    if (existing?.versionId) return existing.versionId;
    const created = await coreCreateDraftVersion(estimateId);
    const v = normalizeVersion(created);
    // refresh versions list
    await loadVersions(estimateId);
    return v.versionId;
  }

  async function loadLineItems(estimateId: string, versionId: string) {
    if (!estimateId || !versionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await coreListLineItems(estimateId, versionId, 500);
      const raw = Array.isArray(res?.items) ? res.items : [];
      const mapped = raw.map(normalizeLineItem).filter((x) => x.lineNumber > 0 || x.lineItemId);
      // stable order
      mapped.sort((a, b) => a.lineNumber - b.lineNumber);
      setLineItems(mapped);
      setDirty(false);

      // Compute totals immediately from loaded data
      const total = round2(mapped.reduce((sum, r) => sum + Number(r.quantity ?? 0) * Number(r.unitPrice ?? 0), 0));
      setSelectedEstimateTotal(total);
      if (estimateId) {
        setEstimateTotalsById((prev) => ({ ...prev, [estimateId]: total }));
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLineItems([]);
      setDirty(false);
      setSelectedEstimateTotal(0);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEstimate() {
    if (!selectedProjectId) return;
    const name = newEstimateName.trim();
    if (!name) {
      setError("Estimate name is required.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const created: EstimateDoc = await coreCreateEstimate({
        projectId: selectedProjectId,
        name,
      });

      const createdId = created?.estimateId ?? (created as any)?.EstimateId;
      setNewEstimateName("");

      await loadEstimates(selectedProjectId);
      if (createdId) setSelectedEstimateId(createdId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleAddLineItem() {
    const maxLine = lineItems.reduce((m, x) => Math.max(m, x.lineNumber ?? 0), 0);
    const nextLineNumber = maxLine + 1;
    const newRow: LineItemRow = {
      lineItemId: undefined,
      lineNumber: nextLineNumber,
      costCode: "",
      description: "",
      quantity: 1,
      uom: "EA",
      unitPrice: 0,
      amount: 0,
      notes: "",
    };
    setLineItems((prev) => [...prev, newRow]);
    setDirty(true);

    // Update totals to include the new row (even before save)
    setTimeout(() => recomputeSelectedTotalsFromGrid(), 0);

    // try focus the new row
    setTimeout(() => {
      if (!lineItemsGridApi.current) return;
      const lastIndex = (lineItemsGridApi.current.getDisplayedRowCount() ?? 1) - 1;
      if (lastIndex >= 0) {
        lineItemsGridApi.current.ensureIndexVisible(lastIndex);
        lineItemsGridApi.current.setFocusedCell(lastIndex, "costCode");
      }
    }, 0);
  }

  async function handleSaveLineItems() {
    if (!selectedEstimateId) return;
    setError("");
    setBusy(true);

    try {
      const versionId = selectedVersionId || (await ensureDraftVersion(selectedEstimateId));
      setSelectedVersionId(versionId);

      // Pull latest edits from grid, not just React state
      const rows: LineItemRow[] = [];
      lineItemsGridApi.current?.forEachNode((n) => {
        if (n.data) rows.push(n.data as LineItemRow);
      });

      const upserts: UpsertLineItem[] = rows
        .map((r) => ({
          lineItemId: r.lineItemId || undefined,
          lineNumber: Number(r.lineNumber ?? 0),
          costCode: (r.costCode ?? "").toString(),
          description: (r.description ?? "").toString(),
          quantity: Number(r.quantity ?? 0),
          uom: (r.uom ?? "").toString(),
          unitPrice: Number(r.unitPrice ?? 0),
          notes: r.notes ?? undefined,
        }))
        .filter((x) => x.lineNumber > 0);

      await coreBatchUpsertLineItems(selectedEstimateId, versionId, upserts);
      await loadLineItems(selectedEstimateId, versionId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedLineItem() {
    if (!selectedEstimateId || !selectedVersionId) return;
    setError("");

    const selected = lineItemsGridApi.current?.getSelectedRows?.()?.[0] as LineItemRow | undefined;
    if (!selected) {
      setError("Select a line item row to delete.");
      return;
    }

    // Unsaved row? Just remove locally.
    if (!selected.lineItemId) {
      setLineItems((prev) => prev.filter((x) => x !== selected));
      setDirty(true);
      setTimeout(() => recomputeSelectedTotalsFromGrid(), 0);
      return;
    }

    setBusy(true);
    try {
      await coreDeleteLineItem(selectedEstimateId, selectedVersionId, selected.lineItemId);
      await loadLineItems(selectedEstimateId, selectedVersionId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // Recompute amount client-side when quantity or unitPrice changes
  function onLineItemCellChanged() {
    setDirty(true);
  }

  // initial load
  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the project text box in sync with the actual selection
  useEffect(() => {
    setProjectSearchText(selectedProjectId || "");
  }, [selectedProjectId]);

  // apply grid-level type-to-search filters
  useEffect(() => {
    applyQuickFilter(estimatesGridApi.current, estimatesSearchText);
  }, [estimatesSearchText]);

  useEffect(() => {
    applyQuickFilter(lineItemsGridApi.current, lineItemsSearchText);
  }, [lineItemsSearchText]);

  // reload estimates when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    void loadEstimates(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // load versions when estimate changes
  useEffect(() => {
    if (!selectedEstimateId) {
      setVersions([]);
      setSelectedVersionId("");
      setLineItems([]);
      setSelectedEstimateTotal(0);
      return;
    }
    void loadVersions(selectedEstimateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEstimateId]);

  // load line items when version changes
  useEffect(() => {
    if (!selectedEstimateId || !selectedVersionId) {
      setLineItems([]);
      setSelectedEstimateTotal(0);
      return;
    }
    void loadLineItems(selectedEstimateId, selectedVersionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Estimates</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Project:&nbsp;
          <input
            list="projects-dl"
            value={projectSearchText}
            onChange={(e) => {
              const v = e.target.value;
              setProjectSearchText(v);

              // When the typed value matches a ProjectId, treat it as a selection.
              // (This avoids fragile parsing of "id — name" strings.)
              const hit = projects.find((p) => p.projectId === v);
              if (hit) setSelectedProjectId(hit.projectId);
            }}
            placeholder="Type project id…"
            style={{ width: 240 }}
            disabled={busy}
          />
          <datalist id="projects-dl">
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId} label={p.name} />
            ))}
          </datalist>
        </label>

        <button onClick={loadProjects} disabled={busy}>
          Reload Projects
        </button>
        <button onClick={() => loadEstimates(selectedProjectId)} disabled={busy || !selectedProjectId}>
          Reload Estimates
        </button>
        {busy ? <span>Working…</span> : null}
      </div>

      {selectedProject ? (
        <div style={{ marginBottom: 12, opacity: 0.85 }}>
          Selected project: <strong>{selectedProject.name}</strong>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            border: "1px solid rgba(255,0,0,0.35)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Create Estimate</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={newEstimateName}
              onChange={(e) => setNewEstimateName(e.target.value)}
              list="estimate-name-dl"
              placeholder="Estimate name"
              style={{ width: 320 }}
              disabled={busy || !selectedProjectId}
            />
            <datalist id="estimate-name-dl">
              {estimates
                .map((e) => (e.name || "").trim())
                .filter((n) => n)
                .slice(0, 200)
                .map((n) => (
                  <option key={n} value={n} />
                ))}
            </datalist>
            <button onClick={handleCreateEstimate} disabled={busy || !selectedProjectId}>
              Create
            </button>
          </div>
        </div>

        <div style={{ opacity: 0.85 }}>
          {selectedEstimate ? (
            <>
              Selected estimate: <strong>{selectedEstimate.name}</strong>
              <span style={{ marginLeft: 12 }}>
                Total: <strong>{selectedEstimateTotal.toFixed(2)}</strong>
              </span>
              {selectedVersion ? (
                <>
                  {" "}
                  (v{selectedVersion.versionNumber} {selectedVersion.state})
                </>
              ) : null}
            </>
          ) : (
            <>Select an estimate to manage line items.</>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Estimates</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <label style={{ opacity: 0.85 }}>
            Search:&nbsp;
            <input
              value={estimatesSearchText}
              onChange={(e) => {
                const v = e.target.value;
                setEstimatesSearchText(v);
                const api: any = estimatesGridApi.current as any;
                if (api?.setQuickFilter) api.setQuickFilter(v);
                else if (api?.setGridOption) api.setGridOption("quickFilterText", v);
              }}
              placeholder="Type to filter estimates…"
              style={{ width: 260 }}
            />
          </label>
          <span style={{ opacity: 0.75 }}>
            Tip: you can also use the per-column filter boxes in the header.
          </span>
        </div>
        <div className="ag-theme-quartz" style={{ height: 280, width: "100%" }}>
          <AgGridReact<EstimateRow>
            rowData={estimates}
            columnDefs={estimateColDefs}
            defaultColDef={defaultColDef}
            rowSelection={{ mode: "singleRow" }}
            onGridReady={(e: GridReadyEvent) => {
              estimatesGridApi.current = e.api;
              applyQuickFilter(e.api, estimatesSearchText);
            }}
            onSelectionChanged={() => {
              const sel = estimatesGridApi.current?.getSelectedRows?.()?.[0] as EstimateRow | undefined;
              if (sel?.estimateId) setSelectedEstimateId(sel.estimateId);
            }}
            getRowId={(p) => p.data.estimateId}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Line Items</div>

        <label style={{ opacity: 0.85 }}>
          Search:&nbsp;
          <input
            value={lineItemsSearchText}
            onChange={(e) => {
              const v = e.target.value;
              setLineItemsSearchText(v);
              const api: any = lineItemsGridApi.current as any;
              if (api?.setQuickFilter) api.setQuickFilter(v);
              else if (api?.setGridOption) api.setGridOption("quickFilterText", v);
            }}
            placeholder="Type to filter line items…"
            style={{ width: 260 }}
            disabled={!selectedEstimateId}
          />
        </label>

        <label style={{ opacity: 0.85 }}>
          Version:&nbsp;
          <input
            list="versions-dl"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            placeholder="Type version id…"
            style={{ width: 240 }}
            disabled={busy || !selectedEstimateId}
          />
          <datalist id="versions-dl">
            {versions.map((v) => (
              <option
                key={v.versionId}
                value={v.versionId}
                label={`v${v.versionNumber} — ${v.state}`}
              />
            ))}
          </datalist>
        </label>

        <span style={{ opacity: 0.85 }}>
          Items: <strong>{lineItems.length}</strong>
        </span>
        <span style={{ opacity: 0.85 }}>
          Total: <strong>{selectedEstimateTotal.toFixed(2)}</strong>
        </span>

        <button onClick={handleAddLineItem} disabled={busy || !selectedEstimateId}>
          Add Item
        </button>
        <button onClick={handleDeleteSelectedLineItem} disabled={busy || !selectedEstimateId}>
          Delete Selected
        </button>
        <button onClick={handleSaveLineItems} disabled={busy || !selectedEstimateId || !dirty}>
          Save Changes
        </button>

        {dirty ? <span style={{ opacity: 0.85 }}>Unsaved changes</span> : null}
      </div>

      <div className="ag-theme-quartz" style={{ height: 420, width: "100%" }}>
        <AgGridReact<LineItemRow>
          rowData={lineItems}
          columnDefs={lineItemColDefs}
          defaultColDef={defaultColDef}
          rowSelection={{ mode: "singleRow" }}
          onGridReady={(e: GridReadyEvent) => {
            lineItemsGridApi.current = e.api;
            // Ensure totals reflect whatever the grid currently has
            setTimeout(() => recomputeSelectedTotalsFromGrid(), 0);
            applyQuickFilter(e.api, lineItemsSearchText);
          }}
          onCellValueChanged={() => {
            // recompute amount immediately by refreshing cells
            lineItemsGridApi.current?.refreshCells({ force: true, columns: ["amount"] });
            onLineItemCellChanged();
            recomputeSelectedTotalsFromGrid();
          }}
          getRowId={(p) => `${p.data.lineItemId ?? "(new)"}|${p.data.lineNumber}`}
        />
      </div>
    </div>
  );
}
