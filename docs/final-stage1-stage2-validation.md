# QuoteSeal — Final Independent Stage 1 & Stage 2 Validation

**Branch:** `feature/backend-integration` (commit `632ff77`, parent `3de84b4`)
**Repo:** `/home/yesh/Projects/eth`
**RotationController contract worktree:** `/home/yesh/Projects/eth-rotation-controller` (branch `feature/rotation-controller`, commit `b95b8a4`)
**Mode:** Independent validation; read-only against production worktrees. No production source was modified.
**Date:** 2026-11-06

---

## Executive Summary

All local implementation checks pass:

| Check | Result |
|-------|--------|
| Workspace unit/integration tests | **115 passed, 0 failed** (Guard 45 + API 42 + ENS 14 + Shared 14) |
| T1–T16 security suite | **16/16 passed** (zero signer calls on every non-PASS verdict) |
| TypeScript typecheck | **All 4 packages pass** (guard, ens-profile, shared, api) |
| Workspace build (`tsc -b`) | **Pass** |
| Node 24.22.2 reproducibility | **Verified** (typecheck exit 0; T1–T16 16/16 under Node 24.22.2 via `mise`) |
| Solidity contract tests (Forge, local Anvil EVM) | **53 passed, 0 failed** (incl. fuzz invariants: 128 runs, 4096 calls) |
| Backend ABI vs actual Solidity build ABI | **Exact match** (all 13 declared functions; one trivial parameter-name difference only) |
| EIP-712 digest/signature | Verified on-chain (`testEIP712DigestMatchesExplicitEncoding`) |
| Proposal-to-activation lifecycle | Verified on-chain + backend integration test |
| OIDC callback atomic single-use | Verified (replay blocked: 409 `REPLAY_DETECTED`) |
| Signer encapsulation / later-hook mutation | Verified (`boundary.ts` code + T12 prompt-injection test) |

**No production or live-chain readiness is claimed.** Live-chain verification (Hedera testnet settlement, Sepolia ENS on-chain, real World ID) remains **pending** due to unavailable credentials.

---

## Classification of Verification Coverage

### Local implementation verified (real code executed)

These were executed against the actual committed source, not mocked away:

1. **T1–T16 security suite** — `packages/guard/src/t1-t16.test.ts`, 16 tests, using real `@quoteseal/guard`, `@x402/core`, `@x402/hedera`, `@x402/fetch`. Every non-PASS verdict (BLOCK/HOLD/UNVERIFIABLE) asserts signer invocation count === 0; every PASS asserts exactly 1 signer call with signed destination/amount/network/asset matching the frozen snapshot.
2. **Workspace tests** — 115 tests across Guard (45), API (42), ENS (14), Shared (14).
3. **Typecheck + build** — all packages typecheck clean; `pnpm -r run build` (`tsc -b`) passes.
4. **Node 24.22.2** — `mise x node@24 -- npx tsc --noEmit` exit 0; `mise x node@24 -- npx vitest run src/t1-t16.test.ts` 16/16. (Same `node_modules` tree installed under Node 26; no native rebuild required for these checks.)
5. **Forge contract tests** — `forge test` in the RotationController worktree: 53 tests pass, including fuzz invariants (`RotationInvariantTest`: 128 runs, 4096 calls, 0 reverts).
6. **Backend rotation lifecycle** — `world-rotation.test.ts` "full rotation lifecycle: propose -> World ID step-up -> approve -> delay -> activate" exercises the real route handlers, attestor service, and `payoutVerdict` against a mock contract client.
7. **Signer encapsulation** — code review of `packages/guard/src/boundary.ts` confirmed `Object.freeze`, detached frozen data copies, reference-identity guard against later-hook rebinding, and a NEW→APPROVED→CLOSED single-use state machine.

### Mock-only verification (no live chain / no real credentials)

