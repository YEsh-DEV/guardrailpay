# QuoteSeal Cross-Branch Integration Validation Results

**Date:** 2026-11-06  
**Worktrees validated:** `eth` (feature/backend-integration), `eth-rotation-controller` (feature/rotation-controller), `eth-world-rotation` (feature/world-rotation-backend), `eth-signer-boundary` (fix/x402-signer-boundary), plus Hedera and ENS spike directories.  
**No other agent's branches were edited or merged.**

---

## 1. Tests Actually Executed

| Worktree | Test Framework | Files | Tests | Passed | Failed | Command |
|----------|---------------|-------|-------|--------|--------|---------|
| `eth` (packages) | vitest | 5 | 57 | 57 | 0 | `npx vitest run` |
| `eth` (spikes/hedera-x402) | tsx/node:test | 3 | 45 | 45 | 0 | `npm test` |
| `eth-signer-boundary` (spikes/x402-pre-sign-guard) | tsx/node:test | 1 | 39 | 39 | 0 | `npx tsx --test final-boundary.test.ts` |
| `eth-rotation-controller` (contracts) | forge | 1 | 50 | 50 | 0 | `forge test` |
| **Total** | | **10** | **191** | **191** | **0** | |

### eth packages — vitest breakdown

| Package | Test File | Tests |
|---------|-----------|-------|
| `apps/api` | `src/api.test.ts` | 19 |
| `apps/api` | `src/world-rotation.test.ts` | 19 |
| `packages/ens-profile` | `src/ens-profile.test.ts` | 12 |
| `packages/guard` | `src/guard.test.ts` | 3 |
| `packages/guard` | `src/integration.test.ts` (new) | 4 |
| `packages/shared` | `src/shared.test.ts` | 8 |

### Typecheck — all pass

| Worktree | Package | Command | Result |
|----------|---------|---------|--------|
| `eth` | `apps/api` | `npx tsc --noEmit -p apps/api/tsconfig.json` | PASS |
| `eth` | `packages/ens-profile` | `npx tsc --noEmit` | PASS |
| `eth` | `packages/guard` | `npx tsc --noEmit` | PASS |
| `eth` | `packages/shared` | `npx tsc --noEmit` | PASS |
| `eth` | `spikes/hedera-x402` | `npx tsc --noEmit` | PASS |
| `eth-signer-boundary` | `spikes/x402-pre-sign-guard` | `npx tsc --noEmit` | PASS |

---

## 2. ABI/API Mismatches (Solidity Contract vs Backend TypeScript)

### Mismatch 1 — ENS Record Key (CRITICAL)

| Component | Key Used | File:Line |
|-----------|----------|-----------|
| Solidity `RotationController.sol` | `quoteseal.profileVersion` | `VERSION_KEY` constant, line 90; written via `_write(VERSION_KEY, ...)` line 295 |
| `ens-profile/src/resolver.ts` | `quoteseal.version` | line 128: `const versionStr = records['quoteseal.version'] || '1'` |

**Impact:** The resolver reads `quoteseal.version` but the contract writes `quoteseal.profileVersion`. Profile version will always default to `'1'` because the contract never writes `quoteseal.version`. Trust-anchor version checks (`ANCHOR_VERSION_MISMATCH`) will never fire correctly.

**Fix:** Change resolver.ts line 128 to read `records['quoteseal.profileVersion']` instead of `records['quoteseal.version']`, or add a fallback chain.

### Mismatch 2 — RotationState Enum

| Source | States | File |
|--------|--------|------|
| Solidity `RotationController.sol` | `STABLE, PROPOSED, PENDING_APPROVED, ACTIVATED, CANCELLED` (5) | line 15-21 |
| Backend `shared/src/types/index.ts` | `STABLE, PROPOSED, PENDING_APPROVED, APPROVED, ACTIVATED, CANCELLED, PAUSED` (7) | line 10-18 |

**Impact:** Backend Zod schema accepts `APPROVED` and `PAUSED` which are not valid Solidity contract states. The `STATE_MAP` in `rotation-controller-client.ts` correctly maps 0-4, but the schema allows invalid states to circulate in the backend.

### Mismatch 3 — Verdict Enum

| Source | Values | File |
|--------|--------|------|
| Solidity `RotationController.sol` | `PASS, BLOCK, HOLD` (3) | line 22-26 |
| Backend `shared/src/types/index.ts` | `PASS, HOLD, BLOCK, UNVERIFIABLE` (4) | line 7-8 |

