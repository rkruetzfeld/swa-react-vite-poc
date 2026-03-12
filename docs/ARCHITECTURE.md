# Architecture

## Overview
The portal consists of a React SPA hosted on Azure Static Web Apps with an integrated Azure Functions API. Cosmos DB (SQL API) is the primary application datastore for portal data (writable).

Integration with PMweb is orchestrated via Logic Apps and Microsoft On-Premises Data Gateway, leveraging staging tables and stored procedures inside the PMweb SQL environment.

## Component Diagram (Text)
Users
  |
  v
Azure Static Web Apps (React + TypeScript)
  |
  v
Azure Functions API (SWA Integrated)
  |
  v
Cosmos DB (SQL API)

Integration:
PMweb SQL environment (staging tables + stored procedures) <-> Logic Apps <-> On-Prem Data Gateway

## Repository Structure (Pinned)
repo-root
  ├ src/                  # React frontend (Azure Static Web Apps)
  │   ├ components/
  │   ├ pages/
  │   ├ grid/
  │   ├ services/
  │   └ types/
  ├ api/                  # Azure Functions (SWA integrated)
  │   ├ functions/
  │   ├ services/
  │   ├ models/
  │   ├ middleware/
  │   └ types/
  ├ integration/          # Logic App definitions + SQL scripts (not runtime)
  │   ├ logicapps/
  │   ├ sql/
  │   └ mappings/
  └ docs/                 # Pinned docs (contracts + architecture)
     ├ PRD.md
     ├ ARCHITECTURE.md
     ├ DATA_DICTIONARY.md
     ├ API_CONTRACT.md
     ├ INTEGRATION.md
     └ DEFINITION_OF_DONE.md

## Tenant Model (Pinned Decision)
This application uses Entra tenant–based multi-tenancy.

- Each customer corresponds to a single Microsoft Entra tenant.
- `tenantId` is derived directly from the Entra `tid` claim.
- All API requests enforce tenant isolation.

Enforcement requirements:
- The API extracts `tenantId` from the validated token.
- All Cosmos operations MUST include:
  - `partitionKey = tenantId`
  - and query predicates that constrain `tenantId` (defense in depth).

No cross-tenant access is permitted.

## Security Boundaries (Pinned)
- Client (React SPA) never accesses Cosmos DB or PMweb SQL directly.
- All data access (read/write) occurs through Azure Functions API.
- Secrets are never shipped to the browser bundle.

## Data Ownership & Write Model
Cosmos DB stores portal data, which may include:
- Data sourced from PMweb (synced in)
- Data authored/updated in the portal (by Editors/Admins)

Data ownership is defined per entity/field in /docs/DATA_DICTIONARY.md.
Where conflicts exist, rules must be explicit (TBD where unknown).

## API Conventions
- REST + JSON
- Standard headers include `x-correlation-id`
- Standard error envelope (see /docs/API_CONTRACT.md)

## AG Grid Conventions (Pinned)
AG Grid Community is used with Infinite Row Model:
- list endpoints accept `startRow`, `endRow`, `sortModel`, `filterModel`
- list endpoints return `{ rows, lastRow }`

## Integration Implementation Status
- PMweb SQL (dbo) contains staging tables (`stg_Projects`, `stg_Estimates`, `stg_Forecasts`), watermark (`etl_Watermark`), and the Projects merge proc (`usp_MergeProjects`) targeting `int_Projects`.
- Estimates/Forecasts merge objects are pending (TBD).

## Environment Variables Policy
Configuration is supplied via environment variables in SWA/Functions settings.
Examples:
- COSMOS_ENDPOINT
- COSMOS_DATABASE
- COSMOS_CONTAINER_PROJECTS
- COSMOS_CONTAINER_ESTIMATES
- COSMOS_CONTAINER_FORECASTS
- ENTRA_CLIENT_ID

## Deployment Overview
- CI builds and deploys the Static Web App (frontend) and Functions (API).
- Integration assets (Logic Apps, SQL scripts) are deployed separately via IaC or controlled promotion.

## Open Questions (TBD)
- Inbound writes to Cosmos: via API vs direct writer from Logic Apps.
- Outbound sync pattern (if required): Cosmos change feed vs scheduled export.
- CI/CD platform and IaC approach (Bicep/Terraform).