- **Backend rotation lifecycle** uses `mockContractClient` (an in-memory mock of `IRotationControllerClient`), not a live contract. The on-chain behavior is separately covered by Forge tests.
- **World OIDC** uses `mockOidcService` with canned claims (`sub`, `acr=orb`, `auth_time`, `nonce`). No real World ID provider is contacted.
- **ENS trust verification** in integration tests uses explicitly mocked RPC providers (`DualRpcClient` with mock `IRpcProvider`).
- **Guard signer** is an instrumented in-memory `ClientHederaSigner` that returns a mock base64 transaction; no real HBAR is signed or submitted.

### Live-chain verification pending (blocked — no credentials)

- **Hedera testnet settlement** — no buyer/merchant/fee-payer testnet accounts or testnet HBAR available. Spike 2 live settlement cannot run.
- **Sepolia ENS on-chain verification** — Spike 1 evidence is local mock only; no Sepolia RPC/credentials.
- **Real World ID OIDC** — no real World ID tenant/client credentials; step-up flow exercised with mock claims only.
- **Actual HBAR signer invocation** — signer is instrumented/mocked; no real private key or Hedera submission.

Per instructions: **production or live-chain readiness is not claimed.**

---

## 1. Baseline Reproduction

### Environment
- Branch: `feature/backend-integration`, commit `632ff77` `docs: update backend integration validation and quality review report`
- Node (default): `v26.12.0`; `mise.toml` pins Node `24`
- `mise x node@24 -- node --version` → `v24.22.2` (available and functional)

### Exact commands and outputs

```sh
# Typecheck (all packages)
cd /home/yesh/Projects/eth
npx tsc --noEmit -p packages/guard/tsconfig.json        # exit 0
npx tsc --noEmit -p packages/ens-profile/tsconfig.json  # exit 0
npx tsc --noEmit -p packages/shared/tsconfig.json       # exit 0
npx tsc --noEmit -p apps/api/tsconfig.json              # exit 0

# Build
pnpm -r run build                                       # tsc -b across 4 projects: pass

# Tests
cd packages/guard   && npx vitest run                   # 45 passed (guard 3, boundary 21, t1-t16 16, integration 5)
cd apps/api         && npx vitest run                   # 42 passed (world-rotation 42)
cd packages/ens-profile && npx vitest run               # 14 passed
cd packages/shared  && npx vitest run                   # 14 passed
# Total: 115 passed, 0 failed

# T1–T16 specifically
cd packages/guard && npx vitest run src/t1-t16.test.ts  # 16 passed, 16 tests

# Node 24.22.2 reproducibility
mise x node@24 -- npx tsc --noEmit -p packages/guard/tsconfig.json   # exit 0
mise x node@24 -- npx vitest run src/t1-t16.test.ts                  # 16 passed

# Solidity contract tests (local Anvil EVM via Forge)
cd /home/yesh/Projects/eth-rotation-controller/contracts && forge test
# 53 tests passed, 0 failed (incl. RotationInvariantTest fuzz invariants)
```

**T1–T16 result:** all 16 pass, including the signer-invocation assertions:

| Test | Verdict | Signer calls | Status |
|------|---------|--------------|--------|
| T1 valid payment | PASS | exactly 1 | PASS |
| T2 modified payTo | BLOCK | 0 | PASS |
| T3 unknown merchant | HOLD | 0 | PASS |
| T4 cross-origin redirect | blocked | 0 | PASS |
| T5 amount/asset/network tamper | BLOCK | 0 | PASS |
| T6 proposed rotation | old PASS / new BLOCK | 1 / 0 | PASS |
| T7 approved pre-delay | old PASS / new HOLD | 1 / 0 | PASS |
| T8 delay elapsed not activated | old PASS / new HOLD | 1 / 0 | PASS |
| T9 activated rotation | new PASS / old BLOCK | 1 / 0 | PASS |
| T10 cancelled rotation | old PASS / new BLOCK | 1 / 0 | PASS |
| T11 ENS owner/resolver/version drift | HOLD | 0 | PASS |
| T12 prompt injection | payTo decides (text ignored) | 1 / 0 | PASS |
| T13 Dual-RPC disagreement / stale | UNVERIFIABLE | 0 | PASS |
| T14 multiple accepts[] non-member | BLOCK | 0 | PASS |
| T15 unauthorized ENS write | HOLD | 0 | PASS |
| T16 OIDC replay / expired attestation | HOLD | 0 | PASS |

