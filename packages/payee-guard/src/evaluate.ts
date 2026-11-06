import {
  BuyerPolicy,
  EvaluationResult,
  MerchantProfile,
  PaymentRequest,
} from './types.js';
import {
  normalizeAccountId,
  normalizeAmount,
  normalizeAsset,
  normalizeNetworkId,
  normalizeOrigin,
} from './normalize.js';

/**
 * Pure evaluation engine for QuoteSeal PayeeGuard.
 * Validates x402 payment details against verified ENSv2 merchant profiles.
 *
 * Rules:
 *  1. Expired 402 offer -> BLOCK (STALE_402_OFFER)
 *  2. Profile missing or expired -> BLOCK (PROFILE_MISSING_OR_EXPIRED)
 *  3. Untrusted merchant (policy check) -> BLOCK (UNTRUSTED_MERCHANT)
 *  4. Origin mismatch -> BLOCK (ORIGIN_MISMATCH)
 *  5. Network mismatch -> BLOCK (NETWORK_MISMATCH)
 *  6. Asset mismatch -> BLOCK (ASSET_MISMATCH)
 *  7. Amount exceeds profile or buyer policy limit -> BLOCK (AMOUNT_EXCEEDED)
 *  8. payTo matches activePayTo -> PASS (PAYEE_VERIFIED_ACTIVE)
 *  9. payTo matches pendingPayTo:
 *     - if now < pendingEffectiveAt -> HOLD (ROTATION_PENDING_TIMELOCK)
 *     - if pending effective has elapsed but not yet activated -> HOLD (ROTATION_AWAITING_ACTIVATION)
 * 10. Anything else -> BLOCK (UNAUTHORIZED_PAYEE)
 */
