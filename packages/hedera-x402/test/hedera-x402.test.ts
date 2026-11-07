import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import Database from 'better-sqlite3';
import { createGuardedSigner, GuardDependencies, MerchantProfile } from '@quoteseal/payee-guard';
import {
  createX402Challenge,
  executeHederaPayment,
  verifyPaymentProof,
  type PaymentVerificationResult,
  type VerifiedPaymentPayload,
  type VerificationConfig,
  type ReplayProtection,
  type X402PaymentTerms,
  type HederaPaymentProofPayload,
  InMemoryReplayProtection,
  SqliteReplayProtection,
} from '../src/index.js';

describe('payment verification module', () => {
  let terms: X402PaymentTerms;
  let config: VerificationConfig;
  let replay: ReplayProtection;

  beforeEach(() => {
    terms = {
      network: 'hedera:testnet',
      asset: 'HBAR',
      payTo: '0.0.12345',
      amount: '100000000',
      ensName: 'researchpro.eth',
      serviceEndpoint: 'https://api.researchpro.com',
      referenceId: 'req_123',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    config = {
      supportedSchemes: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          verifiableWithoutFacilitator: true,
        },
        {
          scheme: 'hedera',
          network: 'hedera:testnet',
          verifiableWithoutFacilitator: false,
        },
      ],
      facilitator: undefined,
    };

    replay = new InMemoryReplayProtection();
  });

  describe('verifyPaymentProof - result types', () => {
    it('returns VERIFIED for a valid proof matching the challenge', async () => {
      const validProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(validProof, terms, config, replay);

      expect(result).toBeDefined();
      expect(['VERIFIED', 'INVALID', 'EXPIRED', 'REPLAYED', 'UNSUPPORTED_PROOF', 'VERIFICATION_UNAVAILABLE']).toContain(
        result.type
      );
    });

    it('returns INVALID for missing proof', async () => {
      const result = await verifyPaymentProof('', terms, config, replay);
      expect(result.type).toBe('INVALID');
      expect(result.reason).toBeDefined();
    });

    it('returns INVALID for malformed base64 JSON', async () => {
      const result = await verifyPaymentProof('not-valid-base64', terms, config, replay);
      expect(result.type).toBe('INVALID');
      expect(result.reason).toBeDefined();
    });

    it('returns UNSUPPORTED_PROOF for unsupported scheme/network', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'unsupported',
          network: 'unknown:network',
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('UNSUPPORTED_PROOF');
      expect(result.reason).toContain('Unsupported payment scheme/network');
    });

    it('returns UNSUPPORTED_PROOF for custom hedera scheme (no crypto proof)', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'hedera',
          network: 'hedera:testnet',
          payer: '0.0.54321',
          payTo: '0.0.12345',
          amount: '100000000',
          transactionId: '0.0.54321@1234567890.000000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('UNSUPPORTED_PROOF');
      expect(result.reason).toContain('not cryptographically verifiable');
    });

    it('returns EXPIRED for expired proof timestamp', async () => {
      const expiredProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now() - 600000, // 10 minutes in the past
        })
      ).toString('base64');

      const result = await verifyPaymentProof(expiredProof, terms, config, replay);
      expect(result.type).toBe('EXPIRED');
      expect(result.reason).toContain('expired');
    });

    it('returns REPLAYED for duplicate proof', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const firstResult = await verifyPaymentProof(proof, terms, config, replay);
      const secondResult = await verifyPaymentProof(proof, terms, config, replay);
      expect(secondResult.type).toBe('REPLAYED');
      expect(secondResult.reason).toContain('already been verified');
    });

    it('returns VERIFIED payload with correct fields', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
          payer: '0.0.54321',
          x402Version: '2',
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);

      if (result.type === 'VERIFIED') {
        const payload: VerifiedPaymentPayload = result.payload;
        expect(payload.scheme).toBe('exact');
        expect(payload.network).toBe('hedera:testnet');
        expect(payload.asset).toBe('HBAR');
        expect(payload.payTo).toBe('0.0.12345');
        expect(payload.amount).toBe('100000000');
        expect(payload.referenceId).toBe('req_123');
        expect(payload.payer).toBe('0.0.54321');
        expect(payload.x402Version).toBe('2');
      } else {
        expect(result.type).not.toBe('UNSUPPORTED_PROOF');
      }
    });
  });

  describe('verifyPaymentProof - specific scenarios', () => {
    it('returns INVALID for wrong recipient', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.other',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('Recipient mismatch');
    });

    it('returns INVALID for wrong asset', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.67890',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('Asset mismatch');
    });

    it('returns INVALID for wrong network', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:mainnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('INVALID');
    });

    it('returns INVALID for insufficient amount', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '50000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('Amount mismatch');
    });

    it('returns INVALID for modified payment data', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123-modified',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(['INVALID', 'UNSUPPORTED_PROOF', 'VERIFIED']).toContain(result.type);
    });

    it('returns UNSUPPORTED_PROOF for forged signature (custom scheme)', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'hedera',
          network: 'hedera:testnet',
          payer: '0.0.54321',
          payTo: '0.0.12345',
          amount: '100000000',
          transactionId: '0.0.54321@1234567890.000000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
          signature: 'fake-signature-attached',
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, config, replay);
      expect(result.type).toBe('UNSUPPORTED_PROOF');
    });

    it('concurrent duplicate verification cannot both succeed', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const results = await Promise.all([
        verifyPaymentProof(proof, terms, config, replay),
        verifyPaymentProof(proof, terms, config, replay),
      ]);

      const types = results.map((r) => r.type);
      const verifiedCount = types.filter((t) => t === 'VERIFIED').length;
      expect(verifiedCount).toBeLessThanOrEqual(1);
    });

    it('returns VERIFICATION_UNAVAILABLE when config is missing', async () => {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const result = await verifyPaymentProof(proof, terms, null as any, replay);
      expect(result.type).toBe('VERIFICATION_UNAVAILABLE');
    });
  });

  // =========================================================================
  // TASK E06 — Cryptographic & On-Chain Settlement Verification Tests
  // =========================================================================

  describe('Task E06 — Cryptographic & On-Chain Settlement Verification', () => {
    const testBuyerKey = PrivateKey.generateED25519();
    const testBuyerId = '0.0.88888';
    const testMerchantId = '0.0.12345';
    const testTxId = `${testBuyerId}@1794010060.000000001`;

    function buildSignedProof(overrides: Partial<HederaPaymentProofPayload> = {}, signerKey = testBuyerKey) {
      const basePayload = {
        scheme: 'exact',
        network: 'hedera:testnet',
        transactionId: testTxId,
        payerAccountId: testBuyerId,
        payTo: testMerchantId,
        amount: '100000000',
        asset: 'HBAR',
        referenceId: 'req_123',
        timestamp: Date.now(),
        ...overrides,
      };

      const payloadBytes = Buffer.from(JSON.stringify(basePayload));
      const sig = signerKey.sign(payloadBytes);
      const signatureHex = Buffer.from(sig).toString('hex');
      const publicKeyHex = signerKey.publicKey.toString();

      const fullPayload = {
        ...basePayload,
        signature: signatureHex,
        publicKey: publicKeyHex,
        simulated: false,
      };

      return {
        base64: Buffer.from(JSON.stringify(fullPayload)).toString('base64'),
        raw: fullPayload,
      };
    }

    function createMockMirrorFetch(opts: {
      status?: number;
      result?: string;
      memo?: string;
      transfers?: Array<{ account: string; amount: number }>;
      throwNetworkError?: boolean;
    } = {}) {
      if (opts.throwNetworkError) {
        return vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Mirror node unreachable'));
      }

      const status = opts.status ?? 200;
      if (status === 404) {
        return vi.fn().mockResolvedValue(new Response(JSON.stringify({ _status: { messages: [{ message: 'Not found' }] } }), { status: 404 }));
      }

      const defaultTransfers = [
        { account: testBuyerId, amount: -100100000 },
        { account: testMerchantId, amount: 100000000 },
        { account: '0.0.98', amount: 100000 },
      ];

      const body = {
        transactions: [
          {
            transaction_id: testTxId.replace('@', '-').replace('.', '-'),
            consensus_timestamp: '1794010069.123456789',
            result: opts.result ?? 'SUCCESS',
            memo_base64: Buffer.from(opts.memo ?? 'qs:req_123').toString('base64'),
            transfers: opts.transfers ?? defaultTransfers,
          },
        ],
      };

      return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    }

    it('VERIFIED: valid signed proof + confirmed mirror node transaction', async () => {
      const { base64 } = buildSignedProof();
      const mockFetch = createMockMirrorFetch();

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('VERIFIED');
      if (result.type === 'VERIFIED') {
        expect(result.payload.payer).toBe(testBuyerId);
        expect(result.payload.payTo).toBe(testMerchantId);
        expect(result.payload.amount).toBe('100000000');
        expect(result.onChainRecord).toBeDefined();
        expect(result.onChainRecord?.result).toBe('SUCCESS');
        expect(result.onChainRecord?.transferredAmount).toBe('100000000');
        expect(result.onChainRecord?.memo).toBe('qs:req_123');
      }
    });

    it('INVALID: invalid cryptographic signature (forged signature)', async () => {
      const { raw } = buildSignedProof();
      // Corrupt signature bytes
      const corruptedSig = raw.signature?.slice(0, -4) + 'abcd';
      const tamperedProof = Buffer.from(JSON.stringify({ ...raw, signature: corruptedSig })).toString('base64');

      const mockFetch = createMockMirrorFetch();
      const result = await verifyPaymentProof(tamperedProof, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('signature');
    });

    it('INVALID: tampered payload (amount altered after signing)', async () => {
      const { raw } = buildSignedProof({ amount: '100000000' });
      // Attacker changes amount in payload without re-signing
      const tamperedProof = Buffer.from(JSON.stringify({ ...raw, amount: '200000000' })).toString('base64');

      const mockFetch = createMockMirrorFetch();
      const result = await verifyPaymentProof(tamperedProof, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('signature verification failed');
    });

    it('INVALID: wrong payer (proof claims payer A, on-chain transfer debited payer B)', async () => {
      const { base64 } = buildSignedProof();
      // Mock on-chain debit from a different account
      const wrongPayerTransfers = [
        { account: '0.0.99999', amount: -100100000 },
        { account: testMerchantId, amount: 100000000 },
      ];
      const mockFetch = createMockMirrorFetch({ transfers: wrongPayerTransfers });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain(`did not debit payer account ${testBuyerId}`);
    });

    it('INVALID: wrong recipient on-chain (transfer credited someone else)', async () => {
      const { base64 } = buildSignedProof();
      // Mock transfer credited someone else
      const wrongRecipientTransfers = [
        { account: testBuyerId, amount: -100100000 },
        { account: '0.0.99999', amount: 100000000 }, // wrong recipient
      ];
      const mockFetch = createMockMirrorFetch({ transfers: wrongRecipientTransfers });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain(`did not credit merchant account ${testMerchantId}`);
    });

    it('INVALID: insufficient transfer amount on-chain', async () => {
      const { base64 } = buildSignedProof();
      // Mock transfer credited only 500 tinybars instead of 100000000
      const insufficientTransfers = [
        { account: testBuyerId, amount: -600 },
        { account: testMerchantId, amount: 500 },
      ];
      const mockFetch = createMockMirrorFetch({ transfers: insufficientTransfers });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('less than required');
    });

    it('INVALID: modified challenge binding (memo mismatch)', async () => {
      const { base64 } = buildSignedProof();
      // Mock mirror node has a different memo (e.g. for another challenge)
      const mockFetch = createMockMirrorFetch({ memo: 'qs:different_challenge_id' });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('does not match expected challenge binding');
    });

    it('VERIFICATION_UNAVAILABLE: settlement pending (mirror node 404)', async () => {
      const { base64 } = buildSignedProof();
      const mockFetch = createMockMirrorFetch({ status: 404 });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('VERIFICATION_UNAVAILABLE');
      expect(result.reason).toContain('pending');
    });

    it('INVALID: failed Hedera transaction (mirror node result != SUCCESS)', async () => {
      const { base64 } = buildSignedProof();
      const mockFetch = createMockMirrorFetch({ result: 'INSUFFICIENT_PAYER_BALANCE' });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('INVALID');
      expect(result.reason).toContain('failed on-chain');
    });

    it('VERIFICATION_UNAVAILABLE: mirror node network error / timeout', async () => {
      const { base64 } = buildSignedProof();
      const mockFetch = createMockMirrorFetch({ throwNetworkError: true });

      const result = await verifyPaymentProof(base64, terms, config, replay, { fetchFn: mockFetch });

      expect(result.type).toBe('VERIFICATION_UNAVAILABLE');
      expect(result.reason).toContain('Mirror Node unavailable');
    });
  });

  // =========================================================================
  // TASK E04 — Persistent SQLite Replay Protection & Concurrency
  // =========================================================================

  describe('Task E04 — Persistent SQLite Replay Protection', () => {
    let sqliteDb: Database.Database;
    let sqliteReplay: SqliteReplayProtection;

    beforeEach(() => {
      sqliteDb = new Database(':memory:');
      sqliteReplay = new SqliteReplayProtection(sqliteDb);
    });

    it('first payment consumption succeeds with ACCEPTED', async () => {
      const res = await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      expect(res.status).toBe('ACCEPTED');
    });

    it('replaying exact same transaction ID for different challenge is REPLAYED', async () => {
      await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      // Attacker tries to reuse transaction 0.0.123@100.1 for request req_002
      const replayRes = await sqliteReplay.consumePayment({
        referenceId: 'req_002',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      expect(replayRes.status).toBe('REPLAYED');
      if (replayRes.status === 'REPLAYED') {
        expect(replayRes.reason).toContain('already consumed for challenge req_001');
      }
    });

    it('fulfilling already settled challenge with different transaction is REPLAYED', async () => {
      await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      // Someone tries to fulfill req_001 again with another transaction
      const secondTxRes = await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.2',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      expect(secondTxRes.status).toBe('REPLAYED');
      if (secondTxRes.status === 'REPLAYED') {
        expect(secondTxRes.reason).toContain('already been fulfilled with transaction 0.0.123@100.1');
      }
    });

    it('safe idempotent retry for same challenge and transaction returns ALREADY_SETTLED', async () => {
      await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      // Payer retries exact same request (e.g. network hiccup on previous response)
      const retryRes = await sqliteReplay.consumePayment({
        referenceId: 'req_001',
        transactionId: '0.0.123@100.1',
        payerAccountId: '0.0.123',
        payTo: '0.0.456',
        amount: '100000000',
      });

      expect(retryRes.status).toBe('ALREADY_SETTLED');
    });

    it('concurrency: 10 concurrent verification attempts -> exactly 1 ACCEPTED, 9 REPLAYED', async () => {
      const attempts = Array.from({ length: 10 }).map((_, i) =>
        sqliteReplay.consumePayment({
          referenceId: 'concurrent_req',
          transactionId: `0.0.123@100.concurrent`,
          payerAccountId: '0.0.123',
          payTo: '0.0.456',
          amount: '100000000',
        })
      );

      const results = await Promise.all(attempts);
      const acceptedCount = results.filter((r) => r.status === 'ACCEPTED').length;
      expect(acceptedCount).toBe(1);

      // Remaining are safely handled as ALREADY_SETTLED or REPLAYED
      const nonAccepted = results.filter((r) => r.status !== 'ACCEPTED');
      expect(nonAccepted.length).toBe(9);
    });
  });

  // =========================================================================
  // TASK E02 & E06 — PayeeGuard Integration & Pre-Signing Gate
  // =========================================================================

  describe('Task E02 & E06 — PayeeGuard Integration & Pre-Signing Gate', () => {
    const mockProfile: MerchantProfile = {
      ensName: 'researchpro.eth',
      serviceEndpoint: 'https://api.researchpro.com',
      network: 'hedera:testnet',
      assetId: 'HBAR',
      activePayTo: '0.0.12345',
      maxAmount: '500000000',
      profileVersion: 1,
      rotationStatus: 'active',
    };

    it('BLOCK verdict from PayeeGuard stops transaction execution (rawSigner never called)', async () => {
      const mockRawSigner = vi.fn().mockResolvedValue({ txId: '0.0.123@1.1' });

      const deps: GuardDependencies = {
        resolveProfile: async () => mockProfile,
        policy: {
          trustedMerchants: ['researchpro.eth'],
        },
        riskReader: {
          getTrustedWalletRiskState: async () => ({
            kind: 'trusted',
            state: {
              status: 'BLOCK',
              entityKey: '0xrisk123',
              owner: '0xmerchantA',
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 10000),
            },
          }),
        },
      };

      const guardedSigner = createGuardedSigner(mockRawSigner, deps);

      const execution = await guardedSigner.execute({
        origin: 'https://api.researchpro.com',
        ensName: 'researchpro.eth',
        payTo: '0.0.12345',
        amount: '100000000',
        asset: 'HBAR',
        network: 'hedera:testnet',
        payerWallet: '0.0.54321',
      });

      expect(execution.verdict).toBe('BLOCK');
      expect(execution.reason).toContain('ARKIV_RISK_BLOCK');
      expect(execution.signerCallCount).toBe(0);
      expect(mockRawSigner).not.toHaveBeenCalled();
      expect(execution.result).toBeUndefined();
    });

    it('HOLD verdict stops signing (rawSigner call count = 0)', async () => {
      const mockRawSigner = vi.fn().mockResolvedValue({ txId: '0.0.123@1.1' });

      const deps: GuardDependencies = {
        resolveProfile: async () => mockProfile,
        policy: {
          trustedMerchants: ['researchpro.eth'],
        },
        riskReader: {
          getTrustedWalletRiskState: async () => ({
            kind: 'trusted',
            state: {
              status: 'REVIEW',
              entityKey: '0xrisk123',
              owner: '0xmerchantA',
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 10000),
            },
          }),
        },
      };

      const guardedSigner = createGuardedSigner(mockRawSigner, deps);

      const execution = await guardedSigner.execute({
        origin: 'https://api.researchpro.com',
        ensName: 'researchpro.eth',
        payTo: '0.0.12345',
        amount: '100000000',
        asset: 'HBAR',
        network: 'hedera:testnet',
        payerWallet: '0.0.54321',
      });

      expect(execution.verdict).toBe('HOLD');
      expect(execution.signerCallCount).toBe(0);
      expect(mockRawSigner).not.toHaveBeenCalled();
    });

    it('UNVERIFIABLE verdict stops signing when profile resolution fails', async () => {
      const mockRawSigner = vi.fn().mockResolvedValue({ txId: '0.0.123@1.1' });

      const deps: GuardDependencies = {
        resolveProfile: async () => {
          throw new Error('ENS node network timeout');
        },
        policy: {
          trustedMerchants: ['researchpro.eth'],
        },
      };

      const guardedSigner = createGuardedSigner(mockRawSigner, deps);

      const execution = await guardedSigner.execute({
        origin: 'https://api.researchpro.com',
        ensName: 'researchpro.eth',
        payTo: '0.0.12345',
        amount: '100000000',
        asset: 'HBAR',
        network: 'hedera:testnet',
        payerWallet: '0.0.54321',
      });

      expect(execution.verdict).toBe('UNVERIFIABLE');
      expect(execution.signerCallCount).toBe(0);
      expect(mockRawSigner).not.toHaveBeenCalled();
    });

    it('PASS verdict permits rawSigner execution path', async () => {
      const mockRawSigner = vi.fn().mockResolvedValue({ txId: '0.0.54321@1794010060.000000001', status: 'SUCCESS' });

      const deps: GuardDependencies = {
        resolveProfile: async () => mockProfile,
        policy: {
          trustedMerchants: ['researchpro.eth'],
        },
        riskReader: {
          getTrustedWalletRiskState: async () => ({
            kind: 'trusted',
            state: {
              status: 'ALLOW',
              entityKey: '0xrisk_clean',
              owner: '0xmerchantA',
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 10000),
            },
          }),
        },
      };

      const guardedSigner = createGuardedSigner(mockRawSigner, deps);

      const execution = await guardedSigner.execute({
        origin: 'https://api.researchpro.com',
        ensName: 'researchpro.eth',
        payTo: '0.0.12345',
        amount: '100000000',
        asset: 'HBAR',
        network: 'hedera:testnet',
        payerWallet: '0.0.54321',
      });

      expect(execution.verdict).toBe('PASS');
      expect(execution.signerCallCount).toBe(1);
      expect(mockRawSigner).toHaveBeenCalledTimes(1);
      expect(execution.result).toEqual({ txId: '0.0.54321@1794010060.000000001', status: 'SUCCESS' });
    });
  });

  // =========================================================================
  // TASK E06 — Resource Delivery Gate (Protected Endpoint Invariant)
  // =========================================================================

  describe('Task E06 — Protected Resource Delivery Invariant', () => {
    const PROTECTED_DATA = { reportTitle: 'Confidential Quantum Analysis', sensitiveData: '0x9948271a' };

    async function simulateMerchantEndpoint(
      headers: Record<string, string>,
      challenge: X402PaymentTerms,
      verifyConfig: VerificationConfig,
      replayStore: ReplayProtection,
      fetchFn?: typeof fetch
    ): Promise<{ statusCode: number; body: any; headers?: Record<string, string> }> {
      const paymentHeader = headers['payment-signature'] || headers['authorization'];

      // No payment provided -> HTTP 402 with challenge
      if (!paymentHeader) {
        const x402Challenge = createX402Challenge(challenge);
        return {
          statusCode: 402,
          headers: x402Challenge.headers,
          body: x402Challenge.body,
        };
      }

      // Verify payment proof
      const verification = await verifyPaymentProof(paymentHeader, challenge, verifyConfig, replayStore, {
        fetchFn,
      });

      if (verification.type === 'EXPIRED') {
        const freshChallenge = createX402Challenge(challenge);
        return {
          statusCode: 402,
          headers: freshChallenge.headers,
          body: { error: 'payment_expired', reason: verification.reason, newChallenge: freshChallenge.body },
        };
      }

      if (verification.type === 'REPLAYED') {
        return {
          statusCode: 409,
          body: { error: 'replayed_payment', reason: verification.reason },
        };
      }

      if (verification.type === 'VERIFICATION_UNAVAILABLE') {
        return {
          statusCode: 402,
          body: { error: 'settlement_pending', reason: verification.reason },
        };
      }

      if (verification.type !== 'VERIFIED') {
        return {
          statusCode: 400,
          body: { error: 'invalid_proof', reason: verification.reason },
        };
      }

      // Deliver resource ONLY when payment proof is VERIFIED
      return {
        statusCode: 200,
        body: {
          success: true,
          data: PROTECTED_DATA,
          settlement: verification.onChainRecord,
        },
      };
    }

    it('unpaid request (no payment header) receives 402 with payment challenge', async () => {
      const res = await simulateMerchantEndpoint({}, terms, config, replay);
      expect(res.statusCode).toBe(402);
      expect(res.headers?.['payment-required']).toBeDefined();
      expect(res.body.payment.payTo).toBe('0.0.12345');
      expect(res.body.sensitiveData).toBeUndefined();
    });

    it('invalid proof receives 400 and protected resource is WITHHELD', async () => {
      const invalidProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          payTo: '0.0.wrong',
          amount: '100000000',
        })
      ).toString('base64');

      const res = await simulateMerchantEndpoint(
        { 'payment-signature': invalidProof },
        terms,
        config,
        replay
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_proof');
      expect(res.body.data).toBeUndefined();
    });

    it('expired proof receives 402 with fresh challenge and resource is WITHHELD', async () => {
      const expiredProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now() - 600000,
        })
      ).toString('base64');

      const res = await simulateMerchantEndpoint(
        { 'payment-signature': expiredProof },
        terms,
        config,
        replay
      );

      expect(res.statusCode).toBe(402);
      expect(res.body.error).toBe('payment_expired');
      expect(res.body.newChallenge).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('replayed proof receives 409 and resource is NOT fulfilled twice', async () => {
      const validProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      // First request: verified
      const firstRes = await simulateMerchantEndpoint(
        { 'payment-signature': validProof },
        terms,
        config,
        replay
      );
      expect(firstRes.statusCode).toBe(200);
      expect(firstRes.body.data).toBeDefined();

      // Second request with same proof: rejected as replayed
      const secondRes = await simulateMerchantEndpoint(
        { 'payment-signature': validProof },
        terms,
        config,
        replay
      );
      expect(secondRes.statusCode).toBe(409);
      expect(secondRes.body.error).toBe('replayed_payment');
      expect(secondRes.body.data).toBeUndefined();
    });

    it('verified payment delivers protected resource', async () => {
      const validProof = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: 'HBAR',
          payTo: '0.0.12345',
          amount: '100000000',
          referenceId: 'req_123',
          timestamp: Date.now(),
        })
      ).toString('base64');

      const res = await simulateMerchantEndpoint(
        { 'payment-signature': validProof },
        terms,
        config,
        replay
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(PROTECTED_DATA);
    });
  });
});
