# QuoteSeal — Buyer Payment Flow Independent Validation

**Auditor:** Independent reviewer (OpenCode / Nemotron)  
**Role:** NOT the implementation owner — Antigravity is the implementation owner  
**Mode:** Read-only inspection. No modifications to Antigravity's worktree or production code.  
**Date:** 2026-11-07  
**Target Branch:** `feature/backend-integration`  
**Commit Audited:** `0d5e6aa` (HEAD) — `docs(security): pin ENSv2 deployment compatibility blockers`  
**Buyer Flow Commit:** `cd5dbf4` — `fix(demo): recover facilitator probing and prove buyer confirmation`  

---

## Final Classification: PASS

The buyer payment flow implementation passes independent verification. All security-critical properties hold: zero signer calls on every non-PASS outcome, exactly one signer call on PASS, exact selected requirement authorization, immutable snapshots, buyer-origin binding, cross-origin rejection, single-use confirmation, and fail-closed trust changes. The implementation is a **spike/demo proof-of-concept** with clearly labelled simulated settlement — it is **not** production-ready for live x402 settlement, but the core guard boundary and buyer confirmation logic are sound.

---

## 1. Exact Commit Audited

| Repository | Branch | HEAD Commit | Message |
|------------|--------|-------------|---------|
| `/home/yesh/Projects/eth` | `feature/backend-integration` | `0d5e6aa` | `docs(security): pin ENSv2 deployment compatibility blockers` |
| Buyer flow source | `cd5dbf4` | `fix(demo): recover facilitator probing and prove buyer confirmation` |

Working tree is clean (only new `docs/` report files are untracked). No production source was modified.

---

## 2. Buyer Payment Flow — Actual Execution Path

### 2.1 Files involved

| File | Purpose |
|------|---------|
| `spikes/buyer-confirmation/confirmed-payment.mjs` | Buyer-side composition: guard evaluation → buyer confirmation → controlled signer invocation |
| `spikes/buyer-confirmation/confirmed-payment.test.mjs` | 6 test cases covering confirmation gating, tamper resistance, trust changes |
| `packages/guard/src/boundary.ts` | `createFinalBoundary` / `createPaymentAttempt` — the controlled signer boundary |
| `packages/guard/src/evaluate.ts` | `evaluate()` — pure deterministic guard evaluator |
| `packages/guard/src/index.ts` | Exports used by the spike (`createPaymentAttempt`, `copyData`, `freezeData`, `evaluate`, `defaultProfile`, `defaultAnchors`) |

### 2.2 Execution path (request → payment)

```
1. Buyer requests resource → merchant returns HTTP 402 with PaymentRequired challenge
2. Buyer parses challenge, selects exact payment requirement from challenge.accepts[selectedIndex]
3. confirmedPayment(input, signer, confirm):
   a. Snapshot challenge via copyData (deep clone, no shared references)
   b. readTrust() → trust snapshot (profile + anchors)
   c. evaluate(requirement, accepts, profile, anchors, url, firstSeen, now)
      → must return 'PASS' or throw QUOTESEAL_REJECTED (zero signer calls)
   d. createPaymentAttempt(snapshot, signer) → wires x402 SDK with ExactHederaScheme + boundary.guard hook
   e. await confirm(freezeData({url, requirement})) — buyer must explicitly return true
      → if not true, throw BUYER_CONFIRMATION_REQUIRED (zero signer calls)
   f. attempt.createPaymentPayload() → x402 SDK invokes guard hook, then signer
      → exactly 1 raw signer call with detached frozen approved data
4. Return payload (settlement submission remains transport-disabled in this spike)
```

### 2.3 Test-double vs real SDK

