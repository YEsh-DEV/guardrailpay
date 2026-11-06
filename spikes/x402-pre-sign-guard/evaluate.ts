import { isDeepStrictEqual } from 'node:util';
import type { PaymentRequirements } from '@x402/core/types';
export type Verdict = 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';
export const anchors = { owner: 'owner', resolver: 'resolver', expiry: 200000, version: 1 };
export const profile = { ...anchors, payTo: '0.0.123456', network: 'hedera:testnet', asset: '0.0.0', origin: 'https://merchant.example', checkedAt: 1000, rpcAgreed: true };
export function evaluate(s: PaymentRequirements, offered: PaymentRequirements[], p: typeof profile | undefined, expected: typeof anchors, url: string, firstSeen: number, now: number): Verdict {
  if (!p) return 'HOLD';
  if (!p.rpcAgreed || now < p.checkedAt || now - p.checkedAt > 5000) return 'UNVERIFIABLE';
  if (Object.keys(expected).some(k => p[k as keyof typeof anchors] !== expected[k as keyof typeof anchors]) || p.expiry <= now) return 'HOLD';
  if (!offered.some(x => isDeepStrictEqual(x, s))) return 'BLOCK';
  try {
    if (new URL(url).origin !== p.origin) return 'BLOCK';
    if (s.scheme !== 'exact' || s.network !== p.network || s.asset !== p.asset || s.payTo !== p.payTo || !/^0\.0\.[0-9]+$/.test(s.payTo)) return 'BLOCK';
    if (typeof s.amount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(s.amount) || s.amount.length > 30 || BigInt(s.amount) > 100n) return 'BLOCK';
    if (!Number.isSafeInteger(s.maxTimeoutSeconds) || s.maxTimeoutSeconds <= 0 || s.maxTimeoutSeconds > 60) return 'BLOCK';
    if (!Number.isFinite(firstSeen) || now < firstSeen || now - firstSeen >= s.maxTimeoutSeconds * 1000) return 'BLOCK';
    if (s.extra?.feePayer !== '0.0.98') return 'BLOCK';
    return 'PASS';
  } catch { return 'BLOCK'; }
}
