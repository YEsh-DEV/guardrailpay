import Database from 'better-sqlite3';

export interface ConsumedPaymentRecord {
  paymentId: string;
  referenceId: string;
  transactionId: string;
  payerAccountId?: string;
  payTo: string;
  amount: string;
  consumedAt: number;
}

export type ReplayCheckResult =
  | { status: 'ACCEPTED' }
  | { status: 'ALREADY_SETTLED'; record: ConsumedPaymentRecord }
  | { status: 'REPLAYED'; reason: string };

export interface ReplayProtection {
  checkAndMark(paymentId: string): Promise<boolean>;
  isDuplicate(paymentId: string): Promise<boolean>;
  consumePayment?(record: {
    referenceId: string;
    transactionId: string;
    payerAccountId?: string;
    payTo: string;
    amount: string;
  }): Promise<ReplayCheckResult>;
  getConsumedRecord?(transactionId: string): Promise<ConsumedPaymentRecord | null>;
}

export class InMemoryReplayProtection implements ReplayProtection {
  private seen = new Set<string>();
  private consumedByTx = new Map<string, ConsumedPaymentRecord>();
  private consumedByRef = new Map<string, ConsumedPaymentRecord>();

  async checkAndMark(paymentId: string): Promise<boolean> {
    await Promise.resolve();
    if (this.seen.has(paymentId)) {
      return true;
    }
    this.seen.add(paymentId);
    return false;
  }

  async isDuplicate(paymentId: string): Promise<boolean> {
    return this.seen.has(paymentId);
  }

  async consumePayment(record: {
    referenceId: string;
    transactionId: string;
    payerAccountId?: string;
    payTo: string;
    amount: string;
  }): Promise<ReplayCheckResult> {
    const existingTx = this.consumedByTx.get(record.transactionId);
    if (existingTx) {
      if (existingTx.referenceId === record.referenceId) {
        return { status: 'ALREADY_SETTLED', record: existingTx };
      }
      return {
        status: 'REPLAYED',
        reason: `Payment transaction ${record.transactionId} was already consumed for challenge ${existingTx.referenceId}`,
      };
    }

    const existingRef = this.consumedByRef.get(record.referenceId);
    if (existingRef) {
      return {
        status: 'REPLAYED',
        reason: `Challenge ${record.referenceId} has already been fulfilled with transaction ${existingRef.transactionId}`,
      };
    }

    const fullRecord: ConsumedPaymentRecord = {
      paymentId: `pay_${record.transactionId}`,
      referenceId: record.referenceId,
      transactionId: record.transactionId,
      payerAccountId: record.payerAccountId,
      payTo: record.payTo,
      amount: record.amount,
      consumedAt: Math.floor(Date.now() / 1000),
    };

    this.consumedByTx.set(record.transactionId, fullRecord);
    this.consumedByRef.set(record.referenceId, fullRecord);
    this.seen.add(record.transactionId);
    this.seen.add(record.referenceId);

    return { status: 'ACCEPTED' };
  }

  async getConsumedRecord(transactionId: string): Promise<ConsumedPaymentRecord | null> {
    return this.consumedByTx.get(transactionId) ?? null;
  }
}

export class SqliteReplayProtection implements ReplayProtection {
  private db: Database.Database;

  constructor(dbOrPath?: Database.Database | string) {
    if (typeof dbOrPath === 'object' && dbOrPath !== null) {
      this.db = dbOrPath;
    } else {
      const path =
        typeof dbOrPath === 'string'
          ? dbOrPath
          : process.env.DATABASE_URL?.replace('file:', '') || './quoteseal.db';
      this.db = new Database(path);
    }

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS consumed_x402_payments (
        payment_id TEXT PRIMARY KEY,
        reference_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL UNIQUE,
        payer_account_id TEXT,
        pay_to TEXT NOT NULL,
        amount TEXT NOT NULL,
        consumed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_consumed_x402_ref ON consumed_x402_payments (reference_id);
      CREATE INDEX IF NOT EXISTS idx_consumed_x402_tx ON consumed_x402_payments (transaction_id);
    `);
  }

  async checkAndMark(paymentId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO consumed_x402_payments (payment_id, reference_id, transaction_id, pay_to, amount, consumed_at)
        VALUES (?, ?, ?, 'none', '0', ?)
      `);
      stmt.run(paymentId, paymentId, paymentId, Math.floor(Date.now() / 1000));
      return false; // successfully inserted -> new
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return true; // already seen -> duplicate
      }
      throw err;
    }
  }

  async isDuplicate(paymentId: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 FROM consumed_x402_payments WHERE payment_id = ? OR transaction_id = ?`)
      .get(paymentId, paymentId);
    return !!row;
  }

  async consumePayment(record: {
    referenceId: string;
    transactionId: string;
    payerAccountId?: string;
    payTo: string;
    amount: string;
  }): Promise<ReplayCheckResult> {
    const runAtomic = this.db.transaction(() => {
      // Check if transaction was already consumed
      const existingTx = this.db
        .prepare(`SELECT * FROM consumed_x402_payments WHERE transaction_id = ?`)
        .get(record.transactionId) as any;

      if (existingTx) {
        const consumedRecord: ConsumedPaymentRecord = {
          paymentId: existingTx.payment_id,
          referenceId: existingTx.reference_id,
          transactionId: existingTx.transaction_id,
          payerAccountId: existingTx.payer_account_id,
          payTo: existingTx.pay_to,
          amount: existingTx.amount,
          consumedAt: existingTx.consumed_at,
        };

        if (existingTx.reference_id === record.referenceId) {
          return { status: 'ALREADY_SETTLED', record: consumedRecord } as const;
        }

        return {
          status: 'REPLAYED',
          reason: `Payment transaction ${record.transactionId} was already consumed for challenge ${existingTx.reference_id}`,
        } as const;
      }

      // Check if challenge reference was already fulfilled with another transaction
      const existingRef = this.db
        .prepare(`SELECT * FROM consumed_x402_payments WHERE reference_id = ?`)
        .get(record.referenceId) as any;

      if (existingRef) {
        return {
          status: 'REPLAYED',
          reason: `Challenge ${record.referenceId} has already been fulfilled with transaction ${existingRef.transaction_id}`,
        } as const;
      }

      // Insert new consumed payment atomically
      const paymentId = `pay_${record.transactionId}`;
      const now = Math.floor(Date.now() / 1000);
      this.db
        .prepare(`
          INSERT INTO consumed_x402_payments (payment_id, reference_id, transaction_id, payer_account_id, pay_to, amount, consumed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          paymentId,
          record.referenceId,
          record.transactionId,
          record.payerAccountId ?? null,
          record.payTo,
          record.amount,
          now
        );

      return { status: 'ACCEPTED' } as const;
    });

    return runAtomic();
  }

  async getConsumedRecord(transactionId: string): Promise<ConsumedPaymentRecord | null> {
    const row = this.db
      .prepare(`SELECT * FROM consumed_x402_payments WHERE transaction_id = ?`)
      .get(transactionId) as any;
    if (!row) return null;
    return {
      paymentId: row.payment_id,
      referenceId: row.reference_id,
      transactionId: row.transaction_id,
      payerAccountId: row.payer_account_id,
      payTo: row.pay_to,
      amount: row.amount,
      consumedAt: row.consumed_at,
    };
  }
}
