import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {passwordAuth} from '../lib/studio/password-auth.mjs';
import {hashPassword, verifyPassword, signTicket, verifyTicket, randomToken} from '../lib/studio/password-crypto.mjs';

const kbOrigin = 'https://kb.example.com', pmiOrigin = 'https://pmi.example.com';
const password = 'a-test-password-only';
const passwordHash = await hashPassword(password);
const users = [
  {username: 'kb-admin', userId: 'kb-owner', email: 'kb@example.com', workspace: 'kb', passwordHash},
  {username: 'pmi-admin', userId: 'pmi-owner', email: 'pmi@example.com', workspace: 'pmi', passwordHash},
];
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0001_password_auth.sql', import.meta.url), 'utf8'));
  const prepare = sql => ({bind: (...args) => ({
    async first() {return db.prepare(sql).get(...args) || null;},
    async run() {const r = db.prepare(sql).run(...args); return {meta: {changes: Number(r.changes)}};},
    async all() {return {results: db.prepare(sql).all(...args)};},
  })});
  return {prepare, async batch(statements) {
    db.exec('BEGIN');
    try {const result = []; for (const s of statements) result.push(await s.all()); db.exec('COMMIT'); return result;}
    catch (e) {db.exec('ROLLBACK'); throw e;}
  }, raw: db};
}
function environments() {
  const common = {STUDIO_AUTH_MODE: 'password', AUTH_KB_ORIGIN: kbOrigin, AUTH_PMI_ORIGIN: pmiOrigin, AUTH_HANDOFF_SECRET: randomToken()};
  return {
    kb: {...common, AUTH_WORKSPACE: 'kb', DB: database(), AUTH_ACCOUNTS_JSON: JSON.stringify(users)},
    pmi: {...common, AUTH_WORKSPACE: 'pmi', DB: database()},
  };
}
function request(base, path, {method = 'GET', body, cookie, headers = {}} = {}) {
  return new Request(base + path, {method, headers: {
    ...(body ? {'content-type': 'application/x-www-form-urlencoded', origin: base} : {}),
    ...(cookie ? {cookie} : {}), ...headers,
  }, ...(body ? {body: new URLSearchParams(body)} : {})});
}
const login = (env, username = 'kb-admin', pass = password) => passwordAuth(request(kbOrigin, '/auth/login', {method: 'POST', body: {username, password: pass}}), env);
const cookie = response => response.headers.get('set-cookie').split(';')[0];
const ticket = async response => (await response.text()).match(/name="ticket" value="([^"]+)"/)[1];

