import { success, badRequest, notFound } from '../../lib/response.js';
import { query } from '../../lib/db.js';
import { requireRole } from '../../lib/rbac.js';
import { clearMenuCache } from '../../lib/menu.js';
import { isUuid } from '../../lib/validators.js';

function serializeMapping(row) {
  return {
    role_id: row.role_id,
    role_name: row.role_name || null,
    task_id: row.task_id,
    task_key: row.task_key || null,
    task_title: row.task_title || null,
    menu_group_id: row.menu_group_id || null,
    menu_group_key: row.menu_group_key || null,
    menu_group_title: row.menu_group_title || null,
  };
}

async function fetchMappings({ roleId = null, taskId = null } = {}) {
  if (roleId && taskId) {
    const { rows } = await query`
      SELECT rt.role_id, r.name AS role_name,
             rt.task_id, t.key AS task_key, t.title AS task_title,
             t.menu_group_id, mg.key AS menu_group_key, mg.title AS menu_group_title
      FROM role_tasks rt
      LEFT JOIN roles r ON r.id = rt.role_id
      LEFT JOIN tasks t ON t.id = rt.task_id
      LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
      WHERE rt.role_id = ${roleId} AND rt.task_id = ${taskId}
      ORDER BY t.title
    `;
    return rows;
  }

  if (roleId) {
    const { rows } = await query`
      SELECT rt.role_id, r.name AS role_name,
             rt.task_id, t.key AS task_key, t.title AS task_title,
             t.menu_group_id, mg.key AS menu_group_key, mg.title AS menu_group_title
      FROM role_tasks rt
      LEFT JOIN roles r ON r.id = rt.role_id
      LEFT JOIN tasks t ON t.id = rt.task_id
      LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
      WHERE rt.role_id = ${roleId}
      ORDER BY t.title
    `;
    return rows;
  }

  if (taskId) {
    const { rows } = await query`
      SELECT rt.role_id, r.name AS role_name,
             rt.task_id, t.key AS task_key, t.title AS task_title,
             t.menu_group_id, mg.key AS menu_group_key, mg.title AS menu_group_title
      FROM role_tasks rt
      LEFT JOIN roles r ON r.id = rt.role_id
      LEFT JOIN tasks t ON t.id = rt.task_id
      LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
      WHERE rt.task_id = ${taskId}
      ORDER BY r.name
    `;
    return rows;
  }

  const { rows } = await query`
    SELECT rt.role_id, r.name AS role_name,
           rt.task_id, t.key AS task_key, t.title AS task_title,
           t.menu_group_id, mg.key AS menu_group_key, mg.title AS menu_group_title
    FROM role_tasks rt
    LEFT JOIN roles r ON r.id = rt.role_id
    LEFT JOIN tasks t ON t.id = rt.task_id
    LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
    ORDER BY r.name, t.title
  `;
  return rows;
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const params = event.url.searchParams;
  const roleIdRaw = params.get('role_id');
  const taskIdRaw = params.get('task_id');

  let roleId = null;
  if (roleIdRaw) {
    if (!isUuid(roleIdRaw)) return badRequest('Invalid role_id');
    roleId = roleIdRaw;
  }

  let taskId = null;
  if (taskIdRaw) {
    if (!isUuid(taskIdRaw)) return badRequest('Invalid task_id');
    taskId = taskIdRaw;
  }

  const rows = await fetchMappings({ roleId, taskId });
  return success({ mappings: rows.map(serializeMapping) });
}

export async function POST(event) {
  await requireRole(event, 'admin');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const roleIdRaw = payload?.role_id ? String(payload.role_id) : null;
  if (!roleIdRaw || !isUuid(roleIdRaw)) return badRequest('Valid role_id is required');
  const roleRes = await query`
    SELECT id, name
    FROM roles
    WHERE id = ${roleIdRaw}
    LIMIT 1
  `;
  if (!roleRes.rows.length) return badRequest('Role not found');

  const taskIdRaw = payload?.task_id ? String(payload.task_id) : null;
  if (!taskIdRaw || !isUuid(taskIdRaw)) return badRequest('Valid task_id is required');
  const taskRes = await query`
    SELECT t.id, t.key, t.title, t.menu_group_id, mg.key AS menu_group_key, mg.title AS menu_group_title
    FROM tasks t
    LEFT JOIN menu_groups mg ON mg.id = t.menu_group_id
    WHERE t.id = ${taskIdRaw}
    LIMIT 1
  `;
  if (!taskRes.rows.length) return badRequest('Task not found');

  const insertRes = await query`
    INSERT INTO role_tasks (role_id, task_id)
    VALUES (${roleRes.rows[0].id}, ${taskRes.rows[0].id})
    ON CONFLICT DO NOTHING
    RETURNING role_id, task_id
  `;

  if (!insertRes.rows.length) {
    return badRequest('Mapping already exists');
  }

  clearMenuCache(roleRes.rows[0].id);

  return success(
    {
      mapping: serializeMapping({
        role_id: roleRes.rows[0].id,
        role_name: roleRes.rows[0].name,
        task_id: taskRes.rows[0].id,
        task_key: taskRes.rows[0].key,
        task_title: taskRes.rows[0].title,
        menu_group_id: taskRes.rows[0].menu_group_id,
        menu_group_key: taskRes.rows[0].menu_group_key,
        menu_group_title: taskRes.rows[0].menu_group_title,
      })
    },
    {},
    201
  );
}

export async function DELETE(event) {
  await requireRole(event, 'admin');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const roleIdRaw = payload?.role_id ? String(payload.role_id) : null;
  if (!roleIdRaw || !isUuid(roleIdRaw)) return badRequest('Valid role_id is required');

  const taskIdRaw = payload?.task_id ? String(payload.task_id) : null;
  if (!taskIdRaw || !isUuid(taskIdRaw)) return badRequest('Valid task_id is required');

  const { rows } = await query`
    DELETE FROM role_tasks
    WHERE role_id = ${roleIdRaw} AND task_id = ${taskIdRaw}
    RETURNING role_id, task_id
  `;
  if (!rows.length) return notFound('Mapping not found');

  clearMenuCache(roleIdRaw);
  return success({ deleted: { role_id: rows[0].role_id, task_id: rows[0].task_id } });
}
