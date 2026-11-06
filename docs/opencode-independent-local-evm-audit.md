# QuoteSeal — Independent Local EVM Audit Report

**Auditor:** Independent verification agent (OpenCode / Nemotron)
**Role:** NOT the implementation owner — Antigravity is the implementation owner
**Scope:** `/home/yesh/Projects/eth` (branch `feature/backend-integration`) and `/home/yesh/Projects/eth-rotation-controller` (branch `feature/rotation-controller`)
**Mode:** Read-only. No production code modified. Antigravity's worktree untouched.
**Date:** 2026-11-06

---

## 1. Exact Commits Audited

| Repository | Branch | HEAD Commit | Commit Message |
|------------|--------|-------------|----------------|
| Main (`/home/yesh/Projects/eth`) | `feature/backend-integration` | `d3d349c` | `feat(integration): real backend to RotationController local EVM integration and evidence report` |
| Contract (`/home/yesh/Projects/eth-rotation-controller`) | `feature/rotation-controller` | `38465c3` | `fix(contract): canonicalize rotation approval timing` |

Git status: ETH repo working tree clean. Rotation repo has only untracked evidence files (`contracts/.gitignore`, `contracts/evidence/`, `contracts/report.md`) — no source modifications.

Node runtime: v26.12.0 default; v24.22.2 available via `mise` (pinned in `mise.toml`). pnpm 12.18.0. Forge/Anvil 1.9.0 available.

---

## 2. Contract Authenticity

### 2.1 Compiled contract exists and is real

The `contracts/` directory in the ETH repo is tracked at HEAD. Foundry build artifacts exist:

- `out/RotationController.sol/RotationController.json` — compiled artifact
- `deployedBytecode.object` length: 35,134 hex chars (non-empty, real contract bytecode)
- `bytecode.object` length: 50,374 hex chars (creation bytecode with constructor)

### 2.2 ABI matches compiled artifact exactly

Programmatic comparison of committed `contracts/abi/RotationController.json` vs compiled `out/RotationController.sol/RotationController.json`:

- Committed functions: 42; Compiled functions: 42
- Only in committed: none; Only in compiled: none
- All function names, input types, output types, internalTypes, and stateMutability match exactly

**ABI MATCH: YES** — the backend uses the exact ABI of the actual compiled contract.

### 2.3 Backend uses the actual deployed address and real RPC client

`apps/api/src/services/rotation-controller-client.ts` — `LiveRotationControllerClient`:
- Constructor takes `PublicClient` (viem) — real RPC client
- `getProposalState`: `publicClient.readContract({ address: controllerAddress, abi: ROTATION_CONTROLLER_ABI, functionName: 'getRotationState' })`
- `payoutVerdict`: `publicClient.readContract({ ..., functionName: 'payoutVerdict', args: [payTo] })`
- `proposeRotation`: `walletClient.writeContract({ address: controllerAddress, abi: ROTATION_CONTROLLER_ABI, functionName: 'proposeRotation', args: [...] })` + `publicClient.waitForTransactionReceipt`
- `approveWithAttestation`, `activateRotation`, `cancelPendingRotation`, `enrollOperator`: same real writeContract pattern
- All methods read from / write to the deployed contract address via viem

### 2.4 Backend calls trace to actual contract methods

Every backend method maps 1:1 to a real Solidity function:

| Backend method | Solidity function | Mutability |
|----------------|-------------------|------------|
| `getProposalState` | `getRotationState()` | view |
| `payoutVerdict` | `payoutVerdict(string)` | view |
| `previewProposalId` | `previewProposalId(address,string,uint64)` | view |
| `enrollOperator` | `enrollOperator(Enrollment,bytes)` | nonpayable |
| `proposeRotation` | `proposeRotation(string,uint64)` | nonpayable |
| `approveWithAttestation` | `approveWithAttestation(RotationApproval,bytes)` | nonpayable |
| `activateRotation` | `activateRotation(bytes32)` | nonpayable |
| `cancelPendingRotation` | `cancelPendingRotation(bytes32,bytes32)` | nonpayable |
| `isOperatorActive` | `operatorExpiry(address)` | view |

