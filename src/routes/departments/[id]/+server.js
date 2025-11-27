import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey } from "../../../lib/validators.js";

function serializeDepartment(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parent_id: row.parent_id,
    parent_name: row.parent_name || null,
  };
}

async function fetchDepartment(id) {
  const { rows } = await query`
    SELECT d.id,
           d.code,
           d.name,
           d.parent_id,
           p.name AS parent_name
    FROM departments d
    LEFT JOIN departments p ON p.id = d.parent_id
    WHERE d.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function validateParent(id, candidate) {
  if (!candidate) return { value: null };
  if (!isUuid(candidate)) {
    return { error: badRequest("El departamento padre es inválido") };
  }
  if (candidate === id) {
    return {
      error: badRequest("El departamento no puede ser su propio padre"),
    };
  }
  const { rows } = await query`
    SELECT id FROM departments WHERE id = ${candidate} LIMIT 1
  `;
  if (!rows.length) {
    return { error: badRequest("El departamento padre no existe") };
  }
  return { value: candidate };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const department = await fetchDepartment(id);
  if (!department) return notFound("Departamento no encontrado");
  return success({ department: serializeDepartment(department) });
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
  const parentProvided = payload?.parent_id !== undefined;

  if (!codeProvided && !nameProvided && !parentProvided) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchDepartment(id);
  if (!current) return notFound("Departamento no encontrado");

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

  let nextParentId = current.parent_id;
  if (parentProvided) {
    if (!payload.parent_id) {
      nextParentId = null;
    } else {
      const validation = await validateParent(id, payload.parent_id);
      if (validation.error) return validation.error;
      nextParentId = validation.value;
    }
  }

  try {
    const { rows } = await query`
      UPDATE departments
      SET code = ${nextCode},
          name = ${nextName},
          parent_id = ${nextParentId},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, parent_id
    `;
    if (!rows.length) return notFound("Departamento no encontrado");

    const updated = rows[0];
    let parentName = null;
    if (updated.parent_id) {
      const { rows: parentRows } = await query`
        SELECT name FROM departments WHERE id = ${updated.parent_id} LIMIT 1
      `;
      parentName = parentRows[0]?.name || null;
    }

    return success({
      department: serializeDepartment({ ...updated, parent_name: parentName }),
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
    DELETE FROM departments
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Departamento no encontrado");
  return success({ deleted: rows[0].id });
}