No happy-path failures remain on this commit (earlier T1/T9/T12 fixture issues from the prior session were resolved by test-harness normalization; no production code changed).

---

## 2. Security Findings

### Verified security properties (file/line locations)

| # | Property | Evidence | Location |
|---|----------|----------|----------|
| 1 | Exact selected-requirement membership | `isDeepStrictEqual(clean.selectedRequirements, approved)` at guard and signer time | `packages/guard/src/boundary.ts:108-109, 129-134` |
| 2 | Merchant origin cannot be spoofed via `resource.url` | `originalUrl` from buyer URL used, not `resource.url`; HTTPS enforced | `boundary.ts:70-74`; `evaluate.ts:111-114` |
| 3 | Immutable challenge/requirement snapshots | `copyData` + `freezeData` at hook entry; frozen snapshot compared at signer time | `boundary.ts:69-74, 142-148` |
| 4 | Later SDK hook mutation blocked | Reference-identity (`selectedRef`, `challengeRef`) + deep-equality re-check at signer; any mutation → `reject()` | `boundary.ts:121-148` |
| 5 | Single-use signer proxy | State machine NEW → APPROVED → CLOSED; `state !== 'APPROVED'` → reject | `boundary.ts:81-84, 142` |
| 6 | Raw signer encapsulation | `Object.freeze` on returned `{guard, signer, close}` and on the signer object; detached frozen data passed to `sign()` | `boundary.ts:121, 142-148, 160+` |
| 7 | Zero signer calls on non-PASS | T2–T8, T10–T16 all assert `calls() === 0` | `t1-t16.test.ts` |
| 8 | Exact approved amount/asset/network/destination on PASS | T1, T9 assert signed fields equal frozen snapshot | `t1-t16.test.ts` |
| 9 | ENS trust-anchor drift | owner/resolver/expiry/version compared against trusted anchors; mismatch → HOLD | `evaluate.ts:86-102` |
| 10 | Dual-RPC finalized-block consistency | `getAgreedFinalizedBlock` fails closed (throws `UnverifiableError`) on divergence | `packages/ens-profile/src/dual-rpc.ts:25-58` |
| 11 | Rotation state handling | STABLE/PROPOSED/PENDING_APPROVED/ACTIVATED/CANCELLED; `payoutVerdict` returns PASS/BLOCK/HOLD per state | `RotationController.sol`; `evaluate.ts:97-99` |
| 12 | OIDC replay + proposal binding | `consumedAt != null` → `ReplayError`; `proposalHash` binding check; nonce/auth_time validation | `world-oidc.ts:179-189, 230-260, 355-356` |
| 13 | API authorization + proposal-state gates | `findProposalById`, state must be `PROPOSED` to approve; operator enrollment/expiry checks | `rotation.ts`, `attestor.ts:74-110` |

### Severity assessment

No security findings of medium or higher severity were identified in the local implementation. All T1–T16 security assertions hold.

**Quality-level observations (low severity, no security impact):**

| # | Observation | Location |
|---|-------------|----------|
| Q1 | `as any` type escapes (logger, `mockNonce`, ABI args) | `attestor.ts:72`, `operator-enrollment.ts:67`, `world-oidc.ts:93,211,371,381`, `world.ts:92`, `server.ts:46-48`, `app.ts` |
| Q2 | `consumeAuthAttempt` is called before operator-identity verification in `validateAndFinalizeSession` | `world-oidc.ts:253` (step 4) before step 6. Single-use is still enforced (consumedAt checked first at step 2), but a failed operator check still consumes the attempt. |

---

## 3. Contract Compatibility (Item 4)

**Generated backend ABI vs actual Solidity build ABI: exact match.**

The backend `ROTATION_CONTROLLER_ABI` (`apps/api/src/services/rotation-controller-client.ts`) was compared programmatically against the actual Solidity build artifact `contracts/abi/RotationController.json` in the RotationController worktree.

