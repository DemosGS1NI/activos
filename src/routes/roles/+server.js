import { success, badRequest } from '../../lib/response.js';
import { query } from '../../lib/db.js';
import { requireRole } from '../../lib/rbac.js';
import { normalizeString } from '../../lib/validators.js';

function serializeRole(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
  };
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const { rows } = await query`
    SELECT id, name, description
    FROM roles
    ORDER BY name
  `;
  return success({ roles: rows.map(serializeRole) });
}

export async function POST(event) {
  await requireRole(event, 'admin');
  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const name = normalizeString(payload?.name);
  const description = normalizeString(payload?.description);

  if (!name) return badRequest('Role name is required');

  try {
    const { rows } = await query`
      INSERT INTO roles (name, description)
      VALUES (${name}, ${description})
      RETURNING id, name, description
    `;
    return success({ role: serializeRole(rows[0]) }, {}, 201);
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Role name already exists');
    }
    throw err;
  }
}
