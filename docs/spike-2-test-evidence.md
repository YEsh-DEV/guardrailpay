# QuoteSeal Spike 2: Test Evidence

**Date:** 2026-11-06  
**Branch:** `spike/hedera-x402`  
**Working directory:** `/home/yesh/Projects/eth/spikes/hedera-x402/`  
**Node version:** v26.12.0 (ADR-01 pins Node 24.x — pending verification)  
**npm version:** 11.20.0

---

## 1. Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `package-validation.test.ts` | Task 1: Package version, export, peer-dependency, compatibility validation | 13 |
| `hedera-harness.test.ts` | Task 2: Local Hedera x402 harness (HBAR, network, tinybars, account IDs, facilitator, transaction inspection) | 14 |
| `security-validation.test.ts` | Task 3: Independent x402 security validation (signer boundary, mutations, redirect, retry) | 18 |

**Total:** 45 tests, 45 passed, 0 failed.

---

## 2. Environment & Versions

```
Package              Version  Source
@x402/core           2.30.0   package.json dependency
@x402/hedera         2.30.0   package.json dependency
@x402/fetch          2.30.0   package.json dependency
@hiero-ledger/sdk    2.90.1   package.json dependency
@x402/fastify        —        NOT installed (gap)
TypeScript           5.9.3    devDependency
tsx                  4.21.0   devDependency
@types/node          24.10.0  devDependency
Node                 v26.12.0   runtime
```

`@x402/hedera` transitive deps: `@hiero-ledger/sdk` 2.90.1, `@hiero-ledger/proto` 2.32.0, `@x402/core` ~2.30.0.

No `peerDependencies` declared by any of the four primary packages — zero peer conflict risk.

---

## 3. Test Execution

### Typecheck

```sh
cd /home/yesh/Projects/eth/spikes/hedera-x402
npx tsc --noEmit
```
**Result:** PASS (no errors)

### Full test suite

```sh
cd /home/yesh/Projects/eth/spikes/hedera-x402
npm test
# or: tsx --test *.test.ts
```
**Result:** 45 passed, 0 failed, duration ~1.4s

---

## 4. Detailed Test Evidence

### Task 1 — Package Validation (13 tests)

All tests pass. Key observed values:

```
PACKAGE_VERSIONS:
  "@x402/core": "2.30.0"
  "@x402/hedera": "2.30.0"
  "@x402/fetch": "2.30.0"
  "@hiero-ledger/sdk": "2.90.1"

CORE_EXPORTS: ["x402Version"]
CORE_PEER_DEPS: {}
HEDERA_EXPORTS: [ExactHederaScheme, createClientHederaSigner,
  createHederaSignAndSubmitTransaction, createHederaVerifyPayerSignature,
  createHederaPreflightTransfer, createHederaClient, HBAR_ASSET_ID,
  HEDERA_TESTNET_CAIP2, HEDERA_MAINNET_CAIP2, isValidHederaEntityId,
  isHbarAsset, inspectHederaTransaction, ...]
HEDERA_PEER_DEPS: {}
FETCH_EXPORTS: [wrapFetchWithPayment, ...]
FETCH_PEER_DEPS: {}
HIERO_EXPORTS: [AccountId, PrivateKey, Client, TransferTransaction, Hbar,
  TokenId, TransactionId, ...]
HEDERA_DEPS: {@hiero-ledger/proto: 2.32.0, @hiero-ledger/sdk: 2.90.1,
  @x402/core: ~2.30.0}
X402_FASTIFY_INSTALLED: false  (gap — required by ADR-02)
```

### Task 2 — Hedera Test Harness (14 tests)

All tests run without credentials. No real keys, no network calls, no fabricated evidence.

**Representative assertions (all passing):**

- `HBAR_ASSET_ID === '0.0.0'`, `HEDERA_TESTNET_CAIP2 === 'hedera:testnet'`
- `BigInt('100000000') === 100_000_000n` (1 HBAR in tinybars)
- Amount matches `/^(0|[1-9][0-9]*)$/` (no floats, no exponent notation)
- `isValidHederaEntityId('0.0.123456') === true`; `isValidHederaEntityId('0x1234') === false`
- `ExactHederaScheme.createPaymentPayload()` → `signer.calls() === 1`, `payload.transaction` is non-empty base64
- Missing `extra.feePayer` → rejection before signer (`calls === 0`)
- Unsupported network → rejection before signer (`calls === 0`)
- Non-exact scheme → rejection before signer (`calls === 0`)
- `createClientHederaSigner(BUYER, priv, {network: 'hedera:testnet'})` → `signer.accountId === BUYER`
- `inspectHederaTransaction(...)` → `receivers[0].accountId === MERCHANT_PAYTO`, `receivers[0].amount === '100000000'`, `payers[0].amount === '-100000000'`, `transactionIdAccountId === FEE_PAYER`
- `createHederaSignAndSubmitTransaction(...)` → returns function with 3 params
- Facilitator `signAndSubmit` → throws without credentials (no fake transactionId)
- `amount: '0'` → `createClientHederaSigner` rejects with "amount must be greater than zero"

