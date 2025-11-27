import { badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { normalizeString } from "../../lib/validators.js";

export function sanitizeAssetTag(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.toUpperCase();
}

export function toDecimal(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ".").trim());
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function serializeAsset(row) {
  return {
    id: row.id,
    asset_tag: row.asset_tag,
    name: row.name,
    description: row.description || null,
    alternative_number: row.alternative_number || null,
    parent_asset_id: row.parent_asset_id || null,
    parent_asset_tag: row.parent_asset_tag || null,
    asset_category_id: row.asset_category_id,
    asset_category_name: row.asset_category_name || null,
    asset_status_id: row.asset_status_id,
    asset_status_name: row.asset_status_name || null,
    depreciation_method_id: row.depreciation_method_id || null,
    depreciation_method_name: row.depreciation_method_name || null,
    lifespan_months:
      row.lifespan_months === null || row.lifespan_months === undefined ? null : Number(row.lifespan_months),
    depreciation_period: row.depreciation_period || null,
    initial_cost: row.initial_cost === null ? null : Number(row.initial_cost),
    actual_cost: row.actual_cost === null ? null : Number(row.actual_cost),
    residual_value: row.residual_value === null ? null : Number(row.residual_value),
    actual_book_value: row.actual_book_value === null ? null : Number(row.actual_book_value),
    cumulative_depreciation_value:
      row.cumulative_depreciation_value === null ? null : Number(row.cumulative_depreciation_value),
    purchase_order_number: row.purchase_order_number || null,
    transaction_number: row.transaction_number || null,
    provider_id: row.provider_id || null,
    provider_name: row.provider_name || null,
    department_id: row.department_id || null,
    department_name: row.department_name || null,
    cost_center_id: row.cost_center_id || null,
    cost_center_name: row.cost_center_name || null,
    location_id: row.location_id || null,
    location_name: row.location_name || null,
    responsible_id: row.responsible_id || null,
    responsible_name: row.responsible_name || null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    additional_attributes: row.additional_attributes || null,
  };
}

export async function fetchAsset(id) {
  const { rows } = await query`
    SELECT a.id,
           a.asset_tag,
           a.name,
           a.description,
           a.alternative_number,
           a.parent_asset_id,
           parent.asset_tag AS parent_asset_tag,
           a.asset_category_id,
           c.name AS asset_category_name,
           a.asset_status_id,
           s.name AS asset_status_name,
           a.depreciation_method_id,
           dm.name AS depreciation_method_name,
           a.lifespan_months,
           a.depreciation_period,
           a.initial_cost,
           a.actual_cost,
           a.residual_value,
           a.actual_book_value,
           a.cumulative_depreciation_value,
           a.purchase_order_number,
           a.transaction_number,
           a.provider_id,
           p.name AS provider_name,
           a.department_id,
           d.name AS department_name,
           a.cost_center_id,
           cc.name AS cost_center_name,
           a.location_id,
           l.name AS location_name,
           a.responsible_id,
           r.name AS responsible_name,
           a.created_at,
           a.updated_at,
           a.additional_attributes
    FROM assets a
    LEFT JOIN assets parent ON parent.id = a.parent_asset_id
    LEFT JOIN asset_categories c ON c.id = a.asset_category_id
    LEFT JOIN asset_statuses s ON s.id = a.asset_status_id
    LEFT JOIN depreciation_methods dm ON dm.id = a.depreciation_method_id
    LEFT JOIN providers p ON p.id = a.provider_id
    LEFT JOIN departments d ON d.id = a.department_id
    LEFT JOIN cost_centers cc ON cc.id = a.cost_center_id
    LEFT JOIN locations l ON l.id = a.location_id
    LEFT JOIN responsibles r ON r.id = a.responsible_id
    WHERE a.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

const ensureLookupQueries = {
  asset_categories: (id) => query`
    SELECT id FROM asset_categories
    WHERE id = ${id}
    LIMIT 1
  `,
  asset_statuses: (id) => query`
    SELECT id FROM asset_statuses
    WHERE id = ${id}
    LIMIT 1
  `,
  depreciation_methods: (id) => query`
    SELECT id FROM depreciation_methods
    WHERE id = ${id}
    LIMIT 1
  `,
  providers: (id) => query`
    SELECT id FROM providers
    WHERE id = ${id}
    LIMIT 1
  `,
  departments: (id) => query`
    SELECT id FROM departments
    WHERE id = ${id}
    LIMIT 1
  `,
  cost_centers: (id) => query`
    SELECT id FROM cost_centers
    WHERE id = ${id}
    LIMIT 1
  `,
  locations: (id) => query`
    SELECT id FROM locations
    WHERE id = ${id}
    LIMIT 1
  `,
  responsibles: (id) => query`
    SELECT id FROM responsibles
    WHERE id = ${id}
    LIMIT 1
  `,
  assets: (id) => query`
    SELECT id FROM assets
    WHERE id = ${id}
    LIMIT 1
  `,
};

export async function ensureExists(tableKey, id, message) {
  const executor = ensureLookupQueries[tableKey];
  if (!executor) throw new Error(`Unsupported lookup table: ${tableKey}`);
  const { rows } = await executor(id);
  if (!rows.length) throw badRequest(message);
}

export function parseAdditionalAttributes(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
      throw new Error("Invalid JSON");
    } catch (err) {
      throw badRequest("Los atributos adicionales deben ser JSON válido");
    }
  }
  throw badRequest("Los atributos adicionales deben ser JSON válido");
}
