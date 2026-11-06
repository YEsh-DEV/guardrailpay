# QuoteSeal Cross-Branch Integration Validation & Stabilisation Results

**Date:** 2026-11-06  
**Node.js Runtime:** v24.22.2 (Node 24 LTS)  
**Package Manager:** pnpm 12.18.0  
**Branch:** `feature/backend-integration`  
**Base Commit:** `1d47004`  
**Worktrees inspected:**  
- `eth` (`feature/backend-integration`)
- `eth-rotation-controller` (`feature/rotation-controller` — strictly read-only, untouched)
- `eth-world-rotation` (`feature/world-rotation-backend` — commit `7417390` merged)
- `eth-signer-boundary` (`fix/x402-signer-boundary` — commit `e4f2454` cherry-picked)

---

## 1. Test Execution Summary

**Result: 115 / 115 tests passing across all workspace packages.**

| Package | Test Framework | Test Files | Tests | Passed | Failed | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `@quoteseal/shared` | vitest | 1 | 14 | 14 | 0 | **PASS** |
| `@quoteseal/ens-profile` | vitest | 1 | 14 | 14 | 0 | **PASS** |
| `@quoteseal/guard` | vitest | 4 | 45 | 45 | 0 | **PASS** |
| `apps/api` | vitest | 3 | 42 | 42 | 0 | **PASS** |
| **Total** | | **9** | **115** | **115** | **0** | **PASS** |

### Breakdown by File
- **`packages/shared/src/shared.test.ts` (14 tests):** Error hierarchy, config validation, secret redaction, 1:1 Solidity State/Verdict enum mappings, off-chain UNVERIFIABLE isolation, and 12-field `RotationApprovalDataSchema` coercion.
- **`packages/ens-profile/src/ens-profile.test.ts` (14 tests):** DualRpcClient consensus and lag detection, `quoteseal.profileVersion` prioritized over legacy `quoteseal.version`, fallback resolution, text record `'pending'` normalization, and pure logic trust anchor verification.
- **`packages/guard/src/guard.test.ts` (3 tests):** Core guard engine baseline.
- **`packages/guard/src/boundary.test.ts` (21 tests):** Deep copy isolation, TOCTOU attack rejection, single-use signer proxy authorization, and rejection of mutated payment requirements.
- **`packages/guard/src/integration.test.ts` (5 tests):** End-to-end integration flow, resolution of contract version keys, state machine progression, off-chain verdict semantics, and regression test proving profile-version change blocks signing until re-anchored.
- **`packages/guard/src/t1-t16.test.ts` (16 tests):** Comprehensive security test vectors (T1–T16) covering prompt injection, cross-origin tampering, and parameter mutations.
- **`apps/api/src/api.test.ts` (11 tests):** Merchant profile API, trust anchors API, health/readiness endpoints.
- **`apps/api/src/world-rotation.test.ts` (19 tests):** World ID OIDC step-up authorization, PKCE verification, anti-replay, session binding to proposal hash, EIP-712 attestation signing, and full rotation lifecycle.
- **`apps/api/src/backend-integration.test.ts` (12 tests):** The 12 core end-to-end integration scenarios connecting real Fastify routes, Drizzle DB store, ENS resolver, World OIDC service, and x402 guard boundary.

### Typecheck & Build
All workspace projects build cleanly via TypeScript strict mode:
```bash
pnpm -r run build
# Scope: 4 of 5 workspace projects
# $ tsc -b (@quoteseal/shared) -> SUCCESS
# $ tsc -b (@quoteseal/ens-profile) -> SUCCESS
# $ tsc -b (@quoteseal/guard) -> SUCCESS
# $ tsc -b (@quoteseal/api) -> SUCCESS
```

---

## 2. Integration Findings & Resolutions

### Finding 1 — ENS Record Key Support (`quoteseal.profileVersion`)
- **Issue:** Solidity contract `RotationController.sol` writes `VERSION_KEY = "quoteseal.profileVersion"`, while the initial resolver only read `quoteseal.version`.
- **Resolution:** Updated `packages/ens-profile/src/resolver.ts` to request and prioritize `quoteseal.profileVersion` directly from on-chain text records, with fallback to `quoteseal.version` only for legacy/unmigrated records.
- **Regression Test Evidence:** Verified in `packages/ens-profile/src/ens-profile.test.ts` and `packages/guard/src/integration.test.ts`. An on-chain version bump triggers `ANCHOR_VERSION_MISMATCH`, produces a `HOLD` verdict, and strictly blocks the buyer's pre-signing boundary until the buyer explicitly re-anchors.

### Finding 2 — RotationState Enum Alignment & Mapping
- **Issue:** Backend Zod schema previously included non-contract states (`APPROVED`, `PAUSED`).
- **Resolution:** In `packages/shared/src/types/index.ts`, `RotationStateSchema` was replaced with `OnChainRotationStateSchema` matching `RotationController.sol` 1:1:
  `['STABLE', 'PROPOSED', 'PENDING_APPROVED', 'ACTIVATED', 'CANCELLED']`.
- **Bidirectional Mappings Added:**
  - `toRotationState(index: number): RotationState` maps Solidity enum integers `0..4` to canonical states.
  - `toSolidityStateIndex(state: RotationState | string): number` maps string states back to Solidity integers `0..4`.
  - `normalizeRotationState(state: string): RotationState` normalizes text records and workflow aliases (e.g. `'pending'` written by the contract -> `'PENDING_APPROVED'`).

