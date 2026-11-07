import { describe, it, expect } from 'vitest';
import {
  createGuardedSigner,
  type MerchantProfile,
  type PaymentRequest,
  type BuyerPolicy,
} from '@quoteseal/payee-guard';
import {
  createTrustedWalletRiskReader,
  createWalletRiskStateStore,
  createRiskSignalStore,
  type WalletRiskStateCandidate,
} from '@quoteseal/arkiv';
import { executeHederaPayment } from '@quoteseal/hedera-x402';

describe('Merchant A -> Arkiv -> Merchant B -> PayeeGuard Cross-Merchant Flow', () => {
  const merchantAWriter = '0x1111111111111111111111111111111111111111' as const;
  const untrustedAttackerWriter = '0x9999999999999999999999999999999999999999' as const;

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

  const basePolicy: BuyerPolicy = {
    trustedMerchants: ['researchpro.eth'],
    maxAmount: 500000000n,
  };

  const suspiciousWallet = '0.0.90001';
  const cleanWallet = '0.0.12345';
  const now = 1800000000;

  // In-memory simulated Arkiv ledger
  const arkivLedger = new Map<string, WalletRiskStateCandidate>();

  const simulatedQuery = {
    async fetchWalletRiskStates(input: { walletKey: string; network: string }) {
      const candidates = Array.from(arkivLedger.values()).filter(
        (c) => c.walletKey.value === input.walletKey && c.network.value === input.network
      );
      return { blockNumber: 1000n, candidates };
    },
  };

  it('Step 1 & 2: Merchant A publishes BLOCK risk state to Arkiv for suspicious wallet', async () => {
    const store = createWalletRiskStateStore({
      expectedOwner: merchantAWriter,
      query: simulatedQuery,
      walletClient: {
        account: { address: merchantAWriter },
        async createEntity(schema, values) {
          const entityKey = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
          const candidate: WalletRiskStateCandidate = {
            $key: entityKey,
            $owner: merchantAWriter,
            $expiresAt: 2000n,
            walletKey: { value: String(values.walletKey) },
            network: { value: String(values.network) },
            status: { value: String(values.status) },
            score: { value: values.score.value },
            policyVersion: { value: String(values.policyVersion) },
            computedAt: { value: values.computedAt.value },
          };
          arkivLedger.set(`${values.walletKey}:${values.network}`, candidate);
          return {
            entityKey,
            txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            expiresAt: 2000n,
          };
        },
        async patchEntity(schema, entityKey, changes) {
          return { entityKey, txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' };
        },
      },
    });

    const result = await store.upsert({
      walletKey: suspiciousWallet,
      network: 'hedera:testnet',
      status: 'BLOCK',
      score: '1.0',
      policyVersion: 'quoteseal-risk-v1',
      signalCount: 1n,
      lastSignalAt: BigInt(now),
    });

    expect(result.action).toBe('created');
    expect(result.status).toBe('BLOCK');
  });

  it('Step 3: Merchant B queries Arkiv and PayeeGuard halts payment to suspicious wallet', async () => {
    // Merchant B reader trusts only Merchant A
    const reader = createTrustedWalletRiskReader(simulatedQuery, merchantAWriter);

    let rawSignerCalls = 0;
    const guarded = createGuardedSigner(
      async (req) => {
        rawSignerCalls++;
        return executeHederaPayment({
          network: req.network,
          asset: req.asset,
          payTo: req.payTo,
          amount: String(req.amount),
          serviceEndpoint: req.origin,
          referenceId: 'ref_suspicious',
          expiresAt: req.expiresAt || now + 300,
        });
      },
      {
        resolveProfile: async () => baseProfile,
        policy: basePolicy,
        riskReader: reader,
        getNow: () => now,
      }
    );

    const payment: PaymentRequest = {
      origin: 'https://api.researchpro.com',
      payerWallet: suspiciousWallet,
      payTo: '0.0.12345',
      amount: 100000000n,
      asset: 'HBAR',
      network: 'hedera:testnet',
      ensName: 'researchpro.eth',
    };

    const res = await guarded.execute(payment);
    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('ARKIV_RISK_BLOCK');
    expect(res.signerCallCount).toBe(0);
    expect(rawSignerCalls).toBe(0); // Underlying raw signer MUST NEVER be called
  });

  it('Step 4: Clean wallet with ALLOW risk state passes PayeeGuard and invokes signer', async () => {
    // Populate clean wallet ALLOW state in Arkiv
    arkivLedger.set(`${cleanWallet}:hedera:testnet`, {
      $key: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      $owner: merchantAWriter,
      $expiresAt: 2000n,
      walletKey: { value: cleanWallet },
      network: { value: 'hedera:testnet' },
      status: { value: 'ALLOW' },
      score: { value: '0.0' },
      policyVersion: { value: 'quoteseal-risk-v1' },
      computedAt: { value: BigInt(now) },
    });

    const reader = createTrustedWalletRiskReader(simulatedQuery, merchantAWriter);

    let rawSignerCalls = 0;
    const guarded = createGuardedSigner(
      async (req) => {
        rawSignerCalls++;
        return executeHederaPayment({
          network: req.network,
          asset: req.asset,
          payTo: req.payTo,
          amount: String(req.amount),
          serviceEndpoint: req.origin,
          referenceId: 'ref_clean',
          expiresAt: req.expiresAt || now + 300,
        });
      },
      {
        resolveProfile: async () => baseProfile,
        policy: basePolicy,
        riskReader: reader,
        getNow: () => now,
      }
    );

    const payment: PaymentRequest = {
      origin: 'https://api.researchpro.com',
      payerWallet: cleanWallet,
      payTo: '0.0.12345',
      amount: 100000000n,
      asset: 'HBAR',
      network: 'hedera:testnet',
      ensName: 'researchpro.eth',
    };

    const res = await guarded.execute(payment);
    expect(res.verdict).toBe('PASS');
    expect(res.signerCallCount).toBe(1);
    expect(rawSignerCalls).toBe(1);
    expect(res.result?.receipt.recipientAccountId).toBe('0.0.12345');
  });

  it('Step 5: Malicious attacker cannot blacklist clean wallet with untrusted signature', async () => {
    // Attacker writes a rogue BLOCK record for clean wallet under untrusted owner
    arkivLedger.set(`${cleanWallet}:hedera:testnet:attacker`, {
      $key: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      $owner: untrustedAttackerWriter,
      $expiresAt: 2000n,
      walletKey: { value: cleanWallet },
      network: { value: 'hedera:testnet' },
      status: { value: 'BLOCK' },
      score: { value: '1.0' },
      policyVersion: { value: 'malicious-v1' },
      computedAt: { value: BigInt(now) },
    });

    // Merchant B reader queries only trusted merchantAWriter
    const reader = createTrustedWalletRiskReader(simulatedQuery, merchantAWriter);
    const riskResult = await reader.getTrustedWalletRiskState({
      walletKey: cleanWallet,
      network: 'hedera:testnet',
    });

    // Attacker's record is completely ignored; only Merchant A's ALLOW record is returned
    expect(riskResult.kind).toBe('trusted');
    if (riskResult.kind === 'trusted') {
      expect(riskResult.state.owner).toBe(merchantAWriter);
      expect(riskResult.state.status).toBe('ALLOW');
    }
  });

  it('Step 6: Arkiv outage causes PayeeGuard to fail closed as UNVERIFIABLE', async () => {
    const brokenQuery = {
      async fetchWalletRiskStates() {
        throw new Error('Arkiv Rabdi RPC connection refused');
      },
    };

    const reader = createTrustedWalletRiskReader(brokenQuery, merchantAWriter, { timeoutMs: 50, retries: 1 });

    let rawSignerCalls = 0;
    const guarded = createGuardedSigner(
      async () => {
        rawSignerCalls++;
        return { ok: true };
      },
      {
        resolveProfile: async () => baseProfile,
        policy: basePolicy,
        riskReader: reader,
        getNow: () => now,
      }
    );

    const res = await guarded.execute({
      origin: 'https://api.researchpro.com',
      payerWallet: cleanWallet,
      payTo: '0.0.12345',
      amount: 100000000n,
      asset: 'HBAR',
      network: 'hedera:testnet',
      ensName: 'researchpro.eth',
    });

    expect(res.verdict).toBe('UNVERIFIABLE');
    expect(res.reason).toContain('ARKIV_RISK_UNAVAILABLE');
    expect(res.signerCallCount).toBe(0);
    expect(rawSignerCalls).toBe(0);
  });
});
