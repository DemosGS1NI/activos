import { test, expect, describe, beforeAll, afterAll } from 'vitest';

// Import functions to be tested
import { config } from '../config.js';
import { signAccess, verify } from '../jwt.js';
import { success } from '../response.js';
import { hashPassword, verifyPassword, needsRehash } from '../password.js';
import { createMenu } from '../menu.js';
import { createRbac } from '../rbac.js';
import { query } from '../db.js';
import { ASSET_IMPORT_TEMPLATE_VERSION } from '../imports/constants.js';

// Import server route handlers
import { POST as registerPOST } from '../../routes/auth/register/+server.js';
import { POST as loginPOST } from '../../routes/auth/login/+server.js';
import { POST as refreshPOST } from '../../routes/auth/refresh/+server.js';
import { POST as logoutPOST } from '../../routes/auth/logout/+server.js';
import { GET as menuGET } from '../../routes/menu/+server.js';
import { GET as menuGroupsGET, POST as menuGroupsPOST } from '../../routes/menu_groups/+server.js';
import { GET as menuGroupGET, PATCH as menuGroupPATCH, DELETE as menuGroupDELETE } from '../../routes/menu_groups/[id]/+server.js';
import { GET as tasksGET, POST as tasksPOST } from '../../routes/tasks/+server.js';
import { GET as taskGET, PATCH as taskPATCH, DELETE as taskDELETE } from '../../routes/tasks/[id]/+server.js';
import { GET as roleTasksGET, POST as roleTasksPOST, DELETE as roleTasksDELETE } from '../../routes/role_tasks/+server.js';
import { POST as assetImportPOST } from '../../routes/assets/import/+server.js';
import { utils as xlsxUtils, write as xlsxWrite } from 'xlsx';

// Ensure the environment is set up for tests
beforeAll(() => {
  // Vitest automatically loads .env, so this check should pass
  if (!config.databaseUrl || config.databaseUrl.includes('example')) {
    throw new Error('DATABASE_URL is not configured for integration tests. Check your .env file.');
  }
});

