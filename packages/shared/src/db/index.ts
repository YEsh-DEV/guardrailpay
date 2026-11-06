import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { DatabaseError } from '../errors/index.js';

export * from './schema.js';

export type QuoteSealDatabase = NodePgDatabase<typeof schema>;

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
  if (!connectionString) {
    throw new DatabaseError('DATABASE_URL is required to initialize PostgreSQL connection');
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
