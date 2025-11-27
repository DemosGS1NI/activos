import { success, badRequest, notFound } from '../../../lib/response.js';
import { query } from '../../../lib/db.js';
import { requireRole } from '../../../lib/rbac.js';
import { isUuid, normalizeString } from '../../../lib/validators.js';

function serializeRole(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
  };
}

async function fetchRole(id) {
  const { rows } = await query`
    SELECT id, name, description
    FROM roles
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const { params } = event;
  const { id } = params;
  if (!isUuid(id)) return badRequest('Invalid role id');

  const role = await fetchRole(id);
  if (!role) return notFound('Role not found');
  return success({ role: serializeRole(role) });
}

export async function PATCH(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid role id');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const name = payload?.name !== undefined ? normalizeString(payload.name) : undefined;
  const description = payload?.description !== undefined ? normalizeString(payload.description) : undefined;

  if (name === undefined && description === undefined) {
    return badRequest('Nothing to update');
  }

  const current = await fetchRole(id);
  if (!current) return notFound('Role not found');

  const nextName = name !== undefined ? name : current.name;
  if (!nextName) return badRequest('Role name cannot be empty');
  const nextDescription = description !== undefined ? description : current.description;

  try {
    const { rows } = await query`
      UPDATE roles
      SET
        name = ${nextName},
        description = ${nextDescription}
      WHERE id = ${id}
      RETURNING id, name, description
    `;
    if (!rows.length) return notFound('Role not found');
    return success({ role: serializeRole(rows[0]) });
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Role name already exists');
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid role id');

  const { rows } = await query`
    DELETE FROM roles
    WHERE id = ${id}
    RETURNING id, name
  `;
  if (!rows.length) return notFound('Role not found');
  return success({ deleted: rows[0].id });
}
