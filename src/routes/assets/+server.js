import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { isUuid, normalizeString, toInteger } from "../../lib/validators.js";
import {
  sanitizeAssetTag,
  toDecimal,
  serializeAsset,
  fetchAsset,
  ensureExists,
  parseAdditionalAttributes,
} from "./_helpers.js";

export async function GET(event) {
  await requireRole(event, "admin");
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
    ORDER BY a.updated_at DESC, a.asset_tag
  `;
  return success({ assets: rows.map(serializeAsset) });
}

export async function POST(event) {
  await requireRole(event, "admin");
  const userId = event.locals?.user?.id || null;

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const assetTag = sanitizeAssetTag(payload?.asset_tag);
  if (!assetTag) return badRequest("El número de activo es requerido");

  const name = normalizeString(payload?.name);
  if (!name) return badRequest("El nombre del activo es requerido");

  const assetCategoryId = payload?.asset_category_id ? String(payload.asset_category_id) : null;
  if (!assetCategoryId || !isUuid(assetCategoryId)) {
    return badRequest("La categoría del activo es requerida");
  }
  await ensureExists("asset_categories", assetCategoryId, "Categoría de activo no encontrada");

  const assetStatusId = payload?.asset_status_id ? String(payload.asset_status_id) : null;
  if (!assetStatusId || !isUuid(assetStatusId)) {
    return badRequest("El estado del activo es requerido");
  }
  await ensureExists("asset_statuses", assetStatusId, "Estado de activo no encontrado");

  let parentAssetId = null;
  if (payload?.parent_asset_id) {
    const candidate = String(payload.parent_asset_id);
    if (!isUuid(candidate)) return badRequest("Activo padre inválido");
    await ensureExists("assets", candidate, "Activo padre no encontrado");
    parentAssetId = candidate;
  }

  const depreciationMethodId = payload?.depreciation_method_id ? String(payload.depreciation_method_id) : null;
  if (depreciationMethodId) {
    if (!isUuid(depreciationMethodId)) return badRequest("Método de depreciación inválido");
    await ensureExists("depreciation_methods", depreciationMethodId, "Método de depreciación no encontrado");
  }

  const providerId = payload?.provider_id ? String(payload.provider_id) : null;
  if (providerId) {
    if (!isUuid(providerId)) return badRequest("Proveedor inválido");
    await ensureExists("providers", providerId, "Proveedor no encontrado");
  }

  const departmentId = payload?.department_id ? String(payload.department_id) : null;
  if (departmentId) {
    if (!isUuid(departmentId)) return badRequest("Departamento inválido");
    await ensureExists("departments", departmentId, "Departamento no encontrado");
  }

  const costCenterId = payload?.cost_center_id ? String(payload.cost_center_id) : null;
  if (costCenterId) {
    if (!isUuid(costCenterId)) return badRequest("Centro de costos inválido");
    await ensureExists("cost_centers", costCenterId, "Centro de costos no encontrado");
  }

  const locationId = payload?.location_id ? String(payload.location_id) : null;
  if (locationId) {
    if (!isUuid(locationId)) return badRequest("Ubicación inválida");
    await ensureExists("locations", locationId, "Ubicación no encontrada");
  }

  const responsibleId = payload?.responsible_id ? String(payload.responsible_id) : null;
  if (responsibleId) {
    if (!isUuid(responsibleId)) return badRequest("Responsable inválido");
    await ensureExists("responsibles", responsibleId, "Responsable no encontrado");
  }

  const lifespanMonths = payload?.lifespan_months === undefined || payload?.lifespan_months === null || payload?.lifespan_months === ""
    ? null
    : toInteger(payload.lifespan_months, null);
  if (lifespanMonths !== null && (lifespanMonths <= 0 || !Number.isInteger(lifespanMonths))) {
    return badRequest("La vida útil debe ser un entero positivo");
  }

  const additionalAttributes = parseAdditionalAttributes(payload?.additional_attributes);

  try {
    const { rows } = await query`
      INSERT INTO assets (
        asset_tag,
        name,
        description,
        alternative_number,
        parent_asset_id,
        asset_category_id,
        asset_status_id,
        depreciation_method_id,
        lifespan_months,
        depreciation_period,
        initial_cost,
        actual_cost,
        residual_value,
        actual_book_value,
        cumulative_depreciation_value,
        purchase_order_number,
        transaction_number,
        provider_id,
        department_id,
        cost_center_id,
        location_id,
        responsible_id,
        created_by,
        updated_by,
        additional_attributes
      )
      VALUES (
        ${assetTag},
        ${name},
        ${normalizeString(payload?.description)},
        ${normalizeString(payload?.alternative_number)},
        ${parentAssetId},
        ${assetCategoryId},
        ${assetStatusId},
        ${depreciationMethodId},
        ${lifespanMonths},
        ${normalizeString(payload?.depreciation_period)},
        ${toDecimal(payload?.initial_cost)},
        ${toDecimal(payload?.actual_cost)},
        ${toDecimal(payload?.residual_value)},
        ${toDecimal(payload?.actual_book_value)},
        ${toDecimal(payload?.cumulative_depreciation_value)},
        ${normalizeString(payload?.purchase_order_number)},
        ${normalizeString(payload?.transaction_number)},
        ${providerId},
        ${departmentId},
        ${costCenterId},
        ${locationId},
        ${responsibleId},
        ${userId},
        ${userId},
        ${additionalAttributes}
      )
      RETURNING id
    `;
    const asset = await fetchAsset(rows[0].id);
    return success({ asset: serializeAsset(asset) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El número de activo ya existe");
    }
    throw err;
  }
}
