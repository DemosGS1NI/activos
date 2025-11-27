import { success, badRequest } from '../../lib/response.js';
import { query } from '../../lib/db.js';
import { requireRole } from '../../lib/rbac.js';
import { hashPassword } from '../../lib/password.js';
import { normalizeString, validateEmail, isUuid, toBoolean } from '../../lib/validators.js';

function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    role_id: row.role_id,
    role_name: row.role_name,
    last_login: row.last_login,
    force_password_change: row.force_password_change,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const { rows } = await query`
    SELECT u.id, u.email, u.name, u.status, u.role_id, u.last_login, u.force_password_change,
           u.created_at, u.updated_at, r.name as role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.created_at DESC
  `;
  return success({ users: rows.map(serializeUser) });
}

export async function POST(event) {
  await requireRole(event, 'admin');
  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const emailRaw = normalizeString(payload?.email);
  const name = normalizeString(payload?.name);
  const roleId = payload?.role_id ? String(payload.role_id) : null;
  const status = normalizeString(payload?.status) || 'active';
  const password = payload?.password;
  const forcePasswordChange = toBoolean(payload?.force_password_change, false);

  if (!emailRaw || !validateEmail(emailRaw)) return badRequest('Valid email is required');
  if (!password || password.length < 8) return badRequest('Password must be at least 8 characters');
  if (!['active', 'inactive', 'suspended'].includes(status)) return badRequest('Invalid status value');

  let resolvedRoleId = null;
  if (roleId) {
    if (!isUuid(roleId)) return badRequest('Invalid role_id');
    const roleRes = await query`SELECT id FROM roles WHERE id = ${roleId} LIMIT 1`;
    if (!roleRes.rows.length) return badRequest('Role not found');
    resolvedRoleId = roleRes.rows[0].id;
  } else {
    const defaultRole = await query`SELECT id FROM roles WHERE name = 'user' LIMIT 1`;
    resolvedRoleId = defaultRole.rows?.[0]?.id || null;
  }

  const passwordHash = hashPassword(password);

  try {
    const { rows } = await query`
      INSERT INTO users (email, password_hash, name, status, role_id, force_password_change)
      VALUES (${emailRaw.toLowerCase()}, ${passwordHash}, ${name}, ${status}, ${resolvedRoleId}, ${forcePasswordChange})
      RETURNING id, email, name, status, role_id, force_password_change, created_at, updated_at, last_login
    `;

    const roleName = resolvedRoleId
      ? (await query`SELECT name FROM roles WHERE id = ${resolvedRoleId} LIMIT 1`).rows?.[0]?.name || null
      : null;

    return success(
      {
        user: serializeUser({ ...rows[0], role_name: roleName }),
      },
      {},
      201
    );
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Email already exists');
    }
    throw err;
  }
}
