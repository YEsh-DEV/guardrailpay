import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  ensName: text('ens_name').notNull().unique(),
  serviceEndpoint: text('service_endpoint').notNull(),
  activePayTo: text('active_pay_to').notNull(),
  network: text('network').notNull().default('hedera:testnet'),
  asset: text('asset').notNull().default('HBAR'),
  maxAmount: text('max_amount').notNull().default('1000000000'),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  merchantId: text('merchant_id').notNull(),
  challengeToken: text('challenge_token').notNull(),
  domain: text('domain').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const rotations = sqliteTable('rotations', {
  id: text('id').primaryKey(),
  merchantId: text('merchant_id').notNull(),
  currentPayTo: text('current_pay_to').notNull(),
  pendingPayTo: text('pending_pay_to').notNull(),
  proposedAt: integer('proposed_at').notNull(),
  approvedAt: integer('approved_at'),
  effectiveAt: integer('effective_at'),
  status: text('status').notNull().default('PROPOSED'), // PROPOSED | APPROVED | ACTIVE | REVOKED
  worldSubject: text('world_subject'),
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
});
