import type { TrustAnchors } from '@quoteseal/shared';
import type { EnsProfileRecord, TrustAnchorVerificationResult } from './types.js';

export interface VerifyTrustAnchorsOptions {
  currentTimeSeconds?: number;
  expectedPayTo?: string;
}

/**
 * Verify resolved ENS profile records against pinned buyer trust anchors.
 *
 * INVARIANTS:
 * - If owner, resolver, expiry, or profile version changes -> returns HOLD.
 *   (Requires explicit re-trust by buyer before any payment can be signed).
 * - If current activePayTo differs from expected payment requirement -> returns BLOCK.
 * - If all trust anchors and payment requirements match -> returns PASS.
 */
export function verifyTrustAnchors(
  current: EnsProfileRecord,
  anchors: TrustAnchors,
  options: VerifyTrustAnchorsOptions = {}
): TrustAnchorVerificationResult {
  const divergentFields: string[] = [];
  const now = options.currentTimeSeconds ?? Math.floor(Date.now() / 1000);

  // 1. Check Owner Anchor
  if (current.owner.toLowerCase() !== anchors.trustedOwner.toLowerCase()) {
    divergentFields.push('owner');
    return {
      verdict: 'HOLD',
      reasonCode: 'ANCHOR_OWNER_MISMATCH',
      message: `ENS name owner changed: expected ${anchors.trustedOwner}, got ${current.owner}`,
      divergentFields,
      currentProfile: current
    };
  }

  // 2. Check Resolver Anchor
  if (current.resolver.toLowerCase() !== anchors.trustedResolver.toLowerCase()) {
    divergentFields.push('resolver');
    return {
      verdict: 'HOLD',
      reasonCode: 'ANCHOR_RESOLVER_MISMATCH',
      message: `ENS resolver address changed: expected ${anchors.trustedResolver}, got ${current.resolver}`,
      divergentFields,
      currentProfile: current
    };
  }

  // 3. Check Expiry Anchor & Real-time Expiration
  if (current.expiry !== anchors.trustedExpiry) {
    divergentFields.push('expiry');
    return {
      verdict: 'HOLD',
      reasonCode: 'ANCHOR_EXPIRY_EXPIRED',
      message: `ENS name expiry changed from pinned anchor: expected ${anchors.trustedExpiry}, got ${current.expiry}`,
      divergentFields,
      currentProfile: current
    };
  }

  if (current.expiry > 0 && current.expiry <= now) {
    divergentFields.push('expiry_expired');
    return {
      verdict: 'HOLD',
      reasonCode: 'ANCHOR_EXPIRY_EXPIRED',
      message: `ENS name registration has expired at timestamp ${current.expiry}`,
      divergentFields,
      currentProfile: current
    };
  }

  // 4. Check Profile Version Anchor
  if (current.profileVersion !== anchors.trustedProfileVersion) {
    divergentFields.push('profileVersion');
    return {
      verdict: 'HOLD',
      reasonCode: 'ANCHOR_VERSION_MISMATCH',
      message: `Profile version mismatch: expected ${anchors.trustedProfileVersion}, got ${current.profileVersion}`,
      divergentFields,
      currentProfile: current
    };
  }

  // 5. Check Active Payout Requirement (if an expected payTo was provided)
  if (options.expectedPayTo && current.activePayTo !== options.expectedPayTo) {
    divergentFields.push('activePayTo');
    return {
      verdict: 'BLOCK',
      reasonCode: 'PAYTO_MISMATCH',
      message: `Active payout mismatch: expected ${options.expectedPayTo}, got ${current.activePayTo}`,
      divergentFields,
      currentProfile: current
    };
  }

  // 6. All Trust Anchors & Payout Requirements Verified
  return {
    verdict: 'PASS',
    reasonCode: 'OK',
    message: 'Profile records verified against pinned trust anchors',
    currentProfile: current
  };
}
