import {createServer, request as httpRequest} from 'node:http';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
import {isIP} from 'node:net';
import {passwordAuth} from '../lib/studio/password-auth.mjs';
import {signGatewayRequest} from '../lib/studio/gateway-identity.mjs';
import {openAuthDatabase} from './auth-database.mjs';

const HOP_HEADERS = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
function cleanHeaders(source) {
  const headers = new Headers(source);
  const connectionHeaders = (headers.get('connection') || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const key of [...HOP_HEADERS, ...connectionHeaders]) headers.delete(key);
  return headers;
}
async function send(response, outgoing) {
  const headers = Object.fromEntries(response.headers);
  if (response.headers.getSetCookie().length) headers['set-cookie'] = response.headers.getSetCookie();
  outgoing.writeHead(response.status, headers);
  if (!response.body) {outgoing.end(); return;}
  await pipeline(Readable.fromWeb(response.body), outgoing);
}
function backend(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Backend must be a loopback HTTP origin');
  return url;
}
export function createGateway(env) {
  const publicURL = new URL(env.AUTH_PUBLIC_ORIGIN);
  if (publicURL.protocol !== 'https:' || publicURL.origin !== env.AUTH_PUBLIC_ORIGIN || typeof env.AUTH_PROXY_SECRET !== 'string' || env.AUTH_PROXY_SECRET.length < 43 ||
    env.AUTH_TOPOLOGY !== 'single-origin' || env.AUTH_WORKSPACE !== 'gateway' || env.STUDIO_AUTH_MODE !== 'password' ||
    env.AUTH_KB_ORIGIN !== publicURL.origin || env.AUTH_PMI_ORIGIN !== publicURL.origin) throw Error('Invalid single-origin gateway configuration');
  const upstreams = {kb: backend(env.KB_UPSTREAM), pmi: backend(env.PMI_UPSTREAM)};
  if (upstreams.kb.origin === upstreams.pmi.origin) throw Error('Workspaces must use different backends');
  return createServer(async (incoming, outgoing) => {
    const abort = new AbortController();
    incoming.once('aborted', () => abort.abort());
    outgoing.once('close', () => {if (!outgoing.writableEnded) abort.abort();});
    try {
      if (incoming.headers.host !== publicURL.host) {outgoing.writeHead(421); outgoing.end('Unrecognized host'); return;}
      const url = new URL(incoming.url, publicURL);
      if (url.origin !== publicURL.origin) {outgoing.writeHead(400); outgoing.end(); return;}
      if (incoming.headers.upgrade) {outgoing.writeHead(426); outgoing.end(); return;}
      const headers = cleanHeaders(Object.entries(incoming.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]]));
      headers.delete('forwarded');
      for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-') || key.startsWith('x-studio-') || key.startsWith('x-forwarded-') || key.startsWith('cf-')) headers.delete(key);
      // Nginx must overwrite X-Real-IP. This process only binds to loopback.
      const clientIP = incoming.headers['x-real-ip'];
      headers.set('cf-connecting-ip', typeof clientIP === 'string' && isIP(clientIP) ? clientIP : incoming.socket.remoteAddress || 'unknown');
      headers.delete('x-real-ip');
      let bytes = 0;
      const limiter = new Transform({transform(chunk, encoding, done) {
        bytes += chunk.length;
        done(bytes > 40 * 1024 * 1024 ? Error('Request too large') : null, chunk);
      }});
      const hasBody = !['GET', 'HEAD'].includes(incoming.method);
      const body = hasBody ? incoming.pipe(limiter) : undefined;
      const request = new Request(url, {method: incoming.method, headers, signal: abort.signal,
        ...(body ? {body: Readable.toWeb(body), duplex: 'half'} : {})});
      const auth = await passwordAuth(request, env);
      if (auth.response) {await send(auth.response, outgoing); return;}
      if (!['kb', 'pmi'].includes(auth.workspace)) throw Error('No workspace');
      const target = upstreams[auth.workspace];
      const forwarded = cleanHeaders(auth.request.headers);
      for (const key of [...forwarded.keys()]) if (key.startsWith('oai-authenticated-') || key.startsWith('x-studio-') || key.startsWith('cf-')) forwarded.delete(key);
      forwarded.delete('cookie');
      forwarded.set('host', publicURL.host);
      forwarded.set('x-studio-proxy-auth', await signGatewayRequest(auth.request, auth.workspace, env.AUTH_PROXY_SECRET));
      await new Promise((resolve, reject) => {
        const upstream = httpRequest({hostname: target.hostname, port: target.port, path: url.pathname + url.search,
          method: incoming.method, headers: Object.fromEntries(forwarded), signal: abort.signal}, response => {
          const responseHeaders = cleanHeaders(Object.entries(response.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]]));
          responseHeaders.delete('set-cookie');
          responseHeaders.delete('x-studio-proxy-auth');
          responseHeaders.set('cache-control', 'private, no-store');
          responseHeaders.set('vary', 'Cookie');
          if (responseHeaders.has('location')) {
            const location = new URL(responseHeaders.get('location'), publicURL);
            if (location.origin !== publicURL.origin) {response.resume(); reject(Error('Unexpected redirect')); return;}
            responseHeaders.set('location', location.pathname + location.search + location.hash);
          }
          outgoing.writeHead(response.statusCode || 502, Object.fromEntries(responseHeaders));
          pipeline(response, outgoing).then(resolve, reject);
        });
        upstream.setTimeout(300000, () => upstream.destroy(Error('Backend timeout')));
        upstream.once('error', reject);
        if (auth.request.body) pipeline(Readable.fromWeb(auth.request.body), upstream).catch(reject);
        else upstream.end();
      });
    } catch {
      if (!outgoing.headersSent) {outgoing.writeHead(502, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}); outgoing.end('工作台暂时不可用，请稍后重试。');}
      else outgoing.destroy();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  if (!process.env.AUTH_DATABASE_PATH) throw Error('AUTH_DATABASE_PATH is required');
  const db = openAuthDatabase(process.env.AUTH_DATABASE_PATH);
  const server = createGateway({...process.env, DB: db});
  const port = Number(process.env.GATEWAY_PORT || 5176);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid gateway port');
  server.listen(port, '127.0.0.1', () => console.log(`Unified login ready on 127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => {db.close(); process.exit(0);}));
}
