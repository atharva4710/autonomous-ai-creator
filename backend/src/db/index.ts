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
 * Robustly resolves the path to schema.sql in both development (src) and compiled production (dist) environments.
 */
export function resolveSchemaPath(): string {
  const possiblePaths = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'dist', 'db', 'schema.sql'),
    path.join(process.cwd(), 'backend', 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'backend', 'dist', 'db', 'schema.sql'),
    path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`schema.sql file not found in any expected location: ${possiblePaths.join(', ')}`);
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
    const schemaPath = resolveSchemaPath();
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await p.query(sql);
    isInitialized = true;
    console.log(`[Database] PostgreSQL schema initialized successfully from ${schemaPath}.`);
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
