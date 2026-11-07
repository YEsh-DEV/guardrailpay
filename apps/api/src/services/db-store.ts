import type {
  QuoteSealDatabase,
  MockDatabaseStore,
  MerchantRecord,
  InsertMerchantRecord,
  OperatorRecord,
  InsertOperatorRecord,
  RotationProposalRecord,
  InsertRotationProposalRecord,
  AuthAttemptRecord,
  InsertAuthAttemptRecord,
  ApprovalRecord,
  InsertApprovalRecord,
  AuditEventRecord,
  InsertAuditEventRecord,
  MerchantDomainChallengeRecord,
  InsertMerchantDomainChallengeRecord,
  OnboardingNonceRecord,
  InsertOnboardingNonceRecord,
  MerchantPayoutWalletRecord,
  InsertMerchantPayoutWalletRecord,
  ArkivSyncRecordDb,
  InsertArkivSyncRecordDb
} from '@quoteseal/shared';
import {
  createMockDatabase,
  merchants,
  operators,
  rotationProposals,
  authAttempts,
  approvals,
  auditEvents,
  merchantDomainChallenges,
  onboardingNonces,
  merchantPayoutWallets,
  arkivSyncRecords
} from '@quoteseal/shared';
import { eq, and, isNull, desc } from 'drizzle-orm';

export interface IDbStore {
  findMerchantById(id: string): Promise<MerchantRecord | null>;
  findMerchantByName(ensName: string): Promise<MerchantRecord | null>;
  findMerchantByIdentity(identityType: string, identityRef: string): Promise<MerchantRecord | null>;
  findMerchantByOrigin(origin: string): Promise<MerchantRecord | null>;
  saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void>;
  updateMerchant(id: string, updates: Partial<MerchantRecord>): Promise<void>;

  findOperatorById(id: string): Promise<OperatorRecord | null>;
  findOperatorByWallet(merchantId: string, walletAddress: string): Promise<OperatorRecord | null>;
  findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<OperatorRecord | null>;
  listOperators(merchantId: string): Promise<OperatorRecord[]>;
  saveOperator(operator: InsertOperatorRecord | OperatorRecord): Promise<void>;
  updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void>;

  findProposalById(id: string): Promise<RotationProposalRecord | null>;
  findProposalByHash(proposalHash: string): Promise<RotationProposalRecord | null>;
  saveProposal(proposal: InsertRotationProposalRecord | RotationProposalRecord): Promise<void>;
  updateProposalState(id: string, state: string, updates?: Record<string, unknown>): Promise<void>;

  saveAuthAttempt(attempt: InsertAuthAttemptRecord | AuthAttemptRecord): Promise<void>;
  findAuthAttemptByStateHash(stateHash: string): Promise<AuthAttemptRecord | null>;
  consumeAuthAttempt(id: string): Promise<boolean>;

  saveApproval(approval: InsertApprovalRecord | ApprovalRecord): Promise<void>;
  findApprovalByProposalId(proposalId: string): Promise<ApprovalRecord | null>;

  saveAuditEvent(event: InsertAuditEventRecord | AuditEventRecord): Promise<void>;
  listAuditEvents(merchantId: string): Promise<AuditEventRecord[]>;

  // Onboarding Nonces
  saveOnboardingNonce(nonce: InsertOnboardingNonceRecord | OnboardingNonceRecord): Promise<void>;
  findOnboardingNonce(nonce: string): Promise<OnboardingNonceRecord | null>;
  consumeOnboardingNonce(nonce: string): Promise<boolean>;

  // Domain Challenges
  saveDomainChallenge(challenge: InsertMerchantDomainChallengeRecord | MerchantDomainChallengeRecord): Promise<void>;
  findDomainChallengeById(id: string): Promise<MerchantDomainChallengeRecord | null>;
  findActiveDomainChallenge(merchantId: string): Promise<MerchantDomainChallengeRecord | null>;
  updateDomainChallengeStatus(id: string, status: string, verifiedAt?: Date | null): Promise<void>;

