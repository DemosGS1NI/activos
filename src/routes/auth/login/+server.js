import { getLoginDelay } from '../../../lib/authUtils.js';
// Simple in-memory IP-based rate limiting (resets on server restart)
const ipAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 10;
import { success, badRequest, error, unauthorized } from '../../../lib/response.js';
import { verifyPassword, needsRehash, hashPassword } from '../../../lib/password.js';
import { query } from '../../../lib/db.js';
import { signAccess, signRefresh } from '../../../lib/jwt.js';
import { getMenuForUser } from '../../../lib/menu.js';

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export async function POST({ request }) {
    // IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = ipAttempts.get(ip) || [];
    // Remove attempts older than window
    const recent = attempts.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      return unauthorized('Too many login attempts from this IP. Try again later.');
    }
    recent.push(now);
    ipAttempts.set(ip, recent);
  let body;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const email = normalizeEmail(body.email);
  const password = body.password || '';
  if (!email || !password) return badRequest('Email and password required');


  // Fetch user and join role name
  const resUser = await query`
    SELECT u.id, u.email, u.password_hash, u."name", u.role_id, u.status, u.failed_login_attempts, u.force_password_change, r.name as role_name
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.email = ${email} LIMIT 1
  `;
  if (!resUser.rows.length) {
    // Progressive delay for unknown users (basic protection)
    await new Promise(res => setTimeout(res, 1000));
    return unauthorized('Invalid credentials');
  }
  const user = resUser.rows[0];

  if (user.status !== 'active') return error('inactive', 'User inactive', 403);
  if (user.failed_login_attempts >= 10) return error('locked', 'Account locked', 423);

  // Progressive delay based on failed attempts (max 5s)
  const delay = getLoginDelay(user.failed_login_attempts);
  if (delay > 0) await new Promise(res => setTimeout(res, delay));

  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    await query`UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ${user.id}`;
    return unauthorized('Invalid credentials');
  }

  // Reset failed attempts and update last_login
  let newHash = user.password_hash;
  if (needsRehash(user.password_hash)) {
    newHash = hashPassword(password);
  }
  await query`UPDATE users SET failed_login_attempts = 0, last_login = now(), password_hash = ${newHash} WHERE id = ${user.id}`;

  const menu = await getMenuForUser(user.id);

  // Pass name and role_name to signAccess so JWT includes them
  const accessToken = await signAccess({
    id: user.id,
    email: user.email,
    name: user.name,
    role_id: user.role_id,
    role_name: user.role_name,
    status: user.status
  }, menu);
  const refreshToken = await signRefresh(user);

  const flags = { force_password_change: user.force_password_change };
  return success({ user: { id: user.id, email: user.email, name: user.name, role_id: user.role_id, role_name: user.role_name, status: user.status }, tokens: { access: accessToken, refresh: refreshToken }, flags });
}
