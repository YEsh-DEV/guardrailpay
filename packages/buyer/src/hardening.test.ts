import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import type { ClientHederaSigner } from '@x402/hedera';
import { defaultProfile, defaultAnchors, createPaymentAttempt } from '@quoteseal/guard';
import { BuyerPaymentOrchestrator } from './orchestrator.js';
import { MockFacilitatorClient, HttpFacilitatorClient } from './facilitator.js';
import {
  HederaMirrorNodeVerifier,
  type MirrorNodeTransactionsResponse
} from './verifier.js';
import {
  QuoteSealSecurityRejectionError,
  PaymentRequiredParseError,
  UnsupportedRequirementError,
  BuyerConfirmationRequiredError,
  FacilitatorSettlementError,
  InvalidSettlementEvidenceError,
  SettlementVerificationError,
  ResourceAccessError
} from './types.js';

describe('Buyer Hardening & Complete Adversarial Verification Suite', () => {
  const RESOURCE_URL = 'https://merchant.example/api/protected-data';
  const MERCHANT_ORIGIN = 'https://merchant.example';
  const VALID_PAYTO = defaultProfile.payTo ?? '0.0.123456';
  const FEE_PAYER = '0.0.98';
  const VALID_AMOUNT = '10';
  const FIXED_NOW = 1000;

  function createTestChallenge(overrides?: Partial<PaymentRequired>): PaymentRequired {
    return {
      x402Version: 2,
      resource: { url: RESOURCE_URL },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: VALID_AMOUNT,
          payTo: VALID_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ],
      extensions: {
        quoteseal: {
          ens: 'merchant.eth'
        }
      },
      ...overrides
    };
  }

  function createInstrumentedSigner(accountId: string = '0.0.42') {
    let calls = 0;
    const signer: ClientHederaSigner = {
      accountId,
      async createPartiallySignedTransferTransaction(req: PaymentRequirements) {
        calls++;
        return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
      }
    };
    return {
      signer,
      getCalls: () => calls
    };
  }

  let orchestrator: BuyerPaymentOrchestrator;
  let facilitator: MockFacilitatorClient;
  let instrumented: ReturnType<typeof createInstrumentedSigner>;

  beforeEach(() => {
    orchestrator = new BuyerPaymentOrchestrator();
    facilitator = new MockFacilitatorClient();
    instrumented = createInstrumentedSigner();
  });

  const baseTrust = () => ({
    profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
    anchors: { ...defaultAnchors }
  });

  // ===========================================================================
  // 1. MALICIOUS MERCHANT & ORIGIN REDIRECTION DEFENSES
  // ===========================================================================
  describe('1. Malicious Merchant & Redirection Defenses', () => {
    it('rejects cross-origin redirect on initial request -> QuoteSeal returns BLOCK, zero signer calls', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://evil-merchant.com/redirect' }
        });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(QuoteSealSecurityRejectionError);

      expect(instrumented.getCalls()).toBe(0);
    });

    it('rejects challenge when resource.url attempts to spoof a different origin -> BLOCK, zero signer calls', async () => {
      const spoofedChallenge = createTestChallenge({
        resource: { url: 'https://attacker.example/api/hijacked' }
      });

      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(spoofedChallenge), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(QuoteSealSecurityRejectionError);

      expect(instrumented.getCalls()).toBe(0);
    });

    it('rejects cross-origin redirect on paid resource retry -> ResourceAccessError', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          // Attacker tries to bounce paid response to third-party
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://attacker.com/steal-payment' }
          });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(ResourceAccessError);

      expect(instrumented.getCalls()).toBe(1); // Signed for legitimate challenge, but rejected merchant redirect
    });

    it('rejects malformed 402 body with invalid JSON -> PaymentRequiredParseError', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('{ invalid_json: ', { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(PaymentRequiredParseError);

      expect(instrumented.getCalls()).toBe(0);
    });

    it('rejects unsupported scheme (e.g. upto instead of exact) -> UnsupportedRequirementError', async () => {
      const unsupportedSchemeChallenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: RESOURCE_URL },
        accepts: [
          {
            scheme: 'upto' as any,
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: VALID_PAYTO,
            maxTimeoutSeconds: 60
          }
        ]
      };

      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(unsupportedSchemeChallenge), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(UnsupportedRequirementError);

      expect(instrumented.getCalls()).toBe(0);
    });
  });

  // ===========================================================================
  // 2. CONCURRENT CONFIRMATION, REPLAY & SIGNER BOUNDARY HARDENING
  // ===========================================================================
  describe('2. Concurrent Confirmation, Replay & Signer Boundary Hardening', () => {
    it('simultaneous confirmation calls on the same payment attempt execute the signer at most once', async () => {
      const boundaryInput = {
        originalUrl: RESOURCE_URL,
        challenge: createTestChallenge(),
        selectedIndex: 0,
        firstSeen: FIXED_NOW,
        now: () => FIXED_NOW,
        readTrust: baseTrust
      };

      const attempt = createPaymentAttempt(boundaryInput, instrumented.signer);

      // Fire 3 simultaneous invocations on the exact same attempt
      const results = await Promise.allSettled([
        attempt.createPaymentPayload(),
        attempt.createPaymentPayload(),
        attempt.createPaymentPayload()
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1); // EXACTLY ONE succeeds
      expect(rejected.length).toBe(2); // Others fail-closed
      expect(instrumented.getCalls()).toBe(1); // SIGNER INVOKED AT MOST ONCE
    });

    it('prevents mutation of confirmation summary in user callback (immutable snapshot)', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async (summary) => {
            // Attacker attempts in-place mutation of frozen summary
            (summary as any).payTo = '0.0.999999_attacker';
            return true;
          }
        })
      ).rejects.toThrow(TypeError);

      expect(instrumented.getCalls()).toBe(0); // ZERO signer calls
    });

    it('rejects expired payment requirements (e.g. invalid timeout) -> BLOCK, zero signer calls', async () => {
      const expiredChallenge = createTestChallenge({
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: VALID_AMOUNT,
            payTo: VALID_PAYTO,
            maxTimeoutSeconds: 0, // Invalid timeout <= 0
            extra: { feePayer: FEE_PAYER }
          }
        ]
      });

      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(expiredChallenge), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(QuoteSealSecurityRejectionError);

      expect(instrumented.getCalls()).toBe(0);
    });

    it('double confirmation / concurrent execution calls on the same resource URL run cleanly', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          return new Response(JSON.stringify({ paid: true }), { status: 200 });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      const [res1, res2] = await Promise.all([
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        }),
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(instrumented.getCalls()).toBe(2); // Two legitimate distinct executions sign exactly once each
    });
  });

  // ===========================================================================
  // 3. FACILITATOR PROTOCOL & CONFIGURATION HARDENING
  // ===========================================================================
  describe('3. Facilitator Protocol & Configuration Hardening', () => {
    it('fails closed when live mode is requested with a MockFacilitatorClient', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          mode: 'live', // Explicit Live Mode
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator, // MockFacilitatorClient (isMock: true)
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(/Cannot use MockFacilitatorClient in live mode/);

      expect(instrumented.getCalls()).toBe(0);
    });

    it('handles facilitator HTTP network timeout and aborts without retrying resource', async () => {
      facilitator.shouldFail = true;
      facilitator.failureReason = 'ETIMEDOUT: Facilitator submission timed out';

      let retryAttempted = false;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          retryAttempted = true;
          return new Response(JSON.stringify({ paid: true }), { status: 200 });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(FacilitatorSettlementError);

      expect(instrumented.getCalls()).toBe(1);
      expect(retryAttempted).toBe(false); // No resource retry after failed facilitator submission
    });

    it('HttpFacilitatorClient constructor validates URL protocol', () => {
      expect(() => new HttpFacilitatorClient('')).toThrow(/non-empty string/);
      expect(() => new HttpFacilitatorClient('ftp://facilitator.com')).toThrow(/expected http: or https:/);
      expect(() => new HttpFacilitatorClient('https://facilitator.hedera.testnet')).not.toThrow();
    });

    it('HttpFacilitatorClient checkHealth queries health endpoint', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          return new Response(JSON.stringify({ status: 'ok', network: 'hedera:testnet' }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const client = new HttpFacilitatorClient('https://facilitator.example/v1', mockFetch as unknown as typeof fetch);
      const health = await client.checkHealth();
      expect(health.healthy).toBe(true);
    });

    it('HttpFacilitatorClient checkCapabilities queries /supported and verifies network + scheme', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/supported')) {
          return new Response(
            JSON.stringify({
              kinds: [
                { x402Version: 2, scheme: 'exact', network: 'hedera:testnet' },
                { x402Version: 2, scheme: 'exact', network: 'eip155:84532' }
              ]
            }),
            { status: 200 }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const client = new HttpFacilitatorClient('https://facilitator.example', mockFetch as unknown as typeof fetch);
      const supported = await client.checkCapabilities('hedera:testnet', 'exact');
      expect(supported.supported).toBe(true);

      const unsupported = await client.checkCapabilities('solana:mainnet', 'exact');
      expect(unsupported.supported).toBe(false);
    });
  });

  // ===========================================================================
  // 4. END-TO-END LIVE MODE & INDEPENDENT MIRROR NODE VERIFICATION
  // ===========================================================================
  describe('4. Independent Mirror Node On-Chain Verification Integration', () => {
    const canonicalTxId = '0.0.5001@1700000000.000000000';
    const normalizedTxId = '0.0.5001-1700000000-000000000';

    const mirrorNodeSuccessResponse: MirrorNodeTransactionsResponse = {
      transactions: [
        {
          transaction_id: normalizedTxId,
          consensus_timestamp: '1700000000.123456789',
          result: 'SUCCESS',
          transfers: [
            { account: '0.0.42', amount: -10 },
            { account: VALID_PAYTO, amount: 10 }
          ]
        }
      ]
    };

    it('Live mode: succeeds end-to-end when independent Mirror Node confirms SETTLED_VERIFIED', async () => {
      const mockMerchantFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          return new Response(JSON.stringify({ article: 'Verified Testnet Paid Content' }), { status: 200 });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      const mockFacilitatorFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            network: 'hedera:testnet',
            transaction: canonicalTxId,
            payer: '0.0.42'
          }),
          { status: 200 }
        );
      });

      const mockMirrorNodeFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(mirrorNodeSuccessResponse), { status: 200 });
      });

      const liveFacilitator = new HttpFacilitatorClient(
        'https://facilitator.hedera.testnet',
        mockFacilitatorFetch as unknown as typeof fetch
      );

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockMirrorNodeFetch as unknown as typeof fetch
      );

      const result = await orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'live',
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: baseTrust,
        facilitator: liveFacilitator,
        verifier,
        fetch: mockMerchantFetch as unknown as typeof fetch,
        confirm: async () => true
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('live');
      expect(result.settlement?.simulated).toBe(false);
      expect(result.verification?.status).toBe('SETTLED_VERIFIED');
      expect(result.verification?.evidence?.result).toBe('SUCCESS');
      expect(result.verification?.evidence?.recipient).toBe(VALID_PAYTO);
      expect(instrumented.getCalls()).toBe(1);
    });

    it('Live mode: fails closed with SettlementVerificationError when Mirror Node reports SETTLEMENT_FAILED', async () => {
      let merchantRetryAttempted = false;

      const mockMerchantFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          merchantRetryAttempted = true;
          return new Response(JSON.stringify({ error: 'Should not reach here' }), { status: 200 });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      const mockFacilitatorFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            network: 'hedera:testnet',
            transaction: canonicalTxId
          }),
          { status: 200 }
        );
      });

      const mirrorNodeFailureResponse: MirrorNodeTransactionsResponse = {
        transactions: [
          {
            transaction_id: normalizedTxId,
            consensus_timestamp: '1700000000.123456789',
            result: 'INSUFFICIENT_PAYER_BALANCE', // On-chain failure!
            transfers: []
          }
        ]
      };

      const mockMirrorNodeFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(mirrorNodeFailureResponse), { status: 200 });
      });

      const liveFacilitator = new HttpFacilitatorClient(
        'https://facilitator.hedera.testnet',
        mockFacilitatorFetch as unknown as typeof fetch
      );

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        mockMirrorNodeFetch as unknown as typeof fetch
      );

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          mode: 'live',
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator: liveFacilitator,
          verifier,
          fetch: mockMerchantFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(SettlementVerificationError);

      expect(merchantRetryAttempted).toBe(false); // Resource retry was ABORTED
    });

    it('Live mode: fails closed when Mirror Node reports recipient/amount mismatch -> SETTLEMENT_MISMATCH', async () => {
      const mockMerchantFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      const mockFacilitatorFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            network: 'hedera:testnet',
            transaction: canonicalTxId
          }),
          { status: 200 }
        );
      });

      // Mirror node reports a transaction that credited the wrong recipient
      const mirrorNodeMismatchResponse: MirrorNodeTransactionsResponse = {
        transactions: [
          {
            transaction_id: normalizedTxId,
            consensus_timestamp: '1700000000.123456789',
            result: 'SUCCESS',
            transfers: [
              { account: '0.0.42', amount: -10 },
              { account: '0.0.999999_wrong_payto', amount: 10 }
            ]
          }
        ]
      };

      const liveFacilitator = new HttpFacilitatorClient(
        'https://facilitator.hedera.testnet',
        mockFacilitatorFetch as unknown as typeof fetch
      );

      const verifier = new HederaMirrorNodeVerifier(
        'https://testnet.mirrornode.hedera.com',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mirrorNodeMismatchResponse), { status: 200 })) as any
      );

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          mode: 'live',
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: baseTrust,
          facilitator: liveFacilitator,
          verifier,
          fetch: mockMerchantFetch as unknown as typeof fetch,
          confirm: async () => true
        })
      ).rejects.toThrow(SettlementVerificationError);
    });

    it('Local demo mode: clearly reports simulated: true and does not claim real on-chain settlement', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (headers.has('PAYMENT-SIGNATURE')) {
          return new Response(JSON.stringify({ paid: true }), { status: 200 });
        }
        return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
      });

      const res = await orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: baseTrust,
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe('local');
      expect(res.settlement?.simulated).toBe(true);
      expect(res.verification?.status).toBe('SETTLEMENT_UNVERIFIED');
      expect(res.verification?.reason).toContain('Local simulation');
    });
  });
});