### 2.5 Integration test proves real deployment

`apps/api/src/local-contract-integration.test.ts`:
- Spawns real Anvil node (port 8549, hardfork cancun)
- Reads compiled artifacts from `contracts/out/`
- Deploys `ResolverMock`, `RegistryMock`, `RootMock`, then **real `RotationController`** via `ownerWallet.deployContract({ abi: rcArt.abi, bytecode: rcArt.bytecode.object, args: [config] })`
- Reads deployment receipt to get `controllerAddress`
- Wires `rotationClient = new LiveRotationControllerClient(publicClient)`
- All 18 lifecycle items and 8 guard invariants exercised against this live-deployed contract

**Test result: 14/14 passed** — real Anvil + real contract + real viem calls.

### 2.6 Dependencies that remain mocked

| Dependency | Type | Used in local EVM integration test? |
|------------|------|-------------------------------------|
| `RotationController.sol` | Real compiled contract | YES — deployed and called |
| `ResolverMock.sol` | Solidity test double (IQuoteSealResolver) | YES — required ENS text-record double |
| `RegistryMock.sol` | Solidity test double (IQuoteSealRegistry) | YES — required ENS registry double |
| `RootMock.sol` | Solidity test double (root registry) | YES — required root delegation double |
| `MockWorldOidcService` | JS mock (fake JWT claims) | YES — no real World ID cloud |
| `MockDatabaseStore` / `createMockDatabase` | JS in-memory DB | YES — no real Postgres |
| `MockRotationControllerClient` | JS mock (hardcoded `0xaa...` IDs) | NO — not imported by this test |
| Deterministic test signer | JS mock (returns `'signed_tx_bytes'`) | YES — no real Hedera broadcast |

**No silent mock fallback:** `local-contract-integration.test.ts` imports `LiveRotationControllerClient` only (line 19), instantiates it (line 190), and never references `MockRotationControllerClient`. The test would fail if Anvil/contract were unavailable.

---

## 3. Proposal ID Independence Verification

### 3.1 Contract formula (Solidity, `RotationController.sol:409-426`)

```
_computeProposalId(operator, newPayTo, proposalExpiry, nonce) =
  keccak256(
    abi.encode(
      address(this),       // controller
      block.chainid,       // chain ID
      merchantId,          // bytes32
      nonce,               // uint256
      operator,            // address
      _hash(activePayTo),  // keccak256(bytes(activePayTo))
      _hash(newPayTo),     // keccak256(bytes(newPayTo))
      proposalExpiry       // uint64
    )
  )
```

### 3.2 Backend formula (TypeScript, `packages/shared/src/contracts/proposal-id.ts:24-51`)

```
computeProposalId = keccak256(
  encodeAbiParameters(
    [address, uint256, bytes32, uint256, address, bytes32, bytes32, uint64],
    [controllerAddress, chainId, merchantId, proposalNonce, operatorAddress,
     keccak256(stringToBytes(activePayTo)), keccak256(stringToBytes(newPayTo)), proposalExpiry]
  )
)
```

The backend formula matches the Solidity formula field-for-field: controller address, chain ID, merchant ID, nonce, operator, keccak256(activePayTo), keccak256(newPayTo), proposalExpiry. Standard `abi.encode` behavior preserved.

### 3.3 Independent verification in test

`local-contract-integration.test.ts` lines 396-406:
- `computeProposalId({controllerAddress, chainId, merchantId, proposalNonce: 1n, operatorAddress, activePayTo: '0.0.123', newPayTo: '0.0.456', proposalExpiry})`
- `expect(computedId).toBe(onChainProposalId)` — TypeScript-computed ID equals on-chain assigned ID
- `previewProposalId()` also queried from contract and validated as `0x` + 64 hex chars

**Verified:** Backend uses canonical on-chain proposal ID in approval attestation (`attestationData.proposalId === onChainProposalId`, line 463).

---

## 4. EIP-712 Independence Verification

### 4.1 Contract typehash (Solidity, `RotationController.sol:82-84`)

