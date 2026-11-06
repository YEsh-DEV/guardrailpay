# QuoteSeal — Sepolia RotationController and ENS Deployment Preparation Audit

**Auditor:** Independent contract deployment preparation reviewer (OpenCode / Nemotron)  
**Role:** NOT the implementation owner  
**Mode:** Read-only inspection. No deployment. No signing. No private keys. No contract source modification.  
**Date:** 2026-11-07  
**Target Chain:** Ethereum Sepolia (Chain ID: 11155111)  
**Main Repository:** `/home/yesh/Projects/eth` (branch `feature/backend-integration`)  
**Contract Repository:** `/home/yesh/Projects/eth-rotation-controller` (branch `feature/rotation-controller`)  

---

## Final Classification: BLOCKED_BY_CONFIGURATION

The QuoteSeal core cannot be deployed to Sepolia as-is because multiple required configuration values are absent or zero, and no deployment script exists to establish them. The architectural design is sound, but the deployment prerequisite chain is incomplete.

---

## 1. Current State Assessment

### 1.1 Configuration gaps (from `.env.example` and `packages/shared/src/config/index.ts`)

| Environment Variable | Current Value | Required for Sepolia | Status |
|----------------------|---------------|----------------------|--------|
| `ROTATION_CONTROLLER_ADDRESS` | `0x0000000000000000000000000000000000000000` | Real deployed contract address | **MISSING (zero)** |
| `ENS_REGISTRY_ADDRESS` | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` | ENS Registry on Sepolia | Present (default) |
| `ENS_RESOLVER_FACTORY_ADDRESS` | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` | PermissionedResolver factory | Present (default) |
| `ATTESTOR_PRIVATE_KEY` | `0x1111...1111` (known test key) | Real non-default key | **DEFAULT (rejected in prod)** |
| `OPERATOR_SUBJECT_HMAC_SECRET` | `sample_32_byte...` (default) | Real secret | **DEFAULT (rejected in prod)** |
| `ENCRYPTION_KEY_HEX` | `00010203...1f` (default) | Real key | **DEFAULT (rejected in prod)** |
| `WORLD_ID_CLIENT_ID` | `app_sample_quoteseal_world_id` (default) | Real World ID client ID | **DEFAULT (rejected in prod)** |
| `APPLICATION_CHAIN_ID` | `11155111` | Correct for Sepolia | ✅ Correct |

The `EnvSchema.refine` in `packages/shared/src/config/index.ts:51-80` explicitly rejects all default test values in `NODE_ENV=production`, including the zero `ROTATION_CONTROLLER_ADDRESS`. **The backend will fail to start in production until a real controller address is configured.**

### 1.2 Chain ID verification

- `packages/shared/src/config/index.ts:30`: `APPLICATION_CHAIN_ID` defaults to `11155111` ✅ Correct for Sepolia
- `apps/api/src/server.ts:24`: Uses `sepolia` chain from `viem/chains` ✅
- `apps/api/src/server.ts:19`: Logs `chainId: env.APPLICATION_CHAIN_ID` ✅

---

## 2. Contract Architecture Analysis

### 2.1 RotationController constructor requirements (`contracts/src/RotationController.sol:153-183`)

