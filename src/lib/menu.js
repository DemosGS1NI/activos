import { query } from './db.js';

// Simple in-memory per-role cache default TTL
const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 60s

// Factory to create menu helpers with optional injected query function and cache TTL.
export function createMenu({ queryFunc = query, cacheTtl = DEFAULT_CACHE_TTL_MS } = {}) {
  const cache = new Map(); // key -> { value, expires }

  function setCache(key, value, ttl = cacheTtl) {
    cache.set(key, { value, expires: Date.now() + ttl });
  }

  function getCache(key) {
    const e = cache.get(key);
    if (!e) return null;
    if (e.expires < Date.now()) {
      cache.delete(key);
      return null;
    }
    return JSON.parse(JSON.stringify(e.value));
  }

  function clearCache(roleId) {
    if (roleId) cache.delete(roleId);
    else cache.clear();
  }

  async function getMenuForRole(roleId) {
    const cacheKey = roleId || 'anonymous';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    if (!roleId) {
      setCache(cacheKey, []);
      return [];
    }

    const res = await queryFunc`
      SELECT mg.id AS menu_group_id,
             mg.key AS menu_group_key,
             mg.title AS menu_group_title,
             mg.ord AS menu_group_ord,
             t.id AS task_id,
             t.key AS task_key,
             t.title AS task_title,
             t.route AS task_route,
             t.ord AS task_ord
      FROM menu_groups mg
      JOIN tasks t
        ON t.menu_group_id = mg.id
       AND t.active = true
       AND mg.active = true
      JOIN role_tasks rt ON rt.task_id = t.id
      WHERE rt.role_id = ${roleId}
      ORDER BY mg.ord, t.ord
    `;

    const rows = res.rows || [];
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.menu_group_id)) {
        map.set(r.menu_group_id, {
          id: r.menu_group_id,
          key: r.menu_group_key,
          title: r.menu_group_title,
          ord: r.menu_group_ord,
          tasks: [],
          seen: new Set()
        });
      }

      const menuGroup = map.get(r.menu_group_id);
      // Avoid duplicate tasks caused by multiple role_task rows for the same task
      if (menuGroup.seen.has(r.task_id)) continue;
      menuGroup.seen.add(r.task_id);
      menuGroup.tasks.push({
        id: r.task_id,
        key: r.task_key,
        title: r.task_title,
        route: r.task_route,
        ord: r.task_ord
      });
    }

    const menu = Array.from(map.values()).map(group => ({
      id: group.id,
      key: group.key,
      title: group.title,
      ord: group.ord,
      tasks: group.tasks
    }));

    setCache(cacheKey, menu);
    return JSON.parse(JSON.stringify(menu));
  }

  async function getMenuForUser(userId) {
    if (!userId) return getMenuForRole(null);
    const u = await queryFunc`SELECT role_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (!u.rows.length) return [];
    const roleId = u.rows[0].role_id;
    return getMenuForRole(roleId);
  }

  return { getMenuForRole, getMenuForUser, clearMenuCache: clearCache };
}

// Default exported helpers using real DB query and default cache
const defaultMenu = createMenu({});
export const getMenuForRole = defaultMenu.getMenuForRole;
export const getMenuForUser = defaultMenu.getMenuForUser;
export const clearMenuCache = defaultMenu.clearMenuCache;

export default { getMenuForRole, getMenuForUser, clearMenuCache, createMenu };
