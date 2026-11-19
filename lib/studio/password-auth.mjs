import {digest, randomToken, signTicket, verifyTicket, verifyPassword, validPasswordHash} from './password-crypto.mjs';
import {loginPage, page, escapeHTML} from './login-page.mjs';

const COOKIE = '__Host-studio_session';
const SESSION_SECONDS = 12 * 60 * 60;
const seconds = () => Math.floor(Date.now() / 1000);
const redirect = (location, cookie) => new Response(null, {status: 303, headers: {
  Location: location, 'Cache-Control': 'no-store', ...(cookie ? {'Set-Cookie': cookie} : {}),
}});
const cookieValue = token => `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
const clearCookie = () => `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
const response = (content, status = 200, extra = {}) => new Response(content, {status, headers: {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", ...extra,
}});
function origin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('登录网址未配置');
  return url.origin;
}
function config(env, request) {
  const singleOrigin = env.AUTH_TOPOLOGY === 'single-origin' && env.AUTH_WORKSPACE === 'gateway';
  if (!env.DB || !(['kb', 'pmi'].includes(env.AUTH_WORKSPACE) || singleOrigin) || typeof env.AUTH_HANDOFF_SECRET !== 'string' || env.AUTH_HANDOFF_SECRET.length < 43) throw Error('登录配置尚未完成');
  const kb = origin(env.AUTH_KB_ORIGIN), pmi = origin(env.AUTH_PMI_ORIGIN);
  if ((singleOrigin ? kb !== pmi : kb === pmi) || new URL(request.url).origin !== (env.AUTH_WORKSPACE === 'kb' || singleOrigin ? kb : pmi)) throw Error('工作台网址配置不匹配');
  return {kb, pmi, workspace: env.AUTH_WORKSPACE, singleOrigin};
}
function accounts(env) {
  const users = JSON.parse(env.AUTH_ACCOUNTS_JSON || 'null');
  if (!Array.isArray(users) || users.length !== 2 || new Set(users.map(u => u.workspace)).size !== 2 || new Set(users.map(u => u.username)).size !== 2 || new Set(users.map(u => u.userId)).size !== 2 || users.some(u =>
    !['kb', 'pmi'].includes(u.workspace) || typeof u.username !== 'string' || !u.username.trim() || u.username !== u.username.trim() || u.username.length > 80 ||
    typeof u.userId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(u.userId) || typeof u.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) || u.email.length > 254 || !validPasswordHash(u.passwordHash))) throw Error('账号配置尚未完成');
  return users;
}
async function form(request) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw Error('请求格式错误');
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw Error('请求过大'); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}
async function session(request, env, cfg) {
  const token = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  if (cfg.singleOrigin) return env.DB.prepare("SELECT * FROM studio_auth_sessions WHERE token_hash=? AND workspace IN ('kb','pmi') AND expires>?").bind(await digest(token), seconds()).first();
  return env.DB.prepare('SELECT * FROM studio_auth_sessions WHERE token_hash=? AND workspace=? AND expires>?').bind(await digest(token), cfg.workspace, seconds()).first();
}
async function createSession(env, user, workspace) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO studio_auth_sessions(token_hash,user_id,username,email,workspace,expires) VALUES(?,?,?,?,?,?)')
    .bind(await digest(token), user.userId, user.username, user.email, workspace, seconds() + SESSION_SECONDS).run();
  return cookieValue(token);
}
async function throttle(env, request, username) {
  const now = seconds();
  const keys = [await digest('ip:' + (request.headers.get('cf-connecting-ip') || 'unknown')), await digest('user:' + username)];
  // Atomic counters in D1 survive Worker restarts and concurrent login requests.
  const results = await env.DB.batch(keys.map(key => env.DB.prepare(`INSERT INTO studio_auth_limits(key,attempts,expires) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING attempts`)
    .bind(key, now + 900, now, now)));
  return results[0].results[0].attempts <= 50 && results[1].results[0].attempts <= 10;
}
async function cleanup(env) {
  const now = seconds();
  await env.DB.batch(['studio_auth_sessions', 'studio_auth_tickets', 'studio_auth_limits'].map(table => env.DB.prepare(`DELETE FROM ${table} WHERE expires<=?`).bind(now)));
}

