# PEG Portal PoC – Current State Documentation

_Generated: 2026-01-23 22:29 UTC_

This document describes what is currently implemented in the PoC repo, how the pieces fit together, and what to watch for next (deployment, correctness, performance, and write-back).

## 1) High-level architecture

**Front-end**: React + Vite app deployed to **Azure Static Web Apps (SWA)**.

**Auth**: Entra ID (MSAL) in the browser; bearer token sent to the API when `VITE_USE_MSAL=true`.

**API**: .NET 8 isolated **Azure Function App** (`pegportal-api-func-cc-001`).

**Data store**: Azure Cosmos DB (database `Portal`, containers `Projects`, `Estimates`).

**Source of truth** (PMWeb SQL): accessed via **Logic Apps** (manual trigger callback URLs) which call SQL stored procedures (typically via Data Gateway / ODBC path).


**Pattern:**
- UI reads from **Cosmos** via Function endpoints.
- Background sync (timer) or on-demand sync (HTTP trigger) pulls from Logic Apps, then upserts into Cosmos.

## 2) What data the UI is actually using (your question)

### Projects

- The **Projects page** (`src/pages/ProjectsPage.tsx`) calls `GET /projects`.

- `GET /projects` is implemented by `api/Portal.RefCache.Api/Functions/ProjectsFunctions.cs`.

- That function queries **Cosmos DB** container `Portal/Projects` using `CosmosProjectsRepository`.


✅ **So the Projects grid is showing data from Cosmos DB, not directly from SQL.**


**Is Projects being synced into Cosmos?**
- The timer function `Projects_Sync_Timer` (in `Functions/ProjectsSyncFunctions.cs`) is intended to run every 15 minutes and upsert Projects into Cosmos.
- If the timer is deployed and the Function App has a valid `PROJECTS_SYNC_URL`, then yes—Projects will be kept up to date in Cosmos.


### Estimates

- The **Estimates page** calls `GET /estimates` (headers list) and `GET /estimates/{estimateId}/details` (details view).

- These are implemented in `Functions/EstimatesFunctions.cs` and read **Cosmos DB**.

- On-demand sync is `POST /sync/estimates` and the timer `Estimates_Sync_Timer` is intended to populate Cosmos from Logic Apps.


✅ **So the Estimates UI reads from Cosmos, and sync is responsible for getting SQL data into Cosmos.**

## 3) Repo layout and components

### Front-end (React/Vite)

- `src/App.tsx`: simple page switching (no router).

- `src/components/Sidebar.tsx`: left navigation.

- Pages:
  - `src/pages/ProjectsPage.tsx`: projects grid, loads from `GET /projects`.
  - `src/pages/EstimatesPage.tsx`: estimates list + details, sync button, create/delete.
  - `src/pages/SmokeTestPage.tsx`: diagnostics smoke tests (API reachability, auth behavior).


### API (Azure Functions, .NET 8 isolated)

- `Program.cs`: DI setup (CosmosClient, repositories, etc.).

- Functions:
  - `ProjectsFunctions.cs`: read endpoints.
  - `ProjectsSyncFunctions.cs`: timer-based upsert into Cosmos.
  - `EstimatesFunctions.cs`: read endpoints (headers + details).
  - `EstimatesSyncFunctions.cs`: on-demand + timer sync from Logic Apps into Cosmos (currently needs a compile/runtime alignment fix—see section 6).


### CI/CD

- SWA build/deploy workflow builds Vite output and uploads `dist` only.
- Function App workflow builds/publishes the .NET function package and deploys it.

## 4) Configuration / required environment variables

### Front-end (GitHub Actions secrets → Vite build env)

- `VITE_AAD_TENANT_ID`
- `VITE_AAD_SPA_CLIENT_ID`
- `VITE_AAD_API_SCOPE`
- `VITE_API_BASE_URL` (example: `https://pegportal-api-func-cc-001.azurewebsites.net/api`)
- `VITE_USE_MSAL` (recommend `true` when API is external to SWA)


### Function App (App Settings)

- Cosmos:
  - `PEG_COSMOS_CONNECTION`
  - `PEG_COSMOS_DB` (expected `Portal`)
  - `PEG_COSMOS_PROJECTS_CONTAINER` (expected `Projects`)
  - `PEG_COSMOS_ESTIMATES_CONTAINER` (expected `Estimates`)
- Tenant:
  - `PEG_TENANT_ID` (default `default`)
- Logic Apps callback URLs:
  - `PROJECTS_SYNC_URL`
  - `ESTIMATES_SYNC_URL`
  - `ESTIMATEDETAILS_SYNC_URL`


**Important:** the Functions’ code assumes the Logic Apps return JSON with a top-level `results: []` array.

## 5) Process flows

### 5.1 Projects: scheduled ref-cache sync

1. Timer fires (`Projects_Sync_Timer`, every 15 minutes).

2. Function POSTs to `PROJECTS_SYNC_URL` (Logic App manual trigger URL).

3. Logic App executes PMWeb SQL stored procedure and returns `results[]`.

