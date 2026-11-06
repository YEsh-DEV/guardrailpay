import { describe, it, expect } from 'vitest';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import type { ClientHederaSigner } from '@x402/hedera';
import {
  quoteSealPayeeDeclaration,
  validateQuoteSealDeclaration,
  quoteSealPayeeExtension,
  requireQuoteSealPayee,
  registerQuoteSealGuard,
  QUOTESEAL_PAYEE_KEY,
  QUOTESEAL_PAYEE_ALT_KEY
} from './extension.js';
import { createPaymentAttempt, type BoundaryInput, type TrustSnapshot } from './boundary.js';
import { defaultProfile, defaultAnchors } from './evaluate.js';

describe('Meigi x402 Bypass Protection in QuoteSeal Guard', () => {
  const TRUSTED_ENS = 'merchant.eth';
  const TRUSTED_PAYTO = defaultProfile.payTo!;
  const TRUSTED_ORIGIN = defaultProfile.origin!;
  const RESOURCE_URL = `${TRUSTED_ORIGIN}/api/resource`;
  const FIXED_TIME = 1000;

  const validProfile = {
    ...defaultProfile,
    ensName: TRUSTED_ENS,
    checkedAt: FIXED_TIME
  };

  const validAnchors = {
    ...defaultAnchors
  };

  const snapshot: TrustSnapshot = {
    profile: validProfile,
    anchors: validAnchors
  };

  const readTrust = (): TrustSnapshot => snapshot;

  function createChallenge(opts: {
    extensions?: Record<string, unknown>;
    payTo?: string;
    amount?: string;
  } = {}): PaymentRequired {
    return {
      x402Version: 2,
      resource: { url: RESOURCE_URL },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: opts.amount ?? '10',
          payTo: opts.payTo ?? TRUSTED_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: '0.0.98' }
        }
      ],
      ...(opts.extensions ? { extensions: opts.extensions } : {})
    };
  }

  function createInstrumentedSigner() {
    let calls = 0;
    const signer: ClientHederaSigner = {
      accountId: '0.0.9999',
      async createPartiallySignedTransferTransaction(_req: PaymentRequirements) {
        calls++;
        return 'mock-tx-bytes';
      }
    };
    return { signer, getCalls: () => calls };
  }

  describe('Declaration Validation Unit Tests', () => {
    it('validates a matching ENS declaration', () => {
      const decl = { ens: TRUSTED_ENS };
      const res = validateQuoteSealDeclaration(decl, validProfile);
      expect(res.valid).toBe(true);
    });

    it('rejects a declaration when ENS mismatches trusted profile', () => {
      const decl = { ens: 'attacker.eth' };
      const res = validateQuoteSealDeclaration(decl, validProfile);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('does not match');
    });

    it('rejects a malformed declaration without ens or merchantId', () => {
      const decl = { foo: 'bar' };
      const res = validateQuoteSealDeclaration(decl, validProfile);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('missing ens or merchantId');
    });
  });

  describe('Meigi Dual-Layer Pre-Signing Bypass Protection', () => {
    it('CASE A: allows legitimate payment with valid QuoteSeal declaration (signer invoked 1 time)', async () => {
      const { signer, getCalls } = createInstrumentedSigner();
      const challenge = createChallenge({
        extensions: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
      });

      const boundaryInput: BoundaryInput = {
        originalUrl: RESOURCE_URL,
        challenge,
        selectedIndex: 0,
        firstSeen: FIXED_TIME,
        now: () => FIXED_TIME,
        readTrust,
        requireDeclaration: true
      };

      const attempt = createPaymentAttempt(boundaryInput, signer);
      const payload = await attempt.createPaymentPayload();

      expect(payload).toBeDefined();
      expect(getCalls()).toBe(1);
    });

    it('CASE B: blocks undeclared merchant challenge when requireDeclaration is true (signerCalls === 0)', async () => {
      const { signer, getCalls } = createInstrumentedSigner();
      // Ordinary 402 with NO extensions
      const challenge = createChallenge();

      const boundaryInput: BoundaryInput = {
        originalUrl: RESOURCE_URL,
        challenge,
        selectedIndex: 0,
        firstSeen: FIXED_TIME,
        now: () => FIXED_TIME,
        readTrust,
        requireDeclaration: true
      };

      const attempt = createPaymentAttempt(boundaryInput, signer);

      await expect(attempt.createPaymentPayload()).rejects.toThrow(/Payment creation aborted/i);
      expect(getCalls()).toBe(0);
    });

    it('CASE C: blocks tampered payTo in declared challenge before signing (signerCalls === 0)', async () => {
      const { signer, getCalls } = createInstrumentedSigner();
      // Declares trusted ENS, but payTo points to attacker
      const challenge = createChallenge({
        extensions: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS }),
        payTo: '0.0.999999'
      });

      const boundaryInput: BoundaryInput = {
        originalUrl: RESOURCE_URL,
        challenge,
        selectedIndex: 0,
        firstSeen: FIXED_TIME,
        now: () => FIXED_TIME,
        readTrust,
        requireDeclaration: true
      };

      const attempt = createPaymentAttempt(boundaryInput, signer);

      await expect(attempt.createPaymentPayload()).rejects.toThrow();
      expect(getCalls()).toBe(0);
    });

    it('CASE C: blocks tampered ENS declaration before signing (signerCalls === 0)', async () => {
      const { signer, getCalls } = createInstrumentedSigner();
      const challenge = createChallenge({
        extensions: quoteSealPayeeDeclaration({ ens: 'impostor.eth' })
      });

      const boundaryInput: BoundaryInput = {
        originalUrl: RESOURCE_URL,
        challenge,
        selectedIndex: 0,
        firstSeen: FIXED_TIME,
        now: () => FIXED_TIME,
        readTrust,
        requireDeclaration: true
      };

      const attempt = createPaymentAttempt(boundaryInput, signer);

      await expect(attempt.createPaymentPayload()).rejects.toThrow(/Payment creation aborted/i);
      expect(getCalls()).toBe(0);
    });
  });
});
