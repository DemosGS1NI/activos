import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey } from "../../../lib/validators.js";

function serializeMethod(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    formula_notes: row.formula_notes || null,
    default_period: row.default_period || null,
  };
}

async function fetchMethod(id) {
  const { rows } = await query`
    SELECT id, code, name, description, formula_notes, default_period
    FROM depreciation_methods
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const method = await fetchMethod(id);
  if (!method) return notFound("Método no encontrado");
  return success({ depreciation_method: serializeMethod(method) });
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
  const descriptionProvided = payload?.description !== undefined;
  const notesProvided = payload?.formula_notes !== undefined;
  const periodProvided = payload?.default_period !== undefined;

  if (
    !codeProvided &&
    !nameProvided &&
    !descriptionProvided &&
    !notesProvided &&
    !periodProvided
  ) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchMethod(id);
  if (!current) return notFound("Método no encontrado");

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

  const nextDescription = descriptionProvided
    ? normalizeString(payload.description)
    : current.description;
  const nextFormulaNotes = notesProvided
    ? normalizeString(payload.formula_notes)
    : current.formula_notes;
  const nextDefaultPeriod = periodProvided
    ? normalizeString(payload.default_period)
    : current.default_period;

  try {
    const { rows } = await query`
      UPDATE depreciation_methods
      SET code = ${nextCode},
          name = ${nextName},
          description = ${nextDescription},
          formula_notes = ${nextFormulaNotes},
          default_period = ${nextDefaultPeriod},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, description, formula_notes, default_period
    `;
    if (!rows.length) return notFound("Método no encontrado");
    return success({ depreciation_method: serializeMethod(rows[0]) });
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
    DELETE FROM depreciation_methods
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Método no encontrado");
  return success({ deleted: rows[0].id });
}