The constructor `Config` struct requires:

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `merchantId` | `bytes32` | ENS namehash of merchant domain | Computed off-chain |
| `owner` | `address` | Merchant owner EVM address | Deployment key |
| `guardian` | `address` | Emergency pause/unpause authority | Deployment key |
| `attestor` | `address` | EIP-712 signature verification authority | Backend signing key |
| `registry` | `address` | ENS Registry contract | Sepolia: `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| `rootRegistry` | `address` | ENS Root Registry | Sepolia: required |
| `resolver` | `address` | PermissionedResolver instance | Must be deployed |
| `dnsName` | `bytes` | DNS name bytes (e.g., `merchant.eth`) | Off-chain computation |
| `namehash` | `bytes32` | ENS namehash of `dnsName` | Must match constructor |
| `nameExpiry` | `uint64` | ENS name expiry timestamp | From registry |
| `delay` | `uint64` | Rotation timelock (seconds) | Config: 86400 (1 day) |
| `maxAuthAge` | `uint64` | Max OIDC auth age (seconds) | Config: 120 |
| `attestationTTL` | `uint64` | Attestation TTL (seconds) | Config: 300 |
| `initialPayTo` | `string` | Canonical Hedera account `0.0.N` | Merchant payout |
| `initialProfileVersion` | `uint256` | Starting version (must be > 0) | Config: 1 |

**Constructor validation rules (lines 154-160):**
- `merchantId`, `owner`, `guardian`, `attestor` must be non-zero
- `guardian != owner`, `attestor != owner`, `attestor != guardian`
- `rootRegistry`, `registry`, `resolver` must have non-empty code (deployed contracts)
- `delay`, `maxAuthAge`, `attestationTTL` must be > 0
- `nameExpiry` must be > `block.timestamp`
- `initialProfileVersion` must be > 0
- `namehash` must match `_parseName(dnsName)`
- `initialPayTo` must match canonical Hedera format `0.0.N`

### 2.2 ENSv2 Permission Model (from Spike 1)

The `spikes/ens-permissions/README.md` and `MockPermissionedResolver.sol` document the required resolver architecture:

1. **Dedicated Merchant Resolver**: Each merchant uses an independent `PermissionedResolver` instance (NOT the public ENS resolver)
2. **Resource-Scoped Setter Roles**: `RotationController` receives `ROLE_SET_TEXT` scoped to:
   - `keccak256(merchantNode, "quoteseal.activePayTo")`
   - `keccak256(merchantNode, "quoteseal.pendingPayTo")`
   - `keccak256(merchantNode, "quoteseal.rotationStatus")`
3. **Hardening Revocation**: Merchant owner's `ROLE_SUPERADMIN` at `ROOT_RESOURCE` (0) is explicitly revoked on the resolver
4. **Registry Defense**: Off-chain trust-anchor verification returns `HOLD` on resolver mismatch

**Critical architectural constraint:** The RotationController calls `resolver.setText()` (line 401) and `resolver.text()` (lines 371, 374) on the resolver address provided in the constructor. The resolver must:
- Implement `IQuoteSealResolver` interface (`setText`, `text`, `resolve`, `getAlias`)
- Grant `RotationController` the `ROLE_SET_TEXT` permission for the specific text record resources
- **NOT** be the public ENS resolver (which would not have QuoteSeal-specific permissions)

---

## 3. Deployment Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEPOLIA DEPLOYMENT DEPENDENCY GRAPH          │
└─────────────────────────────────────────────────────────────────┘

  [PRE-EXISTING ON SEPOLIA]
  ┌──────────────┐    ┌──────────────────────────────────────┐
  │ ENS Registry │────│ ENS Root Registry                    │
  │ 0xbdc8...f0e2│    │ (ensdomains/registry on Sepolia)     │
  └──────┬───────┘    └──────────────────────────────────────┘
         │
         │ registers .eth TLD →
         ▼
  ┌──────────────┐
  │ .eth Registrar│ (ensdomains/registrar on Sepolia)
  └──────┬───────┘
         │
         │ owner of merchant.eth node
         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ [DEPLOYMENT STEP 1] PermissionedResolver (merchant-specific) │
  │  - Deploy new resolver contract                              │
  │  - Grant RotationController ROLE_SET_TEXT on:                │
  │    keccak256(node, "quoteseal.activePayTo")                  │
  │    keccak256(node, "quoteseal.pendingPayTo")                 │
  │    keccak256(node, "quoteseal.rotationStatus")               │
  │  - Revoke merchant owner's ROLE_SUPERADMIN at ROOT_RESOURCE  │
  └──────┬───────────────────────────────────────────────────────┘
         │ setResolver(node, resolverAddress)
         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ [DEPLOYMENT STEP 2] RotationController                       │
  │  - Constructor Config:                                       │
  │    merchantId = namehash(merchant.eth)                       │
  │    owner = merchant owner EVM address                        │
  │    guardian = guardian EVM address                           │
  │    attestor = backend attestor EVM address                   │
  │    registry = 0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2     │
  │    rootRegistry = ENS Root Registry address                  │
  │    resolver = <deployed PermissionedResolver address>        │
  │    dnsName = bytes("merchant.eth")                           │
  │    namehash = namehash("merchant.eth")                       │
  │    nameExpiry = > block.timestamp                            │
  │    delay = 86400                                             │
  │    maxAuthAge = 120                                          │
  │    attestationTTL = 300                                      │
  │    initialPayTo = "0.0.123" (canonical Hedera)               │
  │    initialProfileVersion = 1                                 │
  └──────┬───────────────────────────────────────────────────────┘
         │ emits MerchantConfigured
         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ [DEPLOYMENT STEP 3] Resolver text records                    │
  │  - RotationController writes via _write():                   │
  │    quoteseal.activePayTo = "0.0.123"                         │
  │    quoteseal.profileVersion = "1"                            │
  │    quoteseal.rotationStatus = "stable"                       │
  │    (done automatically in constructor via _checkContext/_write)│
  └──────┬───────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ [CONFIGURATION STEP 4] Backend environment variables         │
  │  - ROTATION_CONTROLLER_ADDRESS = <Step 2 address>            │
  │  - ATTESTOR_PRIVATE_KEY = real key (not test default)        │
  │  - OPERATOR_SUBJECT_HMAC_SECRET = real secret                │
  │  - ENCRYPTION_KEY_HEX = real key                             │
  │  - WORLD_ID_CLIENT_ID = real client ID                       │
  └──────────────────────────────────────────────────────────────┘
```

