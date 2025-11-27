import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import {
  normalizeString,
  sanitizeKey,
  toInteger,
  isUuid,
} from "../../lib/validators.js";

function serializeCategory(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    default_depreciation_method_id: row.default_depreciation_method_id,
    default_depreciation_method_name: row.default_depreciation_method_name || null,
    default_lifespan_months:
      row.default_lifespan_months === null || row.default_lifespan_months === undefined
        ? null
        : Number(row.default_lifespan_months),
  };
}

async function fetchCategory(id) {
  const { rows } = await query`
    SELECT ac.id,
           ac.code,
           ac.name,
           ac.description,
           ac.default_depreciation_method_id,
           ac.default_lifespan_months,
           dm.name AS default_depreciation_method_name
    FROM asset_categories ac
    LEFT JOIN depreciation_methods dm
      ON dm.id = ac.default_depreciation_method_id
    WHERE ac.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT ac.id,
           ac.code,
           ac.name,
           ac.description,
           ac.default_depreciation_method_id,
           ac.default_lifespan_months,
           dm.name AS default_depreciation_method_name
    FROM asset_categories ac
    LEFT JOIN depreciation_methods dm
      ON dm.id = ac.default_depreciation_method_id
    ORDER BY ac.name
  `;
  return success({ asset_categories: rows.map(serializeCategory) });
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

  let defaultMethodId = null;
  if (payload?.default_depreciation_method_id) {
    const candidate = String(payload.default_depreciation_method_id);
    if (!isUuid(candidate)) return badRequest("Método de depreciación inválido");
    const methodLookup = await query`
      SELECT id FROM depreciation_methods
      WHERE id = ${candidate}
      LIMIT 1
    `;
    if (!methodLookup.rows.length) {
      return badRequest("Método de depreciación no encontrado");
    }
    defaultMethodId = candidate;
  }

  let defaultLifespan = null;
  if (payload?.default_lifespan_months !== undefined && payload?.default_lifespan_months !== null && payload?.default_lifespan_months !== "") {
    const parsed = toInteger(payload.default_lifespan_months, null);
    if (parsed === null || parsed <= 0) {
      return badRequest("La vida útil debe ser un número entero positivo");
    }
    defaultLifespan = parsed;
  }

  try {
    const { rows } = await query`
      INSERT INTO asset_categories (
        code,
        name,
        description,
        default_depreciation_method_id,
        default_lifespan_months
      )
      VALUES (${code}, ${name}, ${description}, ${defaultMethodId}, ${defaultLifespan})
      RETURNING id
    `;
    const category = await fetchCategory(rows[0].id);
    return success({ asset_category: serializeCategory(category) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
