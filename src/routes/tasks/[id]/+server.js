import { success, badRequest, notFound } from '../../../lib/response.js';
import { query } from '../../../lib/db.js';
import { requireRole } from '../../../lib/rbac.js';
import { clearMenuCache } from '../../../lib/menu.js';
import {
  isUuid,
  normalizeString,
  toInteger,
  sanitizeKey,
  toBoolean
} from '../../../lib/validators.js';

function serializeTask(row) {
  return {
    id: row.id,
    menu_group_id: row.menu_group_id,
    menu_group_key: row.menu_group_key || null,
    menu_group_title: row.menu_group_title || null,
    key: row.key,
    title: row.title,
    description: row.description,
    route: row.route,
    ord: row.ord == null ? null : Number(row.ord),
    active: row.active,
  };
}

async function fetchTask(id) {
  const { rows } = await query`
    SELECT t.id, t.menu_group_id, t.key, t.title, t.description, t.route, t.ord, t.active,
           mg.key AS menu_group_key, mg.title AS menu_group_title
    FROM tasks t
    LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
    WHERE t.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid task id');

  const task = await fetchTask(id);
  if (!task) return notFound('Task not found');
  return success({ task: serializeTask(task) });
}

export async function PATCH(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid task id');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const menuGroupProvided = payload?.menu_group_id !== undefined;
  const keyProvided = payload?.key !== undefined;
  const titleProvided = payload?.title !== undefined;
  const descriptionProvided = payload?.description !== undefined;
  const routeProvided = payload?.route !== undefined;
  const ordProvided = payload?.ord !== undefined;
  const activeProvided = payload?.active !== undefined;

  if (
    !menuGroupProvided &&
    !keyProvided &&
    !titleProvided &&
    !descriptionProvided &&
    !routeProvided &&
    !ordProvided &&
    !activeProvided
  ) {
    return badRequest('Nothing to update');
  }

  const current = await fetchTask(id);
  if (!current) return notFound('Task not found');

  let nextMenuGroupId = current.menu_group_id;
  if (menuGroupProvided) {
    const menuGroupIdRaw = payload.menu_group_id ? String(payload.menu_group_id) : null;
    if (!menuGroupIdRaw || !isUuid(menuGroupIdRaw)) return badRequest('Valid menu_group_id is required');
    const menuGroupRes = await query`
      SELECT id, key, title
      FROM menu_groups
      WHERE id = ${menuGroupIdRaw}
      LIMIT 1
    `;
    if (!menuGroupRes.rows.length) return badRequest('Menu group not found');
    nextMenuGroupId = menuGroupRes.rows[0].id;
  }

  let nextKey = current.key;
  if (keyProvided) {
    const sanitized = sanitizeKey(payload.key);
    if (!sanitized) return badRequest('Task key must be alphanumeric');
    nextKey = sanitized;
  }

  let nextTitle = current.title;
  if (titleProvided) {
    const normalized = normalizeString(payload.title);
    if (!normalized) return badRequest('Task title is required');
    nextTitle = normalized;
  }

  const nextDescription = descriptionProvided ? normalizeString(payload.description) : current.description;
  const nextRoute = routeProvided ? normalizeString(payload.route) : current.route;

  let nextOrd = current.ord;
  if (ordProvided) {
    const parsed = toInteger(payload.ord, null);
    if (parsed === null) return badRequest('ord must be an integer');
    nextOrd = parsed;
  }

  let nextActive = current.active;
  if (activeProvided) {
    const parsed = toBoolean(payload.active, null);
    if (parsed === null) return badRequest('active must be boolean');
    nextActive = parsed;
  }

  if (nextMenuGroupId !== current.menu_group_id || nextKey !== current.key) {
    const dup = await query`
      SELECT 1
      FROM tasks
      WHERE menu_group_id = ${nextMenuGroupId}
        AND key = ${nextKey}
        AND id <> ${id}
      LIMIT 1
    `;
    if (dup.rows.length) return badRequest('Task key already exists in this menu group');
  }

  try {
    const { rows } = await query`
      UPDATE tasks
      SET
        menu_group_id = ${nextMenuGroupId},
        key = ${nextKey},
        title = ${nextTitle},
        description = ${nextDescription},
        route = ${nextRoute},
        ord = ${nextOrd},
        active = ${nextActive}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) return notFound('Task not found');
    const updated = await fetchTask(id);
    clearMenuCache();
    return success({ task: serializeTask(updated) });
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Task key already exists in this menu group');
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid task id');

  const { rows } = await query`
    DELETE FROM tasks
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound('Task not found');
  clearMenuCache();
  return success({ deleted: rows[0].id });
}