### Finding 3 — Verdict Enum & Off-Chain Isolation
- **Issue:** Solidity contract `RotationController.sol` defines only `enum Verdict { PASS, BLOCK, HOLD }` (0, 1, 2). `UNVERIFIABLE` was in danger of being forced onto the contract.
- **Resolution:**
  - `OnChainVerdictSchema` strictly enforces `['PASS', 'BLOCK', 'HOLD']` (1:1 with Solidity).
  - `VerdictSchema` retains `UNVERIFIABLE` strictly as an off-chain client verdict (for Dual-RPC divergence, RPC transport errors, or unresolvable merchant profiles).
  - Explicit mapping functions `toOnChainVerdict` and `toSolidityVerdictIndex` throw if `UNVERIFIABLE` is passed to on-chain conversion.

### Finding 4 — Removal of `as any` Cast in Rotation Route
- **Issue:** `apps/api/src/routes/rotation.ts:254` previously cast `approvalData as any` before submitting to `approveWithAttestation()`.
- **Resolution:** Created `RotationApprovalDataSchema` in `@quoteseal/shared` validating all 12 EIP-712 fields with strict 32-byte hex hashes, 20-byte addresses, and bigints. `SubmitApprovalSchema` enforces `approvalData: RotationApprovalDataSchema`, eliminating the `as any` cast completely.

### Finding 5 — World Rotation Integration Documentation Corrected
- **Issue:** `docs/world-rotation-integration.md` section 3.3 previously showed an outdated 4-field `RotationApproval` struct and referenced `approveRotation()`.
- **Resolution:** Updated `docs/world-rotation-integration.md` to document the exact 12-field `RotationApproval` struct and changed the function call reference to `RotationController.approveWithAttestation()`.

---

## 3. Security Integration Audit

| Security Property | Implementation Details | Verification Status |
| :--- | :--- | :---: |
| **Immutable Snapshots** | `boundary.ts` deep-copies and deep-freezes (`freezeData(copyData(challenge))`) challenge and selected requirements. | ✅ Verified by `boundary.test.ts` |
| **Private Raw Signer** | `rawSigner` is captured only in closure. Neither `createFinalBoundary` nor `createPaymentAttempt` exports the signer or its credentials. | ✅ Verified by audit & tests |
| **One-Time Signing** | Signer proxy transitions state `NEW -> APPROVED -> CLOSED`. Subsequent calls find `CLOSED` and throw `QUOTESEAL_REJECTED`. | ✅ Verified by `boundary.test.ts` |
| **Non-PASS Verdict Gate** | If guard evaluation produces `BLOCK`, `HOLD`, or `UNVERIFIABLE`, `allowedSignerInvocation` is `false`, `boundary.close()` fires, and signer throws immediately. | ✅ Verified by `guard.test.ts` & `t1-t16.test.ts` |
| **Exact Selection** | Guard evaluates `input.selectedIndex` against the exact matched requirement, never defaulting to an arbitrary `accepts[0]`. | ✅ Verified by `boundary.test.ts` & `t1-t16.test.ts` |

---

## 4. Solidity Contract ABI Compatibility

Inspection of `/home/yesh/Projects/eth-rotation-controller/contracts/src/RotationController.sol` confirms `apps/api/src/services/rotation-controller-client.ts` is 100% aligned with the live contract ABI:

| Contract Function / Property | Solidity Definition | `ROTATION_CONTROLLER_ABI` Match |
| :--- | :--- | :---: |
| `proposeRotation` | `proposeRotation(string, uint64) returns (bytes32)` | ✅ Exact match |
| `approveWithAttestation` | `approveWithAttestation(RotationApproval, bytes)` | ✅ Exact match (12-field tuple) |
| `activateRotation` | `activateRotation(bytes32)` | ✅ Exact match |
| `cancelPendingRotation` | `cancelPendingRotation(bytes32, bytes32)` | ✅ Exact match |
| `enrollOperator` | `enrollOperator(Enrollment, bytes)` | ✅ Exact match (6-field tuple) |
| `revokeOperator` | `revokeOperator(address)` | ✅ Exact match |
| `getRotationState` | `getRotationState() view returns (Proposal)` | ✅ Exact match (9-field tuple) |
| `payoutVerdict` | `payoutVerdict(string) view returns (Verdict)` | ✅ Exact match (`uint8` enum) |
| `activePayTo` | `activePayTo() view returns (string)` | ✅ Exact match |
| `pendingPayTo` | `pendingPayTo() view returns (string)` | ✅ Exact match |
| `profileVersion` | `profileVersion() view returns (uint256)` | ✅ Exact match |
| `paused` | `paused() view returns (bool)` | ✅ Exact match |
| `operatorExpiry` | `operatorExpiry(address) view returns (uint64)` | ✅ Exact match |

---

## 5. Unresolved External & Live-Chain Blockers

> [!IMPORTANT]
> All unit, integration, and mock tests pass. No live-chain verification is claimed from mocks. The following external prerequisites remain before live testnet deployment:

1. **Hedera Testnet Credentials:** Live execution of Hedera x402 settlement requires funded Hedera testnet accounts (buyer account ID/private key, merchant payout account ID, fee payer key). No credentials have been fabricated.
2. **Sepolia Live-Chain Contract Deployment:** Live on-chain verification requires deploying `RotationController.sol` and the ENS Permissioned Resolver to Sepolia testnet to verify live role bitmasks and subname ownership.
3. **`@x402/fastify` Dependency:** ADR-02 specifies `@x402/fastify` for Phase 6 merchant API settlement routes. To be installed prior to Phase 6 deployment.
