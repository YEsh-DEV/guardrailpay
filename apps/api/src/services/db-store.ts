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
  InsertAuditEventRecord
} from '@quoteseal/shared';
import {
  createMockDatabase,
  merchants,
  operators,
  rotationProposals,
  authAttempts,
  approvals,
  auditEvents
} from '@quoteseal/shared';
import { eq, and, isNull } from 'drizzle-orm';

export interface IDbStore {
  findMerchantById(id: string): Promise<MerchantRecord | null>;
  findMerchantByName(ensName: string): Promise<MerchantRecord | null>;
  saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void>;

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
}

export class MemoryDbStore implements IDbStore {
  constructor(private readonly mockDb: MockDatabaseStore = createMockDatabase()) {}

  async findMerchantById(id: string): Promise<MerchantRecord | null> {
    return this.mockDb.merchants.get(id) ?? null;
  }

  async findMerchantByName(ensName: string): Promise<MerchantRecord | null> {
    for (const m of this.mockDb.merchants.values()) {
      if (m.ensName.toLowerCase() === ensName.toLowerCase()) return m;
    }
    return null;
  }

  async saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void> {
    this.mockDb.merchants.set(merchant.id ?? `merchant-${Date.now()}`, merchant as MerchantRecord);
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

  async saveMerchant(merchant: InsertMerchantRecord | MerchantRecord): Promise<void> {
    await this.db.insert(merchants).values(merchant as InsertMerchantRecord);
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
}

export function createDbStore(db: QuoteSealDatabase | MockDatabaseStore): IDbStore {
  if ('merchants' in db && db.merchants instanceof Map) {
    return new MemoryDbStore(db as MockDatabaseStore);
  }
  return new PostgresDbStore(db as QuoteSealDatabase);
}
