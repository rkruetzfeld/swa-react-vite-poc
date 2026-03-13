## Azure Deployment Topology (Pinned – Current RG Snapshot)

Source of truth: `resources-index.json` and `resources-full.json` exports for resource group `rg-swa-react-vite-poc`.

### Static Web Apps (Two Environments)

- **Dev/Primary SWA:** `swa-react-vite-poc`
  - Region: West US 2
  - GitHub repo: `rkruetzfeld/swa-react-vite-poc`
  - Branch: `main`
  - Default hostname: `blue-stone-08c319f1e.4.azurestaticapps.net`
  - SKU: Standard
  - Linked backend: Azure Function App resource `pegportal-api-func-cc-001` (Canada Central).

- **Production SWA:** `swa-react-vite-poc-stable`
  - Region: East US 2
  - GitHub repo: `rkruetzfeld/swa-react-vite-poc`
  - Branch: `stable`
  - Default hostname: `salmon-coast-0397c0b0f.1.azurestaticapps.net`
  - SKU: Free
  - Staging environment policy: Enabled.

**Operational implication (Pinned):**
- Production deployments occur by promoting code to the `stable` branch.
- Development deployments occur on the `main` branch.
- The portal uses SWA-managed API integration to route `/api/*` calls to the linked Function App (for the `main` SWA, the linked backend is explicitly configured).

### API Runtime

- **Function App:** `pegportal-api-func-cc-001`
  - Type: `Microsoft.Web/sites` (Function App, Linux)
  - Region: Canada Central
  - Runtime stack: `DOTNET-ISOLATED 8.0`
  - Hosting plan: `CanadaCentralLinuxDynamicPlan` (Consumption/Y1).

### Data Layer

- **Cosmos DB (SQL API):** `pegportal-cosmos-cc-001-1768836578`
  - Region: Canada Central
  - API: SQL
  - Consistency: Session
  - Public network access: Enabled
  - Automatic failover: Enabled (single region listed in current snapshot).

### Integration Layer (Logic Apps + SQL Connectors)

- **Logic Apps (HTTP-triggered workflows):**
  - `la-pegportal-sqlping-cc`
  - `la-pegportal-projects-sync-cc`
  - `la-pegportal-estimates-sync-cc`
  - `la-pegportal-estimateDetails-sync-cc`

- **SQL Connections (Managed API connections for Logic Apps):**
  - `sql` and `sql-2` (`Microsoft.Web/connections`) in Canada Central.

### Observability

- Application Insights resources exist for the Function App integration:
  - `pegportal-api-func-cc-001-ai`
  - `pegportal-api-func-cc-001` (both are `Microsoft.Insights/components`).

