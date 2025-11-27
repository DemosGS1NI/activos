// Password hashing helper using PBKDF2 (no external deps).
// Format: pbkdf2$iterations$salt$hash (base64 components)

import crypto from 'crypto';

const ITERATIONS = 120000; // Reasonable for serverless, adjust if needed
const KEY_LENGTH = 32; // 256-bit
const DIGEST = 'sha256';

function toBase64(buf) {
  return buf.toString('base64');
}

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be >= 8 characters');
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return ['pbkdf2', ITERATIONS, toBase64(salt), toBase64(derived)].join('$');
}

export function verifyPassword(password, stored) {
  try {
    const parts = stored.split('$');
    if (parts.length !== 4) return false;
    const [algo, iterStr, saltB64, hashB64] = parts;
    if (algo !== 'pbkdf2') return false;
    const iterations = parseInt(iterStr, 10);
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = crypto.pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
    // Constant time compare
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// Rehash decision: if iterations changed upward.
export function needsRehash(stored) {
  const parts = stored.split('$');
  if (parts.length !== 4) return true;
  const iter = parseInt(parts[1], 10);
  return iter < ITERATIONS;
}