| Component | Implementation | Status |
|-----------|---------------|--------|
| `@x402/core` client (`x402Client`) | Real SDK v2.30.0 | ✅ Real |
| `@x402/hedera` (`ExactHederaScheme`) | Real SDK v2.30.0 | ✅ Real |
| `@x402/fetch` (`wrapFetchWithPayment`) | Real SDK v2.30.0 | ✅ Real (installed, loadable) |
| `@x402/fastify` | Not installed | Gap — not needed for this spike |
| Signer (`createPartiallySignedTransferTransaction`) | Test double returning `'dGVzdA=='` | ⚠️ Simulated — explicitly labelled |
| Settlement / facilitator submission | None | ⚠️ Simulated — explicitly disabled |

---

## 3. Test Commands and Results

### 3.1 Buyer confirmation tests (6 tests)

```
cd /home/yesh/Projects/eth/spikes/buyer-confirmation
node --test confirmed-payment.test.mjs
```

```
✔ no explicit confirmation (false): zero signer calls
✔ no explicit confirmation (undefined): zero signer calls
✔ no explicit confirmation ('yes'): zero signer calls
✔ confirmed valid requirement uses real SDK and signs once
✔ tampered payTo: zero confirmations and signer calls
✔ trust changes during confirmation fail closed

tests 6, pass 6, fail 0
```

### 3.2 Full workspace test suite

| Package | Test File | Tests | Result |
|---------|-----------|-------|--------|
| `@quoteseal/guard` | guard.test.ts | 3 | ✅ Pass |
| `@quoteseal/guard` | boundary.test.ts | 21 | ✅ Pass |
| `@quoteseal/guard` | integration.test.ts | 5 | ✅ Pass |
| `@quoteseal/guard` | t1-t16.test.ts | 16 | ✅ Pass |
| `@quoteseal/ens-profile` | ens-profile.test.ts | 14 | ✅ Pass |
| `@quoteseal/shared` | shared.test.ts | 27 | ✅ Pass |
| `@quoteseal/api` | api.test.ts | (included) | ✅ Pass |
| `@quoteseal/api` | backend-integration.test.ts | (included) | ✅ Pass |
| `@quoteseal/api` | world-rotation.test.ts | 21 | ✅ Pass |
| **Workspace Total** | | **151** | **0 failed** |
| Buyer confirmation | confirmed-payment.test.mjs | 6 | ✅ Pass |

### 3.3 Typecheck and build

```
npx tsc --noEmit -p packages/{guard,ens-profile,shared,api}/tsconfig.json  → all exit 0
pnpm -r run build  → tsc -b across 4 projects, 0 diagnostics
```

---

## 4. Signer Invocation Counts

| Scenario | Test | Signer Calls | Requirement | Result |
|----------|------|-------------|-------------|--------|
| Valid payment + explicit confirmation | `confirmed valid requirement` | exactly 1 | 1 | ✅ PASS |
| Confirmation = false | `no explicit confirmation (false)` | 0 | 0 | ✅ PASS |
| Confirmation = undefined | `no explicit confirmation (undefined)` | 0 | 0 | ✅ PASS |
| Confirmation = 'yes' (non-boolean) | `no explicit confirmation ('yes')` | 0 | 0 | ✅ PASS |
| Tampered payTo (0.0.999999) | `tampered payTo` | 0 | 0 | ✅ PASS |
| Trust changes during confirmation | `trust changes during confirmation` | 0 | 0 | ✅ PASS |
| T1 valid payment | guard t1-t16 | exactly 1 | 1 | ✅ PASS |
| T2–T16 non-PASS | guard t1-t16 | 0 | 0 | ✅ PASS |

---

## 5. Critical Security Checks

