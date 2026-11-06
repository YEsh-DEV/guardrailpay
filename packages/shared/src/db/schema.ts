import {
  pgTable,
  uuid,
  varchar,
  bigint,
  integer,
  timestamp,
  text,
  jsonb,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// 1. MERCHANTS TABLE
// =============================================================================
export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ensName: varchar('ens_name', { length: 255 }).notNull().unique(),
  namehash: varchar('namehash', { length: 66 }).notNull().unique(),
  endpointOrigin: varchar('endpoint_origin', { length: 255 }).notNull(),
  chainId: bigint('chain_id', { mode: 'number' }).notNull().default(11155111),
  registryAddress: varchar('registry_address', { length: 42 }).notNull(),
  resolverAddress: varchar('resolver_address', { length: 42 }).notNull(),
  controllerAddress: varchar('controller_address', { length: 42 }),
  ownerAddress: varchar('owner_address', { length: 42 }).notNull(),
  nameExpiry: bigint('name_expiry', { mode: 'number' }).notNull(),
  profileVersion: integer('profile_version').notNull().default(1),
  network: varchar('network', { length: 64 }).notNull().default('hedera:testnet'),
  scheme: varchar('scheme', { length: 32 }).notNull().default('exact'),
  assetId: varchar('asset_id', { length: 64 }).notNull().default('0.0.0'),
  activePayTo: varchar('active_pay_to', { length: 64 }).notNull(),
  maxAmount: varchar('max_amount', { length: 78 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// =============================================================================
// 2. BUYER MERCHANT TRUST ANCHORS
// =============================================================================
export const merchantTrust = pgTable(
  'merchant_trust',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    buyerId: varchar('buyer_id', { length: 128 }).notNull(),
    trustedOwner: varchar('trusted_owner', { length: 42 }).notNull(),
    trustedResolver: varchar('trusted_resolver', { length: 42 }).notNull(),
    trustedExpiry: bigint('trusted_expiry', { mode: 'number' }).notNull(),
    trustedProfileVersion: integer('trusted_profile_version').notNull(),
    trustedAt: timestamp('trusted_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true })
  },
  (table) => [
    uniqueIndex('uq_buyer_merchant').on(table.buyerId, table.merchantId)
  ]
);

// =============================================================================
// 3. ENROLLED OPERATORS
// =============================================================================
export const operators = pgTable(
  'operators',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    role: varchar('role', { length: 64 }).notNull().default('ROLE_ROTATION_APPROVER'),
    issuer: varchar('issuer', { length: 255 }).notNull(),
    subjectHmac: varchar('subject_hmac', { length: 64 }).notNull(),
    subjectEncrypted: text('subject_encrypted'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true })
  },
  (table) => [
    uniqueIndex('uq_operator_identity').on(table.merchantId, table.issuer, table.subjectHmac)
  ]
);

// =============================================================================
// 4. ROTATION PROPOSALS
// =============================================================================
export const rotationProposals = pgTable('rotation_proposals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  oldPayTo: varchar('old_pay_to', { length: 64 }).notNull(),
  newPayTo: varchar('new_pay_to', { length: 64 }).notNull(),
  proposalHash: varchar('proposal_hash', { length: 66 }).notNull().unique(),
  proposalNonce: bigint('proposal_nonce', { mode: 'number' }).notNull(),
  proposedBy: varchar('proposed_by', { length: 42 }).notNull(),
  proposedAt: timestamp('proposed_at', { withTimezone: true }).defaultNow().notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  state: varchar('state', { length: 32 }).notNull().default('PROPOSED'),
  activatedTx: varchar('activated_tx', { length: 66 }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  reasonCode: varchar('reason_code', { length: 64 })
});

// =============================================================================
// 5. AUTHENTICATION ATTEMPTS (WORLD OIDC PKCE)
// =============================================================================
export const authAttempts = pgTable('auth_attempts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  operatorId: uuid('operator_id')
    .notNull()
    .references(() => operators.id, { onDelete: 'cascade' }),
  proposalId: uuid('proposal_id')
    .notNull()
    .references(() => rotationProposals.id, { onDelete: 'cascade' }),
  proposalHash: varchar('proposal_hash', { length: 66 }).notNull(),
  sessionId: varchar('session_id', { length: 128 }).notNull(),
  stateHash: varchar('state_hash', { length: 64 }).notNull().unique(),
  nonceHash: varchar('nonce_hash', { length: 64 }).notNull().unique(),
  pkceVerifierEncrypted: text('pkce_verifier_encrypted').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('pending')
});

// =============================================================================
// 6. APPROVALS AND ATTESTATIONS
// =============================================================================
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => rotationProposals.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    authAttemptId: uuid('auth_attempt_id')
      .notNull()
      .references(() => authAttempts.id, { onDelete: 'cascade' }),
    authTime: bigint('auth_time', { mode: 'number' }).notNull(),
    acr: varchar('acr', { length: 64 }),
    amr: varchar('amr', { length: 64 }),
    attestor: varchar('attestor', { length: 42 }).notNull(),
    signature: text('signature').notNull(),
    signatureHash: varchar('signature_hash', { length: 66 }).notNull(),
    attestationExpiry: bigint('attestation_expiry', { mode: 'number' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true })
  },
  (table) => [
    uniqueIndex('uq_proposal_approval').on(table.proposalId)
  ]
);

// =============================================================================
// 7. AUDIT EVENTS
// =============================================================================
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  decisionId: varchar('decision_id', { length: 128 }).notNull(),
  proposalId: uuid('proposal_id').references(() => rotationProposals.id),
  verdict: varchar('verdict', { length: 32 }).notNull(),
  reasonCode: varchar('reason_code', { length: 64 }).notNull(),
  chainId: bigint('chain_id', { mode: 'number' }).notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  blockHash: varchar('block_hash', { length: 66 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
