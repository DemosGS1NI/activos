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

// Execute arbitrary sequences within a SQL transaction.
export async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.sql`BEGIN`;
    const result = await handler(client);
    await client.sql`COMMIT`;
    return result;
  } catch (error) {
    try {
      await client.sql`ROLLBACK`;
    } catch (rollbackError) {
      console.error('Transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
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