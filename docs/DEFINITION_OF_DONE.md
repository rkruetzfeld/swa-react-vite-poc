# Definition of Done (DoD)

Every feature slice must satisfy the following checklist.

## Functional
- Feature requirements implemented per PRD
- UI validated against expected behaviors (grid, forms, navigation)
- API contract followed (request/response shapes match /docs/API_CONTRACT.md)

## Security & Tenancy (Pinned)
- Entra authentication verified end-to-end
- Role-based authorization enforced server-side
- Tenant isolation enforced server-side:
  - tenantId derived from token `tid`
  - Cosmos operations use partitionKey `/tenantId`
  - no cross-tenant data leakage

## Data
- Partition key used correctly (`/tenantId`)
- ID strategy followed:
  - External-sourced: `${tenantId}:${sourceKey}`
  - Portal-native: `${tenantId}:portal:${uuid}`
- Soft delete behavior implemented where applicable (`isDeleted`)

## API
- Endpoints documented in /docs/API_CONTRACT.md
- Standard error shape implemented
- Correlation ID handled:
  - accept/echo/generate `x-correlation-id`
  - included in logs and error responses

## Grid (AG Grid Community)
- Infinite Row Model supported
- Server-side paging via `startRow/endRow`
- Server-side sorting and filtering via `sortModel/filterModel`
- Performance sanity: avoids loading full dataset into browser memory

## Observability
- Structured logging enabled in API
- Key events logged (request start/end, errors, integration operations)
- Metrics captured where feasible (counts, duration)

## Testing
- Unit tests for:
  - tenant enforcement logic
  - query mapping (sort/filter models)
  - validation for create/update payloads
- API-level tests for at least one list endpoint and one write endpoint per entity module

## Documentation
- Data dictionary updated for field changes
- API contract updated for endpoint changes
- Integration doc updated for integration behavior changes

## Integration Objects (when integration is in scope)
- Required staging tables and stored procedures exist in PMweb SQL (dbo).
- Smoke test passes: stage one batch and run merge procedure successfully.

## Open Questions (TBD)
- Minimum acceptable test coverage threshold
- Performance benchmarks / RU budgets for list queries at 100k rows
