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

## Alignment Notes

- Keep menu response aligned with seeding logic (category `ord`, task `ord`)
- Ensure JWT payload remains small; avoid embedding full menu unless necessary
- Unit tests should mock `query` and `createMenu` for deterministic behaviour; integration tests rely on seeded DB
- Respect current code style: ES modules, async/await, Tailwind class patterns, minimal fallbacks (null when absent)
