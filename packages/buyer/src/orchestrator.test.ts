import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import type { ClientHederaSigner } from '@x402/hedera';
import { defaultProfile, defaultAnchors, createPaymentAttempt } from '@quoteseal/guard';
import { BuyerPaymentOrchestrator } from './orchestrator.js';
import { MockFacilitatorClient, HttpFacilitatorClient } from './facilitator.js';
import {
  BuyerConfirmationRequiredError,
  QuoteSealSecurityRejectionError,
  UnsupportedRequirementError,
  FacilitatorSettlementError,
  InvalidSettlementEvidenceError,
  ResourceAccessError
} from './types.js';

// ---------------------------------------------------------------------------
// TEST FIXTURES & INSTRUMENTATION
// ---------------------------------------------------------------------------

const RESOURCE_URL = 'https://merchant.example/api/premium-report';
const MERCHANT_ORIGIN = 'https://merchant.example';
const VALID_PAYTO = defaultProfile.payTo ?? '0.0.123456';
const FEE_PAYER = '0.0.98';
const VALID_AMOUNT = '10'; // <= defaultProfile.maxAmount ('100')
const FIXED_NOW = 1000;

function createTestChallenge(
  payTo: string = VALID_PAYTO,
  amount: string = VALID_AMOUNT,
  extensions: Record<string, unknown> = { quoteseal: { ens: 'merchant.eth' } }
): PaymentRequired {
  return {
    x402Version: 2,
    resource: { url: RESOURCE_URL },
    accepts: [
      {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount,
        payTo,
        maxTimeoutSeconds: 60,
        extra: { feePayer: FEE_PAYER }
      }
    ],
    extensions
  };
}

function createInstrumentedSigner(accountId: string = '0.0.42') {
  let calls = 0;
  let lastSignedReq: PaymentRequirements | null = null;

  const signer: ClientHederaSigner = {
    accountId,
    async createPartiallySignedTransferTransaction(req: PaymentRequirements) {
      calls++;
      lastSignedReq = { ...req };
      return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
    }
  };

  return {
    signer,
    getCalls: () => calls,
    getLastSigned: () => lastSignedReq,
    reset: () => {
      calls = 0;
      lastSignedReq = null;
    }
  };
}

