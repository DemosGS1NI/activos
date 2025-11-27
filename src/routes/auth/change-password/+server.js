import { badRequest, unauthorized, success, error } from '$lib/response.js';
import { verify } from '$lib/jwt.js';
import { verifyPassword, hashPassword } from '$lib/password.js';
import { query } from '$lib/db.js';

function normalizeAuthHeader(h) {
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function POST({ request }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }

  const current = body.current || '';
  const next = body.next || '';
  if (!current || !next) return badRequest('current and next passwords are required');
  if (next.length < 8) return badRequest('New password must be at least 8 characters');

  const auth = normalizeAuthHeader(request.headers.get('authorization'));
  if (!auth) return unauthorized('Missing Authorization header');

  const payload = await verify(auth);
  if (!payload || payload.type !== 'access') return unauthorized('Invalid access token');

  const userRes = await query`SELECT id, password_hash, status FROM users WHERE id = ${payload.sub} LIMIT 1`;
  if (!userRes.rows.length) return unauthorized('User not found');
  const user = userRes.rows[0];
  if (user.status !== 'active') return unauthorized('User inactive');

  if (!verifyPassword(current, user.password_hash)) return unauthorized('Invalid current password');

  const newHash = hashPassword(next);
  try {
    await query`UPDATE users SET password_hash = ${newHash}, force_password_change = false WHERE id = ${user.id}`;
  } catch (e) {
    return error('db_error', 'Failed to update password', 500, e.message);
  }

  return success({ changed: true });
}
