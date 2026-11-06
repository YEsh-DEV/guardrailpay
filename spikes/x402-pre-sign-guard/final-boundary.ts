import { isDeepStrictEqual, types } from 'node:util';
import { x402Client } from '@x402/core/client';
import type { BeforePaymentCreationHook, PaymentCreationContext } from '@x402/core/client';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import type { ClientHederaSigner } from '@x402/hedera';
import { evaluate, type profile, type anchors } from './evaluate.js';

// This is a trusted adapter result, never constructed from the merchant response.
export interface TrustSnapshot {
  profile: typeof profile | undefined;
  anchors: typeof anchors;
  identity: { chain: number; namehash: string; registry: string; implementation: string; permissions: string; controller: string };
  revision: number;
}
export interface BoundaryInput {
  originalUrl: string;
  challenge: PaymentRequired;
  selectedIndex: number;
  firstSeen: number; // local observation time in milliseconds, not an invented wire field
  now: () => number;
  readTrust: () => TrustSnapshot; // synchronous read of trusted adapter's current snapshot
}
function denied(): never { throw new Error('QUOTESEAL_REJECTED'); }

// Reject accessors and proxies instead of reading them twice (TOCTOU).
// Accept only finite JSON data; clone without sharing references with hooks.
function copyData<T>(input: T, depth = 0): T {
  if (depth > 32) return denied();
  if (input === null || typeof input === 'string' || typeof input === 'boolean' || input === undefined) return input;
  if (typeof input === 'number') { if (!Number.isFinite(input)) return denied(); return input; }
  if (typeof input !== 'object' || types.isProxy(input)) return denied();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null && proto !== Array.prototype) return denied();
  const out: Record<string, unknown> | unknown[] = Array.isArray(input) ? [] : {};
  for (const key of Reflect.ownKeys(input)) {
    if (Array.isArray(input) && key === 'length') continue;
    if (typeof key !== 'string') return denied();
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !d.enumerable) return denied();
    Object.defineProperty(out, key, { value: copyData(d.value, depth + 1), enumerable: true, writable: true, configurable: true });
  }
  return out as T;
}
function freezeData<T>(data: T): T {
  if (data && typeof data === 'object') { for (const v of Object.values(data)) freezeData(v); Object.freeze(data); }
  return data;
}

/** Internal integration primitive. Raw signer must be held only by trusted composition code. */
export function createFinalBoundary(input: BoundaryInput, rawSigner: ClientHederaSigner) {
  const original = freezeData(copyData(input.challenge));
  const originalUrl = new URL(input.originalUrl).href;
  if (new URL(originalUrl).protocol !== 'https:') denied();
  const index = input.selectedIndex;
  if (original.x402Version !== 2 || !Number.isSafeInteger(index) || !original.accepts[index]) denied();
  const approved = freezeData(copyData(original.accepts[index]));
  const firstSeen = input.firstSeen;
  const now = input.now, readTrust = input.readTrust;
  const initialTrust = freezeData(copyData(readTrust()));
  const sign = rawSigner.createPartiallySignedTransferTransaction.bind(rawSigner);
  let state: 'NEW' | 'APPROVED' | 'CLOSED' = 'NEW';
  let context: PaymentCreationContext | undefined;
  let selectedRef: PaymentRequirements | undefined;
  let challengeRef: PaymentRequired | undefined;
  const reject = (): never => { state = 'CLOSED'; return denied(); };
  const checkPolicy = () => {
    const current = copyData(readTrust());
    const time = now();
    if (!Number.isFinite(time) || !isDeepStrictEqual(current, initialTrust) ||
      evaluate(approved, original.accepts, current.profile, current.anchors, originalUrl, firstSeen, time) !== 'PASS' ||
      BigInt(approved.amount) <= 0n) reject();
  };
  const guard: BeforePaymentCreationHook = async ctx => {
    try {
      if (state !== 'NEW') reject();
      const clean = copyData(ctx);
      if (!isDeepStrictEqual(clean.paymentRequired, original) || !isDeepStrictEqual(clean.selectedRequirements, approved)) reject();
      checkPolicy();
      context = ctx; selectedRef = ctx.selectedRequirements; challengeRef = ctx.paymentRequired;
      state = 'APPROVED';
    } catch { return reject(); }
  };
  const signer: ClientHederaSigner = Object.freeze({
    accountId: rawSigner.accountId,
    async createPartiallySignedTransferTransaction(requirements: PaymentRequirements) {
      try {
        if (state !== 'APPROVED' || !context) reject();
        const cleanContext = copyData(context!);
        const final = copyData(requirements);
        if (context!.selectedRequirements !== selectedRef || context!.paymentRequired !== challengeRef || requirements !== selectedRef ||
          !isDeepStrictEqual(cleanContext.paymentRequired, original) ||
          !isDeepStrictEqual(cleanContext.selectedRequirements, approved) || !isDeepStrictEqual(final, approved)) reject();
        checkPolicy();
        // All hooks have finished. No await/callback between consumption and delegation.
        // Pass private detached data, never the SDK's mutable reference.
        const detached = freezeData(copyData(approved));
        state = 'CLOSED';
        return await sign(detached);
      } catch { return reject(); }
    },
  });
  return Object.freeze({ guard, signer, close: () => { state = 'CLOSED'; } });
}

/** Buyer-owned one-shot composition: no raw client, scheme, signer or registration API escapes. */
export function createPaymentAttempt(input: BoundaryInput, rawSigner: ClientHederaSigner,
  hooks: readonly BeforePaymentCreationHook[] = []) {
  const challenge = copyData(input.challenge);
  const selected = copyData(challenge.accepts[input.selectedIndex]);
  const inputResource = copyData(challenge.resource);
  const boundary = createFinalBoundary({ ...input, challenge }, rawSigner);
  const client = new x402Client((_version, eligible) => {
    const match = eligible.find(r => isDeepStrictEqual(r, selected));
    if (!match) return denied(); // never silently choose another offered payment
    return match;
  }).setSpendControls(false);
  client.register('hedera:testnet', new ExactHederaScheme(boundary.signer));
  client.onBeforePaymentCreation(boundary.guard);
  // Startup-only buyer-owned pre-hooks. No extension enrichers, custom schemes,
  // post-sign hooks or recovery handlers are accepted by this facade.
  for (const hook of [...hooks]) client.onBeforePaymentCreation(hook);
  let used = false;
  return Object.freeze({
    async createPaymentPayload() {
      if (used) return denied();
      used = true;
      try {
        const payload = await client.createPaymentPayload(challenge);
        // SDK metadata still references mutable hook context after signing. Publish
        // the actual approved metadata, detached from those references.
        return freezeData({ ...payload, accepted: copyData(selected), resource: copyData(inputResource) });
      }
      finally { boundary.close(); }
    },
  });
}