**Impact:** `UNVERIFIABLE` is an off-chain client-only verdict; it can never come from the contract. `VERDICT_MAP` correctly maps 0-2, but the schema allows `UNVERIFIABLE` as a database-stored verdict.

### Mismatch 4 — RotationApproval Struct (documentation only)

`docs/world-rotation-integration.md` section 3.3 shows a RotationApproval schema with only 4 fields:
```
proposalHash, operator, expiry, controller
```
This does **not** match either:
- Solidity contract (12 fields: merchantId, proposalId, operator, resolver, namehash, oldPayToHash, newPayToHash, effectiveAt, proposalExpiry, proposalNonce, authTime, attestationExpiry)
- Backend TypeScript `RotationApprovalData` interface (12 fields, matches Solidity)

The backend `apps/api/src/services/attestor.ts` `ROTATION_APPROVAL_TYPES` (line 69-82) correctly matches the Solidity contract. Only the documentation is wrong.

### Mismatch 5 — Backend route bypasses type checking

`apps/api/src/routes/rotation.ts` line 254:
```ts
const txHash = await opts.rotationControllerClient.approveWithAttestation(
  controllerAddress,
  approvalData as any,   // <-- bypasses type checking
  signature as Hex,
  ...
);
```
The `as any` cast on `approvalData` means a `RotationApprovalData` with missing or extra fields would compile but fail at the contract level.

---

## 3. Raw Signer Access Verification

**Result: No raw signer or private key is exported through QuoteSeal's public package interfaces.**

| Package | Exports raw signer? | Exports private key? | Details |
|---------|--------------------|---------------------|---------|
| `@quoteseal/ens-profile` | No | No | Exports types, dual-rpc, resolver, trust |
| `@quoteseal/guard` | No | No | Exports interfaces only |
| `@quoteseal/shared` | No | No | Exports types, errors, config, db, logging |
| `@quoteseal/api` (Fastify app) | N/A (app, not library) | N/A | Holds `ATTESTOR_PRIVATE_KEY` in env, used only server-side by `AttestorService` |

The `@x402/hedera` third-party package exports `createClientHederaSigner(accountId, privateKey, config)` but this is a dependency, not QuoteSeal's code. QuoteSeal's own packages do not re-export or expose it.

**The `final-boundary.ts` spike** (`eth-signer-boundary`) accepts a `rawSigner: ClientHederaSigner` parameter but returns a wrapped `signer` object that enforces single-use authorization before delegation. The raw signer is held only by trusted composition code and never escapes the facade.

---

## 4. Hedera Package Compatibility (reproduced)

| Package | Version | Peer Deps | Result |
|---------|---------|-----------|--------|
| `@x402/core` | 2.30.0 | None | PASS |
| `@x402/hedera` | 2.30.0 | None | PASS |
| `@x402/fetch` | 2.30.0 | None | PASS |
| `@hiero-ledger/sdk` | 2.90.1 | N/A | PASS |
| `@x402/fastify` | Not installed | N/A | **Gap** — required by ADR-02 for Phase 6 |

All `@x402/*` packages are aligned at 2.30.0. `@x402/hedera` depends on `@hiero-ledger/sdk` 2.90.1 and `@hiero-ledger/proto` 2.32.0. No peer dependency conflicts.

**Live testnet settlement:** Blocked — no Hedera testnet credentials available. No transaction evidence fabricated.

---

## 5. Critical Integration Blockers

| # | Blocker | Severity | Location | Required Action |
|---|---------|----------|----------|-----------------|
| 1 | ENS record key mismatch: contract writes `quoteseal.profileVersion`, resolver reads `quoteseal.version` | Critical | `packages/ens-profile/src/resolver.ts:128` | Change resolver to read `quoteseal.profileVersion` with fallback to `quoteseal.version` |
| 2 | `@x402/fastify` not installed | High | Root workspace, ADR-02 | `npm install @x402/fastify@2.30.0` before Phase 6 API work |
| 3 | No live Hedera testnet credentials | High | All worktrees | Provision testnet buyer/merchant/fee-payer accounts; perform live settlement |
| 4 | No Sepolia on-chain ENS verification | High | Spike 1 evidence is local mock only | Deploy to Sepolia, verify role bitmasks and registry addresses |
| 5 | Backend `RotationState`/`Verdict` schemas include non-contract values | Medium | `packages/shared/src/types/index.ts` | Align Zod enums with Solidity contract enums |
| 6 | `rotation.ts:254` passes `approvalData as any` | Medium | `apps/api/src/routes/rotation.ts:254` | Remove `as any`, enforce `RotationApprovalData` type |

