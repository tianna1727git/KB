import {decode, signTicket} from './password-crypto.mjs';
const encoder = new TextEncoder();

// Short-lived server-to-server assertion, never returned to the browser.
export async function signGatewayRequest(request, workspace, secret) {
  const url = new URL(request.url);
  return signTicket({
    workspace, origin: url.origin, method: request.method, path: url.pathname + url.search,
    uid: request.headers.get('oai-authenticated-user-id'), email: request.headers.get('oai-authenticated-user-email'),
    name: request.headers.get('oai-authenticated-user-full-name'), exp: Math.floor(Date.now() / 1000) + 30,
  }, secret);
}

export async function gatewayIdentity(request, env) {
  try {
    const token = request.headers.get('x-studio-proxy-auth');
    if (typeof env.AUTH_PROXY_SECRET !== 'string' || env.AUTH_PROXY_SECRET.length < 43 || !['kb', 'pmi'].includes(env.AUTH_WORKSPACE) || !token || token.length > 4096) throw Error('Invalid configuration');
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) throw Error('Invalid signature');
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.AUTH_PROXY_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, decode(signature), encoder.encode(body))) throw Error('Invalid signature');
    const identity = JSON.parse(new TextDecoder().decode(decode(body)));
    const url = new URL(request.url), origin = new URL(env.AUTH_PUBLIC_ORIGIN);
    const now = Math.floor(Date.now() / 1000);
    if (origin.protocol !== 'https:' || origin.origin !== env.AUTH_PUBLIC_ORIGIN ||
      identity.origin !== origin.origin || identity.workspace !== env.AUTH_WORKSPACE ||
      identity.method !== request.method || identity.path !== url.pathname + url.search ||
      !Number.isInteger(identity.exp) || identity.exp <= now || identity.exp > now + 30 ||
      typeof identity.uid !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(identity.uid) ||
      typeof identity.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) || identity.email.length > 254 ||
      typeof identity.name !== 'string' || identity.name.length > 1000) throw Error('Invalid identity');
    const headers = new Headers(request.headers);
    for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-') || key.startsWith('x-studio-')) headers.delete(key);
    headers.delete('cookie');
    headers.set('oai-authenticated-user-id', identity.uid);
    headers.set('oai-authenticated-user-email', identity.email);
    headers.set('oai-authenticated-user-full-name', identity.name);
    headers.set('oai-authenticated-user-full-name-encoding', 'percent-encoded-utf-8');
    headers.set('host', origin.host);
    const rewritten = new Request(origin.origin + url.pathname + url.search, request);
    return {request: new Request(rewritten, {headers})};
  } catch {
    return {response: Response.json({error: '请通过统一登录入口访问工作台。'}, {status: 401, headers: {'Cache-Control': 'no-store'}})};
  }
}
