# Technical Overview

## Current Stack

- **Framework**: SvelteKit v2 (Vite-based) with Svelte 5 components
- **Styling**: Tailwind CSS 4 with forms plugin for consistent UI primitives
- **Auth**: Custom JWT (HS256) issued in `src/routes/auth` endpoints, stored in localStorage; refresh tokens persisted server-side
- **Database**: PostgreSQL (@vercel/postgres) accessed via `lib/db.js` with tagged template helper
- **RBAC/Menu**: Tables `roles`, `users`, `categories`, `tasks`, `role_tasks`; helper `createMenu` builds role-scoped menu with caching
- **Password Security**: PBKDF2 hashing (`lib/password.js`) with rehash checks
- **Testing**: Vitest for unit/integration tests, with db-backed scenarios in `src/lib/tests/main.test.js`
- **Env Config**: `lib/config.js` reads `.env` / `.env.local`, differentiating prod vs dev
- **API Responses**: Structured helpers in `lib/response.js`

## Tools for Menu Implementation

- **Server Endpoint**: Reuse `/menu` route with `getMenuForUser` from `lib/menu.js`; relies on PostgreSQL schema seeded via `scripts/migrate.js`
- **Caching**: Existing in-memory cache in `createMenu` (per role); extend invalidation strategy if admin editing added
- **Client Data Flow**: `AppFrame.svelte` decodes JWT for role/menu; fallback to fetch via Fetch API + Svelte stores
- **Sidebar UI**: Use existing Tailwind utility classes; create category icons via custom mapping (e.g., heroicons or local SVG components)
- **Routing**: SvelteKit `<a>` with `href` to task routes; highlight active route using `$page` store
- **State Management**: Svelte writable store (e.g., `menuStore`) for menu persistence across components

## UI Direction

- **Design Language**: SAP/Fiori-inspired—structured layouts, muted modern palette, subtle rounded corners, focus on data density
- **Core Components**: Responsive data tables with toolbars, KPI/stat cards for dashboards, scrollable sidebar menu with icons
- **Tailwind Strategy**: Define shared utility classes/tokens for consistent spacing, colors, typography, and component shells
- **Responsiveness**: Ensure layouts adjust for tablet/desktop; collapse sidebar gracefully; tables stack or provide compact views
- **Testing & Accessibility**: Verify responsive behaviour where possible; ensure keyboard navigation and ARIA semantics for menu, tables, and cards

## Assets Import Feature Requirements

- **Supported Inputs**: Excel `.xlsx` workbook only; each worksheet must be named after the destination table (`asset_categories`, `asset_statuses`, `locations`, `responsibles`, `assets`, etc.). No CSV fallback.
- **Load Order**: Process sheets in dependency order so FK constraints succeed (e.g., categories → statuses → locations → responsibles → assets). Skip sheets that are not present but enforce that `assets` executes last.
- **Mandatory Columns**: Per-sheet configuration; for the `assets` sheet require at least `asset_tag`, `name`, `asset_category_code`, `asset_status_code`. Reject rows missing mandatory fields.
- **Optional Columns**: `location_code`, `responsible_email`, `lifespan_months`, `initial_cost`, `additional_attributes`, `description`, `alternative_number`, `depreciation_period`; ignore unknown headers gracefully.
- **Lookups & Validation**: Resolve codes/emails against their referenced tables; collect per-row errors when lookups fail or numeric conversions break; maintain row numbers using Excel index for support.
- **Security & Auth**: Endpoint requires admin-level role (`requireRole(event, "admin")`); limit files to ≤5 MB and sanitize filenames.
- **Processing Flow**: Parse workbook, normalize values (trim, uppercase codes where applicable), reuse helpers like `sanitizeAssetTag` and `parseAdditionalAttributes`, wrap each table import in a transaction batch; if any table chunk fails roll back that table's batch.
- **Conflict Handling**: Check whether a row already exists based on the natural key (e.g., `code`, `email`, or `asset_tag`). If it exists, skip mutate operations unless an explicit upsert flag is enabled, and always append an entry to the import log describing the duplicate.
- **Reporting**: Support preview mode that performs full validation without persisting changes; respond with summary `{inserted, updated, skipped, failed}` (all zero in preview) plus detailed `errors[]` (sheet, row number, message); surface truncated rows when exceeding limits.
- **Audit Trail**: Stamp `created_by` / `updated_by` with authenticated user id; persist an `imports_log` row capturing filename, template version, sheet, timestamp, totals, duplicates encountered, preview flag, and requesting user.
- **Schema Guarantees**: Natural-key uniqueness enforced via database indexes on `asset_statuses.name`, `depreciation_methods.name`, `providers.name`, `responsibles.name`, `locations.name`, and `cost_centers.name` (all case-insensitive and trimmed). Each import writes per-sheet entries into `imports_log` (grouped by `batch_id`) with metadata, totals, warnings, errors, duplicates, runtime, preview flag, and requesting user.
- **Persistencia**: En modo commit se ejecuta una sola transacción para todas las hojas y se registran los nuevos IDs en caché para resolver referencias posteriores; en modo preview sólo se devuelven validaciones y los cambios permanecen sin aplicar.
- **API Endpoint**: `GET /assets/import` expone metadatos de la plantilla vigente (versión, ruta pública, límites), mientras que `POST /assets/import` acepta `multipart/form-data` con campos `file` (obligatorio) y `preview` (opcional, por defecto `true`). Responde en español con resumen del lote, versión de plantilla vigente (`1.0`) y metas para el cliente. El backend valida formato `.xlsx`, tamaño ≤5 MB, procesa hojas en orden y registra las ejecuciones en `imports_log` aun en modo de vista previa.
- **Plantilla oficial**: `static/templates/asset-import-v1.0.xlsx` contiene todas las hojas esperadas (en español) con encabezados obligatorios y opcionales. La hoja `README` describe el flujo, límites y orden de carga. Cualquier actualización de estructura debe incrementar `ASSET_IMPORT_TEMPLATE_VERSION` y regenerar este archivo (`pnpm generate:template`).
- **Client UX**: Provide download link for template (include current `template_version`), drag-and-drop upload widget with progress indicator, toggles for preview vs commit, per-sheet outcome tables, and export of log/failed rows.

## Alignment Notes

- Keep menu response aligned with seeding logic (category `ord`, task `ord`)
- Ensure JWT payload remains small; avoid embedding full menu unless necessary
- Unit tests should mock `query` and `createMenu` for deterministic behaviour; integration tests rely on seeded DB
- Respect current code style: ES modules, async/await, Tailwind class patterns, minimal fallbacks (null when absent)
