import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey, toBoolean } from "../../lib/validators.js";

function serializeStatus(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    is_active: row.is_active,
  };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT id, code, name, is_active
    FROM asset_statuses
    ORDER BY name
  `;
  return success({ asset_statuses: rows.map(serializeStatus) });
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

  const isActive = toBoolean(payload?.is_active, true);

  try {
    const { rows } = await query`
      INSERT INTO asset_statuses (code, name, is_active)
      VALUES (${code}, ${name}, ${isActive})
      RETURNING id, code, name, is_active
    `;
    return success({ asset_status: serializeStatus(rows[0]) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
