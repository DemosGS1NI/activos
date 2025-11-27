import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey, isUuid } from "../../lib/validators.js";

function serializeCostCenter(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    department_id: row.department_id,
    department_name: row.department_name || null,
  };
}

async function findDepartment(departmentId) {
  if (!departmentId) return null;
  const { rows } = await query`
    SELECT id
    FROM departments
    WHERE id = ${departmentId}
    LIMIT 1
  `;
  return rows[0] ? departmentId : null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT cc.id,
           cc.code,
           cc.name,
           cc.department_id,
           d.name AS department_name
    FROM cost_centers cc
    LEFT JOIN departments d ON d.id = cc.department_id
    ORDER BY cc.name
  `;
  return success({ cost_centers: rows.map(serializeCostCenter) });
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

  let departmentId = null;
  if (payload?.department_id) {
    if (!isUuid(payload.department_id)) {
      return badRequest("El departamento es inválido");
    }
    departmentId = await findDepartment(payload.department_id);
    if (!departmentId) {
      return badRequest("El departamento no existe");
    }
  }

  try {
    const { rows } = await query`
      INSERT INTO cost_centers (code, name, department_id)
      VALUES (${code}, ${name}, ${departmentId})
      RETURNING id, code, name, department_id
    `;

    const created = rows[0];
    let departmentName = null;
    if (created.department_id) {
      const { rows: dRows } = await query`
        SELECT name FROM departments WHERE id = ${created.department_id} LIMIT 1
      `;
      departmentName = dRows[0]?.name || null;
    }

    return success(
      {
        cost_center: serializeCostCenter({
          ...created,
          department_name: departmentName,
        }),
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
