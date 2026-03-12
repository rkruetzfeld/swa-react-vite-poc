# API Contract

## Authentication (Pinned)
All endpoints require an authenticated user via Microsoft Entra ID.

Standard header:
- `Authorization: Bearer <token>`

Correlation header:
- Client MAY send `x-correlation-id`
- Server MUST echo `x-correlation-id` back (or generate if absent)

## Authorization (Pinned)
Roles:
- Admin: full access
- Editor: read + create/update (and delete where allowed)
- Reader: read-only

Tenant enforcement:
- API derives `tenantId` from token `tid` claim
- All operations are scoped to tenantId

## Standard Error Response (Pinned)
All errors return JSON:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "correlationId": "uuid-or-string"
  }
}
```

## Paging Model (Pinned — AG Grid Community Infinite Row Model)
List endpoints use AG Grid Infinite Row Model semantics.

### Query Parameters (List Endpoints)
- `startRow` (number, required)
- `endRow` (number, required)
- `sortModel` (string, optional) JSON-encoded array of AG Grid sort model
- `filterModel` (string, optional) JSON-encoded AG Grid filter model

### Response (List Endpoints)
```json
{
  "rows": [],
  "lastRow": 100000
}
```
- `lastRow` is the total row count when known.
- If total is expensive to compute, `lastRow` may be `-1`.

## Endpoints

### Projects
- `GET /api/projects` (Reader/Editor/Admin) list (startRow/endRow)
- `GET /api/projects/{id}` (Reader/Editor/Admin) get
- `POST /api/projects` (Editor/Admin) create
- `PUT /api/projects/{id}` (Editor/Admin) update
- `DELETE /api/projects/{id}` (Admin; Editor TBD) soft delete preferred

### Estimates
- `GET /api/estimates` (Reader/Editor/Admin) list (startRow/endRow)
- `GET /api/estimates/{id}` (Reader/Editor/Admin) get
- `POST /api/estimates` (Editor/Admin) create
- `PUT /api/estimates/{id}` (Editor/Admin) update
- `DELETE /api/estimates/{id}` (Admin; Editor TBD) soft delete preferred

### Forecasts
- `GET /api/forecasts` (Reader/Editor/Admin) list (startRow/endRow)
- `GET /api/forecasts/{id}` (Reader/Editor/Admin) get
- `POST /api/forecasts` (Editor/Admin) create
- `PUT /api/forecasts/{id}` (Editor/Admin) update
- `DELETE /api/forecasts/{id}` (Admin; Editor TBD) soft delete preferred

## Data Shapes (Minimal)
Full field definitions are in /docs/DATA_DICTIONARY.md.

- ProjectSummary: id, projectNumber, projectName, status, updatedAt
- EstimateSummary: id, projectId, estimateNumber, estimateDate, estimateAmount, status, updatedAt
- ForecastSummary: id, projectId, forecastPeriod, forecastAmount, scenario, updatedAt

## Open Questions (TBD)
- Should list endpoints support a `q` (search) parameter separate from filterModel?
- Should deletes be Admin-only for all entities?
- Finalize editable field lists for create/update payloads.
