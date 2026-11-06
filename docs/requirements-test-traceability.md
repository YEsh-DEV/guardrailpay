# QuoteSeal: Requirements–Test Traceability Matrix

**Date:** 2026-11-06  
**Branch:** `spike/hedera-x402`  
**Purpose:** Map every security invariant (INV-01 to INV-16) and architecture requirement to executed tests, with evidence location and verdict.

---

## 1. Security Invariant Traceability (INV-01 to INV-16)

| Invariant | Statement | Test(s) | Evidence Location | Verdict |
|-----------|-----------|---------|-------------------|---------|
| **INV-01** | Changed/unauthorized `payTo` never reaches signer | T3-2, T3-13 | `security-validation.test.ts` | ⚠️ Guard BLOCKs (0 calls), but later-hook mutation bypasses (signer called with mutated payTo) |
| **INV-02** | Zero signer invocations on rejection | T3-2 through T3-8, T3-10, T3-11, T3-17 | `security-validation.test.ts` | ✅ PASS — 0 calls on all guard rejections |
| **INV-03** | Exact selected requirement evaluated | T3-1, T3-11 | `security-validation.test.ts` | ✅ PASS — selector + guard evaluate exact selected entry |
| **INV-04** | Selected item belongs to `accepts[]` | T3-10, T3-11 | `security-validation.test.ts` | ✅ PASS — guard checks canonical membership |
| **INV-05** | Origin from buyer URL, not `resource.url` | T3-9 (redirect), T3-10 (malicious resource.url) | `security-validation.test.ts` | ✅ PASS — origin checked against buyer URL |
| **INV-06** | Cross-origin redirects rejected | T3-9 | `security-validation.test.ts` | ✅ PASS — `redirect: 'error'` blocks before signer |
| **INV-07** | Unknown merchant never PASS | T3-6 | `security-validation.test.ts` | ✅ PASS — HOLD, 0 signer calls |
| **INV-08** | Elapsed delay does not auto-activate | (contract level — Spike 4) | `docs/spike-1-ens-results.md` | 📋 Planned (not in Spike 2 scope) |
| **INV-09** | New payout valid only after activation | (contract level — Spike 4) | `docs/spike-1-ens-results.md` | 📋 Planned (not in Spike 2 scope) |
| **INV-10** | Cancelled rotation never activates | (contract level — Spike 4) | `docs/spike-1-ens-results.md` | 📋 Planned (not in Spike 2 scope) |
| **INV-11** | Anchor changes trigger HOLD/re-trust | T3-7 (stale profile) | `security-validation.test.ts` | ✅ PASS — UNVERIFIABLE/HOLD, 0 signer calls |
| **INV-12** | World auth bound to proposal hash | (Phase 5) | — | 📋 Planned (not in Spike 2 scope) |
| **INV-13** | Single-use replay protection | (Phase 5) | — | 📋 Planned (not in Spike 2 scope) |
| **INV-14** | Unauthorized operators rejected on-chain | (Spike 1 / Phase 4) | `docs/spike-1-ens-bypass-tests.md` | ✅ PASS (local mock — TEST-03, TEST-04, TEST-05, TEST-07) |
| **INV-15** | RPC disagreement fails closed | T3-7 | `security-validation.test.ts` | ✅ PASS — UNVERIFIABLE, 0 signer calls |
| **INV-16** | Zero sensitive info on rejection | T3-8 (exception) | `security-validation.test.ts` | ✅ PASS — generic abort, no leak |

**Key:** ✅ Verified in Spike 2 | 📋 Planned for later phase | ⚠️ Partially verified (guard works, SDK mutation gap)

---

## 2. Architecture Requirement Traceability (ADR-01 to ADR-12)

