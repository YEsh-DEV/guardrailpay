import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluate,
  createGuardedSigner,
  normalizeOrigin,
  normalizeNetworkId,
  normalizeAsset,
  normalizeAccountId,
  normalizeAmount,
  MerchantProfile,
  PaymentRequest,
  BuyerPolicy,
  SharedRiskReader,
} from '../src/index.js';

describe('normalize utilities', () => {
  it('normalizes origins correctly (case, ports, trailing slashes)', () => {
    expect(normalizeOrigin('HTTP://API.ResearchPro.com:80/v1/paid')).toBe('http://api.researchpro.com');
    expect(normalizeOrigin('https://api.researchpro.com:443/')).toBe('https://api.researchpro.com');
    expect(normalizeOrigin('https://api.researchpro.com:8443/test/')).toBe('https://api.researchpro.com:8443');
    expect(() => normalizeOrigin('not-a-url')).toThrow();
  });

  it('normalizes network identifiers', () => {
    expect(normalizeNetworkId('HEDERA-TESTNET')).toBe('hedera:testnet');
    expect(normalizeNetworkId('hedera:testnet ')).toBe('hedera:testnet');
    expect(normalizeNetworkId('SEPOLIA')).toBe('ethereum:sepolia');
    expect(normalizeNetworkId('ethereum:sepolia')).toBe('ethereum:sepolia');
  });

  it('normalizes assets', () => {
    expect(normalizeAsset('hbar')).toBe('HBAR');
    expect(normalizeAsset(' 0.0.123456 ')).toBe('0.0.123456');
    expect(normalizeAsset('USDC')).toBe('USDC');
  });

  it('normalizes account IDs (Hedera & EVM)', () => {
    expect(normalizeAccountId('0.0.12345-vjflk')).toBe('0.0.12345');
    expect(normalizeAccountId(' 0.0.98765 ')).toBe('0.0.98765');
    expect(normalizeAccountId('0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c')).toBe(
      '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    );
  });

  it('normalizes amounts', () => {
    expect(normalizeAmount(1000n)).toBe(1000n);
    expect(normalizeAmount(500000)).toBe(500000n);
    expect(normalizeAmount('25000000')).toBe(25000000n);
    expect(() => normalizeAmount(-100n)).toThrow();
    expect(() => normalizeAmount('abc')).toThrow();
  });
});

describe('evaluate (pure verdict engine)', () => {
  const baseProfile: MerchantProfile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    network: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: 1000000000n, // 10 HBAR
    profileVersion: 1,
    rotationStatus: 'none',
  };

  const basePolicy: BuyerPolicy = {
    trustedMerchants: ['researchpro.eth'],
    maxAmount: 500000000n, // 5 HBAR
  };

  const validPayment: PaymentRequest = {
    origin: 'https://api.researchpro.com',
    payTo: '0.0.12345',
    amount: 100000000n, // 1 HBAR
    asset: 'HBAR',
    network: 'hedera:testnet',
    expiresAt: 2000000000,
    ensName: 'researchpro.eth',
  };

  const now = 1900000000;

  it('T1: PASS on matching valid payment request', () => {
    const res = evaluate(validPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('PASS');
    expect(res.reason).toContain('PAYEE_VERIFIED_ACTIVE');
  });

  it('T2: BLOCK when attacker rewrites payTo (MITM substitution)', () => {
    const attackedPayment: PaymentRequest = {
      ...validPayment,
      payTo: '0.0.66666', // Attacker address
    };
    const res = evaluate(attackedPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNAUTHORIZED_PAYEE');
  });

  it('T3: BLOCK when merchant is not in buyer trusted list', () => {
    const untrustedPolicy: BuyerPolicy = {
      trustedMerchants: ['other-merchant.eth'],
    };
    const res = evaluate(validPayment, baseProfile, untrustedPolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNTRUSTED_MERCHANT');
  });

  it('T4: BLOCK on look-alike or mismatched origin', () => {
    const spoofedPayment: PaymentRequest = {
      ...validPayment,
      origin: 'https://api.researchpro.co', // Look-alike domain
    };
    const res = evaluate(spoofedPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('ORIGIN_MISMATCH');
  });

  it('T5: BLOCK on amount, asset, or network drift', () => {
    // Amount exceeds policy limit
    const excessiveAmountPayment: PaymentRequest = {
      ...validPayment,
      amount: 600000000n, // Exceeds policy 5 HBAR
    };
    let res = evaluate(excessiveAmountPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('AMOUNT_EXCEEDED');

    // Network drift
    const networkDriftPayment: PaymentRequest = {
      ...validPayment,
      network: 'hedera:mainnet',
    };
    res = evaluate(networkDriftPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('NETWORK_MISMATCH');

    // Asset drift
    const assetDriftPayment: PaymentRequest = {
      ...validPayment,
      asset: 'USDC',
    };
    res = evaluate(assetDriftPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('ASSET_MISMATCH');
  });

  it('T6: BLOCK unannounced rotation attempt', () => {
    const unannouncedPayment: PaymentRequest = {
      ...validPayment,
      payTo: '0.0.88888', // Not active, and no pending rotation announced
    };
    const res = evaluate(unannouncedPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('UNAUTHORIZED_PAYEE');
  });

  it('T7: HOLD when payment requests pending address during timelock delay', () => {
    const rotatingProfile: MerchantProfile = {
      ...baseProfile,
      rotationStatus: 'pending',
      pendingPayTo: '0.0.77777',
      pendingEffectiveAt: now + 3600, // Effective in 1 hour
    };

    const pendingPayment: PaymentRequest = {
      ...validPayment,
      payTo: '0.0.77777',
    };

    const res = evaluate(pendingPayment, rotatingProfile, basePolicy, now);
    expect(res.verdict).toBe('HOLD');
    expect(res.reason).toContain('ROTATION_PENDING_TIMELOCK');
  });

  it('T8: PASS once rotation is activated and delay elapsed', () => {
    const activatedProfile: MerchantProfile = {
      ...baseProfile,
      rotationStatus: 'active',
      activePayTo: '0.0.77777',
      pendingPayTo: undefined,
    };

    const paymentToNewPayee: PaymentRequest = {
      ...validPayment,
      payTo: '0.0.77777',
    };

    const res = evaluate(paymentToNewPayee, activatedProfile, basePolicy, now + 4000);
    expect(res.verdict).toBe('PASS');

    // Old payee is now blocked
    const paymentToOldPayee: PaymentRequest = {
      ...validPayment,
      payTo: '0.0.12345',
    };
    const oldRes = evaluate(paymentToOldPayee, activatedProfile, basePolicy, now + 4000);
    expect(oldRes.verdict).toBe('BLOCK');
  });

  it('T11: BLOCK stale or expired 402 payment offers', () => {
    const expiredPayment: PaymentRequest = {
      ...validPayment,
      expiresAt: now - 60, // Expired 60s ago
    };
    const res = evaluate(expiredPayment, baseProfile, basePolicy, now);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('STALE_402_OFFER');
  });
});

describe('guardedSigner middleware', () => {
  const baseProfile: MerchantProfile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    network: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: 1000000000n,
    profileVersion: 1,
    rotationStatus: 'none',
  };

  const policy: BuyerPolicy = {
    trustedMerchants: ['researchpro.eth'],
  };

  const validPayment: PaymentRequest = {
    origin: 'https://api.researchpro.com',
    payTo: '0.0.12345',
    amount: 100000000n,
    asset: 'HBAR',
    network: 'hedera:testnet',
    ensName: 'researchpro.eth',
  };

  it('invokes signer ONLY on PASS and tracks call count', async () => {
    let mockSignerCalled = 0;
    const mockSigner = async (req: PaymentRequest) => {
      mockSignerCalled++;
      return { signedTx: `tx_for_${req.payTo}` };
    };

    const guarded = createGuardedSigner(mockSigner, {
      resolveProfile: async () => baseProfile,
      policy,
      getNow: () => 1000,
    });

    // 1. Valid payment -> PASS, signer called once
    const res1 = await guarded.execute(validPayment);
    expect(res1.verdict).toBe('PASS');
    expect(res1.signerCallCount).toBe(1);
    expect(mockSignerCalled).toBe(1);

    // 2. Tampered payment (attack) -> BLOCK, signer NOT called
    const tamperedPayment = { ...validPayment, payTo: '0.0.99999' };
    const res2 = await guarded.execute(tamperedPayment);
    expect(res2.verdict).toBe('BLOCK');
    expect(res2.signerCallCount).toBe(1); // Call count remains 1
    expect(mockSignerCalled).toBe(1); // Underlying signer was not invoked!
  });

  it('T10: Returns UNVERIFIABLE on resolver error with signer call count = 0', async () => {
    let mockSignerCalled = 0;
    const mockSigner = async () => {
      mockSignerCalled++;
      return { tx: 'ok' };
    };

    const failingGuarded = createGuardedSigner(mockSigner, {
      resolveProfile: async () => {
        throw new Error('RPC endpoint timeout');
      },
      policy,
      getNow: () => 1000,
    });

    const res = await failingGuarded.execute(validPayment);
    expect(res.verdict).toBe('UNVERIFIABLE');
    expect(res.signerCallCount).toBe(0);
    expect(mockSignerCalled).toBe(0);
  });

  it('blocks a payer flagged by a trusted Arkiv reader before the signer runs', async () => {
    let signerCalls = 0;
    const riskReader: SharedRiskReader = {
      async getTrustedWalletRiskState() {
        return {
          kind: 'trusted',
          state: {
            status: 'BLOCK',
            entityKey: 'fixture-risk-state',
            owner: 'fixture-writer',
            expiresAt: 999999n,
          },
        };
      },
    };

    const guarded = createGuardedSigner(
      async () => {
        signerCalls += 1;
        return { tx: 'should-not-run' };
      },
      {
        resolveProfile: async () => baseProfile,
        policy,
        riskReader,
        getNow: () => 1000,
      }
    );

    const result = await guarded.execute({ ...validPayment, payerWallet: '0.0.90001' });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('ARKIV_RISK_BLOCK');
    expect(result.signerCallCount).toBe(0);
    expect(signerCalls).toBe(0);
  });

  it('fails safe when the Arkiv reader is unavailable', async () => {
    let signerCalls = 0;
    const guarded = createGuardedSigner(
      async () => {
        signerCalls += 1;
        return { tx: 'should-not-run' };
      },
      {
        resolveProfile: async () => baseProfile,
        policy,
        riskReader: {
          async getTrustedWalletRiskState() {
            return { kind: 'unavailable', reason: 'query timeout' };
          },
        },
        getNow: () => 1000,
      }
    );

    const result = await guarded.execute({ ...validPayment, payerWallet: '0.0.90001' });
    expect(result.verdict).toBe('UNVERIFIABLE');
    expect(result.reason).toContain('ARKIV_RISK_UNAVAILABLE');
    expect(signerCalls).toBe(0);
  });

  it('allows payment signing when Arkiv returns ALLOW and all local checks pass', async () => {
    let signerCalls = 0;
    const guarded = createGuardedSigner(
      async (req) => {
        signerCalls += 1;
        return { tx: `signed_for_${req.payTo}` };
      },
      {
        resolveProfile: async () => baseProfile,
        policy,
        riskReader: {
          async getTrustedWalletRiskState() {
            return {
              kind: 'trusted',
              state: {
                status: 'ALLOW',
                entityKey: 'trusted-allow-entity',
                owner: 'trusted-writer',
                expiresAt: 999999n,
              },
            };
          },
        },
        getNow: () => 1000,
      }
    );

    const result = await guarded.execute({ ...validPayment, payerWallet: '0.0.12345' });
    expect(result.verdict).toBe('PASS');
    expect(result.signerCallCount).toBe(1);
    expect(signerCalls).toBe(1);
    expect(result.result).toEqual({ tx: 'signed_for_0.0.12345' });
  });

  it('holds payment and prevents signing when Arkiv returns REVIEW or UNKNOWN', async () => {
    let signerCalls = 0;
    const guarded = createGuardedSigner(
      async () => {
        signerCalls += 1;
        return { tx: 'should-not-run' };
      },
      {
        resolveProfile: async () => baseProfile,
        policy,
        riskReader: {
          async getTrustedWalletRiskState() {
            return {
              kind: 'trusted',
              state: {
                status: 'REVIEW',
                entityKey: 'review-entity',
                owner: 'trusted-writer',
                expiresAt: 999999n,
              },
            };
          },
        },
        getNow: () => 1000,
      }
    );

    const result = await guarded.execute({ ...validPayment, payerWallet: '0.0.55555' });
    expect(result.verdict).toBe('HOLD');
    expect(result.reason).toContain('ARKIV_RISK_REVIEW');
    expect(result.signerCallCount).toBe(0);
    expect(signerCalls).toBe(0);
  });

  it('returns UNVERIFIABLE without calling signer if payer wallet is omitted when riskReader is active', async () => {
    let signerCalls = 0;
    const guarded = createGuardedSigner(
      async () => {
        signerCalls += 1;
        return { tx: 'should-not-run' };
      },
      {
        resolveProfile: async () => baseProfile,
        policy,
        riskReader: {
          async getTrustedWalletRiskState() {
            return { kind: 'not_found' };
          },
        },
        getNow: () => 1000,
      }
    );

    // Omit payerWallet
    const result = await guarded.execute({ ...validPayment, payerWallet: undefined });
    expect(result.verdict).toBe('UNVERIFIABLE');
    expect(result.reason).toContain('ARKIV_PAYER_MISSING');
    expect(signerCalls).toBe(0);
  });
});
