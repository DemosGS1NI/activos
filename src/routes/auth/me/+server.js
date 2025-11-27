import { badRequest, unauthorized, success } from '$lib/response.js';
import { verify } from '$lib/jwt.js';
import { query } from '$lib/db.js';

function normalizeAuthHeader(h) {
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function GET({ request }) {
  const auth = normalizeAuthHeader(request.headers.get('authorization'));
  if (!auth) return unauthorized('Missing Authorization header');
  const payload = await verify(auth);
  if (!payload || !payload.sub) return unauthorized('Invalid token');

  const res = await query`
    SELECT u.id, u.email, u.name, u.status, r.id as role_id, r.name as role_name
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${payload.sub} LIMIT 1
  `;
  if (!res.rows.length) return unauthorized('User not found');
  const u = res.rows[0];

  return success({ user: { id: u.id, email: u.email, name: u.name, status: u.status, role: { id: u.role_id, name: u.role_name } } });
}
