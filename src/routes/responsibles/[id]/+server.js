import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { normalizeString, validateEmail, isUuid } from "../../../lib/validators.js";

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

async function fetchResponsible(id) {
  const { rows } = await query`
    SELECT r.id,
           r.name,
           r.email,
           r.phone,
           r.department_id,
           d.name AS department_name
    FROM responsibles r
    LEFT JOIN departments d ON d.id = r.department_id
    WHERE r.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function validateDepartment(candidate) {
  if (!candidate) return { value: null };
  if (!isUuid(candidate)) {
    return { error: badRequest("El departamento es inválido") };
  }
  const { rows } = await query`
    SELECT id FROM departments WHERE id = ${candidate} LIMIT 1
  `;
  if (!rows.length) {
    return { error: badRequest("El departamento no existe") };
  }
  return { value: candidate };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const responsible = await fetchResponsible(id);
  if (!responsible) return notFound("Responsable no encontrado");
  return success({ responsible: serializeResponsible(responsible) });
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

  const nameProvided = payload?.name !== undefined;
  const emailProvided = payload?.email !== undefined;
  const phoneProvided = payload?.phone !== undefined;
  const departmentProvided = payload?.department_id !== undefined;

  if (!nameProvided && !emailProvided && !phoneProvided && !departmentProvided) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchResponsible(id);
  if (!current) return notFound("Responsable no encontrado");

  let nextName = current.name;
  if (nameProvided) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre es requerido");
    nextName = normalized;
  }

  let nextEmail = current.email;
  if (emailProvided) {
    const normalized = normalizeString(payload.email);
    if (normalized && !validateEmail(normalized)) {
      return badRequest("El correo electrónico es inválido");
    }
    nextEmail = normalized;
  }

  let nextPhone = current.phone;
  if (phoneProvided) {
    nextPhone = normalizeString(payload.phone);
  }

  let nextDepartmentId = current.department_id;
  if (departmentProvided) {
    if (!payload.department_id) {
      nextDepartmentId = null;
    } else {
      const validation = await validateDepartment(payload.department_id);
      if (validation.error) return validation.error;
      nextDepartmentId = validation.value;
    }
  }

  const { rows } = await query`
    UPDATE responsibles
    SET name = ${nextName},
        email = ${nextEmail},
        phone = ${nextPhone},
        department_id = ${nextDepartmentId},
        updated_at = now()
    WHERE id = ${id}
    RETURNING id, name, email, phone, department_id
  `;

  if (!rows.length) return notFound("Responsable no encontrado");

  const updated = rows[0];
  let departmentName = null;
  if (updated.department_id) {
    const { rows: dRows } = await query`
      SELECT name FROM departments WHERE id = ${updated.department_id} LIMIT 1
    `;
    departmentName = dRows[0]?.name || null;
  }

  return success({
    responsible: serializeResponsible({
      ...updated,
      department_name: departmentName,
    }),
  });
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const { rows } = await query`
    DELETE FROM responsibles
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Responsable no encontrado");
  return success({ deleted: rows[0].id });
}
