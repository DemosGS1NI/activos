import { success, unauthorized } from '../../lib/response.js';
import { verify } from '../../lib/jwt.js';
import { getMenuForUser, getMenuForRole } from '../../lib/menu.js';

// GET /menu
// - If no Authorization header: return an empty menu (no user context)
// - If Authorization Bearer access token present and valid: return role-scoped menu for that user
// - If token present but invalid: return 401 Unauthorized
export async function GET({ request }) {
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);

  if (!m) return success({ menu: [] });

  const token = m[1];
  const payload = await verify(token);
  if (!payload || payload.type !== 'access') return unauthorized('Invalid access token');

  const menu = await getMenuForUser(payload.sub);
  return success({ menu });
}