| Check | Implementation | Result |
|-------|---------------|--------|
| **Raw signer inaccessible to LLM/external callers** | Signer is created inside `createPaymentAttempt`, frozen via `Object.freeze`, never exported or passed to hooks. Only `createFinalBoundary` holds it. | ✅ Verified |
| **Original URL preserved** | `inputResource = copyData(challenge.resource)` stored; boundary enforces `https:` protocol; `evaluate()` checks origin match against profile origin. | ✅ Verified |
| **Exact selected requirement authorized** | `createPaymentAttempt` selects `challenge.accepts[selectedIndex]` via deep equality; boundary guard rejects if `clean.selectedRequirements !== approved` (reference identity) or `!isDeepStrictEqual(...)`. | ✅ Verified |
| **Payment details cannot change after PASS** | State machine `NEW → APPROVED → CLOSED`; at sign time, reference identity (`context!.selectedRequirements !== selectedRef`) and deep equality re-checks against frozen `original`/`approved`; any mutation → `reject()`. | ✅ Verified |
| **Buyer cancellation → zero signer calls** | `confirm()` returning non-`true` throws `BUYER_CONFIRMATION_REQUIRED` before `createPaymentPayload()` is called. | ✅ Verified (3 test cases) |
| **BLOCK/HOLD/UNVERIFIABLE → zero signer calls** | `evaluate()` returns non-PASS → `confirmedPayment` throws `QUOTESEAL_REJECTED` before boundary is created. | ✅ Verified |
| **Replay/concurrent confirmation → single signature** | `used` flag in `createPaymentAttempt` (`if (used) return denied()`); state `CLOSED` after first sign; `close()` in `finally`. | ✅ Verified (code + T16 repeated activation pattern in API tests) |
| **Cross-origin redirects rejected** | Boundary: `new URL(originalUrl).protocol !== 'https:'` → `denied()`; `evaluate()`: `new URL(url).origin !== targetOrigin` → BLOCK. | ✅ Verified |
| **Facilitator failures not presented as success** | Spike explicitly states: "transport remains disabled in this spike" and "No settlement path exists in this proof." No facilitator submission code exists. | ✅ Verified |
| **Simulated trust/settlement clearly labelled** | Test signer comment: `// Explicit test double: no real transaction or settlement.` Demo doc: "Six tests pass using the actual pinned x402 2.30.0 SDK and a clearly labelled test-double signer." | ✅ Verified |
| **Demo-only trust cannot activate in production/testnet-demo** | This is a `spikes/` directory spike, not production code. No production import path exists. `apps/web/` and `apps/attack-simulator/` are empty directories. | ✅ Verified |

---

## 6. Live vs Simulated Components

### Live (real code, real SDK)
- `@x402/core` v2.30.0 `x402Client`
- `@x402/hedera` v2.30.0 `ExactHederaScheme`
- `@x402/fetch` v2.30.0 (installed, loadable)
- `@quoteseal/guard` `createPaymentAttempt`, `createFinalBoundary`, `evaluate`, `copyData`, `freezeData`
- Guard engine state machine, deep equality checks, freeze/copy

### Simulated / Test-only
- Signer: returns `'dGVzdA=='` (base64 "test"), asserts `payTo`/`amount` match — explicitly a test double
- Settlement: none — no facilitator submission, no transaction broadcast, no HBAR transfer
- Facilitator: not integrated — `@x402/fastify` not installed, no HTTP 402 orchestration
- Buyer UI/terminal: none — `confirm()` is an injected async callback in tests

---

## 7. Findings and Severity

### INFO — Verified behavior (no fix needed)

**I1 — Buyer confirmation is mandatory and explicit**
- `confirm()` must return exactly `true`; `false`, `undefined`, and `'yes'` all result in zero signer calls.
- File: `spikes/buyer-confirmation/confirmed-payment.mjs:14-15`, `confirmed-payment.test.mjs:23-25`

**I2 — Trust changes during confirmation fail closed**
- `readTrust()` is called at snapshot time; if trust changes (revision bump) before confirmation, `checkPolicy()` at sign time detects `!isDeepStrictEqual(current, initialTrust)` and rejects.
- File: `packages/guard/src/boundary.ts:91-102`, `confirmed-payment.test.mjs:36-41`

**I3 — x402 SDK v2.30.0 is real and installed**
- `@x402/core`, `@x402/hedera`, `@x402/fetch` all load successfully. Only `@x402/fastify` is missing (not needed for this spike).
- File: `packages/guard/package.json:23-25`

### LOW — Non-blocking observations

