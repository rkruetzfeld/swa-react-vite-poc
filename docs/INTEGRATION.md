# Integration

## Overview
The portal integrates with PMweb using Logic Apps and Microsoft On-Premises Data Gateway. Integration workflows leverage **SQL staging tables** and **SQL stored procedures implemented inside the PMweb SQL environment** (Option C).

Cosmos DB is the portal’s application database (writable). Integration may:
- Ingest records from PMweb into Cosmos (inbound sync)
- Push portal updates from Cosmos/API back to PMweb (outbound sync, if required)

## PMweb SQL Location (Pinned)
Staging tables and stored procedures referenced in this document are implemented **inside the PMweb SQL environment**. Logic Apps connects to PMweb SQL through the Microsoft On-Premises Data Gateway.

## Implemented Database Objects (Current)
The following objects are implemented (created by the one-shot create script):
- `dbo.etl_Watermark`
- `dbo.stg_Projects`, `dbo.stg_Estimates`, `dbo.stg_Forecasts`
- `dbo.int_Projects`
- `dbo.usp_MergeProjects`

Notes:
- Merge logic for Estimates/Forecasts is not implemented yet (TBD).
- Object schema is `dbo`.

## Inbound Sync (PMweb -> Portal)
Conceptual flow:
PMweb
  -> Logic Apps (orchestration)
  -> On-Prem Data Gateway
  -> PMweb SQL staging tables (`dbo.stg_*`)
  -> Stored procedures (merge/dedupe/watermark)
  -> Cosmos DB (via API or direct writer — TBD)

### Inbound Runbook (Pinned)
1) Logic App loads a batch into the appropriate staging table(s) with a shared `BatchId` (GUID).
2) Execute merge proc(s) for that entity.

Example (Projects):
- Load rows into `dbo.stg_Projects` with `BatchId = @BatchId`.
- Run:
  `EXEC dbo.usp_MergeProjects @TenantId = '<tid>', @BatchId = '<guid>', @UpdatedBy = 'logicapp';`
- Procedure merges into `dbo.int_Projects` and updates `dbo.etl_Watermark` for `(TenantId, 'Projects')`.

## Outbound Sync (Portal -> PMweb) (TBD)
If outbound sync is required, recommended patterns include:
- Cosmos Change Feed processor -> Logic Apps -> Data Gateway -> PMweb SQL handoff table(s) -> PMweb import

Outbound principles:
- Explicit field ownership: only push fields that the portal owns
- Idempotent messages and retry-safe processing
- Correlation IDs propagated into integration logs

## SQL Staging & Stored Procedure Conventions (Pinned)
- Staging tables are append/merge-friendly and preserve source keys.
- Every staged record includes `TenantId`, `SourceKey`, and `BatchId`.
- Stored procedures are deterministic and replay-safe.
- Watermark table tracks incremental processing per entity/tenant.

## Monitoring & Metrics
Recommended telemetry:
- `recordsRead`, `recordsStaged`, `recordsMerged`, `recordsFailed`
- `durationMs`, `lastSuccessAt`, `correlationId`

## Open Questions (TBD)
- Will inbound writes to Cosmos be performed through the Azure Functions API or written directly by Logic Apps?
- Will Cosmos Change Feed be used for outbound triggers?
- Confirm PMweb interface for inbound/outbound (API vs file import vs SQL-driven import).
- Define and implement `dbo.int_Estimates`, `dbo.int_Forecasts`, and merge procs.