| ADR | Decision | Test(s) | Evidence | Verdict |
|-----|----------|---------|----------|---------|
| **ADR-01** | pnpm monorepo, strict TS, Node 24.x | `npx tsc --noEmit` | `spikes/hedera-x402/tsconfig.json` | ✅ Typecheck passes (Node 26 runtime — Node 24 pending) |
| **ADR-02** | Fastify + `@x402/fastify` | — | `X402_FASTIFY_INSTALLED: false` | ❌ Gap — `@x402/fastify` not installed |
| **ADR-03** | Next.js App Router | — | — | 📋 Phase 7 |
| **ADR-04** | `@x402/core`, `@x402/hedera`, `@x402/fastify`, `@hiero-ledger/sdk` | Package validation (13 tests) | `package-validation.test.ts` | ✅ Versions aligned (2.30.0), no peer deps, `@hiero-ledger/sdk` 2.90.1 |
| **ADR-05** | HBAR `0.0.0` in tinybars | Task 2 harness | `hedera-harness.test.ts` | ✅ `HBAR_ASSET_ID='0.0.0'`, integer-string amounts, BigInt-safe |
| **ADR-06** | Dedicated ENSv2 resolver per merchant | Spike 1 | `docs/spike-1-ens-results.md` | ✅ PASS (local mock — 14/14 tests) |
| **ADR-07** | Solidity 0.8.24, Foundry | Spike 1 | `spikes/ens-permissions/` | ✅ PASS (local mock — 14/14 tests + 1,000-run fuzz) |
| **ADR-08** | World ID OIDC + EIP-712 attestation | — | — | 📋 Phase 5 |
| **ADR-09** | Dual-RPC at identical finalized block | T3-7 | `security-validation.test.ts` | ✅ PASS — UNVERIFIABLE on disagreement, 0 calls |
| **ADR-10** | Pure deterministic guard evaluator | T3-1 through T3-17 | `security-validation.test.ts` | ✅ PASS — deterministic verdicts, no I/O in evaluator |
| **ADR-11** | PostgreSQL + Drizzle ORM | — | — | 📋 Phase 6 |
| **ADR-12** | HCS optional post-MVP | — | — | 📋 Phase 9 (optional) |

---

## 3. Hedera-Specific Requirement Traceability

| Requirement | Test(s) | Evidence | Verdict |
|-------------|---------|----------|---------|
| Native HBAR payment requirements | Task 2 harness | `hedera-harness.test.ts` | ✅ `scheme: exact`, `asset: 0.0.0`, `network: hedera:testnet` |
| Correct Hedera network identifier (CAIP-2) | Task 2 | `hedera-harness.test.ts` | ✅ `hedera:testnet` |
| Tinybar amount handling (integer strings) | Task 2 | `hedera-harness.test.ts` | ✅ `/^(0|[1-9][0-9]*)$/`, BigInt conversion |
| Hedera account ID `0.0.x` format | Task 2 | `hedera-harness.test.ts` | ✅ `isValidHederaEntityId` regex validation |
| `ExactHederaScheme` builds payload | Task 2 | `hedera-harness.test.ts` | ✅ Signer called once, `transaction` field populated |
| Missing `feePayer` rejected before signer | Task 2 | `hedera-harness.test.ts` | ✅ 0 signer calls |
| Unsupported network rejected before signer | Task 2 | `hedera-harness.test.ts` | ✅ 0 signer calls |
| Non-exact scheme rejected before signer | Task 2 | `hedera-harness.test.ts` | ✅ 0 signer calls |
| `createClientHederaSigner` builds signer | Task 2 | `hedera-harness.test.ts` | ✅ Freezes + signs TransferTransaction |
| `createHederaClient` returns testnet client | Task 2 | `hedera-harness.test.ts` | ✅ `Client.forTestnet()` |
| `inspectHederaTransaction` verifies dest/amount | Task 2 | `hedera-harness.test.ts` | ✅ Receiver=payTo, amount=tinybars, payer=negative |
| `createHederaSignAndSubmitTransaction` factory | Task 2 | `hedera-harness.test.ts` | ✅ `(b64, feePayer, network) => Promise<{transactionId}>` |
| Facilitator submission (no credentials) | Task 2 | `hedera-harness.test.ts` | ✅ Correctly fails — no fake evidence |
| Zero amount rejected | Task 2 | `hedera-harness.test.ts` | ✅ "amount must be greater than zero" |

---

## 4. Test-to-Requirement Mapping (Reverse Index)

