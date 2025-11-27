import { success, badRequest, error } from '../../../lib/response.js';
import { hashPassword } from '../../../lib/password.js';
import { query } from '../../../lib/db.js';
import { signAccess, signRefresh } from '../../../lib/jwt.js';
import { getMenuForUser } from '../../../lib/menu.js';

function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function POST({ request }) {
  let body;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim() || null;

  if (!validateEmail(email)) return badRequest('Invalid email');
  if (password.length < 8) return badRequest('Password must be at least 8 characters');

  // Check existing user
  const existing = await query`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.rows.length) return error('conflict', 'Email already registered', 409);

  // Default role: user
  const role = await query`SELECT id FROM roles WHERE name = 'user' LIMIT 1`;
  const roleId = role.rows.length ? role.rows[0].id : null;

  const passwordHash = hashPassword(password);
  const inserted = await query`INSERT INTO users (email, password_hash, "name", role_id) VALUES (${email}, ${passwordHash}, ${name}, ${roleId}) RETURNING id, email, "name", status, role_id, created_at`;
  const user = inserted.rows[0];

  // Tokens (include menu in access token to avoid DB lookup on each request)
  const menu = await getMenuForUser(user.id);
  const accessToken = await signAccess({ ...user }, menu);
  const refreshToken = await signRefresh(user);

  return success({ user, tokens: { access: accessToken, refresh: refreshToken } }, { created: true }, 201);
}
