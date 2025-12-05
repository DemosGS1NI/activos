import fs from 'fs';
import { createPool } from '@vercel/postgres';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const text = fs.readFileSync('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^DATABASE_URL\s*=\s*(.+)$/);
      if (match) {
        return match[1].trim().replace(/^["'`]/, '').replace(/["'`]$/, '');
      }
    }
  } catch {}
  return null;
}

const url = loadDatabaseUrl();
if (!url) {
  console.error('DATABASE_URL missing (env var or .env.local)');
  process.exit(1);
}

const pool = createPool({ connectionString: url });
const migrationName = '001_init';
// Additional idempotent structural changes after initial migration.
async function postInitPatches() {
  // Revoked refresh tokens table (for logout / token invalidation)
  await pool.sql`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      user_id UUID NOT NULL,
      revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      exp TIMESTAMPTZ
    )
  `;

  // Menu / RBAC tables: menu groups, tasks, and mapping to roles
  await pool.sql`
    CREATE TABLE IF NOT EXISTS menu_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      ord INT NOT NULL DEFAULT 100,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      menu_group_id UUID REFERENCES menu_groups(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      route TEXT,
      ord INT NOT NULL DEFAULT 100,
      active BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(menu_group_id, key)
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS role_tasks (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, task_id)
    )
  `;

  // Remove deprecated visibility flag now that menu relies solely on role-task mappings
  await pool.sql`
    ALTER TABLE tasks DROP COLUMN IF EXISTS public
  `;

  // Asset management lookup tables
  await pool.sql`
    CREATE TABLE IF NOT EXISTS asset_statuses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS depreciation_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      formula_notes TEXT,
      default_period TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS document_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
      address_line TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      postal_code TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS responsibles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      contact_email TEXT,
      contact_phone TEXT,
      tax_id TEXT,
      address_line TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      postal_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS asset_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      default_depreciation_method_id UUID REFERENCES depreciation_methods(id) ON DELETE SET NULL,
      default_lifespan_months INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_tag TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      alternative_number TEXT,
      parent_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
      asset_category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
      asset_status_id UUID NOT NULL REFERENCES asset_statuses(id) ON DELETE RESTRICT,
      depreciation_method_id UUID REFERENCES depreciation_methods(id) ON DELETE SET NULL,
      lifespan_months INT,
      depreciation_period TEXT,
      initial_cost NUMERIC(14, 2),
      actual_cost NUMERIC(14, 2),
      residual_value NUMERIC(14, 2),
      actual_book_value NUMERIC(14, 2),
      cumulative_depreciation_value NUMERIC(14, 2),
      purchase_order_number TEXT,
      transaction_number TEXT,
      provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
      department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
      location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
      responsible_id UUID REFERENCES responsibles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      additional_attributes JSONB
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS asset_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
      location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
      responsible_id UUID REFERENCES responsibles(id) ON DELETE SET NULL,
      effective_from TIMESTAMPTZ NOT NULL,
      effective_to TIMESTAMPTZ,
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS asset_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
      file_url TEXT NOT NULL,
      description TEXT,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Seed lookup data with Spanish names
  await pool.sql`
    INSERT INTO asset_statuses (code, name)
    VALUES
      ('ACTIVO', 'Activo'),
      ('MANTENIMIENTO', 'En mantenimiento'),
      ('RETIRADO', 'Retirado'),
      ('BAJA', 'Dado de baja')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;

  await pool.sql`
    INSERT INTO depreciation_methods (code, name)
    VALUES
      ('LINEA_RECTA', 'Línea recta'),
      ('SUMA_DIGITOS', 'Suma de dígitos'),
      ('SALDO_DECRECIENTE', 'Saldo decreciente')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;

  await pool.sql`
    INSERT INTO document_types (code, name)
    VALUES
      ('FACTURA_COMPRA', 'Factura de compra'),
      ('GARANTIA', 'Garantía'),
      ('FOTOGRAFIA', 'Fotografía'),
      ('INFORME_MANTENIMIENTO', 'Informe de mantenimiento')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;

  await pool.sql`
    INSERT INTO departments (code, name)
    VALUES
      ('FIN', 'Finanzas'),
      ('RRHH', 'Recursos Humanos'),
      ('TI', 'Tecnología'),
      ('OPS', 'Operaciones')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;

  await pool.sql`
    INSERT INTO asset_categories (code, name)
    VALUES
      ('TI_EQUIPOS', 'Equipos de TI'),
      ('MOBILIARIO', 'Mobiliario'),
      ('VEHICULOS', 'Vehículos'),
      ('MAQUINARIA', 'Maquinaria')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS inventory_conditions (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      severity SMALLINT,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS inventory_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scope_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      progress_snapshot JSONB,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived_at TIMESTAMPTZ
    )
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_campaigns_status
      ON inventory_campaigns (status)
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_campaigns_schedule
      ON inventory_campaigns (starts_at, ends_at)
  `;

  await pool.sql`
    CREATE TABLE IF NOT EXISTS inventory_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      scanned_code TEXT,
      checked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
      condition_id INTEGER REFERENCES inventory_conditions(id) ON DELETE SET NULL,
      comment TEXT,
      previous_responsible_id UUID REFERENCES responsibles(id) ON DELETE SET NULL,
      new_responsible_id UUID REFERENCES responsibles(id) ON DELETE SET NULL,
      responsible_updated BOOLEAN NOT NULL DEFAULT false,
      campaign_id UUID REFERENCES inventory_campaigns(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await pool.sql`
    ALTER TABLE inventory_checks
    ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES inventory_campaigns(id) ON DELETE SET NULL
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_checks_campaign_id
      ON inventory_checks (campaign_id)
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_checks_asset_checked_at
      ON inventory_checks (asset_id, checked_at)
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_checks_scanned_code
      ON inventory_checks (scanned_code)
  `;

  await pool.sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_checks_checked_by
      ON inventory_checks (checked_by)
  `;

  await pool.sql`
    INSERT INTO inventory_conditions (slug, label, severity)
    VALUES
      ('good', 'En buen estado', 0),
      ('damaged', 'Dañado', 5),
      ('missing', 'No localizado', 10)
    ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, severity = EXCLUDED.severity
  `;
}

async function run() {
  try {
    // Ensure migrations table first
    await pool.sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const { rows } = await pool.sql`
      SELECT name FROM _migrations WHERE name = ${migrationName}
    `;
    if (!rows.length) {
      console.log('Applying', migrationName);
      await pool.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
      await pool.sql`
        CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )
      `;
      await pool.sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
          last_login TIMESTAMPTZ,
          force_password_change BOOLEAN NOT NULL DEFAULT false,
          password_changed_at TIMESTAMPTZ,
          failed_login_attempts INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await pool.sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
      await pool.sql`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);`;
      await pool.sql`INSERT INTO _migrations (name) VALUES (${migrationName});`;
      console.log('Initial migration complete');
    } else {
      console.log('Initial migration already applied; running post-init patches');
    }
    await postInitPatches();
    console.log('Post-init patches complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { if (typeof pool.end === 'function') { await pool.end(); } } catch {}
  }
}

run();