import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let pool: Pool | null = null;
let isInitialized = false;

/**
 * Gets or initializes the PostgreSQL connection pool.
 */
export function getDbPool(): Pool | null {
  if (process.env.NODE_ENV === 'test') {
    return null; // Keep unit tests 100% deterministic & isolated without requiring local PG
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.trim()) {
    return null; // DB URL not configured
  }

  if (!pool) {
    pool = new Pool({
      connectionString: connectionString.trim(),
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('render.com') || connectionString.includes('railway.app')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return pool;
}

/**
 * Ensures PostgreSQL tables and indexes are created.
 */
export async function initDbSchema(): Promise<boolean> {
  const p = getDbPool();
  if (!p) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await p.query(sql);
    isInitialized = true;
    console.log('[Database] PostgreSQL schema initialized successfully.');
    return true;
  } catch (err: any) {
    console.error('[Database] Failed to initialize PostgreSQL schema:', err.message);
    return false;
  }
}

/**
 * Safely closes the DB pool during shutdown.
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isInitialized = false;
  }
}
