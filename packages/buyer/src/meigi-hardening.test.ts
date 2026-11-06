/**
 * QuoteSeal x402 Hardening & Bypass Protection Test Suite
 *
 * Validates the 8 core scenarios specified in QuoteSeal MVP Porting from Meigi:
 * 1. Trusted merchant with declared identity: PASS (signerCalls === 1)
 * 2. Trusted merchant without identity declaration: BLOCK (signerCalls === 0)
 * 3. Malicious payTo: BLOCK (signerCalls === 0)
 * 4. Altered amount: BLOCK (signerCalls === 0)
 * 5. Wrong network: BLOCK (signerCalls === 0)
 * 6. Wrong asset: BLOCK (signerCalls === 0)
 * 7. Cross-origin redirect: BLOCK (signerCalls === 0)
 * 8. Untrusted/pending merchant: BLOCK/HOLD (signerCalls === 0)
 *
 * Tests the real BuyerPaymentOrchestrator full execution path,
 * verifying that the controlled signer is never invoked on non-PASS verdicts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BuyerPaymentOrchestrator,
  MockFacilitatorClient,
  QuoteSealSecurityRejectionError,
  UnsupportedRequirementError
} from './index.js';
import {
  defaultProfile,
  defaultAnchors,
  quoteSealPayeeDeclaration,
  type TrustSnapshot
} from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';

describe('Meigi x402 Guard Hardening (8 Specified Security Scenarios)', () => {
  const TRUSTED_ENS = 'merchant.eth';
  const TRUSTED_PAYTO = defaultProfile.payTo ?? '0.0.123456';
  const ATTACKER_PAYTO = '0.0.9999999';
  const FEE_PAYER = '0.0.98';
  const VALID_AMOUNT = '10';
  const EXCESSIVE_AMOUNT = '999999999';
  const MERCHANT_ORIGIN = 'https://merchant.example';
  const RESOURCE_URL = `${MERCHANT_ORIGIN}/api/resource`;
  const FIXED_TIME = 1000;

  let orchestrator: BuyerPaymentOrchestrator;
  let facilitator: MockFacilitatorClient;
  let signerCalls: number;
  let signer: ClientHederaSigner;

  beforeEach(() => {
    orchestrator = new BuyerPaymentOrchestrator();
    facilitator = new MockFacilitatorClient();
    signerCalls = 0;
    signer = {
      accountId: '0.0.4242',
      async createPartiallySignedTransferTransaction(_req: PaymentRequirements) {
        signerCalls++;
        return Buffer.from('mock-signed-tx').toString('base64');
      }
    };
  });

  const trustedSnapshot: TrustSnapshot = {
    profile: {
      ...defaultProfile,
      origin: MERCHANT_ORIGIN,
      ensName: TRUSTED_ENS,
      checkedAt: FIXED_TIME
    },
    anchors: { ...defaultAnchors }
  };

  function createChallenge(opts: {
    payTo?: string;
    amount?: string;
    network?: string;
    asset?: string;
    declaration?: Record<string, unknown> | null;
    resourceUrl?: string;
  } = {}): PaymentRequired {
    return {
      x402Version: 2,
      resource: { url: opts.resourceUrl ?? RESOURCE_URL },
      accepts: [
        {
          scheme: 'exact',
          network: (opts.network ?? 'hedera:testnet') as `${string}:${string}`,
          asset: opts.asset ?? '0.0.0',
          amount: opts.amount ?? VALID_AMOUNT,
          payTo: opts.payTo ?? TRUSTED_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ],
      ...(opts.declaration !== null
        ? { extensions: opts.declaration ?? quoteSealPayeeDeclaration({ ens: TRUSTED_ENS }) }
        : {})
    };
  }

  function mockFetch(challenge: PaymentRequired, status: number = 402) {
    let requests = 0;
    return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests++;
      if (requests === 1) {
        return new Response(JSON.stringify(challenge), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Retry with payment proof: return 200 OK
      return new Response(JSON.stringify({ status: 'ACCESS_GRANTED', data: 'premium-data' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Legitimate payment with declared identity (PASS)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 1: trusted merchant with declared identity -> PASS (signerCalls === 1)', async () => {
    const challenge = createChallenge({
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    const result = await orchestrator.execute({
      resourceUrl: RESOURCE_URL,
      mode: 'local',
      signer,
      facilitator,
      fetch: mockFetch(challenge),
      now: () => FIXED_TIME,
      readTrust: () => trustedSnapshot,
      confirm: async () => true
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(signerCalls).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Trusted merchant without identity declaration (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 2: trusted merchant without identity declaration -> BLOCK (signerCalls === 0)', async () => {
    // Plain 402 challenge with no extensions
    const challenge = createChallenge({ declaration: null });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Malicious payTo (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 3: malicious payTo -> BLOCK (signerCalls === 0)', async () => {
    // Declares merchant.eth, but directs payout to attacker account
    const challenge = createChallenge({
      payTo: ATTACKER_PAYTO,
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Altered amount (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 4: altered amount exceeding authorized maxAmount -> BLOCK (signerCalls === 0)', async () => {
    const challenge = createChallenge({
      amount: EXCESSIVE_AMOUNT,
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Wrong network (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 5: wrong network -> BLOCK / rejection (signerCalls === 0)', async () => {
    const challenge = createChallenge({
      network: 'hedera:mainnet',
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(UnsupportedRequirementError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Wrong asset (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 6: wrong asset -> BLOCK / rejection (signerCalls === 0)', async () => {
    const challenge = createChallenge({
      asset: '0.0.9999', // Rogue token
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(UnsupportedRequirementError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: Cross-origin redirect (BLOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 7: cross-origin redirect -> BLOCK (signerCalls === 0)', async () => {
    const redirectFetch: typeof fetch = async () => {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://evil-phishing.example/api/resource' }
      });
    };

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: redirectFetch,
        now: () => FIXED_TIME,
        readTrust: () => trustedSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(signerCalls).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: Untrusted/pending merchant profile (HOLD / UNVERIFIABLE)
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 8: untrusted or pending merchant profile -> HOLD / BLOCK (signerCalls === 0)', async () => {
    const challenge = createChallenge({
      declaration: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    });

    // Profile is missing (pending or uncommitted merchant)
    const emptyTrustSnapshot: TrustSnapshot = {
      profile: undefined,
      anchors: { ...defaultAnchors }
    };

    await expect(
      orchestrator.execute({
        resourceUrl: RESOURCE_URL,
        mode: 'local',
        signer,
        facilitator,
        fetch: mockFetch(challenge),
        now: () => FIXED_TIME,
        readTrust: () => emptyTrustSnapshot,
        confirm: async () => true
      })
    ).rejects.toThrow(QuoteSealSecurityRejectionError);

    expect(signerCalls).toBe(0);
  });
});
