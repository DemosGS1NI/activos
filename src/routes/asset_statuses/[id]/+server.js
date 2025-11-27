import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey, toBoolean } from "../../../lib/validators.js";

function serializeStatus(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    is_active: row.is_active,
  };
}

async function fetchStatus(id) {
  const { rows } = await query`
    SELECT id, code, name, is_active
    FROM asset_statuses
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const status = await fetchStatus(id);
  if (!status) return notFound("Estado de activo no encontrado");
  return success({ asset_status: serializeStatus(status) });
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

  const codeProvided = payload?.code !== undefined;
  const nameProvided = payload?.name !== undefined;
  const isActiveProvided = payload?.is_active !== undefined;

  if (!codeProvided && !nameProvided && !isActiveProvided) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchStatus(id);
  if (!current) return notFound("Estado de activo no encontrado");

  let nextCode = current.code;
  if (codeProvided) {
    const sanitized = sanitizeKey(payload.code);
    if (!sanitized) return badRequest("El código debe ser alfanumérico");
    nextCode = sanitized;
  }

  let nextName = current.name;
  if (nameProvided) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre es requerido");
    nextName = normalized;
  }

  const nextIsActive = isActiveProvided
    ? toBoolean(payload.is_active, current.is_active)
    : current.is_active;

  try {
    const { rows } = await query`
      UPDATE asset_statuses
      SET code = ${nextCode},
          name = ${nextName},
          is_active = ${nextIsActive},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, is_active
    `;
    if (!rows.length) return notFound("Estado de activo no encontrado");
    return success({ asset_status: serializeStatus(rows[0]) });
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

  const { rows } = await query`
    DELETE FROM asset_statuses
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Estado de activo no encontrado");
  return success({ deleted: rows[0].id });
}
