import {Miniflare, createFetchMock} from 'miniflare';
import {build} from 'esbuild';
import {mkdirSync, readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {hashPassword, randomToken} from '../lib/studio/password-crypto.mjs';

mkdirSync('.sites-runtime/tests', {recursive: true});
await build({entryPoints: ['tests/password-auth-worker.mjs'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: '.sites-runtime/tests/password-auth.mjs'});
const kb = 'https://kb.example.com', pmi = 'https://pmi.example.com';
const passwordHash = await hashPassword('integration-test-password');
const shared = {STUDIO_AUTH_MODE: 'password', AUTH_KB_ORIGIN: kb, AUTH_PMI_ORIGIN: pmi, AUTH_HANDOFF_SECRET: randomToken()};
const mock = createFetchMock(); mock.disableNetConnect();
const mf = new Miniflare({fetchMock: mock, workers: ['kb', 'pmi'].map(name => ({
  name, routes: [(name === 'kb' ? kb : pmi).replace('https://', '') + '/*'], modules: true, scriptPath: '.sites-runtime/tests/password-auth.mjs', compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  d1Databases: {DB: 'auth-test-' + name}, r2Buckets: {BUCKET: 'auth-test-files-' + name},
  bindings: {...shared, AUTH_WORKSPACE: name, ...(name === 'kb' ? {AUTH_ACCOUNTS_JSON: JSON.stringify(['kb', 'pmi'].map(workspace => ({
    username: workspace + '-admin', userId: workspace + '-owner', workspace, email: workspace + '@example.com', passwordHash,
  })))} : {})},
}))});
try {
  const workers = {};
  for (const name of ['kb', 'pmi']) {
    workers[name] = {fetch: (url, options) => mf.dispatchFetch(url, options)};
    const db = await mf.getD1Database('DB', name);
    for (const file of ['0000_mature_bug.sql', '0001_password_auth.sql']) {
      const sql = readFileSync('drizzle/' + file, 'utf8').replaceAll('--> statement-breakpoint', '');
      for (const statement of sql.split(';').filter(s => s.trim())) await db.prepare(statement).run();
    }
  }
  const login = username => workers.kb.fetch(kb + '/auth/login', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded', origin: kb}, body: new URLSearchParams({username, password: 'integration-test-password'}), redirect: 'manual'});
  const kbLogin = await login('kb-admin'); assert.equal(kbLogin.status, 303, await kbLogin.clone().text());
  const kbCookie = kbLogin.headers.get('set-cookie').split(';')[0];
  const state = await workers.kb.fetch(kb + '/api/studio/state', {headers: {cookie: kbCookie}});
  assert.equal(state.status, 200, await state.clone().text());
  assert.equal((await state.json()).user.id, 'kb-owner');
  const pmiLogin = await login('pmi-admin'); assert.equal(pmiLogin.status, 200);
  const token = (await pmiLogin.text()).match(/name="ticket" value="([^"]+)"/)[1];
  const callback = () => workers.pmi.fetch(pmi + '/auth/callback', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded', origin: kb}, body: new URLSearchParams({ticket: token}), redirect: 'manual'});
  const accepted = await callback(); assert.equal(accepted.status, 303, await accepted.clone().text());
  assert.equal((await callback()).status, 401);
  const pmiCookie = accepted.headers.get('set-cookie').split(';')[0];
  const pmiState = await workers.pmi.fetch(pmi + '/api/studio/state', {headers: {cookie: pmiCookie}});
  assert.equal(pmiState.status, 200);
  assert.equal((await pmiState.json()).user.id, 'pmi-owner');
  assert.equal((await workers.pmi.fetch(pmi + '/api/studio/state', {headers: {cookie: kbCookie}})).status, 401);
  assert.equal((await workers.kb.fetch(kb + '/api/studio/state', {headers: {cookie: pmiCookie}})).status, 401);
  console.log('Password auth Workers/D1 integration passed: both accounts, real API access, POST handoff, replay rejection and workspace isolation.');
} finally {await mf.dispose();}
