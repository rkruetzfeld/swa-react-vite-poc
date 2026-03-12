# Data Dictionary

## Global Conventions (Pinned)
### Partition & Identity
- Cosmos partition key: `/tenantId`
- `id` strategy: `${tenantId}:${sourceKey}` (for records originating from an external system)
- For portal-native records (no external key yet), `id` MUST still be unique and MUST include tenant context (e.g., `${tenantId}:portal:${uuid}`)

### Common Fields (All Documents)
| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | Yes | Unique document id |
| tenantId | string | Yes | Entra tenant id (`tid`) |
| sourceSystem | string | Yes | E.g., `PMweb` or `Portal` |
| sourceKey | string | Conditional | External key if sourced from PMweb; may be null for portal-native |
| lastSyncedAt | string (ISO datetime) | No | Last time record synced with PMweb (if applicable) |
| createdAt | string (ISO datetime) | Yes | Created timestamp (portal) |
| updatedAt | string (ISO datetime) | Yes | Updated timestamp (portal) |
| isDeleted | boolean | No | Soft delete flag (preferred) |

> NOTE: `createdAt/updatedAt` are portal operational timestamps. PMweb source timestamps may be stored separately (e.g., `sourceUpdatedAt`) where needed.

## Entity: Projects
### Container
- `projects` (partitionKey: `/tenantId`)

### Ownership
- Some fields may be sourced from PMweb and read-only in portal (TBD).
- Some fields are editable in portal by Editor/Admin (TBD explicit list).

### Fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| projectNumber | string | Yes | Display identifier |
| projectName | string | Yes | Name |
| status | string | Yes | Enum (TBD values) |
| startDate | string (ISO date) | No | |
| endDate | string (ISO date) | No | |
| currency | string | No | ISO code (e.g., CAD) |
| projectManager | string | No | |
| sourceUpdatedAt | string (ISO datetime) | No | Timestamp from PMweb (if applicable) |

## Entity: Estimates
### Container
- `estimates` (partitionKey: `/tenantId`)

### Fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| projectId | string | Yes | References Projects.id (same tenant) |
| estimateNumber | string | Yes | |
| estimateDate | string (ISO date) | Yes | |
| estimateAmount | number | Yes | |
| status | string | Yes | Enum (TBD values) |
| version | number | No | If versioned (TBD) |
| sourceUpdatedAt | string (ISO datetime) | No | From PMweb (if applicable) |

## Entity: Forecasts
### Container
- `forecasts` (partitionKey: `/tenantId`)

### Fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| projectId | string | Yes | References Projects.id (same tenant) |
| forecastPeriod | string | Yes | E.g., `2026-03` |
| forecastAmount | number | Yes | |
| status | string | No | Optional enum (TBD) |
| scenario | string | No | For what-if scenarios (TBD) |
| sourceUpdatedAt | string (ISO datetime) | No | From PMweb (if applicable) |

## Indexing & Query Guidance (Pinned)
Primary access pattern:
- All queries are scoped to `tenantId`.

Recommended fields frequently filtered/sorted in grid (index-friendly):
- Projects: `projectNumber`, `projectName`, `status`, `updatedAt`, `startDate`, `endDate`
- Estimates: `projectId`, `status`, `estimateDate`, `estimateAmount`, `updatedAt`
- Forecasts: `projectId`, `forecastPeriod`, `scenario`, `updatedAt`

## Open Questions (TBD)
- Enumerations for `status` fields by entity.
- Canonical mapping of PMweb keys to `sourceKey` and entity relationships.
- Which Project fields are editable vs sourced/locked.