| Test File | Test | Covers |
|-----------|------|--------|
| `package-validation.test.ts` | Task 1 — versions | ADR-04 |
| `package-validation.test.ts` | Task 1 — root presence | ADR-04 |
| `package-validation.test.ts` | Task 1 — core exports | ADR-04 |
| `package-validation.test.ts` | Task 1 — core peer deps | ADR-04 |
| `package-validation.test.ts` | Task 1 — hedera exports | ADR-04 |
| `package-validation.test.ts` | Task 1 — hedera peer deps | ADR-04 |
| `package-validation.test.ts` | Task 1 — fetch exports | ADR-04 |
| `package-validation.test.ts` | Task 1 — fetch peer deps | ADR-04 |
| `package-validation.test.ts` | Task 1 — hiero exports | ADR-04 |
| `package-validation.test.ts` | Task 1 — hedera deps | ADR-04 |
| `package-validation.test.ts` | Task 1 — fastify gap | ADR-02 |
| `package-validation.test.ts` | Task 1 — version alignment | ADR-04 |
| `package-validation.test.ts` | Task 1 — signer helper signatures | ADR-04 |
| `package-validation.test.ts` | Task 1 — ExactHederaScheme constructor | ADR-04 |
| `hedera-harness.test.ts` | HBAR requirements structure | ADR-04, ADR-05 |
| `hedera-harness.test.ts` | Network identifier | ADR-04 |
| `hedera-harness.test.ts` | Tinybar amounts | ADR-05 |
| `hedera-harness.test.ts` | Account ID format | ADR-04, ADR-05 |
| `hedera-harness.test.ts` | ExactHederaScheme payload | ADR-04 |
| `hedera-harness.test.ts` | Missing feePayer | ADR-04 |
| `hedera-harness.test.ts` | Unsupported network | ADR-04 |
| `hedera-harness.test.ts` | Non-exact scheme | ADR-04 |
| `hedera-harness.test.ts` | createClientHederaSigner | ADR-04 |
| `hedera-harness.test.ts` | createHederaClient | ADR-04 |
| `hedera-harness.test.ts` | inspectHederaTransaction | ADR-04, ADR-05 |
| `hedera-harness.test.ts` | createHederaSignAndSubmitTransaction | ADR-04 |
| `hedera-harness.test.ts` | Facilitator integration | ADR-04 |
| `hedera-harness.test.ts` | Zero amount | ADR-04 |
| `security-validation.test.ts` | T3-1 valid payment | INV-01, INV-02, ADR-10 |
| `security-validation.test.ts` | T3-2 BLOCK payTo | INV-01, INV-02 |
| `security-validation.test.ts` | T3-3 BLOCK amount | INV-01, INV-02 |
| `security-validation.test.ts` | T3-4 BLOCK asset | INV-01, INV-02 |
| `security-validation.test.ts` | T3-5 BLOCK network | INV-01, INV-02 |
| `security-validation.test.ts` | T3-6 HOLD unknown merchant | INV-02, INV-07 |
| `security-validation.test.ts` | T3-7 UNVERIFIABLE stale | INV-02, INV-11, INV-15 |
| `security-validation.test.ts` | T3-8 exception | INV-02, INV-16 |
| `security-validation.test.ts` | T3-9 redirect | INV-02, INV-06 |
| `security-validation.test.ts` | T3-10 malicious accepts | INV-02, INV-04 |
| `security-validation.test.ts` | T3-11 fabricated requirement | INV-02, INV-03, INV-04 |
| `security-validation.test.ts` | T3-12 retry fallback | INV-02 |
| `security-validation.test.ts` | T3-13 later-hook payTo | INV-01 (⚠️ gap) |
| `security-validation.test.ts` | T3-14 later-hook amount | INV-01 (⚠️ gap) |
| `security-validation.test.ts` | T3-15 later-hook asset | INV-01 (⚠️ gap) |
| `security-validation.test.ts` | T3-16 later-hook network | INV-01 (⚠️ gap) |
| `security-validation.test.ts` | T3-17 abort prevents later hooks | INV-02 |

---

## 5. Coverage Gaps

| Gap | Why | Phase |
|-----|-----|-------|
| Live Hedera testnet payment | No credentials | Spike 2 (blocked) |
| `@x402/fastify` direct dependency | Not installed | Phase 6 |
| Node 24.x runtime test | Tests on Node 26 | Spike 2 |
| Sepolia ENS on-chain verification | Local mock only | Spike 1 (blocked) |
| World ID OIDC integration | No credentials | Phase 5 |
| `RotationController` Foundry tests | Not yet implemented | Phase 4 |
| Fastify API routes | Not yet implemented | Phase 6 |
| Next.js frontend | Not yet implemented | Phase 7 |
| E2E T1–T16 suite | Components not integrated | Phase 8 |

---

## 6. Conclusion

**45/45 tests pass** across package validation, Hedera harness, and independent security validation. All 16 security invariants are either verified (INV-02 through INV-07, INV-11, INV-14, INV-15, INV-16) or planned for later phases (INV-08, INV-09, INV-10, INV-12, INV-13). INV-01 is partially verified — the guard blocks tampered payTo, but a later-hook SDK mutation gap (T3-13 through T3-16) means the zero-signer-call guarantee is conditional on hook registration order until Codex's `createFinalBoundary()` pattern is adopted.