```
APPROVAL_TYPEHASH = keccak256(
  "RotationApproval(bytes32 merchantId,bytes32 proposalId,address operator,address resolver,bytes32 namehash,bytes32 oldPayToHash,bytes32 newPayToHash,uint64 effectiveAt,uint64 proposalExpiry,uint256 proposalNonce,uint64 authTime,uint64 attestationExpiry)"
)
```

### 4.2 Backend type definition (TypeScript, `apps/api/src/services/attestor.ts:51-66`)

`ROTATION_APPROVAL_TYPES.RotationApproval` lists the same 12 fields in the same order with identical types: `bytes32, bytes32, address, address, bytes32, bytes32, bytes32, uint64, uint64, uint256, uint64, uint64`.

### 4.3 Domain

- Contract: `EIP712("QuoteSeal", "1")` (constructor, line 153)
- Backend: `EIP712_DOMAIN_NAME = 'QuoteSeal'`, `EIP712_DOMAIN_VERSION = '1'` (`packages/shared/src/types/index.ts:224-225`)
- Chain ID: backend passes `BigInt(CHAIN_ID)` (31337 for local) or `merchant.chainId`
- Verifying contract: `controllerAddress` (the deployed RotationController)

### 4.4 Cryptographic digest parity (test line 466-513)

- On-chain digest: `publicClient.readContract({ address: controllerAddress, abi, functionName: 'approvalDigest', args: [approvalStruct] })`
- Local digest: `hashTypedData({ domain: {name, version, chainId, verifyingContract}, types: ROTATION_APPROVAL_TYPES, primaryType: 'RotationApproval', message: approvalData })`
- **Result:** `expect(localDigest).toBe(onChainDigest)` — exact 32-byte equality

### 4.5 Signature verification

- Attestor signs with `this.attestorAccount.signTypedData({ domain, types, primaryType, message: approvalData })` (`attestor.ts:180-190`)
- Contract verifies with `SignatureChecker.isValidSignatureNow(attestor, digest, signature)` (`RotationController.sol:269`)
- Test confirms valid signature is accepted; fake signature (`0x00...65`) reverts with `InvalidSignature()` (test line 727-746)

**EIP-712: VERIFIED** — domain, chain ID, verifying contract, primary type, field ordering, field types, encoded values, digest, and signature all match the actual contract.

---

## 5. Rotation Lifecycle Results

All 18 lifecycle items exercised through real backend API + real deployed contract:

| Item | Scenario | Result |
|------|----------|--------|
| 1-2 | Initial active payout `0.0.123`, version 1, verdicts PASS/BLOCK | PASS |
| 3-6 | Proposal creation, canonical proposal ID matches on-chain | PASS |
| 7 | EIP-712 attestation, digest matches `approvalDigest` | PASS |
| 8-10 | Approval → PENDING_APPROVED, verdicts PASS/HOLD/BLOCK | PASS |
| 11 | Early activation before timelock reverts on-chain | PASS |
| 12 | Delay elapse alone does NOT activate (state stays PENDING_APPROVED, activePayTo unchanged) | PASS |
| 13-15 | Explicit activation → ACTIVATED, verdicts flip (new PASS, old BLOCK), version 2 | PASS |
| 16 | Repeated activation → 200, `alreadyActivated: true`, no duplicate tx | PASS |
| 17 | Emergency cancellation → CANCELLED, activation rejected 409 | PASS |
| 18 | Replay approval reverts InvalidState; fake signature reverts InvalidSignature; DB uncorrupted | PASS |

**Key invariant confirmed:** Passing `effectiveAt` (timelock expiry) does **not** automatically activate the proposal — explicit `activateRotation` call required. State remains `PENDING_APPROVED` until activation.

---

## 6. Signer Invocation Counts

Verified in `local-contract-integration.test.ts` Phase 3 (guard invariants) and `packages/guard/src/t1-t16.test.ts`:

