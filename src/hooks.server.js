import { verify } from './lib/jwt.js';
import { ResponseError } from './lib/response.js';

// SvelteKit handle hook: verify Bearer access token and attach minimal user info
// This version uses claims embedded in the access token (role/menu/status)
// to avoid a DB lookup on every authenticated request.
const userCache = new Map(); // optional in-process cache if needed
const CACHE_MS = 30 * 1000; // keep small (30s)

function cacheGet(id) {
  const e = userCache.get(id);
  if (!e) return null;
  if (e.expires < Date.now()) { userCache.delete(id); return null; }
  return e.user;
}
function cacheSet(id, user) { userCache.set(id, { user, expires: Date.now() + CACHE_MS }); }

export async function handle({ event, resolve }) {
  event.locals.user = null;
  try {
    const auth = event.request.headers.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return await resolve(event);

    const token = m[1];
    const payload = await verify(token);
    if (!payload || payload.type !== 'access') {
      return await resolve(event);
    }

    // Prefer token-embedded user info; fall back to cache to avoid repeated parsing

    let u = cacheGet(payload.sub);
    if (!u) {
      // Build minimal user object from token claims, no fallbacks except null
      u = {
        id: payload.sub ?? null,
        email: payload.email ?? null,
        name: payload.name ?? null,
        role_id: payload.role && typeof payload.role === 'object' ? payload.role.id ?? null : null,
        role_name: payload.role && typeof payload.role === 'object' ? payload.role.name ?? null : null,
        status: payload.status ?? null,
        menu: payload.menu ?? null
      };
      cacheSet(payload.sub, u);
    }

    if (u.status !== null && u.status !== 'active') {
      return await resolve(event);
    }
    event.locals.user = u;
  } catch (e) {
    // Do not fail requests here; routes may decide to require auth.
    // Keep locals.user = null on error.
  }

  try {
    return await resolve(event);
  } catch (err) {
    if (err instanceof ResponseError) return err.response;
    if (err instanceof Response) return err;
    throw err;
  }
}
