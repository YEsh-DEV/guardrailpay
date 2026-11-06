import type { QuoteSealDatabase, MockDatabaseStore } from '@quoteseal/shared';
import {
  merchants,
  operators,
  rotationProposals,
  authAttempts,
  approvals,
  auditEvents
} from '@quoteseal/shared';
import { eq, and } from 'drizzle-orm';

export interface IDbStore {
  findMerchantById(id: string): Promise<any | null>;
  findMerchantByName(ensName: string): Promise<any | null>;
  saveMerchant(merchant: any): Promise<void>;

  findOperatorById(id: string): Promise<any | null>;
  findOperatorByWallet(merchantId: string, walletAddress: string): Promise<any | null>;
  findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<any | null>;
  listOperators(merchantId: string): Promise<any[]>;
  saveOperator(operator: any): Promise<void>;
  updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void>;

  findProposalById(id: string): Promise<any | null>;
  findProposalByHash(proposalHash: string): Promise<any | null>;
  saveProposal(proposal: any): Promise<void>;
  updateProposalState(id: string, state: string, updates?: Record<string, unknown>): Promise<void>;

  saveAuthAttempt(attempt: any): Promise<void>;
  findAuthAttemptByStateHash(stateHash: string): Promise<any | null>;
  consumeAuthAttempt(id: string): Promise<void>;

  saveApproval(approval: any): Promise<void>;
  findApprovalByProposalId(proposalId: string): Promise<any | null>;

  saveAuditEvent(event: any): Promise<void>;
  listAuditEvents(merchantId: string): Promise<any[]>;
}

export class MemoryDbStore implements IDbStore {
  constructor(private readonly mockDb: MockDatabaseStore) {}

  async findMerchantById(id: string): Promise<any | null> {
    return this.mockDb.merchants.get(id) ?? null;
  }

  async findMerchantByName(ensName: string): Promise<any | null> {
    for (const m of this.mockDb.merchants.values()) {
      if (m.ensName.toLowerCase() === ensName.toLowerCase()) return m;
    }
    return null;
  }

  async saveMerchant(merchant: any): Promise<void> {
    this.mockDb.merchants.set(merchant.id, merchant);
  }

  async findOperatorById(id: string): Promise<any | null> {
    return this.mockDb.operators.get(id) ?? null;
  }

  async findOperatorByWallet(merchantId: string, walletAddress: string): Promise<any | null> {
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId && op.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        return op;
      }
    }
    return null;
  }

  async findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<any | null> {
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId && op.subjectHmac === subjectHmac) {
        return op;
      }
    }
    return null;
  }

  async listOperators(merchantId: string): Promise<any[]> {
    const list: any[] = [];
    for (const op of this.mockDb.operators.values()) {
      if (op.merchantId === merchantId) list.push(op);
    }
    return list;
  }

  async saveOperator(operator: any): Promise<void> {
    this.mockDb.operators.set(operator.id, operator);
  }

  async updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void> {
    const op = this.mockDb.operators.get(id);
    if (op) {
      op.status = status;
      if (revokedAt !== undefined) op.revokedAt = revokedAt;
      this.mockDb.operators.set(id, op);
    }
  }

  async findProposalById(id: string): Promise<any | null> {
    return this.mockDb.rotationProposals.get(id) ?? null;
  }

  async findProposalByHash(proposalHash: string): Promise<any | null> {
    for (const p of this.mockDb.rotationProposals.values()) {
      if (p.proposalHash.toLowerCase() === proposalHash.toLowerCase()) return p;
    }
    return null;
  }

  async saveProposal(proposal: any): Promise<void> {
    this.mockDb.rotationProposals.set(proposal.id, proposal);
  }

  async updateProposalState(id: string, state: string, updates: Record<string, unknown> = {}): Promise<void> {
    const p = this.mockDb.rotationProposals.get(id);
    if (p) {
      Object.assign(p, { state, ...updates });
      this.mockDb.rotationProposals.set(id, p);
    }
  }

  async saveAuthAttempt(attempt: any): Promise<void> {
    this.mockDb.authAttempts.set(attempt.id, attempt);
  }

  async findAuthAttemptByStateHash(stateHash: string): Promise<any | null> {
    for (const a of this.mockDb.authAttempts.values()) {
      if (a.stateHash === stateHash) return a;
    }
    return null;
  }

  async consumeAuthAttempt(id: string): Promise<void> {
    const a = this.mockDb.authAttempts.get(id);
    if (a) {
      a.consumedAt = new Date();
      a.status = 'consumed';
      this.mockDb.authAttempts.set(id, a);
    }
  }

  async saveApproval(approval: any): Promise<void> {
    this.mockDb.approvals.set(approval.id, approval);
  }

  async findApprovalByProposalId(proposalId: string): Promise<any | null> {
    for (const app of this.mockDb.approvals.values()) {
      if (app.proposalId === proposalId) return app;
    }
    return null;
  }

  async saveAuditEvent(event: any): Promise<void> {
    this.mockDb.auditEvents.push(event);
  }

  async listAuditEvents(merchantId: string): Promise<any[]> {
    return this.mockDb.auditEvents.filter((e) => e.merchantId === merchantId);
  }
}