  // Multi-Payout Wallets (Operational Storage)
  savePayoutWallet(wallet: InsertMerchantPayoutWalletRecord | MerchantPayoutWalletRecord): Promise<void>;
  listPayoutWallets(merchantId: string): Promise<MerchantPayoutWalletRecord[]>;
  findActivePayoutWallet(merchantId: string): Promise<MerchantPayoutWalletRecord | null>;
  setPayoutWalletActive(merchantId: string, walletId: string): Promise<void>;

  // Arkiv Sync Records
  saveArkivSyncRecord(record: InsertArkivSyncRecordDb | ArkivSyncRecordDb): Promise<void>;
  listArkivSyncRecords(merchantId: string): Promise<ArkivSyncRecordDb[]>;
  findLatestArkivSyncRecord(merchantId: string, entityType: string): Promise<ArkivSyncRecordDb | null>;
}

export class MemoryDbStore implements IDbStore {
  constructor(private readonly mockDb: MockDatabaseStore = createMockDatabase()) {}

  async findMerchantById(id: string): Promise<MerchantRecord | null> {
    return this.mockDb.merchants.get(id) ?? null;
  }

  async findMerchantByName(ensName: string): Promise<MerchantRecord | null> {
    for (const m of this.mockDb.merchants.values()) {
      if (m.ensName && m.ensName.toLowerCase() === ensName.toLowerCase()) return m;
    }
    return null;
  }

  async findMerchantByIdentity(identityType: string, identityRef: string): Promise<MerchantRecord | null> {
    for (const m of this.mockDb.merchants.values()) {
      if (
        m.identityType?.toUpperCase() === identityType.toUpperCase() &&
        (m.identityRef?.toLowerCase() === identityRef.toLowerCase() ||
          m.ensName?.toLowerCase() === identityRef.toLowerCase() ||
          m.domain?.toLowerCase() === identityRef.toLowerCase())
      ) {
        return m;
      }
    }
    return null;
  }

  async findMerchantByOrigin(origin: string): Promise<MerchantRecord | null> {
    const targetOrigin = origin.toLowerCase().replace(/\/+$/, '');
    for (const m of this.mockDb.merchants.values()) {
      const mOrigin = (m.endpointOrigin || '').toLowerCase().replace(/\/+$/, '');
      if (mOrigin === targetOrigin) return m;
    }
    return null;
  }

  async saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void> {
    const id = merchant.id ?? `merchant-${Date.now()}`;
    const fullMerchant = { ...merchant, id } as MerchantRecord;
    this.mockDb.merchants.set(id, fullMerchant);
  }

  async updateMerchant(id: string, updates: Partial<MerchantRecord>): Promise<void> {
    const m = this.mockDb.merchants.get(id);
    if (m) {
      Object.assign(m, updates);
      this.mockDb.merchants.set(id, m);
    }
  }

  async findOperatorById(id: string): Promise<OperatorRecord | null> {
    return this.mockDb.operators.get(id) ?? null;
  }

