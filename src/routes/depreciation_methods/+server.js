import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey } from "../../lib/validators.js";

function serializeMethod(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    formula_notes: row.formula_notes || null,
    default_period: row.default_period || null,
  };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT id, code, name, description, formula_notes, default_period
    FROM depreciation_methods
    ORDER BY name
  `;
  return success({ depreciation_methods: rows.map(serializeMethod) });
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
  const formulaNotes = normalizeString(payload?.formula_notes);
  const defaultPeriod = normalizeString(payload?.default_period);

  try {
    const { rows } = await query`
      INSERT INTO depreciation_methods (code, name, description, formula_notes, default_period)
      VALUES (${code}, ${name}, ${description}, ${formulaNotes}, ${defaultPeriod})
      RETURNING id, code, name, description, formula_notes, default_period
    `;
    return success({ depreciation_method: serializeMethod(rows[0]) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
