// Lightweight HS256 JWT implementation using Web Crypto (Node >=20)
// Avoids external dependencies.
// Use relative import so tests (plain Node) work without Vite alias.
import { config } from './config.js';
import crypto from 'crypto';

const textEncoder = new TextEncoder();

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlJSON(obj) {
  return base64url(JSON.stringify(obj));
}

async function hmacSHA256(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
  return base64url(Buffer.from(signature));
}

export async function sign(payload, ttlSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedHeader = base64urlJSON(header);
  const encodedPayload = base64urlJSON(fullPayload);
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const sig = await hmacSHA256(toSign, config.jwtSecret);
  return `${toSign}.${sig}`;
}

export async function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const toSign = `${h}.${p}`;
  const expected = await hmacSHA256(toSign, config.jwtSecret);
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    // Expiry: reject if current time >= exp (RFC 7519 semantics)
    if (typeof payload.exp !== 'number' || now >= payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

export function decode(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch { return null; }
}

// Convenience accessors for access and refresh tokens.
export async function signAccess(user, menu = null) {
  // Include minimal user claims to avoid DB lookup on each request.
  // Keep payload small: id, email, role object, status, and optional menu.
  const role = user.role_id ? { id: user.role_id, name: user.role_name || null } : null;
  const payload = { sub: user.id, type: 'access', role, status: user.status, name: user.name };
  if (user.email) payload.email = user.email;
  if (user.name) payload.name = user.name;
  if (menu) payload.menu = menu;

  return sign(payload, config.accessTokenTtl);


}

export async function signRefresh(user) {
  // Include unique token id (jti) so consecutive refresh tokens differ even within same second
  const jti = crypto.randomUUID();
  return sign({ sub: user.id, type: 'refresh', jti }, config.refreshTokenTtl);
}