---

## 4. Exact Deployment Order

| Step | Action | Contract | Actor | Transaction Type |
|------|--------|----------|-------|------------------|
| 0 | Verify ENS Registry (`0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2`) has code on Sepolia | ENS Registry | Deployer | Read-only |
| 0 | Verify ENS Root Registry has code on Sepolia | Root Registry | Deployer | Read-only |
| 0 | Verify merchant owns `merchant.eth` node in ENS Registry | ENS Registry | Merchant Owner | Read-only |
| 1 | Deploy PermissionedResolver for merchant | Resolver | Deployer | State-changing (create2) |
| 2 | Grant `ROLE_SET_TEXT` to RotationController (future address) on 3 text resources | Resolver | Resolver Owner | State-changing |
| 3 | Revoke merchant owner's `ROLE_SUPERADMIN` at `ROOT_RESOURCE` | Resolver | Resolver Owner | State-changing |
| 4 | Set `resolver` for `merchant.eth` node in ENS Registry | ENS Registry | Merchant Owner | State-changing |
| 5 | Deploy RotationController with Config | RotationController | Deployer | State-changing (constructor) |
| 6 | RotationController constructor auto-writes resolver text records | Resolver (via controller) | RotationController | State-changing (internal `_write`) |
| 7 | Configure backend `ROTATION_CONTROLLER_ADDRESS` env var | — | DevOps | Configuration |
| 8 | Configure backend attestor/hmac/encryption/WORLD_ID secrets | — | DevOps | Configuration |

**Critical ordering constraint:** Steps 2-3 (resolver permissions) must occur BEFORE step 5 (RotationController deployment), because the constructor calls `_checkContext()` which calls `_write()` → `resolver.setText()`. If the resolver doesn't grant `RotationController` the `ROLE_SET_TEXT` permission, the constructor reverts with `ResolverWriteFailed`.

**Important:** Step 2 grants permission to the RotationController's future address. Since the controller address is determined at deployment (step 5), this requires either:
- A CREATE2 deterministic deployment to know the address beforehand, OR
- A two-phase approach: deploy resolver, grant permission to a placeholder, deploy controller, then update resolver permissions

---

## 5. Required Constructor Arguments (Exact Values)

