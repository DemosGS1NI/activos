import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { normalizeString, sanitizeKey, toBoolean, toInteger } from "../../../lib/validators.js";

function serializeCondition(row) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    severity: row.severity,
    description: row.description,
    active: row.active,
  };
}

function parseId(param) {
  const parsed = Number.parseInt(param, 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  return parsed;
}

async function fetchCondition(id) {
  const { rows } = await query`
    SELECT id,
           slug,
           label,
           severity,
           description,
           active
    FROM inventory_conditions
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const id = parseId(event.params.id);
  if (!id) return badRequest("ID inválido");

  const condition = await fetchCondition(id);
  if (!condition) return notFound("Condición de inventario no encontrada");
  return success({ inventory_condition: serializeCondition(condition) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const id = parseId(event.params.id);
  if (!id) return badRequest("ID inválido");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const slugProvided = payload?.slug !== undefined;
  const labelProvided = payload?.label !== undefined;
  const severityProvided = payload?.severity !== undefined;
  const descriptionProvided = payload?.description !== undefined;
  const activeProvided = payload?.active !== undefined;

  if (
    !slugProvided &&
    !labelProvided &&
    !severityProvided &&
    !descriptionProvided &&
    !activeProvided
  ) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchCondition(id);
  if (!current) return notFound("Condición de inventario no encontrada");

  let nextSlug = current.slug;
  if (slugProvided) {
    const sanitized = sanitizeKey(payload.slug);
    if (!sanitized) return badRequest("El slug debe ser alfanumérico");
    nextSlug = sanitized;
  }

  let nextLabel = current.label;
  if (labelProvided) {
    const normalized = normalizeString(payload.label);
    if (!normalized) return badRequest("El nombre es requerido");
    nextLabel = normalized;
  }

  let nextSeverity = current.severity;
  if (severityProvided) {
    const severity = toInteger(payload.severity);
    if (severity === null || severity === undefined) {
      return badRequest("La severidad es requerida");
    }
    if (severity < 0 || severity > 10) {
      return badRequest("La severidad debe estar entre 0 y 10");
    }
    nextSeverity = severity;
  }

  let nextDescription = current.description;
  if (descriptionProvided) {
    nextDescription = normalizeString(payload.description);
  }

  const nextActive = activeProvided
    ? toBoolean(payload.active, current.active)
    : current.active;

  try {
    const { rows } = await query`
      UPDATE inventory_conditions
      SET slug = ${nextSlug},
          label = ${nextLabel},
          severity = ${nextSeverity},
          description = ${nextDescription},
          active = ${nextActive},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, slug, label, severity, description, active
    `;
    if (!rows.length) {
      return notFound("Condición de inventario no encontrada");
    }
    return success({ inventory_condition: serializeCondition(rows[0]) });
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El slug ya existe");
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const id = parseId(event.params.id);
  if (!id) return badRequest("ID inválido");

  const { rows } = await query`
    DELETE FROM inventory_conditions
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Condición de inventario no encontrada");
  return success({ deleted: rows[0].id });
}