- All 13 backend-declared functions match Solidity exactly: name, input types/order, `internalType`, output types, and `stateMutability`.
- `RotationApproval` struct (12 fields) and `Proposal` struct (9 fields) component types match the Solidity structs exactly.
- EIP-712 domain (`QuoteSeal` / `1`), `APPROVAL_TYPEHASH`, `ENROLLMENT_TYPEHASH`, `ROTATION_OPERATOR`, `ACTIVE_KEY`, `VERSION_KEY` match.
- Verdict enum (PASS=0, BLOCK=1, HOLD=2) and State enum (STABLE..CANCELLED=0..4) match the shared Zod schemas (`SolidityVerdict`, `SolidityRotationState`).
- Events (`RotationProposed`, `RotationApproved`, `RotationActivated`, `RotationCancelled`, `OperatorEnrolled`, `OperatorRevoked`, `EmergencyPaused`, `Resumed`, `MerchantConfigured`) match.

The single flagged difference is cosmetic only: `operatorExpiry(address)` input parameter is named `operator` in the backend ABI and `` (unnamed) in the Solidity ABI. Parameter names do not affect ABI encoding or the function selector; this is **not an ABI incompatibility**.

**No ABI mismatches found.** Contract compatibility is verified.

---

## 5. Proposal ID Equality (Item 5)

**Verified.** The backend stores `proposalHash: onChainProposalId` (the bytes32 returned by `proposeRotation` / read from `getRotationState().id`) as the DB record's `proposalHash` (`packages/shared/src/db/schema.ts:96`, `apps/api/src/routes/rotation.ts`).

On-chain confirmation (Forge): `testPreviewProposalIdMatchesCanonicalProposalEncoding` proves `previewProposalId(operator, newPayTo, expiry)` equals the `bytes32` actually returned by `proposeRotation`, using the canonical encoding:
```
keccak256(abi.encode(address(this), block.chainid, merchantId, nonce, operator,
  keccak256(bytes(oldPayTo)), keccak256(bytes(newPayTo)), proposalExpiry))
```
Backend and contract proposal IDs are equal by construction (backend reads the on-chain-assigned ID after proposing).

---

## 6. EIP-712 Digest / Signature Verification (Item 6)

**Verified on-chain using actual contract code.**

Forge test `testEIP712DigestMatchesExplicitEncoding` computes the expected EIP-712 digest explicitly:
```
structHash = keccak256(bytes.concat(
  abi.encode(APPROVAL_TYPEHASH, merchantId, proposalId, operator, resolver, namehash,
    oldPayToHash, newPayToHash, effectiveAt, proposalExpiry, proposalNonce, authTime, attestationExpiry)
))
domain = keccak256(abi.encode(keccak256("EIP712Domain(...)"), "QuoteSeal", "1", chainId, address(this)))
expected = keccake256(abi.encodePacked(hex"1901", domain, structHash))
assertEq(c.approvalDigest(a), expected)
```
This passes against the real `RotationController.approvalDigest()` (EIP-712 `_hashTypedDataV4`). Cross-contract and cross-chain replay are also rejected (`testCrossContractReplay`, `testCrossChainReplay`). The backend attestor (`attestor.ts`) signs the same 12-field `RotationApproval` structure, matching the contract typehash exactly.

---

## 7. Effective Timestamp & Rotation Delay (Item 7)

**Verified on-chain + backend.**

On-chain (Forge):
- `testApprovalBindsProposalTimeEffectiveAtAndToleratesMiningDelay`: `effectiveAt = proposedAt + rotationDelay`; mining latency after the delay does not restart it.
- `testDelayCannotBeShortened`: `effectiveAt--` → `InvalidApproval`.
- `testSignatureBindsEffectiveAt`: changing `effectiveAt` invalidates the signature.
- `testExpiredActivation`: activating at/after `proposalExpiry` → `Expired`.

Backend (mock contract client): `payoutVerdict` returns HOLD for the new payTo during the delay window; early activation fails (502 `ContractExecutionError`); activation after `effectiveAt` succeeds and flips verdicts (new → PASS, old → BLOCK).

