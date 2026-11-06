# QuoteSeal Spike 2: Hedera x402 Integration Results

**Date:** 2026-11-06  
**Branch:** `spike/hedera-x402`  
**Status:** Hedera package validated + local test harness built + all tests pass.  
**Live testnet settlement:** NOT performed — no testnet credentials available in this environment.

---

## 1. Package Validation (Task 1)

All four packages verified at exact versions. `@x402/fastify` is NOT directly installed (gap for Phase 6).

| Package | Version | Status | Key Exports |
|---------|---------|--------|-------------|
| `@x402/core` | 2.30.0 | ✅ Installed | `x402Client` (client module), `PaymentRequired`, `PaymentRequirements`, `PaymentPayload`, types |
| `@x402/hedera` | 2.30.0 | ✅ Installed | `ExactHederaScheme`, `createClientHederaSigner`, `createHederaSignAndSubmitTransaction`, `createHederaVerifyPayerSignature`, `createHederaPreflightTransfer`, `createHederaClient`, `HBAR_ASSET_ID` (`0.0.0`), `HEDERA_TESTNET_CAIP2` (`hedera:testnet`), `isValidHederaEntityId`, `inspectHederaTransaction` |
| `@x402/fetch` | 2.30.0 | ✅ Installed | `wrapFetchWithPayment` |
| `@hiero-ledger/sdk` | 2.90.1 | ✅ Installed | `AccountId`, `PrivateKey`, `Client`, `TransferTransaction`, `Hbar`, `TokenId`, `TransactionId` |
| `@x402/fastify` | — | ❌ Not installed | Gap: required by ADR-02 for Phase 6 Fastify API |

**Compatibility findings:**
- All `@x402/*` packages share version 2.30.0 — aligned.
- `@x402/hedera` depends on `@hiero-ledger/sdk` 2.90.1 and `@hiero-ledger/proto` 2.32.0 — transitive alignment confirmed.
- None of the four packages declare `peerDependencies` — no peer conflict risk.
- `@x402/core` is primarily a type/re-export surface at the root export; the full client API is in `@x402/core/client`.
- **Gap:** `@x402/fastify` is not installed as a direct dependency. It is required by ADR-02 (Fastify backend with `@x402/fastify` plugin) and must be added before Phase 6 API work.

---

## 2. Hedera Test Harness (Task 2)

**Location:** `spikes/hedera-x402/`  
**Test command:** `cd spikes/hedera-x402 && npm test`  
**Typecheck:** `npx tsc --noEmit` — PASS  
**Test results:** 14/14 tests pass (Task 2 harness), 0 failed.

### What was built

A reproducible local harness (no credentials, no network calls) covering:

| Test | Description | Result |
|------|-------------|--------|
| HBAR payment requirements structure | `scheme: exact`, `asset: 0.0.0`, `network: hedera:testnet`, integer-string amount | PASS |
| Network identifier CAIP-2 | `hedera:testnet` confirmed as the correct network string | PASS |
| Tinybar amount handling | Amounts are integer strings (`/^(0\|[1-9][0-9]*)$/`), BigInt-safe, no floats | PASS |
| Hedera account ID format | `0.0.x` regex (`/^\d+\.\d+\.\d+$/`) validates buyer, payTo, feePayer | PASS |
| ExactHederaScheme payload build | Invokes signer exactly once; builds payload with `transaction` field | PASS |
| Missing feePayer rejection | Scheme rejects before signer when `extra.feePayer` absent | PASS (0 signer calls) |
| Unsupported network rejection | Scheme rejects `ethereum:sepolia` before signer | PASS (0 signer calls) |
| Non-exact scheme rejection | Scheme rejects `upto` before signer | PASS (0 signer calls) |
| createClientHederaSigner | Builds SDK-backed signer; freezes + signs TransferTransaction | PASS |
| createHederaClient | Returns testnet client for `hedera:testnet` | PASS |
| inspectHederaTransaction | Verifies destination (`payTo`), amount (tinybars), fee payer account ID | PASS |
| createHederaSignAndSubmitTransaction | Returns `(b64, feePayer, network) => Promise<{transactionId}>` factory | PASS |
| Facilitator integration | Attempts real submission; correctly fails without credentials (no fake evidence) | PASS |
| Zero amount rejection | Client signer rejects `amount: '0'` before signing | PASS |

### Live testnet settlement

**Blocked:** No Hedera testnet credentials (buyer account ID/private key, merchant payout account, fee payer key) are available in this environment. Per instructions, no transaction evidence was fabricated.

**What is needed for live testnet:**
- Hedera testnet buyer account ID (`0.0.x`) + private key
- Hedera testnet merchant payout account ID (`0.0.x`)
- Hedera testnet fee payer account ID + private key (for facilitator signAndSubmit)
- Testnet HBAR faucet funds on buyer account

**What would be verified live:**
- Real `TransferTransaction` construction and signing via `createClientHederaSigner`
- Facilitator `signAndSubmitTransaction` returning a real `transactionId`
- HashScan settlement confirmation
- Mirror node verification of destination and amount

---

## 3. Codex Signer-Boundary Fix (Inspected)

The `fix/x402-signer-boundary` branch (commit `e4f2454`) contains Codex's independent correction:

- **Implementation:** `spikes/x402-pre-sign-guard/final-boundary.ts` — `createPaymentAttempt()` and internal `createFinalBoundary()`.
- **Approach:** Copies/freezes original challenge + selected requirements before SDK hooks. At the real Hedera signer interface, re-validates exact reference identities, challenge equality, requirement equality, and trusted snapshot. Consumes single-use authorization before delegating to the raw signer. Detached frozen data copy passed to signer — later SDK mutations cannot alter it.
- **Results:** 62 tests passed, 0 failed (23 original preserved + 39 new boundary tests).
- **Key finding:** All rejected/modified attempts (later-hook mutation of payTo/amount/asset/network/scheme/feePayer/timeout, proxy/getter replacement, abort, BLOCK/HOLD/UNVERIFIABLE, direct scheme call, recovery retry) invoke the raw signer **zero times**. Valid payments invoke it **once** with exact approved destination/amount.
- **Limitation:** Not merged into this branch. Lives in separate worktree `/home/yesh/Projects/eth-signer-boundary`. No ENS/RPC/OIDC/facilitator/live settlement implemented there either.

---

## 4. What Remains Blocked

| Item | Reason |
|------|--------|
| Live Hedera testnet payment | No testnet credentials available |
| `@x402/fastify` direct dependency | Not installed; required for Phase 6 API |
| Live ENS/RPC verification | Spike 1 evidence is local mock only; Sepolia on-chain verification pending |
| World ID OIDC integration | No `WORLD_CLIENT_ID`/`WORLD_CLIENT_SECRET` configured |
| Node 24 runtime testing | Tests executed on Node 26.12.0; ADR-01 pins Node 24.x |

---

## 5. Test Commands

```sh
# Typecheck
cd /home/yesh/Projects/eth/spikes/hedera-x402
npx tsc --noEmit

# Run all tests
npm test
# (equivalently: tsx --test *.test.ts)

# Package versions
cat package.json | grep -E '"(name|version)"' -A1
node -e "import('@x402/core').then(m=>console.log('core keys:', Object.keys(m)))"
node -e "import('@x402/hedera').then(m=>console.log('hedera keys:', Object.keys(m)))"
```
