import { describe, it, expect, vi } from 'vitest';
import {
  HederaMirrorNodeVerifier,
  normalizeMirrorNodeTransactionId,
  verifyTransactionRecordAgainstRequirements,
  type MirrorNodeTransactionRecord,
  type MirrorNodeTransactionsResponse,
  type VerifySettlementOptions
} from './verifier.js';

describe('HederaMirrorNodeVerifier — Independent On-Chain Settlement Verification', () => {
  const VALID_TX_ID = '0.0.5001@1700000000.000000000';
  const NORMALIZED_TX_ID = '0.0.5001-1700000000-000000000';
  const PAYER = '0.0.123456';
  const RECIPIENT = '0.0.987654';
  const AMOUNT_TINYBARS = '100000000'; // 1 HBAR
  const HBAR_ASSET = '0.0.0';
  const TESTNET_NETWORK = 'hedera:testnet';

  const defaultOptions: VerifySettlementOptions = {
    transactionId: VALID_TX_ID,
    expectedPayer: PAYER,
    expectedRecipient: RECIPIENT,
    expectedAmount: AMOUNT_TINYBARS,
    expectedAsset: HBAR_ASSET,
    expectedNetwork: TESTNET_NETWORK
  };

  const validHbarTxRecord: MirrorNodeTransactionRecord = {
    transaction_id: NORMALIZED_TX_ID,
    consensus_timestamp: '1700000000.123456789',
    result: 'SUCCESS',
    name: 'CRYPTOTRANSFER',
    node: '0.0.3',
    charged_tx_fee: 100000,
    transfers: [
      { account: PAYER, amount: -100000000, is_approval: false },
      { account: RECIPIENT, amount: 100000000, is_approval: false },
      { account: '0.0.98', amount: -100000, is_approval: false },
      { account: '0.0.3', amount: 100000, is_approval: false }
    ]
  };

  // ---------------------------------------------------------------------------
  // 1. TRANSACTION ID NORMALIZATION
  // ---------------------------------------------------------------------------
  describe('normalizeMirrorNodeTransactionId', () => {
    it('normalizes @ and . into canonical - separators', () => {
      expect(normalizeMirrorNodeTransactionId('0.0.5001@1700000000.000000000')).toBe(
        '0.0.5001-1700000000-000000000'
      );
    });

    it('preserves already normalized - format', () => {
      expect(normalizeMirrorNodeTransactionId('0.0.5001-1700000000-000000000')).toBe(
        '0.0.5001-1700000000-000000000'
      );
    });

    it('pads short nanoseconds to 9 digits', () => {
      expect(normalizeMirrorNodeTransactionId('0.0.42@1650000000.123')).toBe(
        '0.0.42-1650000000-123000000'
      );
    });

    it.each(['', 'invalid', '0.0.5001', '0.0.5001@abc.def', '0.0.x-100-200'])(
      'throws on malformed transaction ID (%s)',
      (invalidId) => {
        expect(() => normalizeMirrorNodeTransactionId(invalidId)).toThrow(
          /(Invalid Hedera transaction ID format|Transaction ID must be a non-empty string)/
        );
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 2. RECORD VERIFICATION UNIT TESTS
  // ---------------------------------------------------------------------------
  describe('verifyTransactionRecordAgainstRequirements', () => {
    it('verifies legitimate HBAR transaction -> SETTLED_VERIFIED with complete evidence', () => {
      const res = verifyTransactionRecordAgainstRequirements(validHbarTxRecord, defaultOptions);
      expect(res.status).toBe('SETTLED_VERIFIED');
      expect(res.transactionId).toBe(NORMALIZED_TX_ID);
      expect(res.evidence).toBeDefined();
      expect(res.evidence?.result).toBe('SUCCESS');
      expect(res.evidence?.consensusTimestamp).toBe('1700000000.123456789');
      expect(res.evidence?.recipient).toBe(RECIPIENT);
      expect(res.evidence?.amount).toBe(AMOUNT_TINYBARS);
      expect(res.evidence?.asset).toBe('0.0.0');
      expect(res.evidence?.payer).toBe(PAYER);
    });

    it('verifies legitimate Token transaction -> SETTLED_VERIFIED with token evidence', () => {
      const tokenAsset = '0.0.777777';
      const tokenAmount = '500';
      const tokenRecord: MirrorNodeTransactionRecord = {
        transaction_id: NORMALIZED_TX_ID,
        consensus_timestamp: '1700000000.999999999',
        result: 'SUCCESS',
        token_transfers: [
          { token_id: tokenAsset, account: PAYER, amount: -500 },
          { token_id: tokenAsset, account: RECIPIENT, amount: 500 }
        ]
      };

      const res = verifyTransactionRecordAgainstRequirements(tokenRecord, {
        ...defaultOptions,
        expectedAsset: tokenAsset,
        expectedAmount: tokenAmount
      });

      expect(res.status).toBe('SETTLED_VERIFIED');
      expect(res.evidence?.asset).toBe(tokenAsset);
      expect(res.evidence?.amount).toBe(tokenAmount);
      expect(res.evidence?.recipient).toBe(RECIPIENT);
      expect(res.evidence?.payer).toBe(PAYER);
    });

    it('fails closed when on-chain result is not SUCCESS (e.g. INSUFFICIENT_PAYER_BALANCE) -> SETTLEMENT_FAILED', () => {
      const failedRecord: MirrorNodeTransactionRecord = {
        ...validHbarTxRecord,
        result: 'INSUFFICIENT_PAYER_BALANCE'
      };
      const res = verifyTransactionRecordAgainstRequirements(failedRecord, defaultOptions);
      expect(res.status).toBe('SETTLEMENT_FAILED');
      expect(res.reason).toContain('INSUFFICIENT_PAYER_BALANCE');
    });

    it('flags transaction as pending when result is missing -> SETTLEMENT_PENDING', () => {
      const pendingRecord: MirrorNodeTransactionRecord = {
        ...validHbarTxRecord,
        result: ''
      };
      const res = verifyTransactionRecordAgainstRequirements(pendingRecord, defaultOptions);
      expect(res.status).toBe('SETTLEMENT_PENDING');
    });

    it('rejects wrong recipient account -> SETTLEMENT_MISMATCH', () => {
      const res = verifyTransactionRecordAgainstRequirements(validHbarTxRecord, {
        ...defaultOptions,
        expectedRecipient: '0.0.666666'
      });
      expect(res.status).toBe('SETTLEMENT_MISMATCH');
      expect(res.reason).toContain('was not credited in HBAR transfers');
    });

    it('rejects underpayment / amount mismatch -> SETTLEMENT_MISMATCH', () => {
      const res = verifyTransactionRecordAgainstRequirements(validHbarTxRecord, {
        ...defaultOptions,
        expectedAmount: '200000000' // Expected 2 HBAR, but tx only paid 1 HBAR
      });
      expect(res.status).toBe('SETTLEMENT_MISMATCH');
      expect(res.reason).toContain('Transfer amount mismatch');
    });

    it('rejects wrong token ID for token transfer -> SETTLEMENT_MISMATCH', () => {
      const tokenRecord: MirrorNodeTransactionRecord = {
        transaction_id: NORMALIZED_TX_ID,
        consensus_timestamp: '1700000000.111111111',
        result: 'SUCCESS',
        token_transfers: [
          { token_id: '0.0.111111', account: RECIPIENT, amount: 100 }
        ]
      };
      const res = verifyTransactionRecordAgainstRequirements(tokenRecord, {
        ...defaultOptions,
        expectedAsset: '0.0.222222', // Expected token 222222
        expectedAmount: '100'
      });
      expect(res.status).toBe('SETTLEMENT_MISMATCH');
      expect(res.reason).toContain('was not credited for token');
    });

    it('rejects unsupported network identifier -> SETTLEMENT_MISMATCH', () => {
      const res = verifyTransactionRecordAgainstRequirements(validHbarTxRecord, {
        ...defaultOptions,
        expectedNetwork: 'ethereum:mainnet'
      });
      expect(res.status).toBe('SETTLEMENT_MISMATCH');
      expect(res.reason).toContain('Unsupported network');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. HTTP CLIENT INTEGRATION & NETWORK RESILIENCE
  // ---------------------------------------------------------------------------
  describe('HederaMirrorNodeVerifier — Network & REST Integration', () => {
    it('queries mirror node, parses matching transaction, and returns SETTLED_VERIFIED', async () => {
      let requestedUrl = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        const payload: MirrorNodeTransactionsResponse = {
          transactions: [validHbarTxRecord]
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLED_VERIFIED');
      expect(requestedUrl).toBe(
        'https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.5001-1700000000-000000000'
      );
      expect(res.evidence?.result).toBe('SUCCESS');
      expect(res.evidence?.recipient).toBe(RECIPIENT);
    });

    it('returns SETTLEMENT_PENDING on 404 Not Found (pending consensus indexing)', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ _status: { messages: [{ message: 'Not found' }] } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLEMENT_PENDING');
      expect(res.reason).toContain('status 404');
    });

    it('returns SETTLEMENT_UNVERIFIED on 500 internal server error or network outage', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('Internal Server Error', { status: 500 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.reason).toContain('HTTP 500');
    });

    it('returns SETTLEMENT_UNVERIFIED on fetch network timeout / thrown exception', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        throw new Error('ETIMEDOUT: Connection to mirror node timed out');
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.reason).toContain('ETIMEDOUT');
    });

    it('returns SETTLEMENT_UNVERIFIED on malformed / non-JSON response', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('<html><title>Cloudflare 502</title></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.reason).toContain('Failed to parse Mirror Node response as JSON');
    });

    it('handles multiple records (scheduled or parent/child transactions) and finds the valid cryptotransfer', async () => {
      const parentRecord: MirrorNodeTransactionRecord = {
        transaction_id: NORMALIZED_TX_ID,
        consensus_timestamp: '1700000000.100000000',
        result: 'SUCCESS',
        name: 'SCHEDULECREATE',
        transfers: []
      };

      const mockFetch = vi.fn().mockImplementation(async () => {
        const payload: MirrorNodeTransactionsResponse = {
          transactions: [parentRecord, validHbarTxRecord]
        };
        return new Response(JSON.stringify(payload), { status: 200 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement(defaultOptions);
      expect(res.status).toBe('SETTLED_VERIFIED');
      expect(res.evidence?.recipient).toBe(RECIPIENT);
      expect(res.evidence?.amount).toBe(AMOUNT_TINYBARS);
    });

    it('returns SETTLEMENT_FAILED immediately for syntactically invalid transaction IDs without network call', async () => {
      const mockFetch = vi.fn();
      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement({
        ...defaultOptions,
        transactionId: 'invalid-id-syntax'
      });

      expect(res.status).toBe('SETTLEMENT_FAILED');
      expect(res.reason).toContain('Invalid transaction ID syntax');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Task 6: delayed indexing - polls until consensus reached and returns SETTLED_VERIFIED', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: 404 Not Found (still indexing)
          return new Response('Not Found', { status: 404 });
        }
        // Second call: 200 OK with valid record
        const payload: MirrorNodeTransactionsResponse = {
          transactions: [validHbarTxRecord]
        };
        return new Response(JSON.stringify(payload), { status: 200 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement({
        ...defaultOptions,
        maxAttempts: 3,
        pollIntervalMs: 10
      });

      expect(callCount).toBe(2);
      expect(res.status).toBe('SETTLED_VERIFIED');
      expect(res.evidence?.recipient).toBe(RECIPIENT);
      expect(res.evidence?.amount).toBe(AMOUNT_TINYBARS);
    });

    it('Task 6: persistent 404 across bounded attempts returns SETTLEMENT_UNVERIFIED', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response('Not Found', { status: 404 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement({
        ...defaultOptions,
        maxAttempts: 3,
        pollIntervalMs: 5
      });

      expect(callCount).toBe(3);
      expect(res.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.reason).toContain('Verification deadline exceeded after 3 attempts');
    });

    it('Task 6: bounded polling deadline timeout returns SETTLEMENT_UNVERIFIED', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulate a small delay
        await new Promise((r) => setTimeout(r, 20));
        return new Response('Not Found', { status: 404 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement({
        ...defaultOptions,
        pollIntervalMs: 10,
        deadlineMs: 35
      });

      expect(res.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.reason).toBe('Verification deadline exceeded');
    });

    it('Task 6: mismatched evidence stops polling immediately without submitting or looping', async () => {
      let callCount = 0;
      const mismatchedRecord: MirrorNodeTransactionRecord = {
        transaction_id: NORMALIZED_TX_ID,
        consensus_timestamp: '1700000000.000000000',
        result: 'SUCCESS',
        transfers: [
          { account: '0.0.999999', amount: AMOUNT_TINYBARS }
        ]
      };

      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        const payload: MirrorNodeTransactionsResponse = {
          transactions: [mismatchedRecord]
        };
        return new Response(JSON.stringify(payload), { status: 200 });
      });

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockFetch as unknown as typeof fetch
      );

      const res = await verifier.verifySettlement({
        ...defaultOptions,
        maxAttempts: 5,
        pollIntervalMs: 10
      });

      expect(callCount).toBe(1);
      expect(res.status).toBe('SETTLEMENT_MISMATCH');
      expect(res.reason).toContain('Recipient account');
    });
  });
});
