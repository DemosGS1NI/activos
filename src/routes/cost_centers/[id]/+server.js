import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey } from "../../../lib/validators.js";

function serializeCostCenter(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    department_id: row.department_id,
    department_name: row.department_name || null,
  };
}

async function fetchCostCenter(id) {
  const { rows } = await query`
    SELECT cc.id,
           cc.code,
           cc.name,
           cc.department_id,
           d.name AS department_name
    FROM cost_centers cc
    LEFT JOIN departments d ON d.id = cc.department_id
    WHERE cc.id = ${id}
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

  const costCenter = await fetchCostCenter(id);
  if (!costCenter) return notFound("Centro de costo no encontrado");
  return success({ cost_center: serializeCostCenter(costCenter) });
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
  const departmentProvided = payload?.department_id !== undefined;

  if (!codeProvided && !nameProvided && !departmentProvided) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchCostCenter(id);
  if (!current) return notFound("Centro de costo no encontrado");

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

  try {
    const { rows } = await query`
      UPDATE cost_centers
      SET code = ${nextCode},
          name = ${nextName},
          department_id = ${nextDepartmentId},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, department_id
    `;
    if (!rows.length) return notFound("Centro de costo no encontrado");

    const updated = rows[0];
    let departmentName = null;
    if (updated.department_id) {
      const { rows: dRows } = await query`
        SELECT name FROM departments WHERE id = ${updated.department_id} LIMIT 1
      `;
      departmentName = dRows[0]?.name || null;
    }

    return success({
      cost_center: serializeCostCenter({
        ...updated,
        department_name: departmentName,
      }),
    });
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
    DELETE FROM cost_centers
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Centro de costo no encontrado");
  return success({ deleted: rows[0].id });
}