// Runs before every app, asset, API and MCP request. In platform mode Sites still owns identity.
export async function passwordAuth(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (!env.STUDIO_AUTH_MODE || env.STUDIO_AUTH_MODE === 'chatgpt') {
    if (path === '/login') return {response: redirect('/signin-with-chatgpt?return_to=/')};
    if (path === '/auth/logout') return {response: redirect('/signout-with-chatgpt?return_to=/')};
    return {request};
  }
  if (env.STUDIO_AUTH_MODE !== 'password') return {response: response(page('<h1>登录模式配置错误</h1>'), 503)};
  try {
    const cfg = config(env, request);
    // Validate all central credentials before accepting traffic, even on GET /login.
    const users = cfg.workspace === 'kb' || cfg.singleOrigin ? accounts(env) : null;
    if (path === '/mcp') return {response: Response.json({error: '用户名密码模式不开放 MCP 访问。'}, {status: 403})};
    if (['/login', '/signin-with-chatgpt', '/callback'].includes(path)) {
      if (request.method !== 'GET') return {response: response('Method not allowed', 405)};
      if (cfg.workspace === 'pmi') return {response: redirect(cfg.kb + '/login')};
      const current = await session(request, env, cfg);
      return {response: current ? redirect('/') : response(loginPage())};
    }
    if (path === '/signout-with-chatgpt') return {response: redirect('/auth/logout')};
    if (path === '/auth/login') {
      if (request.method !== 'POST' || (cfg.workspace !== 'kb' && !cfg.singleOrigin)) return {response: response('Method not allowed', 405)};
      if (request.headers.get('origin') !== cfg.kb) return {response: response('不允许跨站登录', 403)};
      let input;
      try { input = await form(request); } catch { return {response: response(loginPage('登录请求格式错误，请重试。'), 400)}; }
      const username = (input.get('username') || '').trim(), password = input.get('password') || '';
      if (!username || username.length > 80 || !password || password.length > 256) return {response: response(loginPage('请输入有效的用户名和密码。'), 400)};
      if (!await throttle(env, request, username)) return {response: response(loginPage('尝试次数过多，请在15分钟后重试。'), 429, {'Retry-After': '900'})};
      const user = users.find(u => u.username === username);
      const dummyHash = `pbkdf2-sha256$100000$${'A'.repeat(43)}$${'A'.repeat(43)}`;
      const valid = await verifyPassword(password, user?.passwordHash || dummyHash);
      if (!valid || !user) return {response: response(loginPage('用户名或密码错误。'), 401)};
      await cleanup(env);
      if (cfg.singleOrigin) return {response: redirect('/', await createSession(env, user, user.workspace))};
      if (user.workspace === 'kb') return {response: redirect('/', await createSession(env, user, 'kb'))};
      const now = seconds();
      const ticket = await signTicket({userId: user.userId, username: user.username, email: user.email, workspace: 'pmi', aud: cfg.pmi, iat: now, exp: now + 60, nonce: randomToken()}, env.AUTH_HANDOFF_SECRET);
      // POST handoff keeps the short-lived ticket out of URLs, browser history and referrers.
      const nonce = randomToken();
      return {response: response(page(`<h1>登录成功</h1><p class="intro">正在进入 PMI 工作台…</p><form action="${escapeHTML(cfg.pmi)}/auth/callback" method="post"><input type="hidden" name="ticket" value="${escapeHTML(ticket)}"><button>进入 PMI 工作台 →</button></form><script nonce="${nonce}">document.forms[0].submit()</script>`), 200, {
        'Set-Cookie': clearCookie(),
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action ${cfg.pmi}; frame-ancestors 'none'; base-uri 'none'`,
      })};
    }
    if (path === '/auth/callback') {
      if (request.method !== 'POST' || cfg.workspace !== 'pmi') return {response: response('Method not allowed', 405)};
      if (request.headers.get('origin') !== cfg.kb) return {response: response('不允许跨站登录', 403)};
      let token;
      try { token = (await form(request)).get('ticket'); } catch { return {response: response('登录凭证格式错误', 400)}; }
      const user = await verifyTicket(token, env.AUTH_HANDOFF_SECRET, cfg.pmi);
      if (!user) return {response: response(page('<h1>登录已过期</h1><a class="button" href="/login">重新登录</a>'), 401)};
      const consumed = await env.DB.prepare('INSERT OR IGNORE INTO studio_auth_tickets(nonce,expires) VALUES(?,?)').bind(user.nonce, user.exp).run();
      if (consumed.meta.changes !== 1) return {response: response('登录凭证已使用，请重新登录。', 401)};
      await cleanup(env);
      return {response: redirect('/', await createSession(env, user, 'pmi'))};
    }
    const current = await session(request, env, cfg);
    if (path === '/auth/logout') {
      if (request.method === 'GET') return {response: response(page('<h1>退出当前工作台？</h1><form action="/auth/logout" method="post"><button>退出登录</button></form><a class="button" href="/">返回工作台</a>'))};
      if (request.method !== 'POST') return {response: response('Method not allowed', 405)};
      if (request.headers.get('origin') !== url.origin) return {response: response('不允许跨站请求', 403)};
      if (current) await env.DB.prepare('DELETE FROM studio_auth_sessions WHERE token_hash=?').bind(current.token_hash).run();
      return {response: redirect(cfg.kb + '/login', clearCookie())};
    }
    if (!current) return {response: path.startsWith('/api/') ? Response.json({error: '登录已过期，请重新登录。'}, {status: 401, headers: {'Cache-Control': 'no-store'}}) : redirect(cfg.kb + '/login')};
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== url.origin) return {response: response('不允许跨站请求', 403)};
    // Never trust caller-supplied platform identity in password mode.
    const headers = new Headers(request.headers);
    for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-')) headers.delete(key);
    headers.set('oai-authenticated-user-id', current.user_id);
    headers.set('oai-authenticated-user-email', current.email);
    headers.set('oai-authenticated-user-full-name', encodeURIComponent(current.username));
    headers.set('oai-authenticated-user-full-name-encoding', 'percent-encoded-utf-8');
    return {request: new Request(request, {headers}), workspace: current.workspace};
  } catch {
    // No credentials, SQL errors or configuration values are exposed to visitors.
    return {response: response(page('<h1>登录服务尚未就绪</h1><p class="intro">请联系管理员检查登录配置与数据库迁移。</p>'), 503)};
  }
}
