import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { clearMenuCache } from "../../lib/menu.js";
import { normalizeString, toInteger, sanitizeKey, toBoolean } from "../../lib/validators.js";

function serializeMenuGroup(row) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    ord: row.ord == null ? null : Number(row.ord),
    active: row.active,
  };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT id, key, title, description, ord, active
    FROM menu_groups
    ORDER BY ord, title
  `;
  return success({ menu_groups: rows.map(serializeMenuGroup) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const key = sanitizeKey(payload?.key);
  if (!key) return badRequest("Menu group key must be alphanumeric");

  const title = normalizeString(payload?.title);
  if (!title) return badRequest("Menu group title is required");

  const description = normalizeString(payload?.description);

  let ord = 100;
  if (payload?.ord !== undefined) {
    const parsed = toInteger(payload.ord, null);
    if (parsed === null) return badRequest("ord must be an integer");
    ord = parsed;
  }

  let active = true;
  if (payload?.active !== undefined) {
    const parsed = toBoolean(payload.active, null);
    if (parsed === null) return badRequest("active must be boolean");
    active = parsed;
  }

  try {
    const { rows } = await query`
      INSERT INTO menu_groups (key, title, description, ord, active)
      VALUES (${key}, ${title}, ${description}, ${ord}, ${active})
      RETURNING id, key, title, description, ord, active
    `;
    clearMenuCache();
    return success({ menu_group: serializeMenuGroup(rows[0]) }, {}, 201);
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("Menu group key already exists");
    }
    throw err;
  }
}