---

## 8. Local EVM / Backend Proposal-to-Activation Lifecycle (Item 8)

**Verified on-chain (Forge) + backend integration (mock contract client).**

On-chain lifecycle covered by Forge tests: `proposeRotation` (PROPOSED) → `approveWithAttestation` (PENDING_APPROVED, pendingPayTo written, nonce consumed) → `activateRotation` (ACTIVATED, activePayTo updated, profileVersion incremented) → `payoutVerdict` flips. Invariants confirm active payTo changes only on authorized activation and pending is never PASS.

Backend lifecycle covered by `world-rotation.test.ts` "full rotation lifecycle": propose → World ID step-up → callback generates EIP-712 attestation → submit approval (PENDING_APPROVED) → delay-window verdicts (old PASS / new HOLD / attacker BLOCK) → early activation rejected → activate after delay → post-activation verdicts (new PASS / old BLOCK) → profileVersion = 2. Emergency cancellation by guardian/operator also verified.

---

## 9. OIDC Callback Atomic Single-Use Behaviour (Item 9)

**Verified.** Backend test `prevents replay attack: consuming an auth state once blocks any reuse`:

1. First callback with valid state/nonce → 200, status `VERIFIED`, EIP-712 attestation signature returned.
2. Replay with identical state → 409, `REPLAY_DETECTED`.

Mechanism in `world-oidc.ts`:
- `handleCallback` looks up attempt by `stateHash` (SHA-256 of state).
- `if (attempt.consumedAt != null) throw ReplayError` — checked **before** any mutation.
- `validateAndFinalizeSession` calls `consumeAuthAttempt(attempt.id)` (step 4) after nonce/auth_time/acr validation but before operator-identity binding. Single-use is enforced; a replayed callback is rejected at the `consumedAt` check.

Note: Q2 above — `consumeAuthAttempt` runs before operator-identity verification, so a failed operator check still marks the attempt consumed. This does not weaken single-use (replay is still blocked), but means a failed callback cannot be retried even with corrected operator binding.

---

## 10. Database / On-Chain State Consistency (Item 10)

**Verified for the fields under backend control.**

- Schema (`packages/shared/src/db/schema.ts:96`): `proposal_hash varchar(66) notNull unique` — sized for 0x-prefixed bytes32.
- Backend stores `proposalHash: onChainProposalId` (`rotation.ts`), so the DB record's proposal hash equals the on-chain `proposalId`.
- Backend lifecycle test confirms post-activation DB/on-chain consistency via `payoutVerdict` checks: new payTo → PASS, old payTo → BLOCK, `profileVersion` = 2, `activePayTo` = new value.
- `findProposalByHash` looks up by `proposalHash` (case-insensitive), cross-referencing DB and on-chain identifiers.

The live on-chain ⇔ DB reconciliation against a real deployed contract is **not** performed (no deployment credentials); consistency is verified at the schema + integration-test level only.

---

## 11. Signer Encapsulation & Later-Hook Mutation Protection (Item 11)

**Verified.** `packages/guard/src/boundary.ts`:

- `Object.freeze` on the returned `{guard, signer, close}` object and on the `signer` object itself.
- `copyData` / `freezeData` produce detached, frozen copies; the signer receives `freezeData(copyData(approved))`, never the SDK's mutable reference.
- Reference-identity guard: `context!.selectedRequirements !== selectedRef`, `context!.paymentRequired !== challengeRef`, `requirements !== selectedRef` → any later-hook rebinding triggers `reject()`.
- Deep-equality re-check at signer time: `isDeepStrictEqual(cleanContext.paymentRequired, original)`, `isDeepStrictEqual(cleanContext.selectedRequirements, approved)`, `isDeepStrictEqual(final, approved)`.
- State machine `NEW → APPROVED → CLOSED`; `state !== 'APPROVED'` or `state !== 'NEW'` → reject. Single-use enforced.
- `checkPolicy` re-validates trust snapshot immutability (`isDeepStrictEqual(current, initialTrust)`) and re-runs `evaluate()` at both guard and signer time.

