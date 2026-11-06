# QuoteSeal Spike 1: ENSv2 Bypass Test Suite & Verification Results

This document records the exact test scenarios, execution traces, revert reasons, and state verification outcomes for the ENSv2 Permission Isolation Proof-of-Concept.

## Test Environment

- **Framework**: Foundry 1.9.0 (Solc 0.8.24, Cancun EVM)
- **Suite Location**: `spikes/ens-permissions/test/ENSPermissionsSpike.t.sol`
- **Total Tests Executed**: 14 unit tests + 1 property fuzz test (1,000 runs)
- **Overall Result**: **14 PASSED / 0 FAILED**

---

## Detailed Test Case Results

| Test ID | Scenario / Vector | Actor | Function Attempted | Expected Result | Actual Result | Revert Reason / Event | Payout Record Changed? | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Dedicated Resolver Setup Verification | Setup | `registry.resolver(node)`, `resolver.text(node, key)` | Dedicated instance points to merchant node; default profile initialized | PASS | `emit ControllerInitialized(...)` | NO (Initialized to `0.0.123456`) | VERIFIED LOCALLY |
| **TEST-02** | RotationController Least-Privilege Scoping | Inspection | `resolverContract.hasRoles(...)` | Has `ROLE_SET_TEXT` only for `activePayTo`, `pendingPayTo`, `rotationStatus`. No root/upgrade/link roles. | PASS | N/A (View assertions pass) | NO | VERIFIED LOCALLY |
| **TEST-03** | Merchant Owner Direct Payout Write Bypass | `merchantOwner` | `resolver.setText(MERCHANT_NODE, "quoteseal.activePayTo", "0.0.999999")` | Revert due to lack of `ROLE_SET_TEXT` at resource level | PASS | `EACUnauthorizedAccountRoles(resource, owner, ROLE_SET_TEXT)` | **NO** | VERIFIED LOCALLY |
| **TEST-04** | Unauthorized Admin Re-Granting Setter Role | `unauthorizedAdmin` | `resolver.grantRoles(resource, attacker, ROLE_SET_TEXT)` & `grantRootRoles` | Revert due to missing `ROLE_SET_TEXT_ADMIN` or `ROLE_SUPERADMIN` | PASS | `EACUnauthorizedAccountRoles` on grant calls | **NO** | VERIFIED LOCALLY |
| **TEST-05** | Root Role Escalation & Self-Restore | `merchantOwner` | `resolver.grantRootRoles(merchantOwner, ROLE_SUPERADMIN)` | Revert because owner's `ROLE_SUPERADMIN` was revoked during hardening | PASS | `EACUnauthorizedAccountRoles(0, owner, ROLE_SUPERADMIN)` | **NO** | VERIFIED LOCALLY |
| **TEST-06** | `ROLE_LINK` Node Resolution Redirect | `attackerWallet` | `resolver.grantRootRoles(attacker, ROLE_LINK)` | Revert; no actor holds `ROLE_LINK` or `ROLE_LINK_ADMIN` | PASS | `EACUnauthorizedAccountRoles` | **NO** | VERIFIED LOCALLY |
| **TEST-07** | Unauthorized Resolver Implementation Upgrade | `attackerWallet`, `merchantOwner` | `resolver.upgradeTo(rogueImplementation)` | Revert; neither attacker nor post-hardening owner holds `ROLE_UPGRADE` | PASS | `EACUnauthorizedAccountRoles(0, caller, ROLE_UPGRADE)` | **NO** | VERIFIED LOCALLY |
| **TEST-08** | Registry-Level Resolver Reassignment | `merchantOwner` | `registry.setResolver(MERCHANT_NODE, rogueResolver)` | Registry allows owner to update resolver, BUT buyer-side trust anchor detects mismatch and issues HOLD | PASS | `emit ResolverChanged(...)`; Trust anchor mismatch detected -> verdict: `HOLD` | NO (Inside original resolver) | VERIFIED LOCALLY |
| **TEST-09** | ERC-1155 Operator Approval Bypass | `erc1155Operator` | 1. Direct `setText`<br>2. Transfer name token via operator, then `setText` | Revert on direct write; token transfer succeeds but new token holder inherits zero resolver roles | PASS | `EACUnauthorizedAccountRoles` on both write attempts | **NO** | VERIFIED LOCALLY |
| **TEST-10** | Controller-Authorized Payout Update | `RotationController` (via system) | `rotationController.updateActivePayTo("0.0.789012")` | Success; `activePayTo` record is updated to new address | PASS | `emit TextChanged(...)`, `emit PayoutUpdated(...)` | **YES** (Updated to `0.0.789012`) | VERIFIED LOCALLY |
| **TEST-11** | Trust Anchor Change Detection | Validation Engine | Expiry update, Resolver change, Profile version change | Buyer guard detects changes from pinned onboarding anchors, triggering HOLD | PASS | Anchor mismatch flags triggered (`expiryChanged`, `resolverChanged`) | NO | VERIFIED LOCALLY |
| **TEST-12** | Unknown Attacker Comprehensive Attack | `attackerWallet` | 1. Direct `setText`<br>2. `grantRoles`<br>3. `grantRootRoles`<br>4. `upgradeTo` | All 4 distinct attack vectors revert | PASS | `EACUnauthorizedAccountRoles` for all 4 attempts | **NO** | VERIFIED LOCALLY |
| **TEST-13** | Fuzz: Random Caller Payout Modification | Arbitrary `address` (1,000 runs) | `resolver.setText(MERCHANT_NODE, "quoteseal.activePayTo", "0.0.999999")` | Revert for all callers `!= rotationController` | PASS | All 1,000 calls reverted with `EACUnauthorizedAccountRoles` | **NO** | VERIFIED LOCALLY |
| **TEST-14** | Full Authorized Lifecycle & Write-Back Lock | Multi-actor | 1. Controller sets `pending`<br>2. Controller activates `0.0.789012`<br>3. Owner attempts rollback to `0.0.123456` | Step 1 & 2 succeed. Step 3 (owner write-back) reverts. | PASS | Step 1 & 2 succeed; Step 3 reverts with `EACUnauthorizedAccountRoles` | **YES (Controlled)** -> `0.0.789012` | VERIFIED LOCALLY |

---

## Key Revert Signatures Verified

1. `EACUnauthorizedAccountRoles(uint256 resource, address account, uint256 roles)`:
   - Emitted whenever an account lacks either operational or administrative bitmask permissions for a target resource or root resource.
2. `EACRootResourceNotAllowed()`:
   - Thrown when attempting to use scoped `grantRoles`/`revokeRoles` on `ROOT_RESOURCE` (0).
