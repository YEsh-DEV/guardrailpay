# QuoteSeal Spike 1: ENSv2 Permission Isolation Proof-of-Concept

## Objective

Prove or disprove whether QuoteSeal can securely enforce merchant payout rotation exclusively through ENSv2 Permissioned Resolvers:

> **Core Security Guarantee**: "A merchant owner or other unauthorized privileged actor cannot change the active payout address without passing through QuoteSeal's authorized RotationController."

## Architecture

This Foundry proof-of-concept simulates ENSv2's Enhanced Access Control (EAC) architecture:

1. **Dedicated Merchant Resolver**: Each merchant uses an independent, unshared `PermissionedResolver` instance deployed from `VerifiableFactory`.
2. **Resource-Scoped Setter Roles**: `RotationController` receives `ROLE_SET_TEXT` scoped strictly to:
   - `keccak256(merchantNode, "quoteseal.activePayTo")`
   - `keccak256(merchantNode, "quoteseal.pendingPayTo")`
   - `keccak256(merchantNode, "quoteseal.rotationStatus")`
3. **Hardening Revocation**: The merchant owner's initial `ROLE_SUPERADMIN` at `ROOT_RESOURCE` (0) is explicitly revoked on the resolver.
4. **Registry Defense**: The merchant owner's residual ability to invoke `setResolver` at the ENS Registry level is neutralized by QuoteSeal's off-chain trust-anchor verification (dual-RPC buyer pre-signing guard), which returns `HOLD` on any resolver mismatch.

## Project Structure

```
spikes/ens-permissions/
├── foundry.toml                                  # Solc 0.8.24, Cancun EVM configuration
├── README.md                                     # This document
├── src/
│   ├── interfaces/
│   │   ├── IEnhancedAccessControl.sol           # Documented ENSv2 EAC interface
│   │   └── IPermissionedResolver.sol            # Resolver & Registry interface definitions
│   ├── MockPermissionedResolver.sol             # EAC simulation with resource bitmasks & UUPS
│   ├── MockPermissionedRegistry.sol             # Registry simulation with ERC-1155 & resolver mapping
│   └── MockRotationController.sol               # Minimal RotationController write gatekeeper
└── test/
    └── ENSPermissionsSpike.t.sol                # Comprehensive 14-test bypass suite + fuzzing
```

## Running the Tests

To compile and execute the test suite:

```shell
cd spikes/ens-permissions
forge test -vvv
```

To run property fuzz testing with 1,000 randomized iterations:

```shell
forge test --match-test "testFuzz" -vvv --fuzz-runs 1000
```

## Test Results

- Total Tests: 14 unit + 1 fuzz (1,000 runs)
- Result: **14 Passed, 0 Failed**
- All 11 bypass vectors (direct owner write, unauthorized admin role re-grant, root escalation, `ROLE_LINK`, `ROLE_UPGRADE`, registry reassignment, ERC-1155 operator approval, unauthorized write-back) successfully rejected or detected.

Detailed documentation:
- `docs/spike-1-ens-results.md`
- `docs/spike-1-ens-permission-matrix.md`
- `docs/spike-1-ens-bypass-tests.md`
