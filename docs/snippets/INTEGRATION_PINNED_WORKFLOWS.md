## Integration Workflows (Pinned – Current Implementation)

Source of truth: Logic App definitions and SQL connections in `resources-full.json`.

### Integration Mechanism

- Integration is implemented as **Logic Apps** with **HTTP request triggers** and **SQL connector actions**.
- The Logic Apps invoke stored procedures in SQL via `Microsoft.Web/connections` resources (`sql`, `sql-2`).

### Implemented Workflows (Current)

1) **SQL Ping / Projects Probe**
- Logic App: `la-pegportal-sqlping-cc`
- Executes stored procedure: `dbo.PEG_PortalSync_GetProjects`
- Returns HTTP 200 with: `ok`, `results`, `rowCount`, `serverUtc`.

2) **Projects Sync**
- Logic App: `la-pegportal-projects-sync-cc`
- Executes stored procedure: `dbo.PEG_PortalSync_GetProjects`
- Uses SQL connection resource: `Microsoft.Web/connections/sql`

3) **Estimates Sync**
- Logic App: `la-pegportal-estimates-sync-cc`
- Executes stored procedure: `[dbo].[PEG_PortalSync_GetEstimates]`
- Parameters: `ProjectId`, `SinceUtc`, `IncludeInactive`
- Uses SQL connection resource: `Microsoft.Web/connections/sql-2`

4) **Estimate Details Sync**
- Logic App: `la-pegportal-estimateDetails-sync-cc`
- Executes stored procedure: `dbo.PEG_PortalSync_GetEstimateDetailsBySinceUtc`
- Parameters: `ProjectId`, `SinceUtc`, `IncludeInactive`
- Uses SQL connection resource: `Microsoft.Web/connections/sql-2`

### SQL Connection Targets (Current Snapshot)

- SQL connections include connection metadata (treat as sensitive when sharing exports), including:
  - server endpoint and port
  - database name
  - gateway resource reference

### Open Items (Pinned)

- Define how Logic App results are persisted/upserted into Cosmos DB:
  - via Azure Functions API endpoints (recommended), or
  - via direct Cosmos connector/writer (if introduced later).

