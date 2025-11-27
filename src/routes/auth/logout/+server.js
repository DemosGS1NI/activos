import { badRequest, unauthorized, success } from '../../../lib/response.js';
import { verify } from '../../../lib/jwt.js';
import { query } from '../../../lib/db.js';

export async function POST({ request }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const token = body.refresh || body.token || null;
  if (!token) return badRequest('refresh token required');
  const payload = await verify(token);
  if (!payload || payload.type !== 'refresh') return unauthorized('Invalid refresh token');

  // Ensure user exists and active
  const userRes = await query`SELECT id, status FROM users WHERE id = ${payload.sub} LIMIT 1`;
  if (!userRes.rows.length) return unauthorized('User not found');
  if (userRes.rows[0].status !== 'active') return unauthorized('User inactive');

  // Insert revocation record (ignore conflict if already revoked)
  await query`INSERT INTO revoked_tokens (jti, user_id, exp) VALUES (${payload.jti}, ${payload.sub}, to_timestamp(${payload.exp})) ON CONFLICT (jti) DO NOTHING`;

  return success({ revoked: true });
}
