Checkpoint 2026-01-22 — SWA vs Function App Base URL (No /api)
Context

Diagnosing repeated 404 / 405 / 500 errors when calling Azure Functions from the React (Vite) frontend hosted on Azure Static Web Apps. Endpoints like /health/projects and /diag/sql-ping behaved inconsistently between browser, curl, and frontend.

What Was Built / Changed

Confirmed Function App endpoints work correctly when called directly:

GET https://pegportal-api-func-cc-001.azurewebsites.net/diag/sql-ping → 200 OK

Fixed frontend API calls by:

Removing /api prefix entirely

Correctly configuring VITE_API_BASE_URL

Updated ProjectsPage.tsx to rely on the corrected base URL

Restarted Function App to clear transient 500s

SQL Ping now works end-to-end from the UI

Key Decisions Made

The Function App does NOT use /api as a route prefix

All frontend API calls must target:

https://pegportal-api-func-cc-001.azurewebsites.net


/api must NOT appear in:

VITE_API_BASE_URL

client.ts

Any page-level API calls

SWA host (*.azurestaticapps.net) serves only the SPA; calling API routes there returns index.html by design

Critical Configuration (Authoritative)

GitHub → Settings → Secrets and variables → Actions → Variables

VITE_API_BASE_URL = https://pegportal-api-func-cc-001.azurewebsites.net


Any value ending in /api will break routing.

Known Issues / Risks

GET /projects currently returns 500 (backend implementation issue, not routing)

GET /health/projects also returns 500 (likely repository / dependency issue)

Restarting the Function App resolved transient SQL Ping failures → indicates cold start / dependency initialization sensitivity

Future Functions must explicitly document routePrefix assumptions to avoid regressions

Verified Working Endpoints
curl https://pegportal-api-func-cc-001.azurewebsites.net/diag/sql-ping  # ✅

Next Logical Step

Implement Projects Load using the same confirmed pattern as sql-ping

Add a single authoritative backend test endpoint per domain

Avoid introducing /api unless host.json explicitly sets it