import { success, badRequest, notFound } from '../../../lib/response.js';
import { query } from '../../../lib/db.js';
import { requireRole } from '../../../lib/rbac.js';
import {
  isUuid,
  normalizeString,
  validateEmail,
  toBoolean,
} from '../../../lib/validators.js';
import { hashPassword } from '../../../lib/password.js';

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

async function fetchUser(id) {
  const { rows } = await query`
    SELECT u.id, u.email, u.name, u.status, u.role_id, u.last_login, u.force_password_change,
           u.created_at, u.updated_at, u.password_hash, u.password_changed_at,
           u.failed_login_attempts, r.name as role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid user id');

  const user = await fetchUser(id);
  if (!user) return notFound('User not found');
  return success({ user: serializeUser(user) });
}

export async function PATCH(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid user id');

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const email = payload?.email !== undefined ? normalizeString(payload.email) : undefined;
  const name = payload?.name !== undefined ? normalizeString(payload.name) : undefined;
  const status = payload?.status !== undefined ? normalizeString(payload.status) : undefined;
  const roleId = payload?.role_id !== undefined ? payload.role_id : undefined;
  const forcePasswordChange = payload?.force_password_change !== undefined ? toBoolean(payload.force_password_change) : undefined;
  const resetFailedAttempts = payload?.reset_failed_login_attempts !== undefined ? toBoolean(payload.reset_failed_login_attempts) : false;
  const password = payload?.password;

  if (
    email === undefined &&
    name === undefined &&
    status === undefined &&
    roleId === undefined &&
    forcePasswordChange === undefined &&
    password === undefined &&
    !resetFailedAttempts
  ) {
    return badRequest('Nothing to update');
  }

  const current = await fetchUser(id);
  if (!current) return notFound('User not found');

  let nextEmail = current.email;
  if (email !== undefined) {
    if (!email || !validateEmail(email)) return badRequest('Valid email is required');
    nextEmail = email.toLowerCase();
  }

  let nextName = current.name;
  if (name !== undefined) {
    nextName = name;
  }

  let nextStatus = current.status;
  if (status !== undefined) {
    if (!['active', 'inactive', 'suspended'].includes(status)) return badRequest('Invalid status value');
    nextStatus = status;
  }

  let nextRoleId = current.role_id;
  let nextRoleName = current.role_name;
  if (roleId !== undefined) {
    if (roleId === null) {
      nextRoleId = null;
      nextRoleName = null;
    } else {
      const asString = String(roleId);
      if (!isUuid(asString)) return badRequest('Invalid role_id');
      const roleRes = await query`SELECT id, name FROM roles WHERE id = ${asString} LIMIT 1`;
      if (!roleRes.rows.length) return badRequest('Role not found');
      nextRoleId = roleRes.rows[0].id;
      nextRoleName = roleRes.rows[0].name;
    }
  }

  const nextForcePasswordChange = forcePasswordChange !== undefined ? forcePasswordChange : current.force_password_change;
  const changePassword = typeof password === 'string' && password.length > 0;
  if (changePassword && password.length < 8) return badRequest('Password must be at least 8 characters');

  const newPasswordHash = changePassword ? hashPassword(password) : null;

  try {
    const { rows } = await query`
      UPDATE users
      SET
        email = ${nextEmail},
        name = ${nextName},
        status = ${nextStatus},
        role_id = ${nextRoleId},
        force_password_change = ${nextForcePasswordChange},
        password_hash = CASE WHEN ${changePassword} THEN ${newPasswordHash} ELSE password_hash END,
        password_changed_at = CASE WHEN ${changePassword} THEN now() ELSE password_changed_at END,
        failed_login_attempts = CASE WHEN ${resetFailedAttempts} THEN 0 ELSE failed_login_attempts END,
        updated_at = now()
      WHERE id = ${id}
      RETURNING id, email, name, status, role_id, force_password_change, last_login, created_at, updated_at
    `;

    if (!rows.length) return notFound('User not found');

    return success({
      user: serializeUser({ ...rows[0], role_name: nextRoleName })
    });
  } catch (err) {
    if (err?.code === '23505') {
      return badRequest('Email already exists');
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, 'admin');
  const { id } = event.params;
  if (!isUuid(id)) return badRequest('Invalid user id');

  const { rows } = await query`
    DELETE FROM users
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound('User not found');
  return success({ deleted: rows[0].id });
}