| Scenario | Guard Verdict | Raw Signer Calls | Requirement |
|----------|--------------|-------------------|-------------|
| Active on-chain payout | PASS | exactly 1 | ✅ |
| Unrecognized payout `0.0.999` | BLOCK | 0 | ✅ |
| Pending payout during delay | HOLD | 0 | ✅ |
| Missing/divergent ENS profile | UNVERIFIABLE | 0 | ✅ |
| Cross-origin redirect | BLOCK | 0 | ✅ |
| Resource URL override | BLOCK | 0 | ✅ |
| SDK hook mutating payTo | REJECTED | 0 | ✅ |
| Post-activation re-anchoring | PASS | exactly 1 | ✅ |

**Boundary enforcement** (`packages/guard/src/boundary.ts`):
- `Object.freeze` on returned `{guard, signer, close}` and on signer object
- `copyData` + `freezeData` produce detached frozen copies at every stage
- Reference-identity guards (`selectedRef`, `challengeRef`) reject later-hook rebinding
- Deep-equality re-check at signer time against frozen `original` and `approved`
- State machine `NEW → APPROVED → CLOSED`; single-use enforced
- No raw signer, scheme, or registration API escapes the facade

---

## 7. World ID and API Security

### World ID (mock vs real)

- **Mock World ID claims** used in tests (`MockWorldOidcService` with `acr=orb`, `auth_time`, `nonce`) — no real World ID cloud contact
- `LiveWorldOidcService` exists for production (`app.ts:76-89`) using `openid-client v6` against official issuer
- PKCE S256, state/nonce validation, proposal-hash binding, atomic single-use consumption (`consumeAuthAttempt` with compare-and-swap), replay protection all implemented in `world-oidc.ts`

### API security

- PKCE S256 code challenge
- State hash (`sha256Hex(state)`) and nonce hash validation
- `auth_time` freshness vs `maxAuthAgeSeconds`; future auth_time rejected
- ACR/AMR policy (orb/device) enforced fail-closed
- Atomic single-use: `consumedAt` checked before any mutation; `consumeAuthAttempt` returns boolean; concurrent race detected
- Proposal-hash binding: `attempt.proposalHash !== input.proposalHash` → rejected
- Sensitive log/API redaction: error handler redacts internal errors; only known `QuoteSealError` fields exposed
- Contract reverts (502 `ContractExecutionError`) leave DB records uncorrupted (test line 748-751)

---

## 8. Test Commands and Results

| Command | Result |
|---------|--------|
| `cd packages/guard && npx vitest run` | 45 passed (guard 3, boundary 21, t1-t16 16, integration 5) |
| `cd packages/ens-profile && npx vitest run` | 14 passed |
| `cd packages/shared && npx vitest run` | 18 passed |
| `cd apps/api && npx vitest run` | 57 passed (incl. 14 local EVM integration) |
| `cd contracts && forge test` | 53 passed (52 RotationControllerTest + RotationInvariantTest fuzz invariants: 128 runs, 4096 calls, 0 reverts) |
| `mise x node@24 -- npx tsc --noEmit -p <each pkg>` | All exit 0 (guard, ens, shared, api) |
| `mise x node@24 -- pnpm -r run build` | `tsc -b` across 4 projects: (0 diagnostics) |
| `cd apps/api && npx vitest run src/local-contract-integration.test.ts` | 14 passed |

**Total: 187 tests passed, 0 failed** across all suites.

---

## 9. Findings by Severity

### CRITICAL
None found.

### HIGH
None found.

### MEDIUM

**M1 — Silent mock fallback in production app wiring**
- **File/line:** `apps/api/src/app.ts:116-117`
- **Reproduction:** Call `createApp()` without injecting `rotationControllerClient`; defaults to `MockRotationControllerClient` (hardcoded `0xaa...` proposal IDs, fabricated tx hashes)
- **Expected:** Production should require explicit `LiveRotationControllerClient` or fail-fast if none provided
- **Actual:** Silent fallback to mock; deployment without a real client would operate against fabricated contract state
- **Security impact:** MEDIUM — production could run with a mock contract client if dependency injection is omitted
- **Evidence:** `app.ts:116-117` — `const rotationControllerClient = deps.rotationControllerClient ?? new MockRotationControllerClient();`
- **Note:** `server.ts:65` correctly passes `LiveRotationControllerClient`, but `app.ts` default is a latent risk
- **Recommended fix:** Remove the `?? new MockRotationControllerClient()` fallback; require the client to be injected or throw if absent

