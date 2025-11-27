import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, toInteger } from "../../../lib/validators.js";
import {
  sanitizeAssetTag,
  toDecimal,
  serializeAsset,
  fetchAsset,
  ensureExists,
  parseAdditionalAttributes,
} from "../_helpers.js";

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Id de activo inválido");

  const asset = await fetchAsset(id);
  if (!asset) return notFound("Activo no encontrado");
  return success({ asset: serializeAsset(asset) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Id de activo inválido");
  const userId = event.locals?.user?.id || null;

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const providedKeys = [
    "asset_tag",
    "name",
    "description",
    "alternative_number",
    "parent_asset_id",
    "asset_category_id",
    "asset_status_id",
    "depreciation_method_id",
    "lifespan_months",
    "depreciation_period",
    "initial_cost",
    "actual_cost",
    "residual_value",
    "actual_book_value",
    "cumulative_depreciation_value",
    "purchase_order_number",
    "transaction_number",
    "provider_id",
    "department_id",
    "cost_center_id",
    "location_id",
    "responsible_id",
    "additional_attributes",
  ];

  const hasUpdates = providedKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (!hasUpdates) return badRequest("Nada que actualizar");

  const current = await fetchAsset(id);
  if (!current) return notFound("Activo no encontrado");

  let nextAssetTag = current.asset_tag;
  if (Object.prototype.hasOwnProperty.call(payload, "asset_tag")) {
    const sanitized = sanitizeAssetTag(payload.asset_tag);
    if (!sanitized) return badRequest("El número de activo es requerido");
    nextAssetTag = sanitized;
  }

  let nextName = current.name;
  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre del activo es requerido");
    nextName = normalized;
  }

  const nextDescription = Object.prototype.hasOwnProperty.call(payload, "description")
    ? normalizeString(payload.description)
    : current.description;

  const nextAlternativeNumber = Object.prototype.hasOwnProperty.call(payload, "alternative_number")
    ? normalizeString(payload.alternative_number)
    : current.alternative_number;

  let nextParentAssetId = current.parent_asset_id;
  if (Object.prototype.hasOwnProperty.call(payload, "parent_asset_id")) {
    const value = payload.parent_asset_id;
    if (value === null || value === "") {
      nextParentAssetId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Activo padre inválido");
      if (candidate === id) return badRequest("Un activo no puede ser su propio padre");
      await ensureExists("assets", candidate, "Activo padre no encontrado");
      nextParentAssetId = candidate;
    }
  }

  let nextAssetCategoryId = current.asset_category_id;
  if (Object.prototype.hasOwnProperty.call(payload, "asset_category_id")) {
    const value = payload.asset_category_id;
    if (!value) return badRequest("La categoría del activo es requerida");
    const candidate = String(value);
    if (!isUuid(candidate)) return badRequest("Categoría de activo inválida");
    await ensureExists("asset_categories", candidate, "Categoría de activo no encontrada");
    nextAssetCategoryId = candidate;
  }

  let nextAssetStatusId = current.asset_status_id;
  if (Object.prototype.hasOwnProperty.call(payload, "asset_status_id")) {
    const value = payload.asset_status_id;
    if (!value) return badRequest("El estado del activo es requerido");
    const candidate = String(value);
    if (!isUuid(candidate)) return badRequest("Estado de activo inválido");
    await ensureExists("asset_statuses", candidate, "Estado de activo no encontrado");
    nextAssetStatusId = candidate;
  }

  let nextDepreciationMethodId = current.depreciation_method_id;
  if (Object.prototype.hasOwnProperty.call(payload, "depreciation_method_id")) {
    const value = payload.depreciation_method_id;
    if (value === null || value === "") {
      nextDepreciationMethodId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Método de depreciación inválido");
      await ensureExists("depreciation_methods", candidate, "Método de depreciación no encontrado");
      nextDepreciationMethodId = candidate;
    }
  }

  const currentLifespan = current.lifespan_months == null ? null : Number(current.lifespan_months);
  let nextLifespanMonths = currentLifespan;
  if (Object.prototype.hasOwnProperty.call(payload, "lifespan_months")) {
    if (payload.lifespan_months === null || payload.lifespan_months === "") {
      nextLifespanMonths = null;
    } else {
      const parsed = toInteger(payload.lifespan_months, null);
      if (parsed === null || parsed <= 0) {
        return badRequest("La vida útil debe ser un entero positivo");
      }
      nextLifespanMonths = parsed;
    }
  }

  const nextDepreciationPeriod = Object.prototype.hasOwnProperty.call(payload, "depreciation_period")
    ? normalizeString(payload.depreciation_period)
    : current.depreciation_period;

  const currentInitialCost = current.initial_cost == null ? null : Number(current.initial_cost);
  const currentActualCost = current.actual_cost == null ? null : Number(current.actual_cost);
  const currentResidualValue = current.residual_value == null ? null : Number(current.residual_value);
  const currentBookValue = current.actual_book_value == null ? null : Number(current.actual_book_value);
  const currentCumulativeDep = current.cumulative_depreciation_value == null
    ? null
    : Number(current.cumulative_depreciation_value);

  const nextInitialCost = Object.prototype.hasOwnProperty.call(payload, "initial_cost")
    ? toDecimal(payload.initial_cost)
    : currentInitialCost;
  const nextActualCost = Object.prototype.hasOwnProperty.call(payload, "actual_cost")
    ? toDecimal(payload.actual_cost)
    : currentActualCost;
  const nextResidualValue = Object.prototype.hasOwnProperty.call(payload, "residual_value")
    ? toDecimal(payload.residual_value)
    : currentResidualValue;
  const nextBookValue = Object.prototype.hasOwnProperty.call(payload, "actual_book_value")
    ? toDecimal(payload.actual_book_value)
    : currentBookValue;
  const nextCumulativeDep = Object.prototype.hasOwnProperty.call(payload, "cumulative_depreciation_value")
    ? toDecimal(payload.cumulative_depreciation_value)
    : currentCumulativeDep;

  const nextPurchaseOrderNumber = Object.prototype.hasOwnProperty.call(payload, "purchase_order_number")
    ? normalizeString(payload.purchase_order_number)
    : current.purchase_order_number;

  const nextTransactionNumber = Object.prototype.hasOwnProperty.call(payload, "transaction_number")
    ? normalizeString(payload.transaction_number)
    : current.transaction_number;

  let nextProviderId = current.provider_id;
  if (Object.prototype.hasOwnProperty.call(payload, "provider_id")) {
    const value = payload.provider_id;
    if (value === null || value === "") {
      nextProviderId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Proveedor inválido");
      await ensureExists("providers", candidate, "Proveedor no encontrado");
      nextProviderId = candidate;
    }
  }

  let nextDepartmentId = current.department_id;
  if (Object.prototype.hasOwnProperty.call(payload, "department_id")) {
    const value = payload.department_id;
    if (value === null || value === "") {
      nextDepartmentId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Departamento inválido");
      await ensureExists("departments", candidate, "Departamento no encontrado");
      nextDepartmentId = candidate;
    }
  }

  let nextCostCenterId = current.cost_center_id;
  if (Object.prototype.hasOwnProperty.call(payload, "cost_center_id")) {
    const value = payload.cost_center_id;
    if (value === null || value === "") {
      nextCostCenterId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Centro de costos inválido");
      await ensureExists("cost_centers", candidate, "Centro de costos no encontrado");
      nextCostCenterId = candidate;
    }
  }

  let nextLocationId = current.location_id;
  if (Object.prototype.hasOwnProperty.call(payload, "location_id")) {
    const value = payload.location_id;
    if (value === null || value === "") {
      nextLocationId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Ubicación inválida");
      await ensureExists("locations", candidate, "Ubicación no encontrada");
      nextLocationId = candidate;
    }
  }

  let nextResponsibleId = current.responsible_id;
  if (Object.prototype.hasOwnProperty.call(payload, "responsible_id")) {
    const value = payload.responsible_id;
    if (value === null || value === "") {
      nextResponsibleId = null;
    } else {
      const candidate = String(value);
      if (!isUuid(candidate)) return badRequest("Responsable inválido");
      await ensureExists("responsibles", candidate, "Responsable no encontrado");
      nextResponsibleId = candidate;
    }
  }

  let nextAdditionalAttributes = current.additional_attributes;
  if (Object.prototype.hasOwnProperty.call(payload, "additional_attributes")) {
    nextAdditionalAttributes = parseAdditionalAttributes(payload.additional_attributes);
  }

  try {
    const { rows } = await query`
      UPDATE assets
      SET
        asset_tag = ${nextAssetTag},
        name = ${nextName},
        description = ${nextDescription},
        alternative_number = ${nextAlternativeNumber},
        parent_asset_id = ${nextParentAssetId},
        asset_category_id = ${nextAssetCategoryId},
        asset_status_id = ${nextAssetStatusId},
        depreciation_method_id = ${nextDepreciationMethodId},
        lifespan_months = ${nextLifespanMonths},
        depreciation_period = ${nextDepreciationPeriod},
        initial_cost = ${nextInitialCost},
        actual_cost = ${nextActualCost},
        residual_value = ${nextResidualValue},
        actual_book_value = ${nextBookValue},
        cumulative_depreciation_value = ${nextCumulativeDep},
        purchase_order_number = ${nextPurchaseOrderNumber},
        transaction_number = ${nextTransactionNumber},
        provider_id = ${nextProviderId},
        department_id = ${nextDepartmentId},
        cost_center_id = ${nextCostCenterId},
        location_id = ${nextLocationId},
        responsible_id = ${nextResponsibleId},
        updated_by = ${userId},
        updated_at = NOW(),
        additional_attributes = ${nextAdditionalAttributes}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) return notFound("Activo no encontrado");
    const asset = await fetchAsset(rows[0].id);
    return success({ asset: serializeAsset(asset) });
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El número de activo ya existe");
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Id de activo inválido");

  const { rows: childRows } = await query`
    SELECT 1
    FROM assets
    WHERE parent_asset_id = ${id}
    LIMIT 1
  `;
  if (childRows.length) {
    return badRequest("El activo tiene activos dependientes y no puede eliminarse");
  }

  const { rows } = await query`
    DELETE FROM assets
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Activo no encontrado");
  return success({ deleted: rows[0].id });
}