  async findOperatorByWallet(merchantId: string, walletAddress: string): Promise<OperatorRecord | null> {
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId && op.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        return op;
      }
    }
    return null;
  }

  async findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<OperatorRecord | null> {
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId && op.subjectHmac === subjectHmac) {
        return op;
      }
    }
    return null;
  }

  async listOperators(merchantId: string): Promise<OperatorRecord[]> {
    const list: OperatorRecord[] = [];
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId) list.push(op);
    }
    return list;
  }

  async saveOperator(operator: InsertOperatorRecord | OperatorRecord): Promise<void> {
    this.mockDb.operators.set(operator.id ?? `op-${Date.now()}`, operator as OperatorRecord);
  }

  async updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void> {
    const op = this.mockDb.operators.get(id);
    if (op) {
      op.status = status;
      if (revokedAt !== undefined) op.revokedAt = revokedAt;
      this.mockDb.operators.set(id, op);
    }
  }

  async findProposalById(id: string): Promise<RotationProposalRecord | null> {
    return this.mockDb.rotationProposals.get(id) ?? null;
  }

  async findProposalByHash(proposalHash: string): Promise<RotationProposalRecord | null> {
    for (const p of this.mockDb.rotationProposals.values()) {
      if (p.proposalHash.toLowerCase() === proposalHash.toLowerCase()) return p;
    }
    return null;
  }

  async saveProposal(proposal: InsertRotationProposalRecord | RotationProposalRecord): Promise<void> {
    this.mockDb.rotationProposals.set(proposal.id ?? `prop-${Date.now()}`, proposal as RotationProposalRecord);
  }

  async updateProposalState(id: string, state: string, updates: Record<string, unknown> = {}): Promise<void> {
    const p = this.mockDb.rotationProposals.get(id);
    if (p) {
      Object.assign(p, { state, ...updates });
      this.mockDb.rotationProposals.set(id, p);
    }
  }

  async saveAuthAttempt(attempt: InsertAuthAttemptRecord | AuthAttemptRecord): Promise<void> {
    this.mockDb.authAttempts.set(attempt.id ?? `attempt-${Date.now()}`, attempt as AuthAttemptRecord);
  }

  async findAuthAttemptByStateHash(stateHash: string): Promise<AuthAttemptRecord | null> {
    for (const a of this.mockDb.authAttempts.values()) {
      if (a.stateHash === stateHash) return a;
    }
    return null;
  }

  async consumeAuthAttempt(id: string): Promise<boolean> {
    const a = this.mockDb.authAttempts.get(id);
    if (!a || a.consumedAt || a.status === 'consumed') {
      return false;
    }
    a.consumedAt = new Date();
    a.status = 'consumed';
    this.mockDb.authAttempts.set(id, a);
    return true;
  }

  async saveApproval(approval: InsertApprovalRecord | ApprovalRecord): Promise<void> {
    this.mockDb.approvals.set(approval.id ?? `approval-${Date.now()}`, approval as ApprovalRecord);
  }

  async findApprovalByProposalId(proposalId: string): Promise<ApprovalRecord | null> {
    for (const app of this.mockDb.approvals.values()) {
      if (app.proposalId === proposalId) return app;
    }
    return null;
  }

  async saveAuditEvent(event: InsertAuditEventRecord | AuditEventRecord): Promise<void> {
    this.mockDb.auditEvents.push(event as AuditEventRecord);
  }

  async listAuditEvents(merchantId: string): Promise<AuditEventRecord[]> {
    return this.mockDb.auditEvents.filter((e) => e.merchantId === merchantId);
  }

  // Onboarding Nonces
  async saveOnboardingNonce(nonce: InsertOnboardingNonceRecord | OnboardingNonceRecord): Promise<void> {
    this.mockDb.onboardingNonces.set(nonce.nonce, nonce as OnboardingNonceRecord);
  }

  async findOnboardingNonce(nonce: string): Promise<OnboardingNonceRecord | null> {
    return this.mockDb.onboardingNonces.get(nonce) ?? null;
  }

  async consumeOnboardingNonce(nonce: string): Promise<boolean> {
    const record = this.mockDb.onboardingNonces.get(nonce);
    if (!record || record.consumedAt || new Date() > new Date(record.expiresAt)) {
      return false;
    }
    record.consumedAt = new Date();
    this.mockDb.onboardingNonces.set(nonce, record);
    return true;
  }

  // Domain Challenges
  async saveDomainChallenge(challenge: InsertMerchantDomainChallengeRecord | MerchantDomainChallengeRecord): Promise<void> {
    const id = challenge.id ?? `challenge-${Date.now()}`;
    this.mockDb.merchantDomainChallenges.set(id, { ...challenge, id } as MerchantDomainChallengeRecord);
  }

  async findDomainChallengeById(id: string): Promise<MerchantDomainChallengeRecord | null> {
    return this.mockDb.merchantDomainChallenges.get(id) ?? null;
  }

  async findActiveDomainChallenge(merchantId: string): Promise<MerchantDomainChallengeRecord | null> {
    for (const c of this.mockDb.merchantDomainChallenges.values()) {
      if (c.merchantId === merchantId && c.status === 'PENDING') {
        return c;
      }
    }
    return null;
  }

  async updateDomainChallengeStatus(id: string, status: string, verifiedAt?: Date | null): Promise<void> {
    const c = this.mockDb.merchantDomainChallenges.get(id);
    if (c) {
      c.status = status;
      if (verifiedAt !== undefined) c.verifiedAt = verifiedAt;
      this.mockDb.merchantDomainChallenges.set(id, c);
    }
  }

  // Multi-Payout Wallets
  async savePayoutWallet(wallet: InsertMerchantPayoutWalletRecord | MerchantPayoutWalletRecord): Promise<void> {
    const id = wallet.id ?? `wallet-${Date.now()}`;
    this.mockDb.merchantPayoutWallets.set(id, { ...wallet, id } as MerchantPayoutWalletRecord);
  }

  async listPayoutWallets(merchantId: string): Promise<MerchantPayoutWalletRecord[]> {
    const list: MerchantPayoutWalletRecord[] = [];
    for (const w of this.mockDb.merchantPayoutWallets.values()) {
      if (w.merchantId === merchantId) list.push(w);
    }
    return list;
  }

  async findActivePayoutWallet(merchantId: string): Promise<MerchantPayoutWalletRecord | null> {
    for (const w of this.mockDb.merchantPayoutWallets.values()) {
      if (w.merchantId === merchantId && w.isActive) return w;
    }
    return null;
  }

  async setPayoutWalletActive(merchantId: string, walletId: string): Promise<void> {
    for (const [id, w] of this.mockDb.merchantPayoutWallets.entries()) {
      if (w.merchantId === merchantId) {
        w.isActive = id === walletId;
        w.status = id === walletId ? 'ACTIVE' : (w.status === 'ACTIVE' ? 'ARCHIVED' : w.status);
        this.mockDb.merchantPayoutWallets.set(id, w);
      }
    }
  }

  // Arkiv Sync Records
  async saveArkivSyncRecord(record: InsertArkivSyncRecordDb | ArkivSyncRecordDb): Promise<void> {
    const id = record.id ?? `arkiv-${Date.now()}`;
    this.mockDb.arkivSyncRecords.set(id, { ...record, id } as ArkivSyncRecordDb);
  }

  async listArkivSyncRecords(merchantId: string): Promise<ArkivSyncRecordDb[]> {
    const list: ArkivSyncRecordDb[] = [];
    for (const r of this.mockDb.arkivSyncRecords.values()) {
      if (r.merchantId === merchantId) list.push(r);
    }
    return list;
  }

  async findLatestArkivSyncRecord(merchantId: string, entityType: string): Promise<ArkivSyncRecordDb | null> {
    let latest: ArkivSyncRecordDb | null = null;
    for (const r of this.mockDb.arkivSyncRecords.values()) {
      if (r.merchantId === merchantId && r.entityType === entityType) {
        if (!latest || r.version > latest.version) {
          latest = r;
        }
      }
    }
    return latest;
  }
}

