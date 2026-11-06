import { describe, it, expect } from 'vitest';
import {
  createX402Challenge,
  executeHederaPayment,
  submitAuditEventToHcs,
  getHcsAuditLog,
  X402PaymentTerms,
} from '../src/index.js';

describe('hedera-x402 package', () => {
  const terms: X402PaymentTerms = {
    network: 'hedera:testnet',
    asset: 'HBAR',
    payTo: '0.0.12345',
    amount: '100000000',
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    referenceId: 'req_123',
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  };

  it('creates valid 402 challenge response headers and body', () => {
    const challenge = createX402Challenge(terms);
    expect(challenge.statusCode).toBe(402);
    expect(challenge.headers['payment-required']).toBeDefined();
    expect(challenge.body.payment.payTo).toBe('0.0.12345');
  });

  it('executes payment and generates receipt with HashScan link', async () => {
    const res = await executeHederaPayment(terms, {
      buyerAccountId: '0.0.54321',
      network: 'testnet',
    });

    expect(res.receipt.recipientAccountId).toBe('0.0.12345');
    expect(res.receipt.payerAccountId).toBe('0.0.54321');
    expect(res.receipt.hashScanUrl).toContain('https://hashscan.io/testnet/transaction/');
    expect(res.paymentProof).toBeDefined();
  });

  it('submits audit event to HCS and hashes records', async () => {
    const record = await submitAuditEventToHcs({
      type: 'PAYMENT_PASS',
      timestamp: Date.now(),
      origin: 'https://api.researchpro.com',
      payTo: '0.0.12345',
      ensName: 'researchpro.eth',
    });

    expect(record.sequenceNumber).toBeGreaterThan(0);
    expect(record.eventHash).toHaveLength(64); // SHA-256
    expect(getHcsAuditLog().length).toBeGreaterThan(0);
  });
});