---

## 6. World OIDC Flow Verification

**Result: OIDC flow correctly implements state/nonce replay protection, proposal binding, and callback handling.**

| Security Property | Implementation | Verified |
|-------------------|---------------|----------|
| State/nonce binding to proposalHash | `handleCallback` checks `attempt.proposalHash !== input.proposalHash` | ✅ `world-oidc.ts:187` |
| Single-use state consumption | `consumedAt` check + `consumeAuthAttempt()` | ✅ `world-oidc.ts:179-181, 268` |
| Replay detection | `ReplayError` on already-consumed state | ✅ `world-oidc.ts:180` |
| Session expiry | `expiresAt` check before callback processing | ✅ `world-oidc.ts:183-185` |
| Nonce verification | SHA-256 hash comparison against stored `nonceHash` | ✅ `world-oidc.ts:224-230` |
| auth_time freshness | `maxAuthAgeSeconds` enforcement | ✅ `world-oidc.ts:233-245` |
| ACR/AMR assurance | `orb` or `device` policy enforcement | ✅ `world-oidc.ts:248-265` |
| Subject pseudonymization | HMAC-SHA256 of World `sub`, never stored raw | ✅ `crypto.ts:computeSubjectHmac` |
| Operator identity binding | `subjectHmac` matched against enrolled operator | ✅ `world-oidc.ts:274-281` |
| Operator revocation/expiry | Status and expiry checks | ✅ `world-oidc.ts:283-289` |

**Assumption:** `requiredAcr` defaulting to `orb` means device-only credentials are rejected. The `MockWorldOidcService` accepts any `acr` value for testing — this is explicitly labeled as mock.

---

## 7. Mock vs Live-Chain Verification

**No local mock is reported as a live-chain result.**

| Component | Mock/Live | Labeling |
|-----------|-----------|----------|
| ENS profile resolution | Mock RPC providers | `[MOCKED]` in test names |
| Dual-RPC client | Mock providers | `[MOCKED]` in test names |
| Rotation controller client | `MockRotationControllerClient` | Explicitly named "Mock" |
| World OIDC service | `MockWorldOidcService` | Explicitly named "Mock", `[MOCKED]` in logs |
| Hedera testnet settlement | Not attempted | Reported as "Blocked — no credentials" |
| Solidity contract tests | Foundry local (Anvil) | Real contract bytecode, local VM |

All test files explicitly mark mock data. No `transactionId`, `txHash`, or World ID authentication result is fabricated.

---

## 8. New Integration Test

**File:** `packages/guard/src/integration.test.ts`  
**Tests:** 4 (all pass)  
**Connects:** ENS profile resolution → trust-anchor verification → rotation state machine → verdict checking

The test demonstrates:
1. ENS profile resolves via Dual-RPC mock with correct activePayTo
2. Trust anchors verify against pinned buyer anchors (PASS)
3. Tampered payTo → BLOCK at both trust and contract layers
4. ENS record key mismatch documented (contract writes `profileVersion`, resolver reads `version`)
5. Rotation state machine: STABLE → PROPOSED → PENDING_APPROVED (HOLD for new payTo) → ACTIVATED (new payTo PASS, old BLOCK)

---

## 9. Exact Next Actions

| Priority | Action | Command / Location |
|----------|--------|-------------------|
| 1 | Fix ENS record key mismatch | Edit `packages/ens-profile/src/resolver.ts:128`: read `quoteseal.profileVersion` with fallback |
| 2 | Align RotationState/Verdict Zod schemas with Solidity | Edit `packages/shared/src/types/index.ts`: remove `APPROVED`, `PAUSED`, `UNVERIFIABLE` from enums |
| 3 | Remove `as any` cast in rotation route | Edit `apps/api/src/routes/rotation.ts:254`: enforce `RotationApprovalData` type |
| 4 | Install `@x402/fastify` | `npm install @x402/fastify@2.30.0` in root workspace |
| 5 | Provision Hedera testnet credentials | Buyer account, merchant payout account, fee payer key, testnet HBAR |
| 6 | Run Sepolia on-chain ENS verification | Deploy RotationController + ENS resolver to Sepolia, verify role bitmasks |
| 7 | Fix `world-rotation-integration.md` RotationApproval schema | Update section 3.3 to match 12-field Solidity struct |
| 8 | Perform live Hedera testnet payment | Execute real `TransferTransaction` via `createClientHederaSigner`, capture `transactionId` |
