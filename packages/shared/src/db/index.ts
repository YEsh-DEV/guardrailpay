import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import * as schema from './schema.js';
import { ConfigurationError } from '../errors/index.js';

export * from './schema.js';

export type QuoteSealDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseReadiness {
  connected: boolean;
  migrationsApplied: boolean;
}

function requiredMigrationTimestamps(): string[] {
  const journal = JSON.parse(readFileSync(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  return journal.entries.map((entry: { when: number }) => String(entry.when));
}

export async function checkDatabaseReadiness(pool: Pick<pg.Pool, 'query'>): Promise<DatabaseReadiness> {
  try {
    await pool.query('SELECT 1');
  } catch {
    return { connected: false, migrationsApplied: false };
  }

  try {
    const table = await pool.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS name");
    if (!table.rows[0]?.name) return { connected: true, migrationsApplied: false };
    const result = await pool.query('SELECT created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at');
    const applied = result.rows.map((row: { created_at: string }) => row.created_at);
    const required = requiredMigrationTimestamps();
    return {
      connected: true,
      migrationsApplied: applied.length >= required.length && required.every((timestamp, index) => applied[index] === timestamp)
    };
  } catch {
    return { connected: true, migrationsApplied: false };
  }
}

export async function requireDatabaseConnection(pool: Pick<pg.Pool, 'query'>): Promise<DatabaseReadiness> {
  const readiness = await checkDatabaseReadiness(pool);
  if (!readiness.connected) throw new ConfigurationError('PostgreSQL connection failed; API startup aborted');
  return readiness;
}

export interface DatabaseConnectionOptions {
  connectionString?: string;
  maxConnections?: number;
}

export function createDatabaseClient(options: DatabaseConnectionOptions = {}): {
  db: QuoteSealDatabase;
  pool: pg.Pool;
  close: () => Promise<void>;
} {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new ConfigurationError('DATABASE_URL is required to initialize PostgreSQL');
  }

  const pool = new pg.Pool({
    connectionString,
    max: options.maxConnections ?? 10
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    }
  };
}

// In-memory mock database store for isolated unit tests
export interface MockDatabaseStore {
  merchants: Map<string, typeof schema.merchants.$inferSelect>;
  merchantTrust: Map<string, typeof schema.merchantTrust.$inferSelect>;
  operators: Map<string, typeof schema.operators.$inferSelect>;
  rotationProposals: Map<string, typeof schema.rotationProposals.$inferSelect>;
  authAttempts: Map<string, typeof schema.authAttempts.$inferSelect>;
  approvals: Map<string, typeof schema.approvals.$inferSelect>;
  auditEvents: Array<typeof schema.auditEvents.$inferSelect>;
}

export function createMockDatabase(): MockDatabaseStore {
  return {
    merchants: new Map(),
    merchantTrust: new Map(),
    operators: new Map(),
    rotationProposals: new Map(),
    authAttempts: new Map(),
    approvals: new Map(),
    auditEvents: []
  };
}
