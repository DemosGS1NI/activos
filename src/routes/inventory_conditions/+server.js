import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey, toBoolean, toInteger } from "../../lib/validators.js";

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

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT id,
           slug,
           label,
           severity,
           description,
           active
    FROM inventory_conditions
    ORDER BY severity ASC, label ASC
  `;
  return success({ inventory_conditions: rows.map(serializeCondition) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const slug = sanitizeKey(payload?.slug);
  if (!slug) return badRequest("El slug debe ser alfanumérico");

  const label = normalizeString(payload?.label);
  if (!label) return badRequest("El nombre es requerido");

  const severity = toInteger(payload?.severity);
  if (severity === null || severity === undefined) {
    return badRequest("La severidad es requerida");
  }
  if (severity < 0 || severity > 10) {
    return badRequest("La severidad debe estar entre 0 y 10");
  }

  const description = normalizeString(payload?.description);
  const active = toBoolean(payload?.active, true);

  try {
    const { rows } = await query`
      INSERT INTO inventory_conditions (slug, label, severity, description, active)
      VALUES (${slug}, ${label}, ${severity}, ${description}, ${active})
      RETURNING id, slug, label, severity, description, active
    `;
    return success(
      { inventory_condition: serializeCondition(rows[0]) },
      {},
      201
    );
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El slug ya existe");
    }
    throw err;
  }
}
