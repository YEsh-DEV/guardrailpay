# QuoteSeal Cross-Branch Integration Validation & Stabilisation Results

**Date:** 2026-11-06  
**Node.js Runtime:** v24.22.2 (Node 24 LTS)  
**Package Manager:** pnpm 12.18.0  
**Branch:** `feature/backend-integration`  
**Current HEAD Commit:** `3de84b4`  
**Base Commit:** `1d47004`  
**Worktrees Inspected:**  
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

### Breakdown by Test Suite
- **`packages/shared/src/shared.test.ts` (14 tests):** Error hierarchy (`ValidationError`, `SecurityHoldError`, `SecurityBlockError`, `UnverifiableError`), config parsing and validation, secret redaction, 1:1 Solidity State/Verdict enum mappings, off-chain `UNVERIFIABLE` isolation, and 12-field `RotationApprovalDataSchema` validation and bigint coercion.
- **`packages/ens-profile/src/ens-profile.test.ts` (14 tests):** `DualRpcClient` consensus and block lag detection, `quoteseal.profileVersion` prioritized over legacy `quoteseal.version`, fallback resolution, text record `'pending'` normalization to `PENDING_APPROVED`, and pure logic trust anchor verification.
- **`packages/guard/src/guard.test.ts` (3 tests):** Core guard engine evaluation baseline and verdict handling.
- **`packages/guard/src/boundary.test.ts` (21 tests):** Deep copy isolation, TOCTOU attack rejection, single-use signer proxy authorization (`NEW -> APPROVED -> CLOSED`), and rejection of mutated payment requirements.
- **`packages/guard/src/integration.test.ts` (5 tests):** End-to-end integration flow, resolution of contract version keys, state machine progression, off-chain verdict semantics, and regression test proving profile-version change blocks signing until re-anchored.
- **`packages/guard/src/t1-t16.test.ts` (16 tests):** Comprehensive security test vectors (T1–T16) covering basic payments, rotation states, prompt injection, cross-origin tampering, Dual-RPC divergence, and parameter mutations.
- **`apps/api/src/api.test.ts` (11 tests):** Merchant profile API, trust anchors API, health and readiness endpoints.
- **`apps/api/src/world-rotation.test.ts` (19 tests):** World ID OIDC step-up authorization, PKCE verification, anti-replay, session binding to proposal hash, EIP-712 attestation signing, and full rotation lifecycle.
- **`apps/api/src/backend-integration.test.ts` (12 tests):** The 12 core end-to-end integration scenarios connecting real Fastify routes, Drizzle DB store, ENS resolver, World OIDC service, and x402 guard boundary.

---

## 2. Section B Investigation: T1, T9, and T12 Root Cause Analysis

### Background
During initial verification runs of the 16-test security suite (`packages/guard/src/t1-t16.test.ts`), T1, T9, and T12 were reported as failing on strict deep-equality assertions or throwing `SecurityHoldError` (`QUOTESEAL_REJECTED`) when `createPaymentAttempt` was invoked.

### Investigation Methodology (Ponytail Protocol)
Before modifying any production code, a rigorous investigation was conducted:
1. Compared the original x402 payment challenge, selected requirement, canonical snapshot, and test fixtures.
2. Inspected object normalisation, property presence, numeric/bigint representations, and nested fields.
3. Verified whether the discrepancy originated in the production boundary implementation (`copyData`, `freezeData`, `isDeepStrictEqual`) or test fixture generation.

### Root Cause
1. **Ambiguous `undefined` Handling in Test Helper:**
   In `packages/guard/src/t1-t16.test.ts`, the `trustSnapshot()` helper function previously contained:
   ```typescript
   if (overrides.profile === undefined) profile = undefined;
   ```
   When `trustSnapshot({})` or `trustSnapshot()` was called with an empty object or omitted arguments, `overrides.profile` evaluated to `undefined`. This inadvertently assigned `profile = undefined` to the snapshot, discarding the default valid merchant profile.
   Consequently, the guard engine's trust evaluation perceived the merchant profile as missing/unresolvable, returned a `HOLD` verdict, and triggered `SecurityHoldError: QUOTESEAL_REJECTED`. This blocked the single-use raw signer proxy before execution in T1 and T9, causing assertion failures.
