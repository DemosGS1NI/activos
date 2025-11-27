import { success, badRequest } from '../../lib/response.js';
import { query } from '../../lib/db.js';
import { requireRole } from '../../lib/rbac.js';
import { clearMenuCache } from '../../lib/menu.js';
import {
  normalizeString,
  toInteger,
  sanitizeKey,
  toBoolean,
  isUuid
} from '../../lib/validators.js';

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
  const { rows } = await query`
    SELECT t.id, t.menu_group_id, t.key, t.title, t.description, t.route, t.ord, t.active,
           mg.key AS menu_group_key, mg.title AS menu_group_title
    FROM tasks t
    LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
    ORDER BY mg.ord, t.ord, t.title
  `;
  return success({ tasks: rows.map(serializeTask) });
}

export async function POST(event) {
  await requireRole(event, 'admin');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const menuGroupIdRaw = payload?.menu_group_id ? String(payload.menu_group_id) : null;
  if (!menuGroupIdRaw || !isUuid(menuGroupIdRaw)) return badRequest('Valid menu_group_id is required');
  const menuGroupRes = await query`
    SELECT id, key, title
    FROM menu_groups
    WHERE id = ${menuGroupIdRaw}
    LIMIT 1
  `;
  if (!menuGroupRes.rows.length) return badRequest('Menu group not found');

  const key = sanitizeKey(payload?.key);
  if (!key) return badRequest('Task key must be alphanumeric');

  const title = normalizeString(payload?.title);
  if (!title) return badRequest('Task title is required');

  const description = normalizeString(payload?.description);
  const route = normalizeString(payload?.route);

  const duplicateCheck = await query`
    SELECT 1
    FROM tasks
    WHERE menu_group_id = ${menuGroupRes.rows[0].id}
      AND key = ${key}
    LIMIT 1
  `;
  if (duplicateCheck.rows.length) {
    return badRequest('Task key already exists in this menu group');
  }

  let ord = 100;
  if (payload?.ord !== undefined) {
    const parsed = toInteger(payload.ord, null);
    if (parsed === null) return badRequest('ord must be an integer');
    ord = parsed;
  }


  let isActive = true;
  if (payload?.active !== undefined) {
    const parsed = toBoolean(payload.active, null);
    if (parsed === null) return badRequest('active must be boolean');
    isActive = parsed;
  }

  try {
    const { rows } = await query`
      INSERT INTO tasks (menu_group_id, key, title, description, route, ord, active)
      VALUES (${menuGroupRes.rows[0].id}, ${key}, ${title}, ${description}, ${route}, ${ord}, ${isActive})
      RETURNING id
    `;
    const task = await fetchTask(rows[0].id);
    clearMenuCache();
    return success({ task: serializeTask(task) }, {}, 201);
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Task key already exists in this menu group');
    }
    throw err;
  }
}