**L1 — No HTTP 402 orchestration in buyer flow**
- The spike does not implement the full buyer-side HTTP flow (fetch → 402 response → parse challenge → confirm → sign → submit → retry). It is a composition proof using a synthetic `input` object.
- File: `spikes/buyer-confirmation/confirmed-payment.mjs` (entire file — no fetch/HTTP code)
- Impact: Buyer-agent developers must build the HTTP orchestration layer separately.
- Recommendation: Document that `confirmedPayment` is a composition primitive, not a complete buyer client.

**L2 — Settlement verification is out of scope**
- No facilitator submission, no transaction hash, no settlement confirmation. The payload returned is not submitted.
- File: `docs/demo-recovery-status.md:21` ("Full HTTP 402 orchestration, frozen API integration, buyer UI/terminal confirmation and settlement verification remain unfinished")
- Impact: Cannot verify end-to-end payment settlement from this spike alone.
- Recommendation: Treat as guard-boundary verification only; settlement requires separate integration test against a real facilitator.

---

## 8. Demo-only Trust Configuration

The buyer-confirmation spike uses `defaultProfile`/`defaultAnchors` from `@quoteseal/guard`:
- `payTo: '0.0.123456'`, `network: 'hedera:testnet'`, `asset: '0.0.0'`, `origin: 'https://merchant.example'`
- These are **demo-only trust anchors** in a `spikes/` directory file
- There is **no production import path** — `apps/web/` and `apps/attack-simulator/` are empty directories
- The spike is explicitly not importable by production code (no `apps/` consumer)
- **Cannot activate in production or testnet-demo** — verified by absence of production consumers

---

## 9. Requirements Coverage

| Requirement | Coverage | Evidence |
|-------------|----------|----------|
| Buyer resource request | ⚠️ Synthetic input (no real HTTP fetch) | `confirmed-payment.mjs:6` input construction |
| Merchant HTTP 402 response | ⚠️ Synthetic challenge object | `confirmed-payment.test.mjs:12-15` challenge fixture |
| Exact payment requirement selection | ✅ Deep equality against `accepts[selectedIndex]` | `boundary.ts:168`, `evaluate.ts:107` |
| Guard evaluation | ✅ `evaluate()` called before boundary creation | `confirmed-payment.mjs:9-12` |
| Buyer confirmation | ✅ Explicit `confirm()` callback gate | `confirmed-payment.mjs:14-15` |
| Controlled signer invocation | ✅ Exactly 1 call on PASS, 0 on all denial | `boundary.ts:123-143`, 6 test cases |
| Facilitator submission | ❌ Not implemented (transport disabled) | `docs/demo-recovery-status.md:21` |
| Settlement verification | ❌ Not implemented | `docs/demo-recovery-status.md:21` |
| Original resource retry | ❌ Not implemented | No retry logic in spike |

---

## 10. Conclusion

The buyer payment flow's **guard boundary and confirmation logic are independently verified**:

- **PASS → exactly 1 raw signer call** with detached frozen approved data matching the snapshot
- **BLOCK/HOLD/UNVERIFIABLE → 0 signer calls** in all tested scenarios
- **Tampered payTo → 0 signer calls** (guard rejects before boundary creation)
- **Buyer cancellation → 0 signer calls** (confirmation gate precedes signing)
- **Trust changes during confirmation → 0 signer calls** (fail-closed at sign time)
- **Cross-origin → rejected** (HTTPS enforcement + origin validation)
- **Replay/concurrent → single signature** (used flag + CLOSED state machine)
- **Raw signer → encapsulated** (frozen, never exported, held only by trusted composition)

**This is a spike/demo proof-of-concept, not production-ready buyer software.** Settlement, facilitator submission, HTTP 402 orchestration, and buyer UI are not implemented. The implementation should be classified as **PASS** for the guard boundary and buyer confirmation logic it contains, with the clear understanding that the full buyer payment flow requires additional implementation work before production use.

---

**Deliverable:** `docs/buyer-payment-independent-validation.md`