4. Function upserts each row into Cosmos `Portal/Projects` partitioned by `tenantId`.

5. UI reads via `GET /projects` from Cosmos.


### 5.2 Estimates: on-demand sync then read

1. User clicks **Sync from SQL** in UI.

2. UI calls `POST /sync/estimates`.

3. Function calls Logic App #1 (headers) and Logic App #2 (details).

4. Function upserts header + detail documents into Cosmos `Portal/Estimates`.

5. UI calls `GET /estimates` and `GET /estimates/{id}/details`.

## 6) Current issues / correctness notes found in the repo

### 6.1 EstimatesSyncFunctions.cs compile + contract alignment

Your workflow log shows compile errors:
- `PmwebEstimateHeaderDoc` not found
- `PmwebEstimateDetailDoc` not found

In the repo, these models already exist in `Models/`:
- `Models/PmwebEstimateHeaderDoc.cs`
- `Models/PmwebEstimateDetailDoc.cs`

Also, the Cosmos repository and readers expect:
- `DocType` = `pmwebEstimateHeader` / `pmwebEstimateDetail`
- IDs shaped like `pmwebEstimate|{id}` and `pmwebEstimateDetail|{id}`

If sync writes different `DocType`/IDs, the UI will appear empty even if Cosmos is populated.


**Fix:** update `EstimatesSyncFunctions.cs` to:
- `using Portal.RefCache.Api.Models;`
- use the model types from `Models/`
- write `DocType`/`Id` in the same format the repository queries.


A corrected version is included as `patches/EstimatesSyncFunctions.fixed.cs` in the output package.


### 6.2 Deployment workflow: Functions Action trying RBAC

You previously saw:
> `No credentials found. Add an Azure login action before this action.`

That happens when `Azure/functions-action@v1` **does not receive a publish-profile value** (empty/missing secret), so it falls back to RBAC.

**Checks:**
- Ensure the secret exists: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PEGPORTAL_CC001`
- Ensure it contains the full publish profile XML (no truncation)
- Ensure the workflow references the exact secret name

**Future-proof alternative (recommended):** use `azure/login` with OIDC (no publish profile) + `Azure/functions-action` with RBAC.

## 7) Architecture decisions: Logic Apps vs Function App

### Why Logic Apps for SQL (via Data Gateway)

- **Connectivity & ops:** Logic Apps make it straightforward to call on-prem/AWS SQL via Data Gateway + managed connectors, without embedding that complexity inside the Function runtime.

- **Repeatability:** workflow steps (transformations, retries, alerting) are visible and configurable.

- **Security:** secrets/connection references live in Azure integration services; Functions only see a callback URL.


### Why Functions for API + ref-cache

- **Fast reads:** UI reads from Cosmos through a thin API, avoiding repeated SQL/SP calls.

- **Lower coupling:** UI doesn’t need to know about SQL schemas, stored procedures, or gateway concerns.

- **Auth boundary:** Functions sit behind Entra auth, and enforce tenant partitioning.

- **Future writes:** Functions can implement write-back endpoints with consistent validation and idempotency.


### Tradeoffs / counterpoint

- This split adds moving parts (SWA + Functions + Cosmos + Logic Apps + Gateway).
- For a simple PoC, you *could* call the Logic App directly from the UI. But you’d lose: token-based auth control, central validation, consistent error shaping, and you’d expose integration endpoints to the browser.
- The current approach is the right direction if you intend to productize, but you’ll want strong operational telemetry (App Insights + dashboards) to keep the complexity manageable.

## 8) Future considerations

### Performance and scalability

- **Paging on list endpoints:** `GET /projects` and `GET /estimates` should support paging (Cosmos continuation tokens) once data grows.

- **Lazy load details:** keep estimate *details* out of the initial list load (already done: details fetched only when an estimate is opened).

- **Cosmos indexing:** consider composite indexes on `(tenantId, docType, projectId)` and `(tenantId, docType, estimateId)` depending on query patterns.

- **RU optimization:** during sync, use bulk mode and/or `TransactionalBatch` per partition key to reduce RU and latency.

- **Watermarking:** implement `sinceUtc` properly using a deterministic watermark (e.g., SQL `LastUpdateDate` or a separate “transactions since” table) to avoid re-syncing 24h every time.

- **Concurrency control:** protect sync endpoints (auth + throttling) so a user can’t accidentally trigger many expensive syncs.


### Write-back to SQL stored procedures (submission)

- **Pattern A (recommended):** UI → Functions `POST /submit/...` → Function validates → calls Logic App to execute SQL SP → returns a normalized response.

- **Idempotency:** include a client-generated `requestId` so repeated submits don’t duplicate work.

- **Async option:** for heavier writes, queue requests (Service Bus) and let a worker process them; UI polls job status.

- **Conflict detection:** include row-version or `UpdatedDate` checks so users don’t overwrite changes silently.


### UX and page load

- Add loading skeletons for initial list loads.
- Cache recent API results (in-memory) and refresh in the background.
- Consider grid virtualization (AG Grid already helps) and keep row models light.