export function evaluate(
  payment: PaymentRequest,
  profile: MerchantProfile | null | undefined,
  policy: BuyerPolicy,
  now: number
): EvaluationResult {
  // 1. Check for stale / expired 402 payment offer
  if (payment.expiresAt !== undefined && now > payment.expiresAt) {
    return {
      verdict: 'BLOCK',
      reason: 'STALE_402_OFFER: Payment challenge timestamp is in the past',
      details: { currentTime: now, effectiveAt: payment.expiresAt },
    };
  }

  // 2. Profile missing or expired
  if (!profile) {
    return {
      verdict: 'BLOCK',
      reason: 'PROFILE_MISSING: No verified merchant profile found',
    };
  }

  if (profile.expiresAt !== undefined && now > profile.expiresAt) {
    return {
      verdict: 'BLOCK',
      reason: 'PROFILE_EXPIRED: Merchant ENS profile record TTL expired',
      details: { currentTime: now, effectiveAt: profile.expiresAt },
    };
  }

  // 3. Untrusted merchant check (against buyer policy)
  if (policy.trustedMerchants && policy.trustedMerchants.length > 0) {
    const isTrusted = policy.trustedMerchants.some((m) => {
      const trimmedM = m.trim().toLowerCase();
      const ensMatch = profile.ensName && profile.ensName.trim().toLowerCase() === trimmedM;
      let originMatch = false;
      try {
        originMatch = normalizeOrigin(profile.serviceEndpoint) === normalizeOrigin(m);
      } catch {
        // Not a URL, disregard
      }
      return ensMatch || originMatch;
    });

    if (!isTrusted) {
      return {
        verdict: 'BLOCK',
        reason: `UNTRUSTED_MERCHANT: Merchant '${profile.ensName}' is not in the buyer policy trusted list`,
      };
    }
  }

  // 4. Origin validation
  let normalizedReqOrigin: string;
  let normalizedProfileOrigin: string;
  try {
    normalizedReqOrigin = normalizeOrigin(payment.origin);
    normalizedProfileOrigin = normalizeOrigin(profile.serviceEndpoint);
  } catch (err: unknown) {
    return {
      verdict: 'BLOCK',
      reason: `INVALID_ORIGIN_FORMAT: ${(err as Error).message}`,
    };
  }

  if (normalizedReqOrigin !== normalizedProfileOrigin) {
    return {
      verdict: 'BLOCK',
      reason: `ORIGIN_MISMATCH: Payment requested from ${normalizedReqOrigin}, but profile registered for ${normalizedProfileOrigin}`,
    };
  }

  // 5. Network validation
  let normalizedReqNetwork: string;
  let normalizedProfileNetwork: string;
  try {
    normalizedReqNetwork = normalizeNetworkId(payment.network);
    normalizedProfileNetwork = normalizeNetworkId(profile.network);
  } catch (err: unknown) {
    return {
      verdict: 'BLOCK',
      reason: `INVALID_NETWORK_FORMAT: ${(err as Error).message}`,
    };
  }

  if (normalizedReqNetwork !== normalizedProfileNetwork) {
    return {
      verdict: 'BLOCK',
      reason: `NETWORK_MISMATCH: Requested network ${normalizedReqNetwork} does not match profile ${normalizedProfileNetwork}`,
    };
  }

  // 6. Asset validation
  let normalizedReqAsset: string;
  let normalizedProfileAsset: string;
  try {
    normalizedReqAsset = normalizeAsset(payment.asset);
    normalizedProfileAsset = normalizeAsset(profile.assetId);
  } catch (err: unknown) {
    return {
      verdict: 'BLOCK',
      reason: `INVALID_ASSET_FORMAT: ${(err as Error).message}`,
    };
  }

  if (normalizedReqAsset !== normalizedProfileAsset) {
    return {
      verdict: 'BLOCK',
      reason: `ASSET_MISMATCH: Requested asset ${normalizedReqAsset} does not match profile ${normalizedProfileAsset}`,
    };
  }

  // 7. Amount limits (profile max & buyer policy max)
  let requestedAmount: bigint;
  let profileMaxAmount: bigint;
  try {
    requestedAmount = normalizeAmount(payment.amount);
    profileMaxAmount = normalizeAmount(profile.maxAmount);
  } catch (err: unknown) {
    return {
      verdict: 'BLOCK',
      reason: `INVALID_AMOUNT_FORMAT: ${(err as Error).message}`,
    };
  }

  let effectiveLimit = profileMaxAmount;
  if (policy.maxAmount !== undefined) {
    try {
      const policyMax = normalizeAmount(policy.maxAmount);
      if (policyMax < effectiveLimit) {
        effectiveLimit = policyMax;
      }
    } catch (err: unknown) {
      return {
        verdict: 'BLOCK',
        reason: `INVALID_POLICY_AMOUNT: ${(err as Error).message}`,
      };
    }
  }

  if (requestedAmount > effectiveLimit) {
    return {
      verdict: 'BLOCK',
      reason: `AMOUNT_EXCEEDED: Requested ${requestedAmount} exceeds limit ${effectiveLimit}`,
    };
  }

  // 8. Payee Address Validation
  let reqPayTo: string;
  let activePayTo: string;
  try {
    reqPayTo = normalizeAccountId(payment.payTo);
    activePayTo = normalizeAccountId(profile.activePayTo);
  } catch (err: unknown) {
    return {
      verdict: 'BLOCK',
      reason: `INVALID_PAYEE_FORMAT: ${(err as Error).message}`,
    };
  }

  // If payTo matches the currently active payTo
  if (reqPayTo === activePayTo) {
    return {
      verdict: 'PASS',
      reason: 'PAYEE_VERIFIED_ACTIVE: Payee matches trusted active ENS profile record',
      details: {
        checkedPayTo: reqPayTo,
        expectedActivePayTo: activePayTo,
      },
    };
  }

  // If payTo matches a pending rotation
  if (profile.pendingPayTo) {
    let pendingPayTo: string;
    try {
      pendingPayTo = normalizeAccountId(profile.pendingPayTo);
    } catch {
      pendingPayTo = '';
    }

    if (reqPayTo === pendingPayTo) {
      const effectiveAt = profile.pendingEffectiveAt ?? 0;

      // Pending rotation timelock is still active
      if (now < effectiveAt) {
        return {
          verdict: 'HOLD',
          reason: `ROTATION_PENDING_TIMELOCK: Address is in announced rotation delay until ${effectiveAt}`,
          details: {
            checkedPayTo: reqPayTo,
            pendingPayTo,
            effectiveAt,
            currentTime: now,
          },
        };
      }

      // If rotation delay has passed but profile status was not switched to active
      if (profile.rotationStatus !== 'active') {
        return {
          verdict: 'HOLD',
          reason: 'ROTATION_AWAITING_ACTIVATION: Rotation timelock elapsed but awaiting on-chain activation',
          details: {
            checkedPayTo: reqPayTo,
            pendingPayTo,
            effectiveAt,
            currentTime: now,
          },
        };
      }

      // If profile marked active
      return {
        verdict: 'PASS',
        reason: 'PAYEE_ROTATION_ACTIVATED: Payee matches newly activated profile record',
        details: {
          checkedPayTo: reqPayTo,
        },
      };
    }
  }

  // 9. Unknown/unauthorized payee
  return {
    verdict: 'BLOCK',
    reason: `UNAUTHORIZED_PAYEE: Requested payee '${reqPayTo}' does not match active payee '${activePayTo}' or pending rotation`,
    details: {
      checkedPayTo: reqPayTo,
      expectedActivePayTo: activePayTo,
      pendingPayTo: profile.pendingPayTo ? normalizeAccountId(profile.pendingPayTo) : undefined,
    },
  };
}
