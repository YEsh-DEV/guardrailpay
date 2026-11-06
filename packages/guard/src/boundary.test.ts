import { describe, it, expect } from 'vitest';
import { x402Client } from '@x402/core/client';
import type { PaymentCreationContext } from '@x402/core/client';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { createFinalBoundary, createPaymentAttempt, type TrustSnapshot } from './boundary.js';
import { defaultAnchors, defaultProfile } from './evaluate.js';

const base: PaymentRequirements = {
  scheme: 'exact',
  network: 'hedera:testnet',
  asset: '0.0.0',
  payTo: defaultProfile.payTo!,
  amount: '10',
  maxTimeoutSeconds: 60,
  extra: { feePayer: '0.0.98' }
};

function setup() {
  let calls = 0;
  const received: PaymentRequirements[] = [];
  const trust: TrustSnapshot = {
    profile: { ...defaultProfile },
    anchors: { ...defaultAnchors },
    revision: 1,
    identity: {
      chain: 11155111,
      namehash: 'merchant',
      registry: 'registry',
      implementation: 'implementation',
      permissions: 'roles',
      controller: 'controller'
    }
  };
  const challenge: PaymentRequired = {
    x402Version: 2,
    resource: { url: 'https://evil.example', description: 'Pay attacker' },
    accepts: [structuredClone(base)],
    extensions: { diagnostic: {} }
  };
  const input = {
    challenge,
    originalUrl: 'https://merchant.example/resource',
    selectedIndex: 0,
    firstSeen: 1000,
    now: () => 1001,
    readTrust: () => trust
  };
  const raw = {
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r: PaymentRequirements) {
      calls++;
      received.push(r);
      return 'dGVzdA==';
    }
  };
  return { trust, challenge, input, raw, received, calls: () => calls };
}

describe('Guard Final Signer Boundary', () => {
  const mutations: Record<string, (c: PaymentCreationContext) => void> = {
    payTo: (c) => {
      c.selectedRequirements.payTo = '0.0.999999';
    },
    amount: (c) => {
      c.selectedRequirements.amount = '11';
    },
    asset: (c) => {
      c.selectedRequirements.asset = '0.0.9';
    },
    network: (c) => {
      c.selectedRequirements.network = 'hedera:mainnet';
    },
    scheme: (c) => {
      c.selectedRequirements.scheme = 'other';
    },
    feePayer: (c) => {
      c.selectedRequirements.extra!.feePayer = '0.0.999';
    },
    timeout: (c) => {
      c.selectedRequirements.maxTimeoutSeconds = 59;
    },
    'replace selection': (c) => {
      c.selectedRequirements = { ...c.selectedRequirements, payTo: '0.0.999999' };
    },
    'equal cloned reference': (c) => {
      c.selectedRequirements = structuredClone(c.selectedRequirements);
    },
    'replace offered reference': (c) => {
      c.paymentRequired = { ...c.paymentRequired };
    },
    'original offers modified': (c) => {
      c.paymentRequired.accepts.push({ ...base, amount: '12' });
    },
    'getter TOCTOU': (c) => {
      Object.defineProperty(c.selectedRequirements, 'payTo', { enumerable: true, get: () => base.payTo });
    },
    'proxy selection': (c) => {
      c.selectedRequirements = new Proxy(c.selectedRequirements, {});
    },
    'throw exception': () => {
      throw new Error('failure');
    }
  };

  for (const [name, mutate] of Object.entries(mutations)) {
    it(`final boundary rejects mutation: ${name}`, async () => {
      const s = setup();
      const attempt = createPaymentAttempt(s.input, s.raw, [async (c) => mutate(c)]);
      await expect(attempt.createPaymentPayload()).rejects.toThrow();
      expect(s.calls()).toBe(0);
      // Re-entry must also fail
      await expect(attempt.createPaymentPayload()).rejects.toThrow();
      expect(s.calls()).toBe(0);
    });
  }

  it('authorized payment signs exact private detached selection once', async () => {
    const s = setup();
    let retained: PaymentRequirements | undefined;
    const attempt = createPaymentAttempt(s.input, s.raw, [
      async (c) => {
        retained = c.selectedRequirements;
      }
    ]);
    const payload = await attempt.createPaymentPayload();
    expect(s.calls()).toBe(1);
    expect(s.received[0]).toEqual(base);
    expect(payload.accepted).toEqual(base);
    expect(s.received[0]).not.toBe(retained);
    expect(Object.isFrozen(s.received[0].extra)).toBe(true);

    // Attempting post-sign mutation on retained object must not affect signer
    retained!.payTo = '0.0.999999';
    expect(s.received[0].payTo).toBe(base.payTo);

    // Single-use: subsequent call rejected
    await expect(attempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
    expect(s.calls()).toBe(1);
  });

  for (const verdict of ['BLOCK', 'HOLD', 'UNVERIFIABLE'] as const) {
    it(`no direct signer call before or after ${verdict}`, async () => {
      const s = setup();
      if (verdict === 'BLOCK') s.challenge.accepts[0].payTo = '0.0.999999';
      if (verdict === 'HOLD') s.trust.profile = undefined;
      if (verdict === 'UNVERIFIABLE') s.trust.profile!.rpcAgreed = false;

      const boundary = createFinalBoundary(s.input, s.raw);
      const client = new x402Client()
        .setSpendControls(false)
        .register('hedera:testnet', new ExactHederaScheme(boundary.signer));
      client.onBeforePaymentCreation(boundary.guard);

      await expect(client.createPaymentPayload(s.challenge)).rejects.toThrow();
      await expect(boundary.signer.createPartiallySignedTransferTransaction(s.challenge.accepts[0])).rejects.toThrow();
      expect(s.calls()).toBe(0);
    });
  }

  for (const target of ['profile', 'anchors', 'freshness'] as const) {
    it(`final boundary rechecks current ${target}`, async () => {
      const s = setup();
      const attempt = createPaymentAttempt(s.input, s.raw, [
        async () => {
          if (target === 'profile') s.trust.profile!.payTo = '0.0.999999';
          if (target === 'anchors') s.trust.anchors.owner = 'changed';
          if (target === 'freshness') s.input.now = () => 80000;
          if (target === 'freshness') s.trust.profile!.checkedAt = -10000;
        }
      ]);
      await expect(attempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(s.calls()).toBe(0);
    });
  }
});
