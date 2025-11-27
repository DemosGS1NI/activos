import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey, isUuid } from "../../lib/validators.js";

function serializeDepartment(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parent_id: row.parent_id,
    parent_name: row.parent_name || null,
  };
}

async function ensureParentExists(parentId) {
  if (!parentId) return null;
  const { rows } = await query`
    SELECT id FROM departments WHERE id = ${parentId} LIMIT 1
  `;
  return rows[0] ? parentId : null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT d.id,
           d.code,
           d.name,
           d.parent_id,
           p.name AS parent_name
    FROM departments d
    LEFT JOIN departments p ON p.id = d.parent_id
    ORDER BY d.name
  `;
  return success({ departments: rows.map(serializeDepartment) });
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

  let parentId = null;
  if (payload?.parent_id) {
    if (!isUuid(payload.parent_id)) {
      return badRequest("El departamento padre es inválido");
    }
    parentId = await ensureParentExists(payload.parent_id);
    if (!parentId) {
      return badRequest("El departamento padre no existe");
    }
  }

  try {
    const { rows } = await query`
      INSERT INTO departments (code, name, parent_id)
      VALUES (${code}, ${name}, ${parentId})
      RETURNING id, code, name, parent_id
    `;

    const created = rows[0];
    let parentName = null;
    if (created.parent_id) {
      const { rows: parentRows } = await query`
        SELECT name FROM departments WHERE id = ${created.parent_id} LIMIT 1
      `;
      parentName = parentRows[0]?.name || null;
    }

    return success(
      {
        department: serializeDepartment({ ...created, parent_name: parentName }),
      },
      {},
      201
    );
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
