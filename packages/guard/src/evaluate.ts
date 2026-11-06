import { isDeepStrictEqual } from 'node:util';
import type { PaymentRequirements } from '@x402/core/types';
import type { PaymentRequirement } from './interfaces.js';
import type { Verdict } from '@quoteseal/shared';

export type { Verdict };
export type EvaluatableRequirement = PaymentRequirements | PaymentRequirement;

export interface EvaluatableProfile {
  owner: string;
  resolver: string;
  expiry: number;
  profileVersion?: number;
  version?: number;
  activePayTo?: string;
  payTo?: string;
  network?: string;
  scheme?: string;
  assetId?: string;
  asset?: string;
  maxAmount?: string;
  origin?: string;
  checkedAt?: number;
  rpcAgreed?: boolean;
}

export interface EvaluatableAnchors {
  trustedOwner?: string;
  owner?: string;
  trustedResolver?: string;
  resolver?: string;
  trustedExpiry?: number;
  expiry?: number;
  trustedProfileVersion?: number;
  version?: number;
}

export const defaultAnchors: EvaluatableAnchors = {
  owner: 'owner',
  resolver: 'resolver',
  expiry: 200000,
  version: 1
};

export const defaultProfile: EvaluatableProfile = {
  owner: 'owner',
  resolver: 'resolver',
  expiry: 200000,
  version: 1,
  payTo: '0.0.123456',
  network: 'hedera:testnet',
  asset: '0.0.0',
  origin: 'https://merchant.example',
  checkedAt: 1000,
  rpcAgreed: true,
  maxAmount: '100'
};

export function evaluate(
  selected: EvaluatableRequirement,
  offered: readonly EvaluatableRequirement[],
  p: EvaluatableProfile | undefined,
  expected: EvaluatableAnchors,
  url: string,
  firstSeen: number,
  now: number
): Verdict {
  // 1. Missing profile -> HOLD
  if (!p) return 'HOLD';

  // 2. Dual-RPC disagreement or stale read -> UNVERIFIABLE
  if (p.rpcAgreed === false) return 'UNVERIFIABLE';
  if (p.checkedAt !== undefined) {
    if (now < p.checkedAt || now - p.checkedAt > 5000) {
      return 'UNVERIFIABLE';
    }
  }

  // 3. Trust anchor check (owner, resolver, expiry, version)
  const expectedOwner = expected.trustedOwner ?? expected.owner;
  const expectedResolver = expected.trustedResolver ?? expected.resolver;
  const expectedExpiry = expected.trustedExpiry ?? expected.expiry;
  const expectedVersion = expected.trustedProfileVersion ?? expected.version;

  const actualVersion = p.profileVersion ?? p.version;
  const nowSeconds = Math.floor(now / 1000);

  if (expectedOwner !== undefined && p.owner.toLowerCase() !== expectedOwner.toLowerCase()) {
    return 'HOLD';
  }
  if (expectedResolver !== undefined && p.resolver.toLowerCase() !== expectedResolver.toLowerCase()) {
    return 'HOLD';
  }
  if (expectedExpiry !== undefined && p.expiry !== expectedExpiry) {
    return 'HOLD';
  }
  const isMs = p.expiry >= 100_000_000_000;
  const currentTimestamp = isMs ? now : nowSeconds;
  if (p.expiry <= currentTimestamp) {
    return 'HOLD';
  }
  if (expectedVersion !== undefined && actualVersion !== expectedVersion) {
    return 'HOLD';
  }

  // 4. Must match one of the offered requirements
  if (!offered.some((x) => isDeepStrictEqual(x, selected))) {
    return 'BLOCK';
  }

  try {
    // 5. Origin validation
    const targetOrigin = p.origin ? new URL(p.origin).origin : undefined;
    if (targetOrigin && new URL(url).origin !== targetOrigin) {
      return 'BLOCK';
    }

    // 6. Payment scheme & network alignment
    const expectedScheme = p.scheme ?? 'exact';
    const expectedNetwork = p.network ?? 'hedera:testnet';
    const expectedAsset = p.assetId ?? p.asset ?? '0.0.0';
    const expectedPayTo = p.activePayTo ?? p.payTo;

    if (
      selected.scheme !== expectedScheme ||
      selected.network !== expectedNetwork ||
      selected.asset !== expectedAsset ||
      selected.payTo !== expectedPayTo ||
      !/^0\.0\.[0-9]+$/.test(selected.payTo)
    ) {
      return 'BLOCK';
    }

    // 7. Amount validation
    if (typeof selected.amount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(selected.amount) || selected.amount.length > 30) {
      return 'BLOCK';
    }
    const cap = p.maxAmount ? BigInt(p.maxAmount) : 100n;
    if (BigInt(selected.amount) <= 0n || BigInt(selected.amount) > cap) {
      return 'BLOCK';
    }

    // 8. Timeout validation
    if (!Number.isSafeInteger(selected.maxTimeoutSeconds) || (selected.maxTimeoutSeconds ?? 0) <= 0 || (selected.maxTimeoutSeconds ?? 0) > 60) {
      return 'BLOCK';
    }
    if (!Number.isFinite(firstSeen) || now < firstSeen || now - firstSeen >= (selected.maxTimeoutSeconds ?? 60) * 1000) {
      return 'BLOCK';
    }

    // 9. Extra fee payer check if configured
    if (selected.extra?.feePayer && selected.extra.feePayer !== '0.0.98') {
      return 'BLOCK';
    }

    return 'PASS';
  } catch {
    return 'BLOCK';
  }
}