### Task 3 — Independent Security Validation (18 tests)

All tests use the **real** `@x402` SDK (`x402Client`, `wrapFetchWithPayment`, `ExactHederaScheme`) — never a fake SDK lifecycle.

**Central requirement verified:** For every non-PASS outcome, the actual payment signer invocation count is **zero**.

| Test | Scenario | Verdict | Signer Calls | Payload Creations | Recovery |
|------|----------|---------|:---:|:---:|:---:|
| T3-1 | Valid payment | PASS | 1 | 1 | 0 |
| T3-2 | Guard BLOCK: tampered payTo | BLOCK | 0 | 0 | 0 |
| T3-3 | Guard BLOCK: tampered amount | BLOCK | 0 | 0 | 0 |
| T3-4 | Guard BLOCK: tampered asset | BLOCK | 0 | 0 | 0 |
| T3-5 | Guard BLOCK: tampered network | BLOCK | 0 | 0 | 0 |
| T3-6 | Guard HOLD: unknown merchant | HOLD | 0 | 0 | 0 |
| T3-7 | Guard UNVERIFIABLE: stale profile | UNVERIFIABLE | 0 | 0 | 0 |
| T3-8 | Guard exception | Reject | 0 | 0 | 0 |
| T3-9 | Cross-origin redirect (real HTTP 302) | Reject | 0 | — | 0 |
| T3-10 | Malicious accepts[] entry | BLOCK | 0 | 0 | 0 |
| T3-11 | Fabricated selected requirement | BLOCK | 0 | 0 | 0 |
| T3-12 | Retry + fallback | — | 1 total | 1 total | 0 added on retry |
| T3-13 | Later hook mutates payTo | **signer called with mutated payTo** | 1 | 1 | 0 |
| T3-14 | Later hook mutates amount | **signer called with mutated amount** | 1 | 1 | 0 |
| T3-15 | Later hook mutates asset | **signer called with mutated asset** | 1 | 1 | 0 |
| T3-16 | Later hook mutates network | **signer called with mutated network** | 1 | 1 | 0 |
| T3-17 | Guard BLOCK then later hook | BLOCK | 0 | 0 | 0 |

**Critical finding (T3-13 through T3-16):** A later-registered `onBeforePaymentCreation` hook can mutate `selectedRequirements` (payTo, amount, asset, network) after the guard has validated it. The SDK passes the mutable reference to the scheme, which invokes the signer with the mutated values. This is the documented Spike 3 vulnerability: **hook registration order alone is insufficient; the SDK does not freeze or revalidate requirements after all hooks run.**

**Mitigation path:** Codex's `fix/x402-signer-boundary` branch implements `createPaymentAttempt()` / `createFinalBoundary()` which freezes a detached data copy and revalidates at the real signer interface — all mutation tests there yield 0 signer calls. Not yet merged into this branch.

---

## 5. Blocked Items (No Credentials)

| Item | Evidence | Required to unblock |
|------|----------|---------------------|
| Live Hedera testnet payment | Not attempted — no credentials | Testnet buyer account ID + private key, merchant payout account, fee payer key, testnet HBAR funds |
| `@x402/fastify` direct dependency | `X402_FASTIFY_INSTALLED: false` | `npm install @x402/fastify@2.30.0` |
| Node 24 runtime testing | Tests run on Node 26.12.0 | Run on Node 24.x LTS |
| Live ENS/RPC verification | Spike 1 is local mock only | Sepolia testnet deployment + on-chain role inspection |

**No transaction evidence was fabricated.** Every "blocked" item is reported as such.

---

## 6. Reproduction

```sh
cd /home/yesh/Projects/eth/spikes/hedera-x402
npm ci          # or npm install
npx tsc --noEmit
npm test
```
