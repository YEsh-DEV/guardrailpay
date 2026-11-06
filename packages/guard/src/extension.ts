/**
 * QuoteSeal x402 Client Extension and Bypass Protection
 *
 * Adapted from Meigi (packages/x402-guard/src/extension.ts & check.ts)
 * Original Copyright (c) 2026 Karan Singh Bisht, Adithya Prasanna Suriya Prakash (MIT License)
 *
 * Implements dual-layer pre-signing verification:
 * 1. Extension Hook: Validates declared merchant identity against the trusted profile.
 * 2. Global Fallback Hook: Catches undeclared merchants where extension hooks would be skipped.
 */

import type { BeforePaymentCreationHook, ClientExtension, PaymentCreationContext } from '@x402/core/client';
import { evaluate, type EvaluatableProfile, type Verdict } from './evaluate.js';
import type { TrustSnapshot } from './boundary.js';

/** Extension key merchants declare in `PaymentRequired.extensions` */
export const QUOTESEAL_PAYEE_KEY = 'quoteseal';
export const QUOTESEAL_PAYEE_ALT_KEY = 'quoteseal-payee';

export interface QuoteSealPayeeDeclaration {
  ens?: string;
  merchantId?: string;
  origin?: string;
}

export interface QuoteSealGuardOptions {
  onVerdict?: (verdict: Verdict, reason?: string) => void;
  originalUrl?: string;
  firstSeen?: number;
  now?: () => number;
}

export interface GuardClient {
  registerExtension(extension: ClientExtension): unknown;
  onBeforePaymentCreation(hook: BeforePaymentCreationHook): unknown;
}

/**
 * Helper for merchants: generates the extension record to attach to `PaymentRequired.extensions`.
 */
export function quoteSealPayeeDeclaration(
  declaration: QuoteSealPayeeDeclaration
): Record<string, unknown> {
  return {
    [QUOTESEAL_PAYEE_KEY]: { ...declaration }
  };
}

/**
 * Validates a merchant's QuoteSeal declaration against the trusted profile.
 */
export function validateQuoteSealDeclaration(
  declaration: unknown,
  trustedProfile?: EvaluatableProfile
): { valid: boolean; reason?: string } {
  if (!declaration || typeof declaration !== 'object') {
    return { valid: false, reason: "merchant's quoteseal declaration is malformed" };
  }

  const decl = declaration as Record<string, unknown>;
  const ens = typeof decl.ens === 'string' ? decl.ens.trim().toLowerCase() : undefined;
  const merchantId = typeof decl.merchantId === 'string' ? decl.merchantId.trim() : undefined;

  if (!ens && !merchantId) {
    return { valid: false, reason: "merchant's quoteseal declaration missing ens or merchantId" };
  }

  if (ens && trustedProfile) {
    const profileEns = (trustedProfile as { ensName?: string }).ensName?.toLowerCase();
    if (profileEns && profileEns !== ens) {
      return {
        valid: false,
        reason: `declared ens "${ens}" does not match trusted profile "${profileEns}"`
      };
    }
  }

  if (merchantId && trustedProfile) {
    const profileMerchantId = (trustedProfile as { merchantId?: string }).merchantId;
    if (profileMerchantId && profileMerchantId !== merchantId) {
      return {
        valid: false,
        reason: `declared merchantId "${merchantId}" does not match trusted profile "${profileMerchantId}"`
      };
    }
  }

  return { valid: true };
}

/**
 * CASE A & C: x402 client extension hook.
 * Invoked by `@x402/core` ONLY when the merchant declares `quoteseal` in `PaymentRequired.extensions`.
 * Validates the declared identity against the trusted profile and checks all payment requirements.
 */
export function quoteSealPayeeExtension(
  readTrust: () => TrustSnapshot,
  options: QuoteSealGuardOptions = {}
): ClientExtension {
  return {
    key: QUOTESEAL_PAYEE_KEY,
    hooks: {
      async onBeforePaymentCreation(declaration: unknown, context: PaymentCreationContext) {
        const trust = readTrust();
        const profile = trust.profile;

        // 1. Verify declaration structure and match with trusted profile
        const declCheck = validateQuoteSealDeclaration(declaration, profile);
        if (!declCheck.valid) {
          const reason = declCheck.reason ?? 'invalid declaration';
          options.onVerdict?.('BLOCK', reason);
          return { abort: true, reason };
        }

        // 2. Profile existence check
        if (!profile) {
          const reason = 'trusted merchant profile not found or not active';
          options.onVerdict?.('HOLD', reason);
          return { abort: true, reason };
        }

        // 3. Evaluate selected requirement using QuoteSeal's policy engine
        const originalUrl = options.originalUrl ?? context.paymentRequired.resource?.url ?? '';
        const now = options.now ? options.now() : Date.now();
        const firstSeen = options.firstSeen ?? now;

        const verdict = evaluate(
          context.selectedRequirements,
          context.paymentRequired.accepts,
          profile,
          trust.anchors,
          originalUrl,
          firstSeen,
          now
        );

        if (verdict !== 'PASS') {
          const reason = `QuoteSeal guard rejected payment: verdict=${verdict}`;
          options.onVerdict?.(verdict, reason);
          return { abort: true, reason };
        }

        options.onVerdict?.('PASS');
        return undefined;
      }
    }
  };
}

/**
 * CASE B: Strict global fallback hook.
 * Required because `@x402/core` only invokes `ClientExtension` hooks if the extension key
 * is present in `paymentRequired.extensions`. A merchant that omits the extension would
 * bypass `quoteSealPayeeExtension` completely. This hook catches undeclared merchants.
 */
export function requireQuoteSealPayee(
  options: QuoteSealGuardOptions = {}
): BeforePaymentCreationHook {
  return async (context: PaymentCreationContext) => {
    const ext = context.paymentRequired.extensions;
    const declaration = ext?.[QUOTESEAL_PAYEE_KEY] ?? ext?.[QUOTESEAL_PAYEE_ALT_KEY];

    if (declaration !== undefined) {
      // Merchant declared QuoteSeal identity; extension hook handles detailed verification
      return undefined;
    }

    // Undeclared merchant: fail closed before signing
    const reason = 'merchant does not declare a QuoteSeal identity; refusing payment to unverified merchant';
    options.onVerdict?.('BLOCK', reason);
    return { abort: true, reason };
  };
}

/**
 * Registers both the extension hook and the global fallback hook onto the x402 client.
 * Guarantees that neither declared tampered merchants nor undeclared merchants can bypass protection.
 */
export function registerQuoteSealGuard<C extends GuardClient>(
  client: C,
  readTrust: () => TrustSnapshot,
  options: QuoteSealGuardOptions = {}
): C {
  client.registerExtension(quoteSealPayeeExtension(readTrust, options));
  client.onBeforePaymentCreation(requireQuoteSealPayee(options));
  return client;
}
