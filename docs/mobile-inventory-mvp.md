# Mobile Inventory MVP

## Scope

- Physical inventory on smartphone/tablet using a Bluetooth "keyboard wedge" scanner.
- Online only: requires network connectivity while performing checks.
- Operators may optionally reassign the asset's responsible user during the check.

## Data Model

### `inventory_conditions`

| column        | type                | notes                                             |
|---------------|---------------------|---------------------------------------------------|
| `id`          | `serial primary key` | Stable identifier for condition options.          |
| `slug`        | `text unique`        | Machine-friendly identifier (e.g., `good`).       |
| `label`       | `text`               | Human readable label (e.g., `En buen estado`).    |
| `severity`    | `smallint`           | Optional weight (0 = good, higher = worse).       |
| `description` | `text`               | Optional longer guidance for operators.           |
| `active`      | `boolean`            | Allow soft disabling of legacy conditions.        |
| `created_at`  | `timestamptz`        | Defaults to now.                                  |
| `updated_at`  | `timestamptz`        | Updated when condition definitions change.        |

- Seeded defaults cover `good`, `damaged`, and `missing` to bootstrap reporting without UI setup.

### `inventory_checks`

| column                   | type                 | notes                                                                                           |
|--------------------------|----------------------|-------------------------------------------------------------------------------------------------|
| `id`                     | `uuid primary key`   | Generated via `gen_random_uuid()`.                                                              |
| `asset_id`               | `uuid`               | References `assets.id`; required.                                                               |
| `scanned_code`           | `text`               | Raw value received from scanner; stored for audit/comparison.                                   |
| `checked_by`             | `uuid`               | References `users.id`; the operator running the scan.                                           |
| `checked_at`             | `timestamptz`        | Defaults to now; when the scan was confirmed.                                                   |
| `location_id`            | `uuid`               | References `locations.id`; optional if location unchanged.                                      |
| `condition_id`           | `integer`            | References `inventory_conditions.id`; optional if not captured.                                 |
| `comment`                | `text`               | Optional operator free-form note.                                                               |
| `previous_responsible_id`| `uuid`               | References `responsibles.id`; stored if responsible changed.                                    |
| `new_responsible_id`     | `uuid`               | References `responsibles.id`; stored if responsible changed.                                    |
| `responsible_updated`    | `boolean`            | Defaults false; true when responsible changed as part of this check.                            |
| `metadata`               | `jsonb`              | Extra structured data (device info, app version); defaults to `{}`.                             |
| `created_at`             | `timestamptz`        | Defaults to now.                                                                                |

#### Indexing & Constraints

- Unique partial index on `(asset_id, checked_at)` if desired to guard duplicates per minute (optional).
- Index on `scanned_code` for quick lookups when the code is not an exact asset tag.
- Index on `checked_by` to support user audit reports.
- Foreign key constraints to `assets`, `users`, `locations`, and `inventory_conditions` with `ON UPDATE CASCADE`.

## API Contract

### `GET /api/inventory/assets?code=…`

- **Auth**: bearer/JWT, requires permission `inventory.check`.
- **Inputs**: query `code` (string), optional `includeHistory` (boolean).
- **Lookup Rules**: first try exact match on `assets.asset_tag`; fallback to asset `id` or `alternative_number`.
- **Response**: `{ asset, locations, conditions, responsibles, recentChecks? }`.
  - `recentChecks` returned when `includeHistory=true` (last N checks, default 5).
  - `locations` and `responsibles` provide dropdown options; `asset` already carries current links.
  - `conditions` array for populating dropdown.

### `POST /api/inventory/checks`

- **Auth**: bearer/JWT.
- **Permissions**:
  - `inventory.check` required for everyone.
  - `assets.update_responsible` required when `newResponsibleId` provided.
- **Request Body**:
  ```json
  {
    "scannedCode": "ASSET-00042",
    "assetId": "…",
    "locationId": "…",
    "conditionId": 2,
    "comment": "Screen cracked",
    "newResponsibleId": "…"
  }
  ```
- **Behaviour**:
  1. Resolve operator from JWT (`checked_by`).
  2. Validate asset exists and matches scanned code (allow mismatch but record).
  3. Within a transaction, apply any location/responsible changes to the asset record and insert the `inventory_checks` row, flagging `responsible_updated` when applicable.
- **Response**: `201 Created` with check summary `{ id, checkedAt, responsibleUpdated }`.

## Responsible Update Flow

1. Operator scans asset; lookup response includes current responsible.
2. UI shows optional action: "Assign new responsible" (dropdown sourced from the responsibles catalog with search support).
3. On submit with new responsible:
  - Frontend confirms action with modal summarizing old → new responsible.
  - Backend enforces `assets.update_responsible` permission.
  - Transaction updates asset and records change in `inventory_checks`.
4. If permission missing, API returns 403 and UI notifies user.

## Client UX Summary

- Single-page mobile form:
  1. Input field focused automatically (works with keyboard wedge scanner).
  2. After scan, show asset card with key info (status, responsible, location).
  3. Allow selection of location, condition, optional comment.
  4. Optional responsible reassignment toggle reveals user picker.
  5. Submit button confirms check; success toast resets form for next scan.

- Accessibility:
  - Large touch targets for condition/location dropdowns.
  - Minimum contrast for outdoor use.
  - Live region announcements for scan success/error.

## RBAC & Audit

- Permissions introduced:
  - `inventory.check`: view asset info via inventory APIs and record checks.
  - `assets.update_responsible`: reuse existing or add new permission controlling responsible changes.
- Server ensures audit trail by writing `inventory_checks` for every action and storing both responsible IDs when changed.
- Consider nightly report that flags assets with repeated negative conditions or frequent responsible swaps.

## Open Questions / Next Steps

- Do we need per-department filters for responsible dropdown? (Default: unrestricted search.)
- Should scanner misreads (code not found) be stored separately? (Optional future enhancement.)
- Determine retention policy for `inventory_checks` (likely permanent for audit).
