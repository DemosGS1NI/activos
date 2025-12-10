import { unauthorized, forbidden, ResponseError } from './response.js';
import { query as defaultQuery } from './db.js';

// Factory to create RBAC helpers with an injectable query function (useful for tests)
export function createRbac({ queryFunc = defaultQuery } = {}) {
  function requireAuth(event) {
    const user = event?.locals?.user || null;
    
    if (!user) throw new ResponseError(unauthorized('Authentication required'));
    return user;
  }

  async function requireRole(event, allowed) {
    const user = requireAuth(event);
    const allowedArr = Array.isArray(allowed) ? allowed : [allowed];
    const normalized = allowedArr
      .filter((value) => value !== undefined && value !== null)
      .map((value) => (typeof value === 'string' ? value.trim() : value));

    const hasMatch = (candidateName, candidateId, source = 'token') => {
      
      const idStr = candidateId ? String(candidateId) : null;
      const name = typeof candidateName === 'string' ? candidateName : null;
      const nameLower = name ? name.trim().toLowerCase() : null;

      for (const item of normalized) {
        if (item === null || item === undefined) continue;
        if (idStr && String(item) === idStr) return true;
        if (typeof item === 'string') {
          const itemLower = item.trim().toLowerCase();
          if (nameLower && nameLower === itemLower) return true;
        }
      }
      return false;
    };

    if (hasMatch(user.role_name, user.role_id, 'token')) return user;

    if (user.role_id) {
      const result = await queryFunc`
        SELECT name FROM roles WHERE id = ${user.role_id} LIMIT 1
      `;
      const dbName = result.rows?.[0]?.name || null;
      if (dbName) {
        if (!user.role_name) {
          user.role_name = dbName;
        }
        if (hasMatch(dbName, user.role_id, 'database')) return user;
      }
    }

    throw new ResponseError(forbidden('Insufficient role'));
  }

  async function requirePermission(event, permissionInput) {
    const user = requireAuth(event);

    const permissionList = (Array.isArray(permissionInput)
      ? permissionInput
      : [permissionInput]
    )
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    if (!permissionList.length) {
      throw new ResponseError(forbidden('Missing permission'));
    }

    // Fast path: token-embedded menu (if present)
    try {
      const allowed = new Set(permissionList);
      const menu = user.menu;
      if (Array.isArray(menu)) {
        for (const cat of menu) {
          if (!cat || !Array.isArray(cat.tasks)) continue;
          for (const t of cat.tasks) {
            if (!t) continue;
            if (allowed.has(t.key)) return user;
          }
        }
      }
    } catch (_) {
      // ignore parsing issues and try DB fallback
    }

    // DB fallback: check if user's role has any of the requested tasks
    if (!user.role_id) throw new ResponseError(forbidden('Missing permission'));

    let res;
    if (permissionList.length === 1) {
      res = await queryFunc`
        SELECT 1 FROM role_tasks rt
        JOIN tasks t ON t.id = rt.task_id
        WHERE rt.role_id = ${user.role_id} AND t.key = ${permissionList[0]}
        LIMIT 1
      `;
    } else {
      res = await queryFunc`
        SELECT 1 FROM role_tasks rt
        JOIN tasks t ON t.id = rt.task_id
        WHERE rt.role_id = ${user.role_id} AND t.key = ANY(${permissionList})
        LIMIT 1
      `;
    }

    if (res.rows && res.rows.length) return user;

    throw new ResponseError(forbidden('Missing permission'));
  }

  return { requireAuth, requireRole, requirePermission };
}

// Default instance for runtime (uses real DB query)
const defaultRbac = createRbac({});
export const requireAuth = defaultRbac.requireAuth;
export const requireRole = defaultRbac.requireRole;
export const requirePermission = defaultRbac.requirePermission;

export default { createRbac, requireAuth, requireRole, requirePermission };