export class PostgresDbStore implements IDbStore {
  constructor(private readonly db: QuoteSealDatabase) {}

  async findMerchantById(id: string): Promise<any | null> {
    const rows = await this.db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findMerchantByName(ensName: string): Promise<any | null> {
    const rows = await this.db.select().from(merchants).where(eq(merchants.ensName, ensName.toLowerCase())).limit(1);
    return rows[0] ?? null;
  }

  async saveMerchant(merchant: any): Promise<void> {
    await this.db.insert(merchants).values(merchant);
  }

  async findOperatorById(id: string): Promise<any | null> {
    const rows = await this.db.select().from(operators).where(eq(operators.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findOperatorByWallet(merchantId: string, walletAddress: string): Promise<any | null> {
    const rows = await this.db
      .select()
      .from(operators)
      .where(and(eq(operators.merchantId, merchantId), eq(operators.walletAddress, walletAddress.toLowerCase())))
      .limit(1);
    return rows[0] ?? null;
  }

  async findOperatorBySubjectHmac(merchantId: string, subjectHmac: string): Promise<any | null> {
    const rows = await this.db
      .select()
      .from(operators)
      .where(and(eq(operators.merchantId, merchantId), eq(operators.subjectHmac, subjectHmac)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listOperators(merchantId: string): Promise<any[]> {
    return this.db.select().from(operators).where(eq(operators.merchantId, merchantId));
  }

  async saveOperator(operator: any): Promise<void> {
    await this.db.insert(operators).values(operator);
  }

  async updateOperatorStatus(id: string, status: 'active' | 'revoked', revokedAt?: Date | null): Promise<void> {
    await this.db.update(operators).set({ status, revokedAt: revokedAt ?? null }).where(eq(operators.id, id));
  }

  async findProposalById(id: string): Promise<any | null> {
    const rows = await this.db.select().from(rotationProposals).where(eq(rotationProposals.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findProposalByHash(proposalHash: string): Promise<any | null> {
    const rows = await this.db
      .select()
      .from(rotationProposals)
      .where(eq(rotationProposals.proposalHash, proposalHash.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async saveProposal(proposal: any): Promise<void> {
    await this.db.insert(rotationProposals).values(proposal);
  }

  async updateProposalState(id: string, state: string, updates: Record<string, unknown> = {}): Promise<void> {
    await this.db.update(rotationProposals).set({ state, ...updates }).where(eq(rotationProposals.id, id));
  }

  async saveAuthAttempt(attempt: any): Promise<void> {
    await this.db.insert(authAttempts).values(attempt);
  }

  async findAuthAttemptByStateHash(stateHash: string): Promise<any | null> {
    const rows = await this.db.select().from(authAttempts).where(eq(authAttempts.stateHash, stateHash)).limit(1);
    return rows[0] ?? null;
  }

  async consumeAuthAttempt(id: string): Promise<void> {
    await this.db
      .update(authAttempts)
      .set({ consumedAt: new Date(), status: 'consumed' })
      .where(eq(authAttempts.id, id));
  }

  async saveApproval(approval: any): Promise<void> {
    await this.db.insert(approvals).values(approval);
  }

  async findApprovalByProposalId(proposalId: string): Promise<any | null> {
    const rows = await this.db.select().from(approvals).where(eq(approvals.proposalId, proposalId)).limit(1);
    return rows[0] ?? null;
  }

  async saveAuditEvent(event: any): Promise<void> {
    await this.db.insert(auditEvents).values(event);
  }

  async listAuditEvents(merchantId: string): Promise<any[]> {
    return this.db.select().from(auditEvents).where(eq(auditEvents.merchantId, merchantId));
  }
}

export function createDbStore(db: QuoteSealDatabase | MockDatabaseStore): IDbStore {
  if ('merchants' in db && db.merchants instanceof Map) {
    return new MemoryDbStore(db as MockDatabaseStore);
  }
  return new PostgresDbStore(db as QuoteSealDatabase);
}
