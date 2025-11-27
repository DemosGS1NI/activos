import { badRequest, unauthorized, success } from '../../../lib/response.js';
import { verify, signAccess, signRefresh } from '../../../lib/jwt.js';
import { query } from '../../../lib/db.js';

export async function POST({ request }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const token = body.refresh || (body.token) || null;
  if (!token) return badRequest('refresh token required');
  const payload = await verify(token);
  if (!payload || payload.type !== 'refresh') return unauthorized('Invalid refresh token');

  // Check revocation list
  const revokedRes = await query`SELECT jti FROM revoked_tokens WHERE jti = ${payload.jti} LIMIT 1`;
  if (revokedRes.rows.length) return unauthorized('Token revoked');

  // Load user to ensure still active
  const userRes = await query`SELECT id, email, role_id, status FROM users WHERE id = ${payload.sub} LIMIT 1`;
  if (!userRes.rows.length) return unauthorized('User not found');
  const user = userRes.rows[0];
  if (user.status !== 'active') return unauthorized('User inactive');
  // Build menu once and include in new access token to avoid DB lookup in hook
  const { getMenuForUser } = await import('../../../lib/menu.js');
  const menu = await getMenuForUser(user.id);
  const newAccess = await signAccess(user, menu);
  const newRefresh = await signRefresh(user);

  return success({ tokens: { access: newAccess, refresh: newRefresh } });
}