export class PostgresDbStore implements IDbStore {
  constructor(private readonly db: QuoteSealDatabase) {}

  async findMerchantById(id: string): Promise<MerchantRecord | null> {
    const rows = await this.db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findMerchantByName(ensName: string): Promise<MerchantRecord | null> {
    const rows = await this.db.select().from(merchants).where(eq(merchants.ensName, ensName.toLowerCase())).limit(1);
    return rows[0] ?? null;
  }

  async findMerchantByIdentity(identityType: string, identityRef: string): Promise<MerchantRecord | null> {
    const rows = await this.db
      .select()
      .from(merchants)
      .where(and(eq(merchants.identityType, identityType.toUpperCase()), eq(merchants.identityRef, identityRef)))
      .limit(1);
    if (rows[0]) return rows[0];

    // Also check domain or ensName if identityRef didn't match directly
    const byEns = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.ensName, identityRef.toLowerCase()))
      .limit(1);
    if (byEns[0]) return byEns[0];

    const byDomain = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.domain, identityRef.toLowerCase()))
      .limit(1);
    return byDomain[0] ?? null;
  }

  async findMerchantByOrigin(origin: string): Promise<MerchantRecord | null> {
    const targetOrigin = origin.toLowerCase().replace(/\/+$/, '');
    const rows = await this.db.select().from(merchants).where(eq(merchants.endpointOrigin, targetOrigin)).limit(1);
    return rows[0] ?? null;
  }

  async saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void> {
    await this.db.insert(merchants).values(merchant as InsertMerchantRecord);
  }

  async updateMerchant(id: string, updates: Partial<MerchantRecord>): Promise<void> {
    await this.db.update(merchants).set(updates).where(eq(merchants.id, id));
  }

  async findOperatorById(id: string): Promise<OperatorRecord | null> {
    const rows = await this.db.select().from(operators).where(eq(operators.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findOperatorByWallet(merchantId: string, walletAddress: string): Promise<OperatorRecord | null> {
    const rows = await this.db
      .select()
      .from(operators)
      .where(and(eq(operators.merchantId, merchantId), eq(operators.walletAddress, walletAddress.toLowerCase())))
      .limit(1);
    return rows[0] ?? null;
  }

  async findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<OperatorRecord | null> {
    const rows = await this.db
      .select()
      .from(operators)
      .where(and(eq(operators.merchantId, merchantId), eq(operators.subjectHmac, subjectHmac)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listOperators(merchantId: string): Promise<OperatorRecord[]> {
    return this.db.select().from(operators).where(eq(operators.merchantId, merchantId));
  }

  async saveOperator(operator: InsertOperatorRecord | OperatorRecord): Promise<void> {
    await this.db.insert(operators).values(operator as InsertOperatorRecord);
  }

  async updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void> {
    await this.db.update(operators).set({ status, revokedAt: revokedAt ?? null }).where(eq(operators.id, id));
  }

  async findProposalById(id: string): Promise<RotationProposalRecord | null> {
    const rows = await this.db.select().from(rotationProposals).where(eq(rotationProposals.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findProposalByHash(proposalHash: string): Promise<RotationProposalRecord | null> {
    const rows = await this.db
      .select()
      .from(rotationProposals)
      .where(eq(rotationProposals.proposalHash, proposalHash.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async saveProposal(proposal: InsertRotationProposalRecord | RotationProposalRecord): Promise<void> {
    await this.db.insert(rotationProposals).values(proposal as InsertRotationProposalRecord);
  }

  async updateProposalState(id: string, state: string, updates: Record<string, unknown> = {}): Promise<void> {
    await this.db.update(rotationProposals).set({ state, ...updates }).where(eq(rotationProposals.id, id));
  }

  async saveAuthAttempt(attempt: InsertAuthAttemptRecord | AuthAttemptRecord): Promise<void> {
    await this.db.insert(authAttempts).values(attempt as InsertAuthAttemptRecord);
  }

  async findAuthAttemptByStateHash(stateHash: string): Promise<AuthAttemptRecord | null> {
    const rows = await this.db.select().from(authAttempts).where(eq(authAttempts.stateHash, stateHash)).limit(1);
    return rows[0] ?? null;
  }

  async consumeAuthAttempt(id: string): Promise<boolean> {
    const updated = await this.db
      .update(authAttempts)
      .set({ consumedAt: new Date(), status: 'consumed' })
      .where(and(eq(authAttempts.id, id), isNull(authAttempts.consumedAt)))
      .returning({ id: authAttempts.id });
    return updated.length > 0;
  }

  async saveApproval(approval: InsertApprovalRecord | ApprovalRecord): Promise<void> {
    await this.db.insert(approvals).values(approval as InsertApprovalRecord);
  }

  async findApprovalByProposalId(proposalId: string): Promise<ApprovalRecord | null> {
    const rows = await this.db.select().from(approvals).where(eq(approvals.proposalId, proposalId)).limit(1);
    return rows[0] ?? null;
  }

  async saveAuditEvent(event: InsertAuditEventRecord | AuditEventRecord): Promise<void> {
    await this.db.insert(auditEvents).values(event as InsertAuditEventRecord);
  }

  async listAuditEvents(merchantId: string): Promise<AuditEventRecord[]> {
    return this.db.select().from(auditEvents).where(eq(auditEvents.merchantId, merchantId));
  }

  // Onboarding Nonces
  async saveOnboardingNonce(nonce: InsertOnboardingNonceRecord | OnboardingNonceRecord): Promise<void> {
    await this.db.insert(onboardingNonces).values(nonce as InsertOnboardingNonceRecord);
  }

  async findOnboardingNonce(nonce: string): Promise<OnboardingNonceRecord | null> {
    const rows = await this.db.select().from(onboardingNonces).where(eq(onboardingNonces.nonce, nonce)).limit(1);
    return rows[0] ?? null;
  }

  async consumeOnboardingNonce(nonce: string): Promise<boolean> {
    const updated = await this.db
      .update(onboardingNonces)
      .set({ consumedAt: new Date() })
      .where(and(eq(onboardingNonces.nonce, nonce), isNull(onboardingNonces.consumedAt)))
      .returning({ nonce: onboardingNonces.nonce });
    return updated.length > 0;
  }

  // Domain Challenges
  async saveDomainChallenge(challenge: InsertMerchantDomainChallengeRecord | MerchantDomainChallengeRecord): Promise<void> {
    await this.db.insert(merchantDomainChallenges).values(challenge as InsertMerchantDomainChallengeRecord);
  }

  async findDomainChallengeById(id: string): Promise<MerchantDomainChallengeRecord | null> {
    const rows = await this.db
      .select()
      .from(merchantDomainChallenges)
      .where(eq(merchantDomainChallenges.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveDomainChallenge(merchantId: string): Promise<MerchantDomainChallengeRecord | null> {
    const rows = await this.db
      .select()
      .from(merchantDomainChallenges)
      .where(and(eq(merchantDomainChallenges.merchantId, merchantId), eq(merchantDomainChallenges.status, 'PENDING')))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateDomainChallengeStatus(id: string, status: string, verifiedAt?: Date | null): Promise<void> {
    await this.db
      .update(merchantDomainChallenges)
      .set({ status, verifiedAt: verifiedAt ?? null })
      .where(eq(merchantDomainChallenges.id, id));
  }

  // Multi-Payout Wallets
  async savePayoutWallet(wallet: InsertMerchantPayoutWalletRecord | MerchantPayoutWalletRecord): Promise<void> {
    await this.db.insert(merchantPayoutWallets).values(wallet as InsertMerchantPayoutWalletRecord);
  }

  async listPayoutWallets(merchantId: string): Promise<MerchantPayoutWalletRecord[]> {
    return this.db.select().from(merchantPayoutWallets).where(eq(merchantPayoutWallets.merchantId, merchantId));
  }

  async findActivePayoutWallet(merchantId: string): Promise<MerchantPayoutWalletRecord | null> {
    const rows = await this.db
      .select()
      .from(merchantPayoutWallets)
      .where(and(eq(merchantPayoutWallets.merchantId, merchantId), eq(merchantPayoutWallets.isActive, true)))
      .limit(1);
    return rows[0] ?? null;
  }

  async setPayoutWalletActive(merchantId: string, walletId: string): Promise<void> {
    await this.db
      .update(merchantPayoutWallets)
      .set({ isActive: false })
      .where(eq(merchantPayoutWallets.merchantId, merchantId));
    await this.db
      .update(merchantPayoutWallets)
      .set({ isActive: true, status: 'ACTIVE' })
      .where(and(eq(merchantPayoutWallets.id, walletId), eq(merchantPayoutWallets.merchantId, merchantId)));
  }

  // Arkiv Sync Records
  async saveArkivSyncRecord(record: InsertArkivSyncRecordDb | ArkivSyncRecordDb): Promise<void> {
    await this.db.insert(arkivSyncRecords).values(record as InsertArkivSyncRecordDb);
  }

  async listArkivSyncRecords(merchantId: string): Promise<ArkivSyncRecordDb[]> {
    return this.db.select().from(arkivSyncRecords).where(eq(arkivSyncRecords.merchantId, merchantId));
  }

  async findLatestArkivSyncRecord(merchantId: string, entityType: string): Promise<ArkivSyncRecordDb | null> {
    const rows = await this.db
      .select()
      .from(arkivSyncRecords)
      .where(and(eq(arkivSyncRecords.merchantId, merchantId), eq(arkivSyncRecords.entityType, entityType)))
      .orderBy(desc(arkivSyncRecords.version))
      .limit(1);
    return rows[0] ?? null;
  }
}

export function createDbStore(db: QuoteSealDatabase | MockDatabaseStore): IDbStore {
  if ('merchants' in db && db.merchants instanceof Map) {
    return new MemoryDbStore(db as MockDatabaseStore);
  }
  return new PostgresDbStore(db as QuoteSealDatabase);
}