describe('BuyerPaymentOrchestrator — End-to-End Buyer x402 Flow & Security Invariants', () => {
  let orchestrator: BuyerPaymentOrchestrator;
  let facilitator: MockFacilitatorClient;
  let instrumented: ReturnType<typeof createInstrumentedSigner>;

  beforeEach(() => {
    orchestrator = new BuyerPaymentOrchestrator();
    facilitator = new MockFacilitatorClient();
    instrumented = createInstrumentedSigner();
  });

  it('runs a real local HTTP 402 → confirm → simulated settlement → paid resource round trip', async () => {
    let requests = 0;
    const server = createServer((req, res) => {
      requests++;
      if (!req.headers['payment-signature']) {
        res.writeHead(402, { 'content-type': 'application/json' });
        res.end(JSON.stringify(createTestChallenge()));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ demo: 'LOCAL/SIMULATED', content: 'paid resource' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Local merchant failed to bind');
    const url = 'https://merchant.example/premium';
    const localFetch: typeof fetch = (request, init) => {
      const target = new URL(typeof request === 'string' ? request : request.url);
      if (target.origin !== 'https://merchant.example') throw new Error('Unexpected resource origin');
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(address.port);
      return fetch(target, init);
    };
    try {
      const result = await orchestrator.execute({
        resourceUrl: url,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({ profile: { ...defaultProfile, origin: new URL(url).origin }, anchors: { ...defaultAnchors } }),
        facilitator,
        fetch: localFetch,
        confirm: async summary => {
          expect(summary.resourceUrl).toBe(url);
          expect(summary.network).toBe('hedera:testnet');
          return true;
        }
      });
      expect(result.data).toEqual({ demo: 'LOCAL/SIMULATED', content: 'paid resource' });
      expect(requests).toBe(2);
      expect(instrumented.getCalls()).toBe(1);
      expect(result.settlement?.transactionId).toBeDefined(); // MockFacilitatorClient: simulation only.
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    }
  });

  // ===========================================================================
  // 1. LEGITIMATE REQUIREMENT AND BUYER CONFIRMATION
  // ===========================================================================
  it('1. Legitimate requirement and buyer confirmation -> signs exactly once and returns paid resource', async () => {
    let confirmCalled = false;
    let receivedSummary: any = null;

    // Mock fetch: 402 on initial call, 200 on paid retry
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('PAYMENT-SIGNATURE')) {
        return new Response(JSON.stringify(createTestChallenge()), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify payment signature is present
      const sig = headers.get('PAYMENT-SIGNATURE');
      expect(sig).toBeDefined();

      return new Response(JSON.stringify({ report: 'Decentralized Identity Insights', paid: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      signer: instrumented.signer,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN, ensName: 'merchant.eth' },
        anchors: { ...defaultAnchors }
      }),
      facilitator,
      fetch: mockFetch as unknown as typeof fetch,
      now: () => 1000,
      confirm: async (summary) => {
        confirmCalled = true;
        receivedSummary = summary;
        // Verify summary fields
        expect(summary.payTo).toBe(VALID_PAYTO);
        expect(summary.amount).toBe(VALID_AMOUNT);
        expect(summary.asset).toBe('0.0.0');
        expect(summary.network).toBe('hedera:testnet');
        expect(summary.merchantOrigin).toBe(MERCHANT_ORIGIN);
        expect(Object.isFrozen(summary)).toBe(true);
        expect(Object.isFrozen(summary.rawRequirement)).toBe(true);
        return true;
      }
    });

    // Invariants check
    expect(confirmCalled).toBe(true);
    expect(instrumented.getCalls()).toBe(1); // SIGNER INVOKED EXACTLY ONCE
    expect(facilitator.calls.length).toBe(1);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect((result.data as any).paid).toBe(true);
    expect(result.settlement?.transactionId).toBe('0.0.5001@1700000000.000000000');
    expect(result.payment?.merchantPayTo).toBe(VALID_PAYTO);
  });

  // ===========================================================================
  // 2. BUYER CANCELLATION
  // ===========================================================================
  it.each([false, undefined, 'yes', 'true', null, 0])(
    '2. Buyer cancellation (answer: %s) -> aborts with zero signer calls',
    async (nonBooleanAnswer) => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(createTestChallenge()), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      await expect(
        orchestrator.execute({
          resourceUrl: RESOURCE_URL,
          signer: instrumented.signer,
          now: () => FIXED_NOW,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
            anchors: { ...defaultAnchors }
          }),
          facilitator,
          fetch: mockFetch as unknown as typeof fetch,
          confirm: async () => nonBooleanAnswer as any
        })
      ).rejects.toThrow(BuyerConfirmationRequiredError);

      expect(instrumented.getCalls()).toBe(0); // ZERO SIGNER CALLS
      expect(facilitator.calls.length).toBe(0); // ZERO FACILITATOR CALLS
    }
  );

  // ===========================================================================
  // 3. TAMPERED PAYTO
  // ===========================================================================
  it('3. Tampered payTo (different from trusted ENS payout) -> QuoteSeal returns BLOCK, zero confirmations, zero signer calls', async () => {
    let confirmInvoked = false;

    // Attacker alters payTo in 402 challenge
    const attackerPayTo = '0.0.999999_attacker';
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(createTestChallenge(attackerPayTo)), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN, payTo: VALID_PAYTO, activePayTo: VALID_PAYTO },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => {
          confirmInvoked = true;
          return true;
        }
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(confirmInvoked).toBe(false); // Buyer confirmation is never prompted on BLOCK
    expect(instrumented.getCalls()).toBe(0); // ZERO SIGNER CALLS
    expect(facilitator.calls.length).toBe(0);
  });

  // ===========================================================================
  // 4. CHANGED AMOUNT (EXCEEDS CAP OR ZERO/NEGATIVE)
  // ===========================================================================
  it('4a. Amount exceeds buyer maximum cap -> QuoteSeal returns BLOCK with zero signer calls', async () => {
    let confirmInvoked = false;

    // Amount exceeds profile maxAmount
    const excessiveAmount = '999999999999';
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(createTestChallenge(VALID_PAYTO, excessiveAmount)), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN, maxAmount: '50' },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => {
          confirmInvoked = true;
          return true;
        }
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(confirmInvoked).toBe(false);
    expect(instrumented.getCalls()).toBe(0);
  });

  it('4b. Amount is zero or negative -> QuoteSeal returns BLOCK with zero signer calls', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(createTestChallenge(VALID_PAYTO, '0')), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(instrumented.getCalls()).toBe(0);
  });

  // ===========================================================================
  // 5. CHANGED NETWORK OR ASSET
  // ===========================================================================
  it('5a. Unsupported network (e.g. ethereum:sepolia) -> aborts with UnsupportedRequirementError, zero signer calls', async () => {
    const wrongNetworkChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: RESOURCE_URL },
      accepts: [
        {
          scheme: 'exact',
          network: 'ethereum:sepolia' as any,
          asset: '0x0000000000000000000000000000000000000000',
          amount: '100',
          payTo: '0x1111111111111111111111111111111111111111',
          maxTimeoutSeconds: 60
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(wrongNetworkChallenge), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      })
    ).rejects.toThrow(UnsupportedRequirementError);

    expect(instrumented.getCalls()).toBe(0);
  });

  it('5b. Unsupported asset (e.g. unknown token id) -> aborts with UnsupportedRequirementError, zero signer calls', async () => {
    const wrongAssetChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: RESOURCE_URL },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.999999', // Unknown non-HBAR asset
          amount: '100',
          payTo: VALID_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(wrongAssetChallenge), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      })
    ).rejects.toThrow(UnsupportedRequirementError);

    expect(instrumented.getCalls()).toBe(0);
  });

  // ===========================================================================
  // 6. REPLAYED CONFIRMATION / CONSUMED PAYMENT ATTEMPT
  // ===========================================================================
  it('6. Replay attack: second confirmation cannot reuse a consumed payment attempt', async () => {
    // 6a. Direct boundary test: a single payment attempt cannot be invoked twice
    const boundaryInput = {
      originalUrl: RESOURCE_URL,
      challenge: createTestChallenge(),
      selectedIndex: 0,
      firstSeen: FIXED_NOW,
      now: () => FIXED_NOW,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
        anchors: { ...defaultAnchors }
      })
    };
    const attempt = createPaymentAttempt(boundaryInput, instrumented.signer);
    const payload = await attempt.createPaymentPayload();
    expect(payload).toBeDefined();
    expect(instrumented.getCalls()).toBe(1);

    // Second call on same attempt MUST fail and MUST NOT call signer again
    await expect(attempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
    expect(instrumented.getCalls()).toBe(1);

    // 6b. Across orchestrator runs, each execution is freshly evaluated and confirmed
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('PAYMENT-SIGNATURE')) {
        return new Response(JSON.stringify(createTestChallenge()), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ paid: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const secondSigner = createInstrumentedSigner();
    const result = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      signer: secondSigner.signer,
      now: () => FIXED_NOW,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
        anchors: { ...defaultAnchors }
      }),
      facilitator,
      fetch: mockFetch as unknown as typeof fetch,
      confirm: async () => true
    });
    expect(result.success).toBe(true);
    expect(secondSigner.getCalls()).toBe(1);
  });

  // ===========================================================================
  // 7. FACILITATOR FAILURE
  // ===========================================================================
  it('7. Facilitator failure -> throws FacilitatorSettlementError, zero settlement claim, no resource access', async () => {
    let merchantRetryReceived = false;

    facilitator.shouldFail = true;
    facilitator.failureReason = 'INSUFFICIENT_FEE_PAYER_BALANCE';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.has('PAYMENT-SIGNATURE')) {
        merchantRetryReceived = true;
        return new Response(JSON.stringify({ paid: true }), { status: 200 });
      }
      return new Response(JSON.stringify(createTestChallenge()), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      })
    ).rejects.toThrow(FacilitatorSettlementError);

    // Signer was called to create the payload
    expect(instrumented.getCalls()).toBe(1);
    // But settlement failed, so retry was NEVER sent to merchant
    expect(merchantRetryReceived).toBe(false);
  });

  // ===========================================================================
  // 8. SUCCESSFUL SETTLEMENT EVIDENCE VERIFICATION & FABRICATED EVIDENCE DEFENSE
  // ===========================================================================
  it('8a. Facilitator response with fabricated/invalid transaction evidence is rejected', async () => {
    facilitator.invalidEvidence = true; // Returns "invalid_fake_id" instead of "0.0.x@sec.nano"

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(createTestChallenge()), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
          anchors: { ...defaultAnchors }
        }),
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => true
      })
    ).rejects.toThrow(InvalidSettlementEvidenceError);
  });

  it('8b. Valid Hedera transaction ID (shard.realm.account@seconds.nanos) is accepted and verified', async () => {
    facilitator.simulatedTransactionId = '0.0.9876@1789000000.123456789';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.has('PAYMENT-SIGNATURE')) {
        return new Response(JSON.stringify({ content: 'Verified Premium Data' }), { status: 200 });
      }
      return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
    });

    const res = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      signer: instrumented.signer,
      now: () => FIXED_NOW,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
        anchors: { ...defaultAnchors }
      }),
      facilitator,
      fetch: mockFetch as unknown as typeof fetch,
      confirm: async () => true
    });

    expect(res.settlement?.transactionId).toBe('0.0.9876@1789000000.123456789');
  });

  // ===========================================================================
  // 9. TRUST DRIFT DURING CONFIRMATION FAILS CLOSED
  // ===========================================================================
  it('9. Trust anchors change between 402 evaluation and signing -> fails closed with zero signer calls', async () => {
    let trustMutated = false;
    const baseRead = () => ({
      profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
      anchors: { ...defaultAnchors }
    });

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        signer: instrumented.signer,
        now: () => FIXED_NOW,
        readTrust: () => {
          if (trustMutated) {
            // Anchor owner drifted!
            return {
              profile: { ...defaultProfile, origin: MERCHANT_ORIGIN, owner: '0x9999999999999999999999999999999999999999' },
              anchors: { ...defaultAnchors, trustedOwner: '0x9999999999999999999999999999999999999999' }
            };
          }
          return baseRead();
        },
        facilitator,
        fetch: mockFetch as unknown as typeof fetch,
        confirm: async () => {
          // Attacker or drift occurs while user is looking at confirmation dialog
          trustMutated = true;
          return true;
        }
      })
    ).rejects.toThrow('QUOTESEAL_REJECTED');

    expect(instrumented.getCalls()).toBe(0);
  });

  // ===========================================================================
  // 10. REAL X402 FACILITATOR WIRE PROTOCOL INTEGRATION
  // ===========================================================================
  it('10. Direct integration with HttpFacilitatorClient wire protocol and settlement validation', async () => {
    let facilitatorRequestBody: any = null;

    const mockFacilitatorFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/testnet/settle')) {
        facilitatorRequestBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            success: true,
            network: 'hedera:testnet',
            transaction: '0.0.5001@1700000000.123456789',
            payer: '0.0.98'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const httpClient = new HttpFacilitatorClient(
      'https://facilitator.example/testnet',
      mockFacilitatorFetch as unknown as typeof fetch
    );

    const mockMerchantFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.has('PAYMENT-SIGNATURE')) {
        return new Response(JSON.stringify({ success: true, article: 'Official x402 Settled Content' }), {
          status: 200
        });
      }
      return new Response(JSON.stringify(createTestChallenge()), { status: 402 });
    });

    const result = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      signer: instrumented.signer,
      now: () => FIXED_NOW,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
        anchors: { ...defaultAnchors }
      }),
      facilitator: httpClient,
      fetch: mockMerchantFetch as unknown as typeof fetch,
      confirm: async () => true
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(instrumented.getCalls()).toBe(1);
    expect(facilitatorRequestBody).toBeDefined();
    expect(facilitatorRequestBody.x402Version).toBe(2);
    expect(facilitatorRequestBody.paymentRequirements.scheme).toBe('exact');
    expect(result.settlement?.transactionId).toBe('0.0.5001@1700000000.123456789');
  });

  // ===========================================================================
  // 11. UNPAID RESOURCE (200 OK INITIALLY)
  // ===========================================================================
  it('11. Initial request returns 200 OK -> returns resource directly with zero signer or facilitator calls', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ freeArticle: 'Public Content' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      signer: instrumented.signer,
      now: () => FIXED_NOW,
      readTrust: () => ({
        profile: { ...defaultProfile, origin: MERCHANT_ORIGIN },
        anchors: { ...defaultAnchors }
      }),
      facilitator,
      fetch: mockFetch as unknown as typeof fetch,
      confirm: async () => true
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect((result.data as any).freeArticle).toBe('Public Content');
    expect(instrumented.getCalls()).toBe(0);
    expect(facilitator.calls.length).toBe(0);
  });
});
