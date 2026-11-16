const encoder = new TextEncoder();
export const encode = value => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
export const randomToken = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
export async function hashPassword(password, salt = randomToken()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations: 100000}, key, 256);
  return `pbkdf2-sha256$100000$${salt}$${encode(new Uint8Array(bits))}`;
}
export function validPasswordHash(hash) {
  return /^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{43}\$[A-Za-z0-9_-]{43}$/.test(hash);
}
export async function verifyPassword(password, hash) {
  if (!validPasswordHash(hash)) return false;
  const actual = await hashPassword(password, hash.split('$')[2]);
  // Comparing digests through Web Crypto avoids a prefix-dependent string comparison.
  const key = await crypto.subtle.importKey('raw', encoder.encode(hash), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(actual));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(hash));
}
async function signingKey(secret) {
  if (typeof secret !== 'string' || secret.length < 43) throw new Error('登录密钥未配置');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
export async function signTicket(payload, secret) {
  const body = encode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}
export async function verifyTicket(token, secret, audience, now = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await signingKey(secret), decode(parts[1]), encoder.encode(parts[0]))) return null;
    const p = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (p.aud !== audience || p.workspace !== 'pmi' || !Number.isInteger(p.exp) || p.exp <= now || p.exp > now + 60 ||
      !Number.isInteger(p.iat) || p.iat > now + 5 || p.exp - p.iat !== 60 ||
      !/^[A-Za-z0-9_-]{43}$/.test(p.nonce) || typeof p.userId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(p.userId) ||
      typeof p.username !== 'string' || p.username.length > 80 || typeof p.email !== 'string' || p.email.length > 254) return null;
    return p;
  } catch { return null; }
}
