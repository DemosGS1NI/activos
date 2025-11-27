import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey } from "../../../lib/validators.js";

function serializeDocumentType(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
  };
}

async function fetchDocumentType(id) {
  const { rows } = await query`
    SELECT id, code, name, description
    FROM document_types
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const docType = await fetchDocumentType(id);
  if (!docType) return notFound("Tipo de documento no encontrado");
  return success({ document_type: serializeDocumentType(docType) });
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

  if (!codeProvided && !nameProvided && !descriptionProvided) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchDocumentType(id);
  if (!current) return notFound("Tipo de documento no encontrado");

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

  try {
    const { rows } = await query`
      UPDATE document_types
      SET code = ${nextCode},
          name = ${nextName},
          description = ${nextDescription},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, description
    `;
    if (!rows.length) return notFound("Tipo de documento no encontrado");
    return success({ document_type: serializeDocumentType(rows[0]) });
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
    DELETE FROM document_types
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Tipo de documento no encontrado");
  return success({ deleted: rows[0].id });
}