### LOW

**L1 — `consumeAuthAttempt` called before operator-identity verification**
- **File/line:** `apps/api/src/services/world-oidc.ts:286` (step 4) before step 6 (operator verification at line 295+)
- **Reproduction:** Callback with valid state but wrong/mismatched operator subject
- **Expected:** Consume the attempt only after all validation passes
- **Actual:** Attempt is marked consumed even if operator identity check subsequently fails; the one-time attempt cannot be retried
- **Security impact:** LOW — single-use still enforced (replay blocked), but legitimate retries with corrected operator binding are blocked
- **Evidence:** `world-oidc.ts:285-289` consume; `295-309` operator check after

**L2 — Test-only `as any` casts**
- **File/lines:** `world-oidc.ts:215-219`, `world.ts:92`, `app.ts:52,74,88,100,113,197`, `server.ts:46-48`, `attestor.ts:72`, `operator-enrollment.ts:67`, `world-oidc.ts:93`
- **Security impact:** LOW — type escape hatches, mostly in logging and test mockNonce handling

### INFO

**I1 — ENS infrastructure uses test doubles locally**
- `ResolverMock`, `RegistryMock`, `RootMock` are Solidity test doubles; full ENSv2 Universal Resolver not deployed locally. Documented as a known limitation.

**I2 — World ID uses mock claims in local testing**
- `MockWorldOidcService` generates cryptographically bound JWT claims without contacting World ID cloud. `LiveWorldOidcService` exists for production.

**I3 — Hedera signing uses deterministic test signer locally**
- No real HBAR broadcast in local EVM integration. Real Hedera integration requires testnet credentials (not available).

**I4 — All security invariants verified**
- PASS → exactly 1 signer call; BLOCK/HOLD/UNVERIFIABLE → 0 signer calls; exact selected requirement checked; buyer-origin binding preserved; cross-origin redirects fail closed; later SDK mutation rejected; immutable snapshot enforced; raw signer encapsulated; no sensitive comparison data leaks.

---

## 10. Final Classification

**PASS — genuine local EVM integration independently verified.**

### Basis for classification

1. **Real contract deployed:** The integration test spawns Anvil, reads the compiled `RotationController` artifact, and deploys the real contract via `deployer.deployContract({ abi, bytecode, args: [config] })`. Deployment receipt confirms a real contract address on-chain.

2. **Real RPC calls:** `LiveRotationControllerClient` uses viem `publicClient.readContract` and `walletClient.writeContract` against the deployed address. All 9 contract methods map 1:1 to Solidity functions.

3. **Real on-chain state transitions:** Propose → Approve → Activate → Cancel all execute as real transactions mined by Anvil, with receipts checked for non-reverted status.

4. **Real ABI match:** Committed ABI equals compiled artifact ABI exactly (42/42 functions).

5. **Real EIP-712:** Local digest equals on-chain `approvalDigest` output byte-for-byte.

6. **Real proposal ID:** `computeProposalId` output equals on-chain `proposal.id`; `previewProposalId` matches.

7. **Real test results:** 187 tests pass across all suites; 0 failures. Typecheck and build pass under pinned Node 24.22.2.

### Limitations (documented, do not change classification)

- ENSv2 uses Solidity test doubles locally (not full ENSv2 Sepolia deployment)
- World ID uses mock claims locally (not real World ID cloud)
- Hedera signing uses deterministic test signer locally (no real testnet broadcast)
- `MockRotationControllerClient` exists as a fallback in `app.ts:116-117` (MEDIUM finding M1 — production `server.ts` correctly uses `LiveRotationControllerClient`)

### Not claimed

- Live-chain verification (Hedera testnet, Sepolia ENS, real World ID) — **not performed and not claimed**
- Production mainnet readiness — **not claimed**

### Deliverable

`docs/opencode-independent-local-evm-audit.md` (this file)