describe('Unit Tests', () => {

  // test('login delay calculation', async () => {
  //    const { getLoginDelay } = await import('../authUtils.js');
  //   expect(getLoginDelay(0)).toBe(0);
  //   expect(getLoginDelay(1)).toBe(500);
  //   expect(getLoginDelay(10)).toBe(5000);
  //   expect(getLoginDelay(20)).toBe(5000);
  // });
  test('config loads and validates', () => {
    expect(config.jwtSecret).toBeDefined();
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.databaseUrl).toBeDefined();
  });

  test('jwt sign/verify access token', async () => {
    const token = await signAccess({ id: 'user-1', role_id: null });
    expect(token.split('.').length).toBe(3);
    const payload = await verify(token);
    expect(payload).toBeDefined();
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('access');
  });

  test('jwt expires correctly', async () => {
    const { sign, verify } = await import('../jwt.js');
    const token = await sign({ sub: 'u' }, 1); // 1 second ttl
    const first = await verify(token);
    expect(first).toBeDefined();
    await new Promise(r => setTimeout(r, 1500));
    const second = await verify(token);
    expect(second).toBeNull();
  });

  test('response success shape', async () => {
    const res = success({ a: 1 });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.a).toBe(1);
  });

  test('password hash & verify', async () => {
    const h = hashPassword('SuperSecret123!');
    expect(verifyPassword('SuperSecret123!', h)).toBe(true);
    expect(verifyPassword('wrong123', h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  test('getMenuForRole uses injected query and respects cache', async () => {
    let calls = 0;
    const mockRows = [{ menu_group_id: 'mg-1', menu_group_key: 'dashboard', menu_group_title: 'Dashboard', menu_group_ord: 10, task_id: 'task-1', task_key: 'home', task_title: 'Home', task_route: '/dashboard', task_ord: 10 }];
    const mockQuery = async () => {
      calls++;
      return { rows: mockRows };
    };

    const m = createMenu({ queryFunc: mockQuery, cacheTtl: 1000 });
    const menu1 = await m.getMenuForRole('role-x');
    expect(menu1).toBeInstanceOf(Array);
    expect(menu1.length).toBeGreaterThan(0);
    expect(calls).toBe(1);

    await m.getMenuForRole('role-x');
    expect(calls).toBe(1); // Should be cached

    m.clearMenuCache();
    await m.getMenuForRole('role-x');
    expect(calls).toBe(2); // Should call again after cache clear
  });

  test('getMenuForUser uses injected query and caching behavior', async () => {
    let calls = 0;
    const taskRows = [{ menu_group_id: 'mg-1', menu_group_key: 'dashboard', menu_group_title: 'Dashboard', menu_group_ord: 10, task_id: 'task-1', task_key: 'home', task_title: 'Home', task_route: '/dashboard', task_ord: 10 }];
    const mockQuery = async (strings, ...values) => {
      calls++;
      const sql = strings.join(' ');
      if (sql.toLowerCase().includes('select role_id from users')) {
        return { rows: [{ role_id: 'role-x' }] };
      }
      return { rows: taskRows };
    };

    const m = createMenu({ queryFunc: mockQuery, cacheTtl: 1000 });
    await m.getMenuForUser('user-1');
    expect(calls).toBe(2);

    await m.getMenuForUser('user-1');
    expect(calls).toBe(3);

    m.clearMenuCache();
    await m.getMenuForUser('user-1');
    expect(calls).toBe(5);
  });

  test('rbac helpers: requireAuth/requireRole/requirePermission', async () => {
    let calls = 0;
    const mockQuery = async (strings, ...values) => {
      calls++;
      const sql = strings.join(' ');
      if (sql.toLowerCase().includes('from role_tasks') && values.includes('db-allowed')) {
        return { rows: [{ ok: 1 }] };
      }
      return { rows: [] };
    };

    const { requireAuth, requireRole, requirePermission } = createRbac({ queryFunc: mockQuery });

    expect(() => requireAuth({ locals: {} })).toThrow();

    const event = { locals: { user: { id: 'u1', role_id: 'r1', role_name: 'user', menu: [{ tasks: [{ key: 'can-do' }] }] } } };
    await expect(requireRole(event, 'user')).resolves.toBe(event.locals.user);
    await expect(requireRole(event, 'admin')).rejects.toThrow();

    await requirePermission(event, 'can-do');

    const event2 = { locals: { user: { id: 'u2', role_id: 'r2', role_name: 'user', menu: [] } } };
    await requirePermission(event2, 'db-allowed');
    expect(calls).toBe(2);
  });
});

describe('Integration Tests', () => {

  test.skip('progressive delay and IP rate limiting', async () => {
    const email = `brute_${Date.now()}@example.com`;
    testUsers.push(email);
    // Register user
    await registerPOST({
      request: new Request('http://internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Brute User' })
      })
    });

    // Simulate failed logins from same IP
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await loginPOST({
        request: new Request('http://internal/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
          body: JSON.stringify({ email, password: 'WrongPassword' })
        })
      });
      lastStatus = res.status;
    }
    // After 10 attempts, should be rate limited
    expect(lastStatus).toBe(401);
    const body = await (await loginPOST({
      request: new Request('http://internal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ email, password: 'WrongPassword' })
      })
    })).json();
    expect(body.error.message).toMatch(/too many login attempts/i);
  }, 60000);
  const testUsers = [];
  const tempMenuGroupIds = new Set();
  const importCleanup = {
    assetTags: [],
    categoryCodes: [],
    statusCodes: [],
    depCodes: [],
    batchIds: []
  };
  let adminRoleId;
  let createdAdminRole = false;

  beforeAll(async () => {
    // Ensure revoked_tokens table exists for integration tests
    await query`CREATE TABLE IF NOT EXISTS revoked_tokens ( jti TEXT PRIMARY KEY, user_id UUID NOT NULL, revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(), exp TIMESTAMPTZ )`;
    await query`
      CREATE TABLE IF NOT EXISTS imports_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL,
        sheet_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        template_version TEXT NOT NULL,
        preview BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'completed',
        totals JSONB NOT NULL DEFAULT '{}'::jsonb,
        warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        duplicates JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        duration_ms INTEGER,
        requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await query`CREATE INDEX IF NOT EXISTS idx_imports_log_batch_id ON imports_log (batch_id)`;
    await query`CREATE INDEX IF NOT EXISTS idx_imports_log_created_at ON imports_log (created_at DESC)`;
  });

  beforeAll(async () => {
    const roleRes = await query`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`;
    adminRoleId = roleRes.rows?.[0]?.id || null;
    if (!adminRoleId) {
      const insertRes = await query`
        INSERT INTO roles (name, description)
        VALUES ('admin', 'Admin role for automated tests')
        RETURNING id
      `;
      adminRoleId = insertRes.rows?.[0]?.id || null;
      createdAdminRole = Boolean(adminRoleId);
    }
    if (!adminRoleId) {
      throw new Error('Admin role not found or could not be created for integration tests');
    }
  });

  afterAll(async () => {
    // Clean up test users
    for (const email of testUsers) {
      await query`DELETE FROM users WHERE email = ${email}`;
    }
    for (const id of tempMenuGroupIds) {
      await query`DELETE FROM menu_groups WHERE id = ${id}`;
    }
    for (const batchId of importCleanup.batchIds) {
      await query`DELETE FROM imports_log WHERE batch_id = ${batchId}`;
    }
    for (const tag of importCleanup.assetTags) {
      await query`DELETE FROM assets WHERE asset_tag = ${tag}`;
    }
    for (const code of importCleanup.categoryCodes) {
      await query`DELETE FROM asset_categories WHERE code = ${code}`;
    }
    for (const code of importCleanup.statusCodes) {
      await query`DELETE FROM asset_statuses WHERE code = ${code}`;
    }
    for (const code of importCleanup.depCodes) {
      await query`DELETE FROM depreciation_methods WHERE code = ${code}`;
    }
    if (createdAdminRole && adminRoleId) {
      await query`DELETE FROM role_tasks WHERE role_id = ${adminRoleId}`;
      await query`UPDATE users SET role_id = NULL WHERE role_id = ${adminRoleId}`;
      await query`DELETE FROM roles WHERE id = ${adminRoleId}`;
    }
  });

  function adminEvent({ url, method = 'GET', body, params = {} } = {}) {
    if (!url) throw new Error('adminEvent requires url');
    const init = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const request = new Request(url, init);
    return {
      request,
      url: new URL(url),
      params,
      locals: { user: { id: 'admin-test', role_id: adminRoleId, role_name: 'admin' } }
    };
  }

  const IMPORT_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function buildImportWorkbook(suffix) {
    const workbook = xlsxUtils.book_new();
    const depCode = `DEP_${suffix}`.toUpperCase();
    const categoryCode = `CAT_${suffix}`.toUpperCase();
    const statusCode = `STS_${suffix}`.toUpperCase();
    const assetTag = `AST_${suffix}`.toUpperCase();

    const addSheet = (name, rows) => {
      const sheet = xlsxUtils.aoa_to_sheet(rows);
      xlsxUtils.book_append_sheet(workbook, sheet, name);
    };

    addSheet('depreciation_methods', [
      ['code', 'name', 'default_period'],
      [depCode, `Método ${suffix}`, 'mensual']
    ]);

    addSheet('asset_categories', [
      ['code', 'name', 'default_depreciation_method_code'],
      [categoryCode, `Categoría ${suffix}`, depCode]
    ]);

    addSheet('asset_statuses', [
      ['code', 'name', 'is_active'],
      [statusCode, `Estado ${suffix}`, true]
    ]);

    addSheet('assets', [
      ['asset_tag', 'name', 'asset_category_code', 'asset_status_code', 'depreciation_method_code'],
      [assetTag, `Activo ${suffix}`, categoryCode, statusCode, depCode]
    ]);

    const buffer = xlsxWrite(workbook, { bookType: 'xlsx', type: 'buffer' });
    const fileName = `import-${suffix}.xlsx`;
    return { buffer, fileName, depCode, categoryCode, statusCode, assetTag };
  }

  async function executeAssetImport({ buffer, fileName, preview }) {
    const file = new File([buffer], fileName, { type: IMPORT_MIME });
    const form = new FormData();
    form.append('file', file);
    if (preview === false) {
      form.append('preview', 'false');
    } else if (preview === true) {
      form.append('preview', 'true');
    }
    const request = new Request('http://internal/assets/import', {
      method: 'POST',
      body: form
    });
    return assetImportPOST({
      request,
      locals: { user: { id: null, role_id: adminRoleId, role_name: 'admin' } }
    });
  }

  test('register, login, and refresh flow', async () => {
    const email = `test_${Date.now()}@example.com`;
    testUsers.push(email);
    const registerReq = new Request('http://internal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Test User' })
    });
    const registerRes = await registerPOST({ request: registerReq });
    const registerBody = await registerRes.json();
    expect(registerRes.status).toBe(201);
    expect(registerBody.success).toBe(true);
    expect(registerBody.data.tokens.access).toBeDefined();

    const loginReq = new Request('http://internal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass123!' })
    });
    const loginRes = await loginPOST({ request: loginReq });
    const loginBody = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginBody.data.tokens.access).toBeDefined();

    const refreshToken = loginBody.data.tokens.refresh;
    const refreshReq = new Request('http://internal/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    const refreshRes = await refreshPOST({ request: refreshReq });
    const refreshBody = await refreshRes.json();
    expect(refreshRes.status).toBe(200);
    expect(refreshBody.data.tokens.access).toBeDefined();
    expect(refreshBody.data.tokens.refresh).not.toBe(refreshToken);
  });

  test('logout revokes refresh token', async () => {
    const email = `logout_${Date.now()}@example.com`;
    testUsers.push(email);
    const registerReq = new Request('http://internal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Logout User' })
    });
    const registerRes = await registerPOST({ request: registerReq });
    const registerBody = await registerRes.json();
    const refreshToken = registerBody.data.tokens.refresh;

    const logoutReq = new Request('http://internal/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    const logoutRes = await logoutPOST({ request: logoutReq });
    const logoutBody = await logoutRes.json();
    expect(logoutRes.status).toBe(200);
    expect(logoutBody.data.revoked).toBe(true);

    const badRefreshReq = new Request('http://internal/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    const badRefreshRes = await refreshPOST({ request: badRefreshReq });
    const badBody = await badRefreshRes.json();
    expect(badRefreshRes.status).toBe(401);
    expect(badBody.error.message).toBe('Token revoked');
  });

  test('menu route returns empty for anonymous and role-scoped menu', async () => {
    const email = `menu_${Date.now()}@example.com`;
    testUsers.push(email);
    const registerReq = new Request('http://internal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Menu User' })
    });
    const registerRes = await registerPOST({ request: registerReq });
    const registerBody = await registerRes.json();
    const accessToken = registerBody.data.tokens.access;

    const anonReq = new Request('http://internal/menu', { method: 'GET' });
    const anonRes = await menuGET({ request: anonReq });
    const anonBody = await anonRes.json();
    expect(anonRes.status).toBe(200);
    expect(anonBody.data.menu).toBeInstanceOf(Array);
    expect(anonBody.data.menu.length).toBe(0);

    const authReq = new Request('http://internal/menu', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
    const authRes = await menuGET({ request: authReq });
    const authBody = await authRes.json();
    expect(authRes.status).toBe(200);
    expect(authBody.data.menu).toBeInstanceOf(Array);
  });

  test('menu group CRUD endpoints respond with expected data', async () => {
    const key = `mg_${Date.now()}`;
    const createRes = await menuGroupsPOST(adminEvent({
      url: 'http://internal/menu_groups',
      method: 'POST',
      body: { key, title: 'Integration Menu Group', description: 'Created via test', ord: 25, active: true }
    }));
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    const menuGroupId = createBody.data.menu_group.id;
    expect(createBody.data.menu_group.key).toBe(key);
    tempMenuGroupIds.add(menuGroupId);

    const listRes = await menuGroupsGET(adminEvent({ url: 'http://internal/menu_groups' }));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.menu_groups.some((g) => g.id === menuGroupId)).toBe(true);

    const detailRes = await menuGroupGET(adminEvent({
      url: `http://internal/menu_groups/${menuGroupId}`,
      params: { id: menuGroupId }
    }));
    expect(detailRes.status).toBe(200);

    const patchRes = await menuGroupPATCH(adminEvent({
      url: `http://internal/menu_groups/${menuGroupId}`,
      method: 'PATCH',
      params: { id: menuGroupId },
      body: { title: 'Updated Menu Group', active: false, ord: 30 }
    }));
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.menu_group.title).toBe('Updated Menu Group');
    expect(patchBody.data.menu_group.active).toBe(false);

    const deleteRes = await menuGroupDELETE(adminEvent({
      url: `http://internal/menu_groups/${menuGroupId}`,
      method: 'DELETE',
      params: { id: menuGroupId }
    }));
    expect(deleteRes.status).toBe(200);
    tempMenuGroupIds.delete(menuGroupId);
  });

  test('menu group endpoint rejects duplicate keys and bad payloads', async () => {
    const key = `mg_dup_${Date.now()}`;
    const invalidRes = await menuGroupsPOST(adminEvent({
      url: 'http://internal/menu_groups',
      method: 'POST',
      body: { title: 'Missing Key' }
    }));
    expect(invalidRes.status).toBe(400);

    const firstRes = await menuGroupsPOST(adminEvent({
      url: 'http://internal/menu_groups',
      method: 'POST',
      body: { key, title: 'First Menu Group' }
    }));
    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json();
    const menuGroupId = firstBody.data.menu_group.id;
    tempMenuGroupIds.add(menuGroupId);

    const dupRes = await menuGroupsPOST(adminEvent({
      url: 'http://internal/menu_groups',
      method: 'POST',
      body: { key, title: 'Duplicate Menu Group' }
    }));
    expect(dupRes.status).toBe(400);

    const patchRes = await menuGroupPATCH(adminEvent({
      url: `http://internal/menu_groups/${menuGroupId}`,
      method: 'PATCH',
      params: { id: menuGroupId },
      body: { ord: 'not-a-number' }
    }));
    expect(patchRes.status).toBe(400);

    const badIdRes = await menuGroupGET(adminEvent({
      url: 'http://internal/menu_groups/not-a-uuid',
      params: { id: 'not-a-uuid' }
    }));
    expect(badIdRes.status).toBe(400);

    await query`DELETE FROM menu_groups WHERE id = ${menuGroupId}`;
    tempMenuGroupIds.delete(menuGroupId);
  });

  test('tasks CRUD endpoints handle full lifecycle', async () => {
    const menuGroupKey = `mg_task_${Date.now()}`;
    const menuGroupInsert = await query`
      INSERT INTO menu_groups (key, title, ord, active)
      VALUES (${menuGroupKey}, 'Task Menu Group', 5, true)
      RETURNING id
    `;
    const menuGroupId = menuGroupInsert.rows[0].id;
    tempMenuGroupIds.add(menuGroupId);

    const taskKey = `task_${Date.now()}`;
    const createRes = await tasksPOST(adminEvent({
      url: 'http://internal/tasks',
      method: 'POST',
      body: {
        menu_group_id: menuGroupId,
        key: taskKey,
        title: 'Task Title',
        description: 'Task description',
        route: '/test/task',
        ord: 11,
        active: true
      }
    }));
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const taskId = createBody.data.task.id;
    expect(createBody.data.task.key).toBe(taskKey);

    const listRes = await tasksGET(adminEvent({ url: 'http://internal/tasks' }));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.tasks.some((t) => t.id === taskId)).toBe(true);

    const detailRes = await taskGET(adminEvent({
      url: `http://internal/tasks/${taskId}`,
      params: { id: taskId }
    }));
    expect(detailRes.status).toBe(200);

    const patchRes = await taskPATCH(adminEvent({
      url: `http://internal/tasks/${taskId}`,
      method: 'PATCH',
      params: { id: taskId },
      body: { title: 'Task Updated', ord: 15 }
    }));
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.task.title).toBe('Task Updated');

    const deleteRes = await taskDELETE(adminEvent({
      url: `http://internal/tasks/${taskId}`,
      method: 'DELETE',
      params: { id: taskId }
    }));
    expect(deleteRes.status).toBe(200);

    await query`DELETE FROM menu_groups WHERE id = ${menuGroupId}`;
    tempMenuGroupIds.delete(menuGroupId);
  });

  test('tasks endpoint validates menu group linkage and duplicate keys', async () => {
    const badMenuGroupRes = await tasksPOST(adminEvent({
      url: 'http://internal/tasks',
      method: 'POST',
      body: { menu_group_id: 'not-a-uuid', key: 'bad', title: 'Bad' }
    }));
    expect(badMenuGroupRes.status).toBe(400);

    const menuGroupKey = `mg_val_${Date.now()}`;
    const menuGroupInsert = await query`
      INSERT INTO menu_groups (key, title, ord, active)
      VALUES (${menuGroupKey}, 'Validation Menu Group', 1, true)
      RETURNING id
    `;
    const menuGroupId = menuGroupInsert.rows[0].id;
    tempMenuGroupIds.add(menuGroupId);

    const key = `taskdup_${Date.now()}`;
    const createRes = await tasksPOST(adminEvent({
      url: 'http://internal/tasks',
      method: 'POST',
      body: { menu_group_id: menuGroupId, key, title: 'Valid Task' }
    }));
    expect(createRes.status).toBe(201);

    const dupRes = await tasksPOST(adminEvent({
      url: 'http://internal/tasks',
      method: 'POST',
      body: { menu_group_id: menuGroupId, key, title: 'Duplicate Task' }
    }));
    expect(dupRes.status).toBe(400);

    const listBody = await (await tasksGET(adminEvent({ url: 'http://internal/tasks' }))).json();
    const taskId = listBody.data.tasks.find((t) => t.key === key && t.menu_group_id === menuGroupId)?.id;
    expect(taskId).toBeDefined();

    const badPatchRes = await taskPATCH(adminEvent({
      url: `http://internal/tasks/${taskId}`,
      method: 'PATCH',
      params: { id: taskId },
      body: { active: 'not-bool' }
    }));
    expect(badPatchRes.status).toBe(400);

    await query`DELETE FROM menu_groups WHERE id = ${menuGroupId}`;
    tempMenuGroupIds.delete(menuGroupId);
  });

  test('role-task mapping endpoints manage associations', async () => {
    const menuGroupKey = `mg_map_${Date.now()}`;
    const menuGroupInsert = await query`
      INSERT INTO menu_groups (key, title, ord, active)
      VALUES (${menuGroupKey}, 'Map Menu Group', 6, true)
      RETURNING id
    `;
    const menuGroupId = menuGroupInsert.rows[0].id;
    tempMenuGroupIds.add(menuGroupId);

    const taskKey = `task_map_${Date.now()}`;
    const taskInsert = await query`
      INSERT INTO tasks (menu_group_id, key, title, ord, active)
      VALUES (${menuGroupId}, ${taskKey}, 'Map Task', 4, true)
      RETURNING id
    `;
    const taskId = taskInsert.rows[0].id;

    let mappingCreated = false;

    try {
      const createRes = await roleTasksPOST(adminEvent({
        url: 'http://internal/role_tasks',
        method: 'POST',
        body: { role_id: adminRoleId, task_id: taskId }
      }));
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody.data.mapping.role_id).toBe(adminRoleId);
      expect(createBody.data.mapping.task_id).toBe(taskId);
      expect(createBody.data.mapping.menu_group_id).toBe(menuGroupId);
      mappingCreated = true;

      const roleFilterRes = await roleTasksGET(adminEvent({
        url: `http://internal/role_tasks?role_id=${adminRoleId}`
      }));
      expect(roleFilterRes.status).toBe(200);
      const roleFilterBody = await roleFilterRes.json();
      expect(roleFilterBody.data.mappings.some((m) => m.task_id === taskId)).toBe(true);

      const deleteRes = await roleTasksDELETE(adminEvent({
        url: 'http://internal/role_tasks',
        method: 'DELETE',
        body: { role_id: adminRoleId, task_id: taskId }
      }));
      expect(deleteRes.status).toBe(200);
      mappingCreated = false;
    } finally {
      if (mappingCreated) {
        await query`DELETE FROM role_tasks WHERE role_id = ${adminRoleId} AND task_id = ${taskId}`;
      }
      await query`DELETE FROM menu_groups WHERE id = ${menuGroupId}`;
      tempMenuGroupIds.delete(menuGroupId);
    }
  });

  test('role-task mappings reject duplicates and invalid ids', async () => {
    const badCreateRes = await roleTasksPOST(adminEvent({
      url: 'http://internal/role_tasks',
      method: 'POST',
      body: { role_id: 'bad', task_id: 'bad' }
    }));
    expect(badCreateRes.status).toBe(400);

    const menuGroupInsert = await query`
      INSERT INTO menu_groups (key, title, ord, active)
      VALUES (${`mg_valmap_${Date.now()}`}, 'Val Map Menu Group', 9, true)
      RETURNING id
    `;
    const menuGroupId = menuGroupInsert.rows[0].id;
    tempMenuGroupIds.add(menuGroupId);

    const taskInsert = await query`
      INSERT INTO tasks (menu_group_id, key, title, ord, active)
      VALUES (${menuGroupId}, ${`task_valmap_${Date.now()}`}, 'Val Map Task', 1, true)
      RETURNING id
    `;
    const taskId = taskInsert.rows[0].id;

    try {
      const firstRes = await roleTasksPOST(adminEvent({
        url: 'http://internal/role_tasks',
        method: 'POST',
        body: { role_id: adminRoleId, task_id: taskId }
      }));
      expect(firstRes.status).toBe(201);

      const dupRes = await roleTasksPOST(adminEvent({
        url: 'http://internal/role_tasks',
        method: 'POST',
        body: { role_id: adminRoleId, task_id: taskId }
      }));
      expect(dupRes.status).toBe(400);

      const badDeleteRes = await roleTasksDELETE(adminEvent({
        url: 'http://internal/role_tasks',
        method: 'DELETE',
        body: { role_id: adminRoleId, task_id: 'not-a-uuid' }
      }));
      expect(badDeleteRes.status).toBe(400);
    } finally {
      await query`DELETE FROM role_tasks WHERE role_id = ${adminRoleId} AND task_id = ${taskId}`;
      await query`DELETE FROM menu_groups WHERE id = ${menuGroupId}`;
      tempMenuGroupIds.delete(menuGroupId);
    }
  });

  test('assets import validates workbook in preview mode', async () => {
    const suffix = `PREV${Date.now()}`;
    const workbook = buildImportWorkbook(suffix);
    const response = await executeAssetImport({ buffer: workbook.buffer, fileName: workbook.fileName, preview: true });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.plantilla).toBe(ASSET_IMPORT_TEMPLATE_VERSION);
    const summary = body.data.resumen;
    expect(summary.templateVersion).toBe(ASSET_IMPORT_TEMPLATE_VERSION);
    expect(summary.preview).toBe(true);
    expect(summary.mode).toBe('preview');
    expect(summary.totals.inserted).toBe(0);
    expect(summary.sheets.assets.status).toBe('validated');
    const assetRow = summary.sheets.assets.rows[0];
    expect(assetRow.status).toBe('validated');
    expect(assetRow.key).toBe(workbook.assetTag);

    const logs = await query`SELECT preview, status FROM imports_log WHERE batch_id = ${summary.batchId}`;
    expect(logs.rows.length).toBeGreaterThan(0);
    expect(logs.rows.every((row) => row.preview === true)).toBe(true);
    importCleanup.batchIds.push(summary.batchId);
  });

  test('assets import persists workbook in commit mode', async () => {
    const suffix = `COM${Date.now()}`;
    const workbook = buildImportWorkbook(suffix);
    const response = await executeAssetImport({ buffer: workbook.buffer, fileName: workbook.fileName, preview: false });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.plantilla).toBe(ASSET_IMPORT_TEMPLATE_VERSION);
    const summary = body.data.resumen;
    expect(summary.templateVersion).toBe(ASSET_IMPORT_TEMPLATE_VERSION);
    expect(summary.preview).toBe(false);
    expect(summary.mode).toBe('commit');
    expect(summary.totals.inserted).toBe(4);
    expect(summary.sheets.assets.status).toBe('committed');
    const assetRow = summary.sheets.assets.rows[0];
    expect(assetRow.status).toBe('inserted');
    expect(assetRow.key).toBe(workbook.assetTag);

    const assetQuery = await query`SELECT asset_tag FROM assets WHERE asset_tag = ${workbook.assetTag}`;
    expect(assetQuery.rows.length).toBe(1);
    importCleanup.assetTags.push(workbook.assetTag);
    importCleanup.categoryCodes.push(workbook.categoryCode);
    importCleanup.statusCodes.push(workbook.statusCode);
    importCleanup.depCodes.push(workbook.depCode);

    const logs = await query`SELECT preview, status FROM imports_log WHERE batch_id = ${summary.batchId}`;
    expect(logs.rows.length).toBeGreaterThan(0);
    expect(logs.rows.every((row) => row.preview === false)).toBe(true);
    expect(logs.rows.some((row) => row.status.startsWith('committed'))).toBe(true);
    importCleanup.batchIds.push(summary.batchId);
  });
});
