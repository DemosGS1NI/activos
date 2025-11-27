// Central environment configuration and validation.
// Reads from process.env (for scripts) and is compatible with SvelteKit server code.
// Fail fast on missing critical variables.

import { config as loadEnv } from 'dotenv';

if (!process.env.SKIP_DOTENV) {
  // Load .env.local first (preferred for secrets), then fallback to .env without overriding existing values.
  for (const file of ['.env.local', '.env']) {
    loadEnv({ path: file, override: false });
  }
}

const required = ['DATABASE_URL', 'JWT_SECRET'];

function validateEnv() {
  const errors = [];
  for (const key of required) {
    if (!process.env[key] || String(process.env[key]).trim() === '') {
      errors.push(`Missing env var: ${key}`);
    }
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (errors.length) {
    throw new Error('Environment validation failed:\n' + errors.join('\n'));
  }
}

let cachedConfig = null;

export function getConfig() {
  if (cachedConfig) return cachedConfig;
  validateEnv();
  const nodeEnv = process.env.NODE_ENV || 'development';
  const config = {
    nodeEnv,
    isProd: nodeEnv === 'production',
    isDev: nodeEnv !== 'production',
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // Token lifetimes (seconds)
    accessTokenTtl: 15 * 60, // 15 minutes
    refreshTokenTtl: 7 * 24 * 60 * 60 // 7 days
  };
  cachedConfig = Object.freeze(config);
  return cachedConfig;
}

// Convenience accessor (throws on first call if invalid)
export const config = getConfig();
