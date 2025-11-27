import { createPool } from '@vercel/postgres';
import { config } from './config.js';

// Use the validated config instead of raw process.env
const url = config.databaseUrl;

// cache pool on globalThis to avoid recreating in dev hot reload
const pool = globalThis.__pgPool__ || (globalThis.__pgPool__ = createPool({ connectionString: url }));

// Basic tagged template query helper
export async function query(strings, ...values) {
  return pool.sql(strings, ...values);
}

// Health check: returns server time
export async function ping() {
  const { rows } = await pool.sql`SELECT now() AS now`;
  return rows[0].now;
}

// Simple connectivity test
export async function canConnect() {
  const { rows } = await pool.sql`SELECT 1 AS ok`;
  return rows[0].ok === 1;
}