test('password hashes have random salts and reject wrong passwords', async () => {
  assert.notEqual(passwordHash, await hashPassword(password));
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong', passwordHash), false);
  assert.equal(await verifyPassword(password, 'plain-text'), false);
});
test('provisioning reads password from stdin and outputs only a salted account hash', async () => {
  const child = spawnSync(process.execPath, ['scripts/create-login-account.mjs', '--workspace', 'kb', '--username', 'admin', '--email', 'admin@example.com'], {input: password + '\n', encoding: 'utf8'});
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.includes(password), false);
  const account = JSON.parse(child.stdout);
  assert.equal(account.userId, 'kb-owner');
  assert.equal(await verifyPassword(password, account.passwordHash), true);
});
test('KB logs in locally; caller identity is replaced and logout revokes the session', async () => {
  const {kb} = environments();
  const {response} = await login(kb);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
  assert.match(response.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);
  const sessionCookie = cookie(response);
  const result = await passwordAuth(request(kbOrigin, '/api/studio/state', {cookie: sessionCookie, headers: {'oai-authenticated-user-id': 'attacker'}}), kb);
  assert.equal(result.request.headers.get('oai-authenticated-user-id'), 'kb-owner');
  const logout = await passwordAuth(request(kbOrigin, '/auth/logout', {method: 'POST', cookie: sessionCookie, body: {}}), kb);
  assert.equal(logout.response.status, 303);
  assert.equal((await passwordAuth(request(kbOrigin, '/api/studio/state', {cookie: sessionCookie}), kb)).response.status, 401);
});
test('PMI account receives a POST ticket and only PMI accepts it once', async () => {
  const {kb, pmi} = environments();
  const {response} = await login(kb, 'pmi-admin');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  const token = await ticket(response);
  const callback = () => passwordAuth(request(pmiOrigin, '/auth/callback', {method: 'POST', body: {ticket: token}, headers: {origin: kbOrigin}}), pmi);
  const accepted = await callback();
  assert.equal(accepted.response.status, 303);
  const pmiCookie = cookie(accepted.response);
  const result = await passwordAuth(request(pmiOrigin, '/api/studio/state', {cookie: pmiCookie}), pmi);
  assert.equal(result.request.headers.get('oai-authenticated-user-id'), 'pmi-owner');
  assert.equal((await callback()).response.status, 401);
  assert.equal((await passwordAuth(request(kbOrigin, '/api/studio/state', {cookie: pmiCookie}), kb)).response.status, 401);
});
test('KB cookie cannot grant PMI access and spoofed platform headers do not bypass login', async () => {
  const {kb, pmi} = environments();
  const {response} = await login(kb);
  for (const opts of [{cookie: cookie(response)}, {headers: {'oai-authenticated-user-id': 'kb-owner', 'oai-authenticated-user-email': 'kb@example.com'}}]) {
    assert.equal((await passwordAuth(request(pmiOrigin, '/api/studio/state', opts), pmi)).response.status, 401);
  }
  assert.equal((await passwordAuth(request(pmiOrigin, '/'), pmi)).response.headers.get('location'), kbOrigin + '/login');
});
test('signed tickets reject tampering, expiry, wrong destination and secret', async () => {
  const secret = randomToken(), now = Math.floor(Date.now() / 1000);
  const payload = {...users[1], passwordHash: undefined, aud: pmiOrigin, iat: now, exp: now + 60, nonce: randomToken()};
  const token = await signTicket(payload, secret);
  assert.ok(await verifyTicket(token, secret, pmiOrigin, now));
  assert.equal(await verifyTicket(token + 'x', secret, pmiOrigin, now), null);
  assert.equal(await verifyTicket(token, secret, kbOrigin, now), null);
  assert.equal(await verifyTicket(token, randomToken(), pmiOrigin, now), null);
  assert.equal(await verifyTicket(token, secret, pmiOrigin, now + 61), null);
  assert.equal(await verifyTicket(await signTicket({...payload, workspace: 'kb'}, secret), secret, pmiOrigin, now), null);
});
test('cross-origin login, callback and authenticated writes are blocked', async () => {
  const {kb, pmi} = environments();
  const req = request(kbOrigin, '/auth/login', {method: 'POST', body: {username: 'kb-admin', password}, headers: {origin: 'https://evil.example'}});
  assert.equal((await passwordAuth(request(kbOrigin, '/auth/login', {method: 'POST', body: {username: 'kb-admin', password}, headers: {origin: 'null'}}), kb)).response.status, 403);
  assert.equal((await passwordAuth(req, kb)).response.status, 403);
  assert.equal((await passwordAuth(request(pmiOrigin, '/auth/callback', {method: 'POST', body: {ticket: 'anything'}, headers: {origin: pmiOrigin}}), pmi)).response.status, 403);
  const sessionCookie = cookie((await login(kb)).response);
  assert.equal((await passwordAuth(request(kbOrigin, '/api/studio/run', {method: 'POST', body: {}, cookie: sessionCookie, headers: {origin: 'https://evil.example'}}), kb)).response.status, 403);
});
test('wrong and unknown accounts have identical errors, then durable limits reject attempts', async () => {
  const {kb} = environments();
  const wrong = (await login(kb, 'kb-admin', 'wrong')).response;
  const unknown = (await login(kb, 'unknown', 'wrong')).response;
  assert.equal(wrong.status, 401); assert.equal(await wrong.text(), await unknown.text());
  for (let i = 1; i < 10; i++) assert.equal((await login(kb, 'kb-admin', 'wrong')).response.status, 401);
  assert.equal((await login(kb)).response.status, 429);
});
test('expired sessions and forged cookies are rejected', async () => {
  const {kb} = environments(); const result = await login(kb);
  kb.DB.raw.exec('UPDATE studio_auth_sessions SET expires=0');
  for (const sessionCookie of [cookie(result.response), '__Host-studio_session=' + randomToken()]) {
    assert.equal((await passwordAuth(request(kbOrigin, '/api/studio/state', {cookie: sessionCookie}), kb)).response.status, 401);
  }
});
test('missing config, migrations and unknown modes fail closed; default platform mode is preserved', async () => {
  const {kb} = environments();
  for (const env of [{...kb, AUTH_HANDOFF_SECRET: ''}, {...kb, AUTH_KB_ORIGIN: 'https://evil.example'}, {...kb, AUTH_ACCOUNTS_JSON: '[]'}, {...kb, STUDIO_AUTH_MODE: 'typo'}]) {
    assert.equal((await passwordAuth(request(kbOrigin, '/'), env)).response.status, 503);
  }
  kb.DB.raw.exec('DROP TABLE studio_auth_sessions');
  assert.equal((await passwordAuth(request(kbOrigin, '/', {cookie: '__Host-studio_session=' + randomToken()}), kb)).response.status, 503);
  const req = request(kbOrigin, '/');
  assert.equal((await passwordAuth(req, {})).request, req);
  assert.match((await passwordAuth(request(kbOrigin, '/login'), {})).response.headers.get('location'), /^\/signin-with-chatgpt/);
});
test('login HTML has accessible form fields, escaping and no-store policy; MCP stays closed', async () => {
  const {kb} = environments();
  const {response} = await passwordAuth(request(kbOrigin, '/login'), kb);
  const html = await response.text();
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /label for="username"/);
  // no-referrer makes browser navigation POSTs send Origin: null.
  assert.match(html, /name="referrer" content="strict-origin-when-cross-origin"/);
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await passwordAuth(request(kbOrigin, '/mcp'), kb)).response.status, 403);
});
