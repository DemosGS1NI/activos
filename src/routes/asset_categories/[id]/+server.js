import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import {
  isUuid,
  normalizeString,
  sanitizeKey,
  toInteger,
} from "../../../lib/validators.js";

function serializeCategory(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    default_depreciation_method_id: row.default_depreciation_method_id,
    default_depreciation_method_name: row.default_depreciation_method_name || null,
    default_lifespan_months:
      row.default_lifespan_months === null || row.default_lifespan_months === undefined
        ? null
        : Number(row.default_lifespan_months),
  };
}

async function fetchCategory(id) {
  const { rows } = await query`
    SELECT ac.id,
           ac.code,
           ac.name,
           ac.description,
           ac.default_depreciation_method_id,
           ac.default_lifespan_months,
           dm.name AS default_depreciation_method_name
    FROM asset_categories ac
    LEFT JOIN depreciation_methods dm
      ON dm.id = ac.default_depreciation_method_id
    WHERE ac.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const category = await fetchCategory(id);
  if (!category) return notFound("Categoría de activo no encontrada");
  return success({ asset_category: serializeCategory(category) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  if (
    payload?.code === undefined &&
    payload?.name === undefined &&
    payload?.description === undefined &&
    payload?.default_depreciation_method_id === undefined &&
    payload?.default_lifespan_months === undefined
  ) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchCategory(id);
  if (!current) return notFound("Categoría de activo no encontrada");

  let nextCode = current.code;
  if (payload?.code !== undefined) {
    const sanitized = sanitizeKey(payload.code);
    if (!sanitized) return badRequest("El código debe ser alfanumérico");
    nextCode = sanitized;
  }

  let nextName = current.name;
  if (payload?.name !== undefined) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre es requerido");
    nextName = normalized;
  }

  const nextDescription =
    payload?.description !== undefined
      ? normalizeString(payload.description)
      : current.description;

  let nextMethodId = current.default_depreciation_method_id;
  if (payload?.default_depreciation_method_id !== undefined) {
    const raw = payload.default_depreciation_method_id;
    if (raw === null || raw === "") {
      nextMethodId = null;
    } else {
      const candidate = String(raw);
      if (!isUuid(candidate)) return badRequest("Método de depreciación inválido");
      const methodLookup = await query`
        SELECT id FROM depreciation_methods
        WHERE id = ${candidate}
        LIMIT 1
      `;
      if (!methodLookup.rows.length) {
        return badRequest("Método de depreciación no encontrado");
      }
      nextMethodId = candidate;
    }
  }

  let nextLifespan = current.default_lifespan_months;
  if (payload?.default_lifespan_months !== undefined) {
    const raw = payload.default_lifespan_months;
    if (raw === null || raw === "") {
      nextLifespan = null;
    } else {
      const parsed = toInteger(raw, null);
      if (parsed === null || parsed <= 0) {
        return badRequest("La vida útil debe ser un número entero positivo");
      }
      nextLifespan = parsed;
    }
  }

  try {
    const { rows } = await query`
      UPDATE asset_categories
      SET code = ${nextCode},
          name = ${nextName},
          description = ${nextDescription},
          default_depreciation_method_id = ${nextMethodId},
          default_lifespan_months = ${nextLifespan},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) return notFound("Categoría de activo no encontrada");
    const category = await fetchCategory(rows[0].id);
    return success({ asset_category: serializeCategory(category) });
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  try {
    const { rows } = await query`
      DELETE FROM asset_categories
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) return notFound("Categoría de activo no encontrada");
    return success({ deleted: rows[0].id });
  } catch (err) {
    if (err?.code === "23503") {
      return badRequest("No se puede eliminar la categoría porque está en uso");
    }
    throw err;
  }
}