| Argument | Type | Value Source | Example for Sepolia |
|----------|------|--------------|---------------------|
| `merchantId` | `bytes32` | `namehash("merchant.eth")` | `keccak256(abi.encode(namehash("eth"), keccak256("merchant")))` |
| `owner` | `address` | Merchant owner EVM address | `0x...` (merchant's EVM key) |
| `guardian` | `address` | Emergency authority EVM address | `0x...` (distinct from owner and attestor) |
| `attestor` | `address` | Backend attestor EVM address | `0x...` (matches `ATTESTOR_PRIVATE_KEY`) |
| `registry` | `address` | ENS Registry on Sepolia | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| `rootRegistry` | `address` | ENS Root Registry on Sepolia | Required (not in `.env.example`) |
| `resolver` | `address` | Deployed PermissionedResolver | `0x...` (from Step 1) |
| `dnsName` | `bytes` | UTF-8 bytes of DNS name | `0x086d65726368616e740365746800` (for "merchant.eth") |
| `namehash` | `bytes32` | Must equal `_parseName(dnsName)` | Same as `merchantId` |
| `nameExpiry` | `uint64` | ENS registry `expiry(node)` | Must be > `block.timestamp` |
| `delay` | `uint64` | Rotation timelock | `86400` (1 day, from `.env.example`) |
| `maxAuthAge` | `uint64` | OIDC auth max age | `120` (2 minutes, from `.env.example`) |
| `attestationTTL` | `uint64` | Attestation validity | `300` (5 minutes, from `.env.example`) |
| `initialPayTo` | `string` | Canonical Hedera account | `"0.0.123"` (must match `^0\.0\.[1-9][0-9]*$`) |
| `initialProfileVersion` | `uint256` | Starting version | `1` |

**Distinct-address constraint:** `owner`, `guardian`, and `attestor` must all be different addresses.

---

## 6. Required Role Assignments

### 6.1 Resolver → RotationController permissions

The PermissionedResolver must grant `RotationController` the `ROLE_SET_TEXT` operational role on these exact resources:

| Resource | Computation | Purpose |
|----------|-------------|---------|
| `keccak256(merchantNode, "quoteseal.activePayTo")` | Text key resource | Controller writes active payout on activation |
| `keccak256(merchantNode, "quoteseal.pendingPayTo")` | Text key resource | Controller writes pending payout on approval |
| `keccak256(merchantNode, "quoteseal.rotationStatus")` | Text key resource | Controller writes rotation status on state change |

### 6.2 Resolver → Merchant Owner restrictions

The merchant owner's `ROLE_SUPERADMIN` at `ROOT_RESOURCE` (0) must be revoked to prevent bypassing QuoteSeal's rotation gate.

### 6.3 RotationController internal roles

| Role | Value | Holder |
|------|-------|--------|
| `ROTATION_OPERATOR` | `1` | Enrolled operator EVM address |
| `owner` | Constructor arg | Merchant owner (enrolls operators) |
| `guardian` | Constructor arg | Emergency pause/unpause |
| `attestor` | Constructor arg | EIP-712 signature verification |

---

## 7. ENSv2 Configuration Sequence

### 7.1 Merchant identity vs ENS owner vs resolver vs payout (critical distinctions)

| Concept | Type | Example | Role in QuoteSeal |
|---------|------|---------|-------------------|
| **ENS Owner** | EVM address | `0x1234...` | Controls the ENS name node; can call `setResolver` |
| **Resolver** | EVM address | `0x5678...` (PermissionedResolver) | Stores text records; RotationController writes to it |
| **Merchant Identity** | `bytes32` namehash | `0xabcd...` | Used as `merchantId` in RotationController |
| **Payout Address** | Hedera account ID | `0.0.123` | Stored in `quoteseal.activePayTo` text record |
| **EVM Address** | `0x...` address | `0x9999...` | Used for owner/guardian/attestor/operator roles |

**These are five different things and must not be conflated.**

### 7.2 Required text records on PermissionedResolver

The RotationController writes these via `_write()` during constructor and lifecycle operations:

| Key | Value | Written by |
|-----|-------|------------|
| `quoteseal.activePayTo` | `0.0.123` | Constructor + `activateRotation()` |
| `quoteseal.profileVersion` | `1` | Constructor + `activateRotation()` |
| `quoteseal.pendingPayTo` | `0.0.456` | `approveWithAttestation()` |
| `quoteseal.pendingEffectiveAt` | `1793987092` | `approveWithAttestation()` |
| `quoteseal.rotationStatus` | `pending`/`stable` | `approveWithAttestation()`/`activateRotation()` |

The backend `EnsProfileResolver.resolveProfile()` reads these keys (lines 95-105 of `resolver.ts`):
- `quoteseal.activePayTo` (required)
- `quoteseal.pendingPayTo`
- `quoteseal.rotationStatus`
- `quoteseal.version` OR `quoteseal.profileVersion`
- `quoteseal.network`
- `quoteseal.scheme`
- `quoteseal.asset`
- `quoteseal.maxAmount`

---

## 8. Required Environment Variable Names

| Variable | Description | Required for Production | Example Value |
|----------|-------------|------------------------|---------------|
| `ROTATION_CONTROLLER_ADDRESS` | Deployed RotationController address | **YES** (currently zero) | `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` |
| `ENS_REGISTRY_ADDRESS` | ENS Registry on Sepolia | Yes | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| `ENS_RESOLVER_FACTORY_ADDRESS` | PermissionedResolver factory | Yes | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| `APPLICATION_CHAIN_ID` | Sepolia chain ID | Yes | `11155111` |
| `ATTESTOR_PRIVATE_KEY` | Backend attestor signing key | **YES** (not default) | Real 32-byte hex key |
| `OPERATOR_SUBJECT_HMAC_SECRET` | Subject HMAC secret | **YES** (not default) | Real 32+ byte secret |
| `ENCRYPTION_KEY_HEX` | PKCE encryption key | **YES** (not default) | Real 32-byte hex |
| `WORLD_ID_CLIENT_ID` | World ID OIDC client ID | **YES** (not default) | Real client ID |
| `SEPOLIA_RPC_URL_PRIMARY` | Primary Sepolia RPC | Yes | `https://ethereum-sepolia-rpc.publicnode.com` |
| `SEPOLIA_RPC_URL_SECONDARY` | Secondary Sepolia RPC | Yes | `https://gateway.tenderly.co/public/sepolia` |

---

## 9. Read-Only Verification Commands

All commands below are read-only. None deploy, sign, or modify state.

```bash
# 1. Verify ENS Registry has code on Sepolia
cast code 0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2 --rpc-url $SEPOLIA_RPC_URL_PRIMARY

# 2. Verify ENS Root Registry has code on Sepolia
cast code <ROOT_REGISTRY_ADDRESS> --rpc-url $SEPOLIA_RPC_URL_PRIMARY

# 3. Verify merchant owns merchant.eth node
cast call 0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2 \
  "owner(bytes32)" $(cast keccak "merchant.eth") \
  --rpc-url $SEPOLIA_RPC_URL_PRIMARY

# 4. Verify current resolver for merchant.eth
cast call 0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2 \
  "resolver(bytes32)" $(cast keccak "merchant.eth") \
  --rpc-url $SEPOLIA_RPC_URL_PRIMARY

# 5. Verify ENS name expiry
cast call 0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2 \
  "expiry(bytes32)" $(cast keccak "merchant.eth") \
  --rpc-url $SEPOLIA_RPC_URL_PRIMARY

# 6. Verify RotationController address is configured (should NOT be zero)
echo $ROTATION_CONTROLLER_ADDRESS

# 7. Verify Dual-RPC providers respond
cast block-number --rpc-url $SEPOLIA_RPC_URL_PRIMARY
cast block-number --rpc-url $SEPOLIA_RPC_URL_SECONDARY
```

---

## 10. State-Changing Transactions That Will Eventually Be Required

| Transaction | Contract | Purpose | Actor |
|-------------|----------|---------|-------|
| Deploy PermissionedResolver | Resolver | Create merchant-specific resolver | Deployer |
| `grantRoles(textResource, controller, ROLE_SET_TEXT)` | Resolver | Grant controller write permission | Resolver Owner |
| `revokeRootRoles(owner, ROLE_SUPERADMIN)` | Resolver | Remove owner's superadmin | Resolver Owner |
| `setResolver(node, resolverAddress)` | ENS Registry | Point merchant name to resolver | Merchant Owner |
| Deploy RotationController | Controller | Deploy with Config | Deployer |
| Constructor internal `_write()` calls | Resolver (via controller) | Write initial text records | RotationController |
| `enrollOperator(enrollment, ownerSignature)` | Controller | Authorize rotation operator | Merchant Owner |
| `proposeRotation(newPayTo, expiry)` | Controller | Create rotation proposal | Operator |
| `approveWithAttestation(approval, signature)` | Controller | Approve rotation (EIP-712) | Operator + Attestor |
| `activateRotation(proposalId)` | Controller | Activate after timelock | Operator |

---

## 11. Deployment Risks and Rollback Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `ROTATION_CONTROLLER_ADDRESS` is zero — backend fails production env validation | HIGH | Deploy contract first, then set env var |
| Resolver permissions granted before controller address known | MEDIUM | Use CREATE2 deterministic deployment or two-phase permission grant |
| Constructor `_checkContext()` reverts if resolver lacks `setText` permission | HIGH | Verify resolver permissions before deploying controller |
| `nameExpiry <= block.timestamp` causes constructor revert | MEDIUM | Set nameExpiry well in the future |
| `guardian == owner` or `attestor == owner` causes constructor revert | MEDIUM | Use three distinct EVM addresses |
| Merchant owner can call `setResolver` to point to malicious resolver | MEDIUM | Off-chain dual-RPC trust-anchor verification returns HOLD on resolver mismatch (documented in Spike 1) |
| Resolver owner can upgrade resolver implementation (UUPS bypass) | MEDIUM | Revoke `ROLE_UPGRADE` from all accounts on resolver |
| No deployment script exists — manual deployment error-prone | MEDIUM | Create Foundry deployment script before Sepolia deployment |

**Rollback:** If RotationController deployment fails, the resolver permissions (Step 2-3) can be revoked. If ENS Registry `setResolver` is called incorrectly, the merchant owner can call `setResolver` again to correct it. Once RotationController is deployed, it is non-upgradeable (no upgrade function exists).

---

## 12. Unresolved Architectural Incompatibility

**CRITICAL: The RotationController assumes direct write access to the resolver via `resolver.setText()` (line 401).** On live Sepolia ENSv2:

1. The public ENS resolver does **not** implement QuoteSeal's permission model. It does not have `ROLE_SET_TEXT` scoped to `quoteseal.*` keys for the RotationController.
2. A dedicated `PermissionedResolver` must be deployed per merchant (per Spike 1 architecture).
3. **The `install-deps.sh` script only installs OpenZeppelin and forge-std — there is no PermissionedResolver contract in the `contracts/` directory.** The `MockPermissionedResolver.sol` exists only in `spikes/ens-permissions/`, which is explicitly marked as a LOCAL SIMULATION ("MOCK STATUS: This is a LOCAL SIMULATION of the ENSv2 permission model").
4. No Foundry deployment script exists in `contracts/script/` except `install-deps.sh`.
5. The `ENS_RESOLVER_FACTORY_ADDRESS` env var references a factory (`0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef`) but there is no contract code or integration with it in the repo.

**This is an architectural gap:** The repo contains no production-ready PermissionedResolver contract and no deployment script to create one, grant permissions, and wire it to the RotationController. The Spike 1 mock must be replaced with a real, audited PermissionedResolver implementation before Sepolia deployment.

---

## 13. Backend Compatibility with Deployed Addresses

| Backend Component | Config Source | Sepolia Readiness |
|-------------------|---------------|-------------------|
| `LiveRotationControllerClient` | `ROTATION_CONTROLLER_ADDRESS` env var | ❌ Zero address — will fail |
| `DualRpcClient` | `SEPOLIA_RPC_URL_PRIMARY/SECONDARY` | ✅ Configured |
| `EnsProfileResolver` | `ENS_REGISTRY_ADDRESS` env var | ✅ Default present |
| `AttestorService` | `ATTESTOR_PRIVATE_KEY` env var | ❌ Default test key rejected in prod |
| `OperatorEnrollmentService` | `OPERATOR_SUBJECT_HMAC_SECRET` | ❌ Default secret rejected in prod |
| `validateEnv()` production check | All of the above | ❌ Will reject production startup |

---

## 14. Readiness Classification: BLOCKED_BY_CONFIGURATION

**The core cannot be deployed to Sepolia as-is.**

### Blocking Issues (must be resolved before deployment):

1. **`ROTATION_CONTROLLER_ADDRESS` is zero** — Backend production env validation explicitly rejects this (`packages/shared/src/config/index.ts:67-69`).
2. **No PermissionedResolver contract exists** in `contracts/` — Only a mock exists in `spikes/ens-permissions/`. The RotationController requires a resolver with QuoteSeal-specific `ROLE_SET_TEXT` permissions.
3. **No deployment script** — `contracts/script/` contains only `install-deps.sh`. No Foundry script to deploy resolver, grant permissions, and deploy controller.
4. **Production secrets use defaults** — `ATTESTOR_PRIVATE_KEY`, `OPERATOR_SUBJECT_HMAC_SECRET`, `ENCRYPTION_KEY_HEX`, `WORLD_ID_CLIENT_ID` all have default values that `validateEnv()` rejects in production.
5. **`rootRegistry` address not configured** — Required by RotationController constructor but not present in `.env.example`.

### Items already correct (not blocking):

- `APPLICATION_CHAIN_ID = 11155111` ✅ Correct for Sepolia
- `ENS_REGISTRY_ADDRESS` default present ✅
- `ENS_RESOLVER_FACTORY_ADDRESS` default present ✅ (but no factory integration code)
- Dual-RPC configuration ✅
- Contract source compiles (Foundry build artifacts exist) ✅
- ABI matches compiled artifact ✅ (verified in prior audit)
- T1–T16 security invariants verified ✅
- Local EVM integration verified ✅

### Path to READY_TO_DEPLOY:

1. Develop/productionize the PermissionedResolver contract (from Spike 1 mock) in `contracts/src/`
2. Create Foundry deployment script for: deploy resolver → grant permissions → revoke superadmin → set ENS resolver → deploy RotationController
3. Set `ROTATION_CONTROLLER_ADDRESS` to the deployed contract address
4. Replace all default test secrets with real production values
5. Add `ENS_ROOT_REGISTRY_ADDRESS` env var
6. Run `validateEnv()` in production to confirm no rejection
7. Execute deployment on Sepolia using the script