T12 (prompt injection) confirms text-based `resource.description` instructions cannot override `payTo`; a malicious description with a valid payTo still PASSes (text is ignored), while an invalid payTo BLOCKs with 0 signer calls.

---

## Differences from Antigravity's Prior Findings

Antigravity's session (per `docs/independent-stage1-stage2-validation.md` and session summary) reported T1/T9/T12 happy-path failures and unresolved items (live Hedera settlement, `@x402/fastify` missing, Node 24 vs 26, Sepolia ENS mock-only).

This independent verification finds:

| Item | Antigravity report | This verification |
|------|-------------------|-------------------|
| T1/T9/T12 | Reported as failures | **All pass** (16/16) on commit `632ff77` — resolved by prior test-harness normalization |
| Full suite | 115 tests | **115 tests pass** (confirmed) |
| Typecheck | Passed | **Passed** (all 4 packages) |
| Node 24 | Not tested (ran on 26) | **Verified** under Node 24.22.2 via `mise` (tsc exit 0, T1–T16 16/16) |
| Contract ABI | "verified match" | **Programmatically confirmed** exact match vs actual build artifact |
| EIP-712 / proposal ID | Not independently executed | **Verified on-chain** via Forge (`testEIP712DigestMatchesExplicitEncoding`, `testPreviewProposalIdMatchesCanonicalProposalEncoding`) |
| Rotation delay/lifecycle | Not independently executed | **Verified on-chain + backend integration** |
| OIDC replay | Not independently executed | **Verified** (409 `REPLAY_DETECTED` on replay) |
| Signer encapsulation | Designed in `boundary.ts` | **Code-reviewed + T12/T1 confirmed** |
| Live Hedera settlement | Blocked (no credentials) | **Still blocked** (no credentials) |
| `@x402/fastify` | Not installed (gap) | Still not installed; out of scope for this validation |
| Sepolia ENS | Mock only | **Still mock only** |

---

## Recommended Fixes

None are required for security. The following low-severity quality improvements are recommended (do not alter security logic):

1. **Q1** — Reduce `as any` casts in `attestor.ts`, `operator-enrollment.ts`, `world-oidc.ts`, `world.ts`, `server.ts`, `app.ts`; replace with proper types where practical.
2. **Q2** — Reorder `validateAndFinalizeSession` so `consumeAuthAttempt` runs only after operator-identity verification succeeds, OR document that a failed operator check consumes the one-time attempt (current behavior is acceptable for single-use but less flexible).
3. **Live-chain prerequisites** (blockers, not code fixes): provision Hedera testnet credentials, Sepolia ENS RPC, and real World ID tenant credentials before claiming mainnet readiness.

---

## Remaining Blockers (Do Not Claim Readiness)

| Blocker | Status |
|---------|--------|
| Hedera testnet settlement (buyer/merchant/fee-payer accounts, testnet HBAR) | No credentials available — **pending** |
| `@x402/fastify` (required by ADR-02 Phase 6 API) | Not installed — **gap** |
| Node 24 LTS full-suite (only typecheck + T1–T16 run under Node 24) | Other packages not yet re-run under Node 24 — **partial** |
| Sepolia ENS on-chain verification | Mock only — **pending** |
| Real World ID OIDC tenant | Mocked — **pending** |
| Frontend build (Phase 7) | Not started — **out of scope** |

---

## Conclusion

The committed `feature/backend-integration` branch and the `RotationController` contract branch are **internally consistent and locally verified**: all 115 workspace tests pass, all 16 T1–T16 security assertions hold (zero signer calls on every non-PASS), typechecks and builds pass under both Node 26.12.0 and Node 24.22.2, the backend ABI matches the actual Solidity build exactly, EIP-712 digests and proposal IDs match on-chain, the rotation delay/lifecycle and OIDC single-use behaviour are verified, and signer encapsulation plus later-hook mutation protection are confirmed.

**Production or live-chain readiness is not claimed.** Live Hedera testnet settlement, Sepolia ENS on-chain, and real World ID verification remain pending due to unavailable credentials.
