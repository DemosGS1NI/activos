import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { clearMenuCache } from "../../../lib/menu.js";
import { isUuid, normalizeString, toInteger, sanitizeKey, toBoolean } from "../../../lib/validators.js";

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

async function fetchMenuGroup(id) {
  const { rows } = await query`
    SELECT id, key, title, description, ord, active
    FROM menu_groups
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Invalid menu group id");

  const menuGroup = await fetchMenuGroup(id);
  if (!menuGroup) return notFound("Menu group not found");
  return success({ menu_group: serializeMenuGroup(menuGroup) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Invalid menu group id");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const keyProvided = payload?.key !== undefined;
  const titleProvided = payload?.title !== undefined;
  const descriptionProvided = payload?.description !== undefined;
  const ordProvided = payload?.ord !== undefined;
  const activeProvided = payload?.active !== undefined;

  if (!keyProvided && !titleProvided && !descriptionProvided && !ordProvided && !activeProvided) {
    return badRequest("Nothing to update");
  }

  const current = await fetchMenuGroup(id);
  if (!current) return notFound("Menu group not found");

  let nextKey = current.key;
  if (keyProvided) {
    const sanitized = sanitizeKey(payload.key);
    if (!sanitized) return badRequest("Menu group key must be alphanumeric");
    nextKey = sanitized;
  }

  let nextTitle = current.title;
  if (titleProvided) {
    const normalized = normalizeString(payload.title);
    if (!normalized) return badRequest("Menu group title is required");
    nextTitle = normalized;
  }

  const nextDescription = descriptionProvided ? normalizeString(payload.description) : current.description;

  let nextOrd = current.ord;
  if (ordProvided) {
    const parsed = toInteger(payload.ord, null);
    if (parsed === null) return badRequest("ord must be an integer");
    nextOrd = parsed;
  }

  let nextActive = current.active;
  if (activeProvided) {
    const parsed = toBoolean(payload.active, null);
    if (parsed === null) return badRequest("active must be boolean");
    nextActive = parsed;
  }

  try {
    const { rows } = await query`
      UPDATE menu_groups
      SET
        key = ${nextKey},
        title = ${nextTitle},
        description = ${nextDescription},
        ord = ${nextOrd},
        active = ${nextActive}
      WHERE id = ${id}
      RETURNING id, key, title, description, ord, active
    `;
    if (!rows.length) return notFound("Menu group not found");
    clearMenuCache();
    return success({ menu_group: serializeMenuGroup(rows[0]) });
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("Menu group key already exists");
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Invalid menu group id");

  const { rows } = await query`
    DELETE FROM menu_groups
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Menu group not found");
  clearMenuCache();
  return success({ deleted: rows[0].id });
}
