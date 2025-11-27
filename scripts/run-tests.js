// Simple test harness without external dependencies.
// Run: npm test

import fs from 'fs';
import path from 'path';

// Auto-load .env.local (simple parser) so integration tests can use DATABASE_URL without manual export.
function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      let [, key, value] = match;
      // Strip surrounding quotes if present
      value = value.replace(/^['"`]/, '').replace(/['"`]$/, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvLocal();

let pass = 0;
let fail = 0;
const results = [];

function logResult(ok, name, error) {
  if (ok) {
    pass++;
    results.push(`PASS ${name}`);
  } else {
    fail++;
    results.push(`FAIL ${name} -> ${error}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    logResult(true, name);
  } catch (e) {
    logResult(false, name, e.message || String(e));
  }
}

// Ensure required env vars for config tests (fallbacks if not in .env.local)
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test_jwt_secret_value_1234567890_abcdef_zz';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://example';

await test('config loads and validates', async () => {
  const { config } = await import('../src/lib/config.js');
  if (!config.jwtSecret || config.jwtSecret.length < 32) throw new Error('jwtSecret invalid');
  if (!config.databaseUrl) throw new Error('databaseUrl missing');
});

await test('jwt sign/verify access token', async () => {
  const { signAccess, verify } = await import('../src/lib/jwt.js');
  const token = await signAccess({ id: 'user-1', role_id: null });
  if (token.split('.').length !== 3) throw new Error('token format');
  const payload = await verify(token);
  if (!payload) throw new Error('verify returned null');
  if (payload.sub !== 'user-1') throw new Error('sub mismatch');
  if (payload.type !== 'access') throw new Error('type mismatch');
});

await test('jwt expires correctly', async () => {
  const { sign, verify } = await import('../src/lib/jwt.js');
  const token = await sign({ sub: 'u' }, 1); // 1 second ttl
  const first = await verify(token);
  if (!first) throw new Error('should verify initially');
  await new Promise(r => setTimeout(r, 1500));
  const second = await verify(token);
  if (second) throw new Error('token should have expired');
});

await test('response success shape', async () => {
  const { success } = await import('../src/lib/response.js');
  const res = success({ a: 1 });
  const body = await res.text();
  const json = JSON.parse(body);
  if (!json.success || json.data.a !== 1) throw new Error('invalid success response');
});

await test('password hash & verify', async () => {
  const { hashPassword, verifyPassword, needsRehash } = await import('../src/lib/password.js');
  const h = hashPassword('SuperSecret123!');
  if (!verifyPassword('SuperSecret123!', h)) throw new Error('verify failed');
  if (verifyPassword('wrong123', h)) throw new Error('false positive');
  if (needsRehash(h)) throw new Error('should not need rehash');
});

await test('unit getMenuForRole uses injected query and respects cache', async () => {
  const { createMenu } = await import('../src/lib/menu.js');
  let calls = 0;
  const mockRows = [
    {
      category_id: 'cat-1', category_key: 'dashboard', category_title: 'Dashboard', category_ord: 10,
      task_id: 'task-1', task_key: 'home', task_title: 'Home', task_route: '/dashboard', task_ord: 10
    }
  ];
  // mock tagged template function
  function mockQuery(strings, ...values) {
    calls++;
    return Promise.resolve({ rows: mockRows });
  }

  const m = createMenu({ queryFunc: mockQuery, cacheTtl: 1000 });
  const menu1 = await m.getMenuForRole('role-x');
  if (!Array.isArray(menu1) || menu1.length === 0) throw new Error('menu1 invalid');
  if (calls !== 1) throw new Error('expected 1 query call');
  const menu2 = await m.getMenuForRole('role-x');
  if (calls !== 1) throw new Error('expected cached, no new calls');
  m.clearMenuCache();
  const menu3 = await m.getMenuForRole('role-x');
  if (calls !== 2) throw new Error('expected call after clear');
});

await test('unit getMenuForUser uses injected query and caching behavior', async () => {
  const { createMenu } = await import('../src/lib/menu.js');
  let calls = 0;

  const taskRows = [
    {
      category_id: 'cat-1', category_key: 'dashboard', category_title: 'Dashboard', category_ord: 10,
      task_id: 'task-1', task_key: 'home', task_title: 'Home', task_route: '/dashboard', task_ord: 10
    }
  ];

  // mock tagged template function that distinguishes user lookup vs tasks
  function mockQuery(strings, ...values) {
    calls++;
    const sql = strings.join(' ');
    if (sql.toLowerCase().includes('select role_id from users')) {
      return Promise.resolve({ rows: [{ role_id: 'role-x' }] });
    }
    return Promise.resolve({ rows: taskRows });
  }

  const m = createMenu({ queryFunc: mockQuery, cacheTtl: 1000 });

  // First call: user lookup + tasks query => 2 calls
  const menu1 = await m.getMenuForUser('user-1');
  if (!Array.isArray(menu1) || menu1.length === 0) throw new Error('menu1 invalid');
  if (calls !== 2) throw new Error('expected 2 query calls (user+tasks)');

  // Second call: user lookup only (menu cached) => +1 call
  const menu2 = await m.getMenuForUser('user-1');
  if (calls !== 3) throw new Error('expected 3 total calls after cached menu (user lookup only)');

  // Clear cache and call again: user lookup + tasks => +2 calls
  m.clearMenuCache();
  const menu3 = await m.getMenuForUser('user-1');
  if (calls !== 5) throw new Error('expected 5 total calls after clear');
});

await test('unit rbac helpers: requireAuth/requireRole/requirePermission', async () => {
  const { createRbac } = await import('../src/lib/rbac.js');
  let calls = 0;
  // mock query: only used for permission DB fallback
  function mockQuery(strings, ...values) {
    calls++;
    // If checking role_tasks, return a hit when permission is 'db-allowed'
    const sql = strings.join(' ');
    if (sql.toLowerCase().includes('from role_tasks') && values.includes('db-allowed')) {
      return Promise.resolve({ rows: [{ ok: 1 }] });
    }
    return Promise.resolve({ rows: [] });
  }

  const { requireAuth, requireRole, requirePermission } = createRbac({ queryFunc: mockQuery });

  // requireAuth should throw when no user
  let threw = false;
  try { requireAuth({ locals: {} }); } catch (e) { threw = true; }
  if (!threw) throw new Error('requireAuth should throw when unauthenticated');

  // Create fake event with user
  const event = { locals: { user: { id: 'u1', role_id: 'r1', role_name: 'user', menu: [{ tasks: [{ key: 'can-do' }] }] } } };

  // requireRole: allowed
  requireRole(event, 'user');
  // requireRole: not allowed
  let forbiddenThrown = false;
  try { requireRole(event, 'admin'); } catch (e) { forbiddenThrown = true; }
  if (!forbiddenThrown) throw new Error('requireRole should throw for insufficient role');

  // requirePermission: fast path via menu
  await requirePermission(event, 'can-do');

  // requirePermission: DB fallback
  // change user so menu doesn't include it
  const event2 = { locals: { user: { id: 'u2', role_id: 'r2', role_name: 'user', menu: [] } } };
  await requirePermission(event2, 'db-allowed');
  if (calls === 0) throw new Error('expected mockQuery to be called for DB fallback');
});

await test('register endpoint creates user and returns tokens', async () => {
  // Require real DATABASE_URL; skip if dummy (no @vercel/postgres connection possible)
  if (process.env.DATABASE_URL === 'postgresql://example') {
    throw new Error('DATABASE_URL not set for integration test');
  }
  // Ensure revoked_tokens table exists (migration may not have been run in test env)
  const { query } = await import('../src/lib/db.js');
  await query`CREATE TABLE IF NOT EXISTS revoked_tokens ( jti TEXT PRIMARY KEY, user_id UUID NOT NULL, revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(), exp TIMESTAMPTZ )`;
  const email = `test_${Date.now()}@example.com`;
  const { POST: registerPOST } = await import('../src/routes/auth/register/+server.js');
  const req = new Request('http://internal/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Test User' })
  });
  const res = await registerPOST({ request: req });
  const body = JSON.parse(await res.text());
  if (res.status !== 201) throw new Error('status ' + res.status);
  if (!body.success) throw new Error('success false');
  if (!body.data.tokens || !body.data.tokens.access) throw new Error('missing tokens');
  // Login test immediately after register
  const { POST: loginPOST } = await import('../src/routes/auth/login/+server.js');
  const loginReq = new Request('http://internal/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPass123!' })
  });
  const loginRes = await loginPOST({ request: loginReq });
  const loginBody = JSON.parse(await loginRes.text());
  if (loginRes.status !== 200) throw new Error('login status ' + loginRes.status);
  if (!loginBody.data || !loginBody.data.tokens || !loginBody.data.tokens.access) throw new Error('login missing tokens');
  const refreshToken = loginBody.data.tokens.refresh;
  // Refresh test
  const { POST: refreshPOST } = await import('../src/routes/auth/refresh/+server.js');
  const refreshReq = new Request('http://internal/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken })
  });
  const refreshRes = await refreshPOST({ request: refreshReq });
  const refreshBody = JSON.parse(await refreshRes.text());
  if (refreshRes.status !== 200) throw new Error('refresh status ' + refreshRes.status);
  if (!refreshBody.data.tokens.access || !refreshBody.data.tokens.refresh) throw new Error('refresh missing tokens');
  if (refreshBody.data.tokens.refresh === refreshToken) throw new Error('refresh token not rotated');
});

await test('logout revokes refresh token', async () => {
  if (process.env.DATABASE_URL === 'postgresql://example') {
    throw new Error('DATABASE_URL not set for integration test');
  }
  const { query } = await import('../src/lib/db.js');
  await query`CREATE TABLE IF NOT EXISTS revoked_tokens ( jti TEXT PRIMARY KEY, user_id UUID NOT NULL, revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(), exp TIMESTAMPTZ )`;
  const email = `logout_${Date.now()}@example.com`;
  const { POST: registerPOST } = await import('../src/routes/auth/register/+server.js');
  const regReq = new Request('http://internal/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Logout User' })
  });
  const regRes = await registerPOST({ request: regReq });
  const regBody = JSON.parse(await regRes.text());
  if (regRes.status !== 201) throw new Error('register status ' + regRes.status);
  const refreshToken = regBody.data.tokens.refresh;
  // Logout
  const { POST: logoutPOST } = await import('../src/routes/auth/logout/+server.js');
  const logoutReq = new Request('http://internal/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken })
  });
  const logoutRes = await logoutPOST({ request: logoutReq });
  const logoutBody = JSON.parse(await logoutRes.text());
  if (logoutRes.status !== 200) throw new Error('logout status ' + logoutRes.status);
  if (!logoutBody.success || !logoutBody.data.revoked) throw new Error('logout did not revoke');
  // Attempt refresh with revoked token
  const { POST: refreshPOST } = await import('../src/routes/auth/refresh/+server.js');
  const badRefreshReq = new Request('http://internal/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken })
  });
  const badRefreshRes = await refreshPOST({ request: badRefreshReq });
  const badBody = JSON.parse(await badRefreshRes.text());
  if (badRefreshRes.status === 200) throw new Error('revoked token refreshed');
  if (badRefreshRes.status !== 401) throw new Error('expected 401 for revoked');
  if (badBody.success) throw new Error('revoked refresh returned success');
  if (!badBody.error || badBody.error.message !== 'Token revoked') throw new Error('missing revoked message');
});

await test('menu route returns empty for anonymous and respects cache invalidation', async () => {
  if (process.env.DATABASE_URL === 'postgresql://example') {
    throw new Error('DATABASE_URL not set for integration test');
  }

  const email = `menu_${Date.now()}@example.com`;
  const { POST: registerPOST } = await import('../src/routes/auth/register/+server.js');
  const regReq = new Request('http://internal/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'StrongPass123!', name: 'Menu User' })
  });
  const regRes = await registerPOST({ request: regReq });
  const regBody = JSON.parse(await regRes.text());
  if (regRes.status !== 201) throw new Error('register status ' + regRes.status);
  const accessToken = regBody.data.tokens.access;

  // Anonymous menu
  const { GET: menuGET } = await import('../src/routes/menu/+server.js');
  const anonReq = new Request('http://internal/menu', { method: 'GET' });
  const anonRes = await menuGET({ request: anonReq });
  if (anonRes.status !== 200) throw new Error('anon menu status ' + anonRes.status);
  const anonBody = JSON.parse(await anonRes.text());
  if (!anonBody.success || !Array.isArray(anonBody.data.menu)) throw new Error('anon menu invalid');
  if (anonBody.data.menu.length !== 0) throw new Error('expected anonymous menu to be empty');

  // Authenticated menu (first call)
  const authReq = new Request('http://internal/menu', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
  const authRes1 = await menuGET({ request: authReq });
  if (authRes1.status !== 200) throw new Error('auth menu status ' + authRes1.status);
  const authBody1 = JSON.parse(await authRes1.text());
  if (!authBody1.success || !Array.isArray(authBody1.data.menu)) throw new Error('auth menu invalid');

  // Second call should return same shape (cached)
  const authRes2 = await menuGET({ request: authReq });
  if (authRes2.status !== 200) throw new Error('auth menu2 status ' + authRes2.status);
  const authBody2 = JSON.parse(await authRes2.text());
  if (JSON.stringify(authBody1.data.menu) !== JSON.stringify(authBody2.data.menu)) throw new Error('cached menu mismatch');

  // Invalidate cache and fetch again
  const { clearMenuCache } = await import('../src/lib/menu.js');
  clearMenuCache();
  const authRes3 = await menuGET({ request: authReq });
  if (authRes3.status !== 200) throw new Error('auth menu3 status ' + authRes3.status);
  const authBody3 = JSON.parse(await authRes3.text());
  if (!authBody3.success || !Array.isArray(authBody3.data.menu)) throw new Error('post-clear menu invalid');
});

console.log('\nTest Results:');
for (const line of results) console.log(line);
console.log(`\nPassed: ${pass}  Failed: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
