# QuoteSeal: Independent Security Validation

**Date:** 2026-11-06  
**Branch:** `spike/hedera-x402`  
**Validator role:** Independent integration and test engineer  
**Method:** Real SDK testing — no fake SDK lifecycle, no simulated control flow

---

## 1. Scope

Independently validated the critical security claim of QuoteSeal:

> **For every non-PASS outcome (BLOCK, HOLD, UNVERIFIABLE, rejection, exception), the actual payment signer invocation count must be zero.**

Tests executed against the **real** `@x402/core` v2.30.0, `@x402/fetch` v2.30.0, and `@x402/hedera` v2.30.0 SDKs using `x402Client`, `wrapFetchWithPayment`, and `ExactHederaScheme`. An instrumented signer wrapper counts `createPartiallySignedTransferTransaction` invocations. No fake SDK, no mocked lifecycle, no simulated payment flow.

---

## 2. Test Results Summary

**18 security tests, 18 passed, 0 failed.**

| Category | Tests | All zero-signer on non-PASS? |
|----------|-------|------------------------------|
| Guard verdicts (BLOCK/HOLD/UNVERIFIABLE/exception) | 8 | ✅ Yes |
| Malformed input (accepts[], fabricated requirement) | 3 | ✅ Yes |
| Transport (cross-origin redirect) | 1 | ✅ Yes |
| Retry / fallback | 1 | ✅ Yes |
| **SDK mutation vulnerability (later hook)** | **4** | **❌ Signer called with MUTATED values** |
| Guard abort prevents later hooks | 1 | ✅ Yes |

### 2.1 Guard Verdicts — All PASS (zero signer calls)

Every non-PASS verdict from the guard results in 0 signer invocations:

- Tampered `payTo` → BLOCK → 0 calls
- Tampered `amount` → BLOCK → 0 calls
- Tampered `asset` → BLOCK → 0 calls
- Tampered `network` → BLOCK → 0 calls
- Unknown merchant → HOLD → 0 calls
- Stale profile / RPC disagreement → UNVERIFIABLE → 0 calls
- Guard throws exception → Reject → 0 calls
- Cross-origin HTTP 302 redirect → Reject before payment → 0 calls

### 2.2 Malformed Input — All PASS (zero signer calls)

- Malicious `accepts[]` entry (tampered payTo in offered array) → guard BLOCKs → 0 calls
- Fabricated selected requirement (selector returns entry not in offers) → guard BLOCKs → 0 calls
- Malicious `accepts[]` + buyer URL origin mismatch → guard BLOCKs → 0 calls

### 2.3 Transport — PASS (zero signer calls)

- Real HTTP 302 cross-origin redirect with `redirect: 'error'` → fetch rejects before payment logic → 0 signer calls

### 2.4 Retry / Fallback — PASS (zero added signer calls on rejected retry)

- Recovery retry re-enters the guard; rejected retry adds **0** signer calls. First (valid) attempt: 1 call. Retried (rejected) attempt: 0 additional calls. Total: 1.

### 2.5 SDK Mutation Vulnerability — CRITICAL FINDING

Tests T3-13 through T3-16 demonstrate that a **later-registered** `onBeforePaymentCreation` hook can mutate `selectedRequirements` after the guard has validated it:

| Mutation | Guard sees | Signer receives | Signer calls |
|----------|-----------|-----------------|-------------|
| `payTo` | `0.0.123456` | `0.0.999999` | 1 |
| `amount` | `10` | `999999999` | 1 |
| `asset` | `0.0.0` | `0.0.429274` | 1 |
| `network` | `hedera:testnet` | `hedera:mainnet` | 1 |

**Root cause:** The x402 SDK passes a mutable `selectedRequirements` reference through the hook chain. Manual hooks run first, then scheme adapters, then declared extension hooks (`getLabeledHooks` at `@x402/core/dist/esm/client/index.mjs:631`). Nothing freezes or deep-copies the requirements after the final hook. The scheme calls `createPartiallySignedTransferTransaction(requirements)` with whatever reference exists at that moment.

**This is the documented Spike 3 vulnerability.** Hook registration order alone is not a security boundary.

### 2.6 Guard Abort Prevents Later Hooks — PASS

When the guard returns `{ abort: true }`, the SDK throws before reaching later hooks or the scheme. `signer.calls === 0`. Later hooks never execute.

---

## 3. Codex Signer-Boundary Fix (Inspected, Not Merged)

The `fix/x402-signer-boundary` branch (commit `e4f2454`) contains Codex's independent correction:

- **File:** `spikes/x402-pre-sign-guard/final-boundary.ts` (in separate worktree `/home/yesh/Projects/eth-signer-boundary`)
- **API:** `createPaymentAttempt()` + internal `createFinalBoundary()`
- **Approach:** Copies and deep-freezes the original challenge + selected requirements before SDK hooks. At the real Hedera signer interface, re-validates reference identities, challenge equality, requirement equality (all fields including nested `extra`), and trusted snapshot. Consumes single-use authorization before delegating to the raw signer. Detached frozen data copy passed to signer.
- **Results:** 62 tests passed, 0 failed (23 original preserved + 39 new). All mutation tests (payTo, amount, asset, network, scheme, feePayer, timeout, proxy/getter replacement, abort, BLOCK/HOLD/UNVERIFIABLE, direct scheme call, recovery retry) → **0 signer calls**.
- **Valid payments** → **1 signer call** with exact approved destination and amount.

**Not merged into this branch.** Lives in a separate worktree. No ENS/RPC/OIDC/facilitator/live settlement implemented there either.

---

## 4. Remaining Unverified Assumptions

These were NOT tested in this validation (no credentials, no live network):

| Assumption | Risk | Required verification |
|------------|------|----------------------|
| Live Hedera testnet settlement works | High | Testnet credentials + real payment |
| Facilitator `signAndSubmitTransaction` returns valid `transactionId` | High | Real facilitator integration |
| Mirror node verifies destination/amount | Medium | Live testnet + HashScan |
| ENSv2 Permissioned Resolver on Sepolia enforces exclusive writer | High | Spike 1 Sepolia on-chain verification |
| Dual-RPC agreement at finalized block | Medium | Live Alchemy + Infura Sepolia endpoints |
| World ID OIDC step-up binds to proposal hash | High | `WORLD_CLIENT_ID`/`SECRET` + registered app |
| `@x402/fastify` plugin integration | Medium | `npm install @x402/fastify@2.30.0` |
| Node 24.x runtime compatibility | Low | Test on Node 24 LTS |

---

## 5. Verdict

**The guard itself provides the zero-signer-call guarantee for all non-PASS verdicts it produces.** However, the **SDK does not freeze or revalidate `selectedRequirements` after all `onBeforePaymentCreation` hooks run**. A later-registered hook (scheme adapter, extension, or buyer-configured plugin) can mutate payTo/amount/asset/network after guard validation, causing the signer to be invoked with attacker-controlled values.

**Recommendation:** Adopt Codex's `createPaymentAttempt()` / `createFinalBoundary()` pattern (or equivalent) before any production use. The facade must:
1. Copy and freeze original challenge + requirements before SDK hooks
2. Revalidate at the real signer interface (reference identity + deep equality + trusted snapshot)
3. Pass a detached frozen data copy to the raw signer
4. Consume single-use authorization before delegation
5. Not register arbitrary extensions, post-sign hooks, or replacement schemes

Without this boundary, the zero-signer-call claim is conditional on hook registration order — which is not a security boundary.