2. **Hedera Test Fixture Extra Fields:**
   In `packages/guard/src/integration.test.ts`, Hedera test requirements required `extra: { feePayer: '0.0.98' }` to satisfy the strict `ExactHederaPaymentRequirementsSchema`.
3. **Prompt Injection Test Verification (T12):**
   In T12, prompt injection text in the description field was confirmed to be completely ignored by the guard engine, as payment authorization is strictly determined by canonical on-chain `payTo` address and trust anchor hashes, not free-text instructions.

### Resolution & Security Invariants
- The test helper was updated surgically to check property presence:
  ```typescript
  const profile = 'profile' in overrides ? overrides.profile : { ...baseProfile };
  ```
- **Strict Invariants Preserved:**
  - Deep equality (`copyData`, `freezeData`, `isDeepStrictEqual`) was **NEVER weakened**.
  - Object freezing (`Object.freeze`) on challenges and snapshots was **retained 100%**.
  - Permissive comparisons or loose equality checks were **NOT introduced**.
  - Single-use signing authorization (`NEW -> APPROVED -> CLOSED`) was strictly preserved.
  - In all non-PASS outcomes (`BLOCK`, `HOLD`, `UNVERIFIABLE`), raw signer calls were verified to be **strictly 0**.

---

## 3. Comprehensive Backend Quality Review

A systematic code quality, architectural integrity, and security review was conducted across all 4 integrated packages (`apps/api`, `packages/shared`, `packages/ens-profile`, and `packages/guard`).

### Summary Classification

| Severity | Count | Status | Description |
| :---: | :---: | :---: | :--- |
| **Critical** | 0 | None | No security vulnerabilities, credential leaks, or guard bypasses detected. |
| **High** | 0 | Resolved | All enum/struct/key mismatches between TypeScript and Solidity resolved in `3de84b4`. |
| **Medium** | 2 | Documented | Production hardening recommendations for multi-instance DB concurrency & idempotency. |
| **Low** | 2 | Documented | Minor deprecation notice and test environment configuration hardening. |

---

### Detailed Findings

#### Finding Q-01 (Medium): Database Race Condition on World OIDC State Consumption
- **Location:** `apps/api/src/services/world-oidc.ts:277` (`consumeAuthAttempt`)
- **Description:** The function reads an authorization attempt and subsequently updates `consumedAt = new Date()`. In a horizontally scaled, multi-instance deployment with concurrent callback submissions, two simultaneous requests with the same state could theoretically read the unconsumed record concurrently.
- **Impact:** In the current single-instance deployment and test environment, this is benign. For multi-instance production workloads, an atomic `UPDATE auth_attempts SET consumed_at = NOW() WHERE state = $1 AND consumed_at IS NULL` or serializable database transaction should be used to guarantee single-winner execution.
- **Status:** Documented for production clustering hardening.

#### Finding Q-02 (Medium): Idempotency on Rotation Activation Endpoint
- **Location:** `apps/api/src/routes/rotation.ts:285` (`POST /v1/merchants/:ensName/proposals/:proposalId/activate`)
- **Description:** When `activateRotation` is called repeatedly for an already-activated proposal, the endpoint returns HTTP `409 INVALID_PROPOSAL_STATE` with message `"Contract state is not PENDING_APPROVED for this proposalId"`.
- **Impact:** In standard distributed RESTful architectures, repeating an activation request that has already succeeded should ideally be idempotent (returning `200 OK` with the current `ACTIVATED` status) to avoid treating network retries as client errors.
- **Status:** Documented for Phase 6 client retry alignment.

#### Finding Q-03 (Low): Fastify Request Logging Deprecation Notice
- **Location:** `apps/api/src/server.ts` (`disableRequestLogging`)
- **Description:** Fastify 5 emits a deprecation warning: `[FSTDEP023] FastifyDeprecation: disableRequestLogging option is deprecated. Use the logController option with disableRequestLogging or isLogDisabled override instead. The disableRequestLogging top-level option will be removed in fastify@6.`
- **Impact:** Informational deprecation notice. No functional or security impact on Node 24 / Fastify 5.
- **Status:** Modernization planned prior to Fastify 6 upgrade.

