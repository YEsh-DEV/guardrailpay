import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './quoteseal.db';
const sqlite = new Database(dbPath);

// Initialize tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    ens_name TEXT NOT NULL UNIQUE,
    service_endpoint TEXT NOT NULL,
    active_pay_to TEXT NOT NULL,
    network TEXT NOT NULL DEFAULT 'hedera:testnet',
    asset TEXT NOT NULL DEFAULT 'HBAR',
    max_amount TEXT NOT NULL DEFAULT '1000000000',
    verified INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    challenge_token TEXT NOT NULL,
    domain TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rotations (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    current_pay_to TEXT NOT NULL,
    pending_pay_to TEXT NOT NULL,
    proposed_at INTEGER NOT NULL,
    approved_at INTEGER,
    effective_at INTEGER,
    status TEXT NOT NULL DEFAULT 'PROPOSED',
    world_subject TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
