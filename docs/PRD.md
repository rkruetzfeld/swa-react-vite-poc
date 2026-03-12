# Product Requirements Document (PRD)

## Overview
This project delivers a multi-tenant web portal for viewing and managing project execution and financial data (Projects, Estimates, Forecasts) with secure authentication via Microsoft Entra ID.

The portal uses Azure Static Web Apps (React + TypeScript) and an integrated Azure Functions API. Cosmos DB (SQL API) is the primary application datastore for portal data (writable).

The portal integrates with PMweb through Logic Apps and Microsoft On-Premises Data Gateway, using SQL staging tables and stored procedures implemented inside the PMweb SQL environment (see /docs/INTEGRATION.md).

## Goals
- Provide fast, scalable access to Projects, Estimates, and Forecasts at ~100k rows per main entity.
- Support multi-tenant isolation per customer tenant.
- Provide grid-based exploration (AG Grid Community) with server-side paging, filtering, and sorting.
- Enable controlled create/update operations by Editors and Admins.
- Support integration workflows with PMweb (inbound and/or outbound synchronization) leveraging PMweb SQL staging tables and stored procedures.

## Core Pages
### Projects
- View/search/filter/sort projects
- Open project detail
- Create/update project (role-dependent)

### Estimates
- View estimates for a project and across tenant
- Filter by project/status/date, sort by date/amount
- Create/update estimates (role-dependent)

### Forecasts
- View forecasts by project/period
- Filter and sort, analyze trends
- Create/update forecasts (role-dependent)

## Roles & Capabilities
### Reader
- Read-only access to Projects/Estimates/Forecasts.

### Editor
- Read access to all portal data for their tenant.
- Create/update portal-managed data:
  - Projects (portal-managed fields and approved editable fields)
  - Estimates
  - Forecasts
- May initiate sync actions where applicable (e.g., push updates outbound) as allowed by tenant configuration.

### Admin
- All Editor capabilities
- Manage tenant configuration and integration settings (where implemented)
- Manage user access/roles (where implemented)
- Elevated operations (bulk operations, diagnostics) where implemented

## Non-Goals
The portal does not:
- Replace PMweb as the authoritative system of record for all fields (ownership is defined per entity/field).
- Provide a full PMweb feature set.
- Expose database credentials or allow direct client access to Cosmos DB.

## Key Principles
- Multi-tenant isolation is mandatory and enforced server-side.
- The UI never directly accesses Cosmos DB or PMweb SQL; all data access occurs through the API.
- API contracts and data dictionary are source-of-truth for implementation.
- Consistent error handling and correlation IDs for observability.

## Open Questions (TBD)
- Which specific Project fields are editable in the portal vs sourced/locked from PMweb?
- For each entity, which fields are portal-authoritative vs PMweb-authoritative?
- Tenant onboarding workflow and role assignment model (app roles vs groups).
