import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey } from "../../lib/validators.js";

function serializeDocumentType(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
  };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT id, code, name, description
    FROM document_types
    ORDER BY name
  `;
  return success({ document_types: rows.map(serializeDocumentType) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const code = sanitizeKey(payload?.code);
  if (!code) return badRequest("El código debe ser alfanumérico");

  const name = normalizeString(payload?.name);
  if (!name) return badRequest("El nombre es requerido");

  const description = normalizeString(payload?.description);

  try {
    const { rows } = await query`
      INSERT INTO document_types (code, name, description)
      VALUES (${code}, ${name}, ${description})
      RETURNING id, code, name, description
    `;
    return success({ document_type: serializeDocumentType(rows[0]) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
