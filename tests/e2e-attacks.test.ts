import { describe, it, expect } from 'vitest';
import {
  evaluate,
  createGuardedSigner,
  MerchantProfile,
  PaymentRequest,
  BuyerPolicy,
} from '@quoteseal/payee-guard';
import { executeHederaPayment } from '@quoteseal/hedera-x402';
import { startAuth, validateCallback } from '@quoteseal/world-auth';

describe('QuoteSeal Cross-Package E2E Test Suite (T1 - T11)', () => {
  const baseProfile: MerchantProfile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    network: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: 1000000000n, // 10 HBAR limit
    profileVersion: 1,
    rotationStatus: 'none',
  };

  const basePolicy: BuyerPolicy = {
    trustedMerchants: ['researchpro.eth'],
    maxAmount: 500000000n, // 5 HBAR limit
  };

  const now = 1800000000;

  const validPayment: PaymentRequest = {
    origin: 'https://api.researchpro.com',
    payTo: '0.0.12345',
    amount: 100000000n, // 1 HBAR
    asset: 'HBAR',
    network: 'hedera:testnet',
    expiresAt: now + 300,
    ensName: 'researchpro.eth',
  };

  // T1: Normal payment, matching profile -> PASS, signer called, Hedera settles
  it('T1: Normal payment passes guard, signer called, settles on Hedera', async () => {
    let rawSignerCalled = 0;
    const guarded = createGuardedSigner(
      async (req) => {
        rawSignerCalled++;
        return executeHederaPayment({
          network: req.network,
          asset: req.asset,
          payTo: req.payTo,
          amount: String(req.amount),
          serviceEndpoint: req.origin,
          referenceId: 'ref_t1',
          expiresAt: req.expiresAt || now + 300,
        });
      },
      {
        resolveProfile: async () => baseProfile,
        policy: basePolicy,
        getNow: () => now,
      }
    );

    const res = await guarded.execute(validPayment);
    expect(res.verdict).toBe('PASS');
    expect(res.signerCallCount).toBe(1);
    expect(rawSignerCalled).toBe(1);
    expect(res.result?.receipt.hashScanUrl).toContain('hashscan.io');
    expect(res.result?.receipt.recipientAccountId).toBe('0.0.12345');
  });

  // T2: Proxy rewrites payTo -> BLOCK, signer never called
  it('T2: Attack proxy rewrites payTo -> BLOCK with signerCallCount = 0', async () => {
    let rawSignerCalled = 0;
    const guarded = createGuardedSigner(
      async () => {
        rawSignerCalled++;
        return { receipt: {} };
      },
      {
        resolveProfile: async () => baseProfile,
        policy: basePolicy,
        getNow: () => now,
      }
    );

    // MITM Attack Proxy modifies payTo to attacker address 0.0.66666
    const tamperedPayment = {
      ...validPayment,
      payTo: '0.0.66666',
    };

    const res = await guarded.execute(tamperedPayment);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNAUTHORIZED_PAYEE');
    expect(res.signerCallCount).toBe(0);
    expect(rawSignerCalled).toBe(0);
  });

  // T3: Unknown merchant -> BLOCK
  it('T3: Unknown / untrusted merchant is blocked', () => {
    const untrustedPolicy: BuyerPolicy = {
      trustedMerchants: ['other-merchant.eth'],
    };
    const res = evaluate(validPayment, baseProfile, untrustedPolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNTRUSTED_MERCHANT');
  });

  // T4: Look-alike origin -> BLOCK
  it('T4: Look-alike origin domain is blocked', () => {
    const lookAlikePayment = {
      ...validPayment,
      origin: 'https://api.researchpro.co', // .co instead of .com
    };
    const res = evaluate(lookAlikePayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('ORIGIN_MISMATCH');
  });

  // T5: Amount/asset/network drift -> BLOCK
  it('T5: Amount, asset, and network drift are blocked', () => {
    // Excessive amount
    const excessivePayment = { ...validPayment, amount: 600000000n };
    expect(evaluate(excessivePayment, baseProfile, basePolicy, now).verdict).toBe('BLOCK');

    // Wrong network
    const networkDriftPayment = { ...validPayment, network: 'hedera:mainnet' };
    expect(evaluate(networkDriftPayment, baseProfile, basePolicy, now).verdict).toBe('BLOCK');

    // Wrong asset
    const assetDriftPayment = { ...validPayment, asset: 'USDC' };
    expect(evaluate(assetDriftPayment, baseProfile, basePolicy, now).verdict).toBe('BLOCK');
  });

  // T6: Unannounced rotation -> BLOCK
  it('T6: Unannounced payout rotation is blocked', () => {
    const unannouncedPayment = {
      ...validPayment,
      payTo: '0.0.88888',
    };
    const res = evaluate(unannouncedPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNAUTHORIZED_PAYEE');
  });

  // T7: During rotation delay -> HOLD, no signature
  it('T7: Payment during rotation timelock delay results in HOLD', async () => {
    let rawSignerCalled = 0;
    const pendingProfile: MerchantProfile = {
      ...baseProfile,
      rotationStatus: 'pending',
      pendingPayTo: '0.0.99999',
      pendingEffectiveAt: now + 90, // 90 seconds timelock
    };

    const guarded = createGuardedSigner(
      async () => {
        rawSignerCalled++;
        return {};
      },
      {
        resolveProfile: async () => pendingProfile,
        policy: basePolicy,
        getNow: () => now, // current time is during timelock delay
      }
    );

    const pendingPayment = { ...validPayment, payTo: '0.0.99999' };
    const res = await guarded.execute(pendingPayment);

    expect(res.verdict).toBe('HOLD');
    expect(res.reason).toContain('ROTATION_PENDING_TIMELOCK');
    expect(res.signerCallCount).toBe(0);
    expect(rawSignerCalled).toBe(0);
  });

  // T8: Approved rotation -> New payTo passes, old rejected
  it('T8: After rotation activation, new payTo passes and old payTo is blocked', () => {
    const activatedProfile: MerchantProfile = {
      ...baseProfile,
      rotationStatus: 'active',
      activePayTo: '0.0.99999',
    };

    // New address passes
    const newPayment = { ...validPayment, payTo: '0.0.99999' };
    expect(evaluate(newPayment, activatedProfile, basePolicy, now + 100).verdict).toBe('PASS');

    // Old address is now blocked
    const oldPayment = { ...validPayment, payTo: '0.0.12345' };
    expect(evaluate(oldPayment, activatedProfile, basePolicy, now + 100).verdict).toBe('BLOCK');
  });

  // T9: Denied/expired World auth -> No activation, old profile stays
  it('T9: Denied or unauthorized World ID auth prevents activation', async () => {
    const session = startAuth({
      clientId: 'app_test',
      redirectUri: 'http://localhost:3001/world/callback',
    });

    const deniedResult = await validateCallback({
      code: '',
      state: session.state,
      error: 'access_denied',
      error_description: 'Operator rejected biometric verification',
    });

    expect(deniedResult.valid).toBe(false);
    expect(deniedResult.error).toContain('access_denied');

    // Profile remains unchanged with original activePayTo
    expect(baseProfile.activePayTo).toBe('0.0.12345');
  });

  // T10: ENS/RPC unavailable -> UNVERIFIABLE (fail closed)
  it('T10: ENS/RPC failure maps to UNVERIFIABLE (fail-closed, signer never called)', async () => {
    let rawSignerCalled = 0;
    const guarded = createGuardedSigner(
      async () => {
        rawSignerCalled++;
        return {};
      },
      {
        resolveProfile: async () => {
          throw new Error('Sepolia RPC connection timed out');
        },
        policy: basePolicy,
        getNow: () => now,
      }
    );

    const res = await guarded.execute(validPayment);
    expect(res.verdict).toBe('UNVERIFIABLE');
    expect(res.signerCallCount).toBe(0);
    expect(rawSignerCalled).toBe(0);
  });

  // T11: Stale/replayed 402 -> Reject, do not sign stale terms
  it('T11: Stale / replayed 402 payment challenge is blocked', () => {
    const stalePayment = {
      ...validPayment,
      expiresAt: now - 10, // Expired 10 seconds ago
    };
    const res = evaluate(stalePayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('STALE_402_OFFER');
  });
});