#### Finding Q-04 (Low): Attestor Key Configuration in Test Environments
- **Location:** `apps/api/src/config/index.ts`
- **Description:** The attestor service defaults to a hardcoded development private key if `ATTESTOR_PRIVATE_KEY` is not provided in environment variables.
- **Impact:** Convenient for unit and integration tests, but must never be deployed to production. Production deployments must strictly enforce loading keys from AWS Secrets Manager, HashiCorp Vault, or Google Secret Manager.
- **Status:** Guarded by configuration validation (`ValidationError` thrown in production mode).

---

## 4. Solidity Contract ABI & Integration Alignment

Inspection of `RotationController.sol` (commit `62baee2` in Codex's contract worktree) confirms that `apps/api/src/services/rotation-controller-client.ts` and `@quoteseal/shared` are 100% aligned with the live contract ABI:

| Contract Function / Property | Solidity Definition | `ROTATION_CONTROLLER_ABI` Match | Verification |
| :--- | :--- | :---: | :---: |
| `proposeRotation` | `proposeRotation(string, uint64) returns (bytes32)` | ✅ Exact match | `world-rotation.test.ts` |
| `approveWithAttestation` | `approveWithAttestation(RotationApproval, bytes)` | ✅ Exact match (12-field tuple) | `world-rotation.test.ts` |
| `activateRotation` | `activateRotation(bytes32)` | ✅ Exact match | `world-rotation.test.ts` |
| `cancelPendingRotation` | `cancelPendingRotation(bytes32, bytes32)` | ✅ Exact match | `world-rotation.test.ts` |
| `enrollOperator` | `enrollOperator(Enrollment, bytes)` | ✅ Exact match (6-field tuple) | `world-rotation.test.ts` |
| `revokeOperator` | `revokeOperator(address)` | ✅ Exact match | `world-rotation.test.ts` |
| `getRotationState` | `getRotationState() view returns (Proposal)` | ✅ Exact match (9-field tuple) | `backend-integration.test.ts` |
| `payoutVerdict` | `payoutVerdict(string) view returns (Verdict)` | ✅ Exact match (`uint8` enum) | `integration.test.ts` |
| `activePayTo` | `activePayTo() view returns (string)` | ✅ Exact match | `integration.test.ts` |
| `pendingPayTo` | `pendingPayTo() view returns (string)` | ✅ Exact match | `integration.test.ts` |
| `profileVersion` | `profileVersion() view returns (uint256)` | ✅ Exact match | `ens-profile.test.ts` |
| `paused` | `paused() view returns (bool)` | ✅ Exact match | `world-rotation.test.ts` |
| `operatorExpiry` | `operatorExpiry(address) view returns (uint64)` | ✅ Exact match | `world-rotation.test.ts` |

### On-Chain vs Off-Chain Enum Mapping Integrity

```
Solidity RotationController.sol                QuoteSeal Backend (@quoteseal/shared)
--------------------------------              -------------------------------------
enum State {                                   type RotationState =
  STABLE,            // 0       <=========>      'STABLE'
  PROPOSED,          // 1       <=========>      'PROPOSED'
  PENDING_APPROVED,  // 2       <=========>      'PENDING_APPROVED'
  ACTIVATED,         // 3       <=========>      'ACTIVATED'
  CANCELLED          // 4       <=========>      'CANCELLED'
}

enum Verdict {                                 type OnChainVerdict =
  PASS,              // 0       <=========>      'PASS'
  BLOCK,             // 1       <=========>      'BLOCK'
  HOLD               // 2       <=========>      'HOLD'
}
                                               type Verdict =
                                                 OnChainVerdict | 'UNVERIFIABLE' (Off-Chain Only)
```

---

## 5. Security Test Vectors (T1–T16) Verification Matrix

The T1–T16 suite in `packages/guard/src/t1-t16.test.ts` validates the complete attack surface and signer boundary invariants:

| Test ID | Scenario Description | Expected Verdict | Signer Invocation Allowed? | Raw Signer Calls | Test Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **T1** | Valid payment matching canonical anchors | `PASS` | Yes (Single-Use) | **1** | ✅ **PASS** |
| **T2** | Modified `payTo` address / recipient tampering | `BLOCK` | No | **0** | ✅ **PASS** |
| **T3** | Unknown merchant / unanchored ENS name | `HOLD` | No | **0** | ✅ **PASS** |
| **T4** | Cross-origin redirect attack | N/A (Blocked pre-guard) | No | **0** | ✅ **PASS** |
| **T5** | Amount exceeds cap / wrong asset / wrong network | `BLOCK` | No | **0** | ✅ **PASS** |
| **T6** | Rotation proposed but not approved | Old: `PASS`, New: `BLOCK` | No (on BLOCK) | **0** | ✅ **PASS** |
| **T7** | Rotation approved but delay not elapsed | Old: `PASS`, New: `HOLD` | No (on HOLD) | **0** | ✅ **PASS** |
| **T8** | Rotation delay elapsed but not activated | Old: `PASS`, New: `HOLD` | No (on HOLD) | **0** | ✅ **PASS** |
| **T9** | Rotation activated on-chain | New: `PASS`, Old: `BLOCK` | Yes (on PASS) | **1** | ✅ **PASS** |
| **T10** | Rotation cancelled | Old: `PASS`, New: `BLOCK` | No (on BLOCK) | **0** | ✅ **PASS** |
| **T11** | ENS owner, resolver, or version drift | `HOLD` | No | **0** | ✅ **PASS** |
| **T12** | Prompt injection in description / metadata | `BLOCK` (payTo decides) | No (on BLOCK) | **0** | ✅ **PASS** |
| **T13** | Dual-RPC disagreement or RPC outage | `UNVERIFIABLE` | No | **0** | ✅ **PASS** |
| **T14** | Multiple `accepts[]` payment options | Exact Match Only | No (on BLOCK) | **0** | ✅ **PASS** |
| **T15** | Unauthorized ENS record write / registry change | `HOLD` | No | **0** | ✅ **PASS** |
| **T16** | OIDC replay / proposal hash mismatch / revoked | `HOLD` / `BLOCK` | No | **0** | ✅ **PASS** |

---

## 6. Exact Reproducible Commands for Building & Testing

To reproduce all builds, typechecks, and test runs from a clean repository state on Linux with Node.js 24 and pnpm 12:

### Environment Prerequisites
```bash
node -v   # v24.22.2 (Node 24 LTS)
pnpm -v   # 12.18.0
```

### 1. Clean Install
```bash
pnpm install --frozen-lockfile
```

### 2. Full Workspace Strict TypeScript Compilation
```bash
pnpm -r run build
```

### 3. Full Workspace Test Suite (115 Tests)
```bash
pnpm -r test
```

### 4. Package-Specific Test Commands
```bash
# Shared package tests (14 tests)
pnpm --filter @quoteseal/shared test

# ENS profile resolver & trust anchor tests (14 tests)
pnpm --filter @quoteseal/ens-profile test

# x402 guard pre-signing boundary & T1-T16 suite (45 tests)
pnpm --filter @quoteseal/guard test

# Fastify API, World OIDC, and full integration tests (42 tests)
pnpm --filter @quoteseal/api test

# Security Vector Suite T1–T16 specifically (16 tests)
pnpm --filter @quoteseal/guard test run src/t1-t16.test.ts
```

---

## 7. Unresolved External & Live-Chain Blockers

> [!IMPORTANT]
> All unit, integration, and security mock tests pass with 100% deterministic success. In adherence to QuoteSeal security policy, no live-chain verification is claimed from mock tests. The following external prerequisites remain before live testnet deployment:

1. **Hedera Testnet Credentials:** Live on-chain execution of Hedera x402 settlement requires funded Hedera testnet accounts (buyer account ID/private key, merchant payout account ID, fee payer key). No credentials have been fabricated or hardcoded.
2. **Sepolia Live-Chain Contract Deployment:** Live on-chain verification requires deploying `RotationController.sol` and the ENS Permissioned Resolver to Sepolia testnet to verify live role bitmasks and subname ownership.
3. **`@x402/fastify` Dependency:** ADR-02 specifies `@x402/fastify` for Phase 6 merchant API settlement routes. To be installed prior to Phase 6 deployment.
