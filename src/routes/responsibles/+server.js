import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, validateEmail, isUuid } from "../../lib/validators.js";

function serializeResponsible(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
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
    SELECT r.id,
           r.name,
           r.email,
           r.phone,
           r.department_id,
           d.name AS department_name
    FROM responsibles r
    LEFT JOIN departments d ON d.id = r.department_id
    ORDER BY r.name
  `;
  return success({ responsibles: rows.map(serializeResponsible) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const name = normalizeString(payload?.name);
  if (!name) return badRequest("El nombre es requerido");

  const emailValue = normalizeString(payload?.email);
  if (emailValue && !validateEmail(emailValue)) {
    return badRequest("El correo electrónico es inválido");
  }

  const phoneValue = normalizeString(payload?.phone);

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

  const { rows } = await query`
    INSERT INTO responsibles (name, email, phone, department_id)
    VALUES (${name}, ${emailValue}, ${phoneValue}, ${departmentId})
    RETURNING id, name, email, phone, department_id
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
      responsible: serializeResponsible({
        ...created,
        department_name: departmentName,
      }),
    },
    {},
    201
  );
}
