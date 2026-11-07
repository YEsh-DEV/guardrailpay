# QuoteSeal Merchant Authorization Architecture

Status: implementation design for the isolated ENSv2 compatibility branch. No live ENSv2 integration or Sepolia deployment is claimed.

## 1. Decisions and scope

The immediate compatibility patch keeps `RotationController` as the single-payout authority for ENS merchants. It changes only its ENS boundary: DNS-wire name setters, resolver-profile reads, registry identity checks, and fail-closed EAC lock checks. The existing 12-field `RotationApproval`, EIP-712 domain, proposal ID, delay, state transitions, operator enrollment, guardian pause, emergency cancellation, and nonce behavior remain unchanged.

For the longer-term common identity model, introduce a separate non-upgradeable `MerchantAuthorizationRegistry` (MAR) as the canonical identity and payout-policy authority. Keep identity-specific verification outside its storage model: an ENSv2 verifier validates registry ownership, expiry, resolver, and locked profile; a native-identity attestor validates domain-control challenges off-chain and signs a short-lived EIP-712 registration/update authorization. MAR stores commitments and authorization state, not raw proofs or secrets. A future rotation controller consumes MAR state and is the sole writer of active payout authorization. Do not deploy MAR beside the current RotationController until migration semantics are approved; two active payout authorities would be unsafe.

This is less disruptive than making ENS concepts optional in the current contract and avoids encoding a native merchant as a fake ENS name. It does require a new contract version and an explicit migration/deprecation plan for existing controllers. In the current patch, ENS-backed payout data remains in the resolver and is gated by RotationController.

## 2. ENSv2 interface and verified deployment references

The ENS documentation describes Permissioned Resolver writes as `setText(bytes name,string key,string value)` with DNS-wire names; reads are profile calldata sent to resolver `resolve(bytes name,bytes data)`. Permissioned Resolver does not expose direct `text(bytes32,string)` getters and has no `getAlias(bytes)` dependency. Resolver instances are UUPS proxies. Resolver EAC setter permissions are key-scoped across every name served by that resolver, not name-scoped. Root grants override key-scoped grants; role-admin roles can re-grant roles; `ROLE_LINK` can relink records; `ROLE_UPGRADE` can replace the implementation.

Published ENS Sepolia deployment table (checked during this task):

| Component | Address | Use |
|---|---|---|
| PermissionedResolverImpl | `0x115eb53f0c60696633855f90b138178fb40b2b2c` | Published implementation reference; not an individual merchant proxy |
| ETHRegistry | `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4` | ETH namespace registry implementation/deployment reference |
| RootRegistry | `0xb458d6a3a77919449d03e7a6903c26827c1ec43f` | ENSv2 root registry |
| UniversalResolverV2 | `0x24e1d8e068620b647ca097f961a61055f4f42d72` | Canonical public resolution service |
| UpgradableUniversalResolverProxy | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` | Resolver proxy address in deployment table |

The current controller does direct resolver `resolve(name,data)` calls, which is the Permissioned Resolver profile entry point. It does not call the Universal Resolver itself. That is valid for validating a configured resolver directly, provided registry resolution independently proves the exact resolver/name binding. Buyer-facing general resolution should continue using ENS Universal Resolver.

Published resolver ABI signatures used by the patch: `setText(bytes,string,string)`, `resolve(bytes,bytes)`, `hasRoles(uint256,uint256,address)`, `hasAssignees(uint256,uint256)`, `roleCount(uint256)`, and `getAssigneeCount(uint256,uint256)`. Registry signatures retained from the published Permissioned Registry API include `getSubregistry(string)`, `getResolver(string)`, `findOwner(string)`, and `findExpiry(string)`. These selectors are drawn from ENS’s published Sepolia deployment JSON/ABI and official docs, not inferred from the old local mocks.

Sources: [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/), [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/), [ENS deployments](https://docs.ens.domains/learn/deployments/), [published Sepolia PermissionedResolverImpl ABI](https://github.com/ensdomains/contracts-v2/blob/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/PermissionedResolverImpl.json).

## 3. ENS name, registry, ownership, and record validation

The configured DNS name must be canonical DNS-wire encoding: each label is length-prefixed, labels are in DNS order, and the name ends in a zero byte. The constructor/configuration must reject malformed lengths, missing terminator, trailing bytes, empty interior labels, and a name whose recomputed ENS namehash differs from configured `namehash`. Production name normalization occurs before encoding; the Solidity controller validates wire structure and expected identity, not Unicode normalization.

The controller follows `getSubregistry(label)` from the pinned root registry from the rightmost TLD toward the leaf, then checks the leaf registry’s resolver, `findOwner`, and `findExpiry`. A missing child registry, zero resolver, owner mismatch, changed resolver, expired name, or expiry mismatch is a trust-anchor change and must fail closed. Parent/subregistry hierarchy changes are therefore detected through the path read on each validation. A name transfer changes owner and fails closed until explicit re-trust/redeployment/configuration.

The protected records are `quoteseal.activePayTo`, `quoteseal.profileVersion`, `quoteseal.pendingPayTo`, `quoteseal.pendingEffectiveAt`, and `quoteseal.rotationStatus`. The controller must be the sole setter-role assignee for all five keys, with no key-scoped setter-admin grants. Reads encode the exact `text(bytes32,string)` profile calldata and call the configured resolver’s `resolve(dnsName, calldata)`. The returned bytes must ABI-decode as one string and match the controller’s state exactly. Writes call `setText(dnsName,key,value)`, then re-read through `resolve` and require an exact match. Empty/malformed/reverting responses are unverifiable and abort the state transition.

## 4. EAC policy and proxy-upgrade boundary

Configuration must use a dedicated resolver for the merchant name. The controller must have `ROLE_SET_TEXT` only for the two QuoteSeal text-key resources, derived by the resolver as `keccak256(bytes(key))`. The resolver’s root `ROLE_SET_TEXT` and `ROLE_SET_TEXT_ADMIN` must have no assignees. Each protected key must have the controller as its only `ROLE_SET_TEXT` assignee and no `ROLE_SET_TEXT_ADMIN` assignee. This prevents the owner or another account from directly changing QuoteSeal records and prevents role admins from re-granting setter access.

For the served resolver, root `ROLE_LINK`, `ROLE_LINK_ADMIN`, `ROLE_UPGRADE`, and `ROLE_UPGRADE_ADMIN` must be permanently revoked from all accounts. The controller checks absence of those root roles/admins on every validation. `ROLE_LINK` is security-critical because it can redirect the record bundle without touching either payout key. UUPS upgrades are controlled by `ROLE_UPGRADE`; removing its admin prevents later re-grant. This is an irreversible resolver lock. If the merchant cannot accept this policy, this controller integration cannot safely claim resolver-payout authority.

The old `address(resolver).codehash` pin is removed because it fingerprints the proxy shell, not its implementation. The on-chain controller cannot read another account’s ERC-1967 storage slot. It instead requires the ungrantable EAC upgrade and link roles to be absent, making a role-authorized implementation change unavailable. Deployment tooling and the backend trust reader must independently query the resolver proxy’s EIP-1967 implementation slot and implementation bytecode against two independent Sepolia RPCs, compare registry/name/resolver/profile reads at a common finalized block, and return UNVERIFIABLE on disagreement. A resolver proxy whose upgrade authorization cannot be established is not trusted. No claim is made that codehash pinning alone detects upgrades.

Registry resolver-setting authority is separate from resolver EAC. The controller re-checks the leaf resolver mapping every time. The merchant owner or registry actors may change it, but the next controller check fails closed. The owner retains control over other keys only to the extent allowed by the same resolver’s EAC; a dedicated per-merchant resolver avoids key-scope inheritance across unrelated names. Existing dangerous registry root roles, ERC-1155 operator approvals, registry implementation upgrades, resolver ownership, and parent-registry authority remain external trust boundaries and must be monitored by the independent RPC reader. They cannot be made safe by checking only ordinary setter roles.

## 5. Common merchant identity model (MAR target)

Logical record:

```text
MerchantAuthorization {
  bytes32 merchantId;                 // stable QuoteSeal ID, never derived from mutable display data
  IdentityType identityType;           // ENSV2 or QUOTESEAL_NATIVE
  bytes32 identityRefHash;             // ENS namehash or native challenge identity commitment
  address ownerWallet;                 // verified wallet, explicit reauthorization on change
  bytes32 endpointOriginHash;          // keccak256(canonical scheme://host[:port])
  bytes32 payoutPolicyHash;            // committed policy, never authority in PostgreSQL/Arkiv
  uint64 profileVersion;               // strictly monotonic
  Status status;                       // ACTIVE, SUSPENDED, REVOKED
  address payoutController;            // sole active payout state writer
}
```

Authoritative on-chain fields: `merchantId`, identity type/ref commitment, owner wallet, endpoint-origin commitment, payout policy commitment, profile version, status, active payout/payout-set root, and controller address. PostgreSQL stores onboarding workflows, encrypted/non-secret operational configuration, audit event references, endpoint metadata, verification state, and proposal records. Arkiv may store public discovery metadata and signed/public announcement references. Neither is an authorization source. Endpoint URL paths, display name, logo, contact details, and search tags are discovery metadata; the security commitment is the canonical origin hash.

Identity changes, owner changes, endpoint-origin changes, and payout-policy changes increment the monotonic profile version and require reauthorization. Suspension/revocation is an explicit on-chain state transition and causes the buyer guard to HOLD/BLOCK. Reactivation requires a fresh owner authorization and version increment; there is no implicit fallback.

### ENSv2 registration

Registration binds stable merchantId to normalized ENS namehash, expected registry path, owner wallet, resolver proxy, expiry, endpoint origin hash, and controller. ENS ownership/expiry/resolver/profile are rechecked on trust reads. The registry and resolver remain external identity authorities; a transfer, expiry, resolver change, resolver upgrade permission, role escalation, or read disagreement returns UNVERIFIABLE/HOLD and requires re-trust.

### QuoteSeal-native registration

Native registration does not fabricate an ENS name. The owner proves wallet control by signing a one-time, short-lived registration authorization. A backend domain verifier performs DNS TXT or HTTPS `/.well-known/quoteseal` challenge validation and signs a domain attestation. This asserts that the configured attestor observed the challenge; DNS is not verified by the EVM itself.

Suggested typed data (separate from RotationApproval):

```text
NativeMerchantDomainAttestation(
  bytes32 merchantId,
  address ownerWallet,
  bytes32 originHash,
  bytes32 challengeHash,
  uint256 nonce,
  uint64 issuedAt,
  uint64 expiry,
  uint64 profileVersion,
  address registry
)
```

EIP-712 domain name/version/chainId/verifyingContract are fixed by MAR deployment. Contract checks an enrolled attestor, chain and registry binding, exact merchant/owner/origin, unused nonce, `issuedAt` freshness, expiry, and expected next profile version. Owner authorization is independently verified, preferably as a separate signature to avoid making the domain attestor equivalent to the owner. Consumed nonces are one-use. Attestor revocation, owner revocation, domain change, and suspension increment version and invalidate prior attestations. Compromise of the domain attestor can falsely assert domain control, so use a narrowly scoped, rotatable attestor role and short TTL; disclose the trust assumption in product and operations.

## 6. Common authorization contract boundary

MAR is planned as a non-upgradeable contract with an explicit owner-governed role model or a multisig-controlled immutable implementation. It is not a generic storage oracle. Registration and updates require identity-specific verifier authorization plus owner consent. Payout changes use a dedicated controller and retain explicit approval, expiry, replay protection, delay, activation, cancellation, pause, and state events. Pause/security roles cannot approve or activate payouts. Database services can submit/relay authorized calls but cannot create authorization.

Migration from existing RotationController is not automatic: `merchantId`, EIP-712 verifying-contract domain, nonce space, proposal IDs, and payout state are address-bound. Existing signatures must never be accepted by a new controller. Existing merchant must explicitly enroll on the new authority; buyer trust configuration changes atomically to the new controller/version only after state is independently verified.

## 7. Payout policy and multiple wallets

Current frozen guard and current controller authorize one active `payTo`. Keep that policy until a separate guard change is approved. Do not claim a set commitment is enforceable by the present guard.

Future option: sorted Merkle tree with leaves `keccak256(abi.encode(merchantId, profileVersion, payoutAddress, assetPolicyHash, networkPolicyHash, amountLimit, validity))`. MAR stores root and monotonically increasing payout-set version. A proof binds exact merchant, version, wallet, asset/network policy, and validity. Enrollment/removal is owner-authorized, proposal-bound, timelocked, explicitly activated, and increments profile version. Suspension/revocation is immediate through a security role and invalidates the version/root; restoring requires a new proposal/version. No leaf is usable merely because its proposal delay elapsed. Replay protection is by proposal nonce and version.

The backward-compatible guard extension is a new optional `payoutAuthorization` object: `{mode:"single"}` for current merchants or `{mode:"merkle",root,version,leaf,proof[]}` for future merchants. The verifier reads root/version/status from authoritative chain state and verifies the leaf locally; missing proof, stale version, state disagreement, unsupported mode, or RPC disagreement is non-PASS. This needs explicit schema/API versioning and tests for forged proofs, wrong merchant/version, revoked root, asset/network/limit mismatch, and signer-zero for every failure. Do not change the frozen guard or signer boundary in this branch.

## 8. Backend interface

Normalized read response (proposed coordination interface; not yet an implemented or approved API):

```json
{
  "merchantId": "bytes32",
  "identityType": "ENSV2|QUOTESEAL_NATIVE",
  "identityRef": "namehash-or-opaque-commitment",
  "ownerWallet": "address",
  "endpointOriginHash": "bytes32",
  "activePayTo": "string",
  "profileVersion": "uint256-decimal-string",
  "trustStatus": "TRUSTED|HOLD|UNVERIFIABLE|REVOKED",
  "blockNumber": "uint64-decimal-string",
  "stateDigest": "bytes32"
}
```

ENS reads include registry hierarchy, owner, expiry, resolver, relevant EAC roles/admins, proxy implementation slot, and profile records, all tagged to one finalized block and cross-checked via independent RPCs. Native reads include MAR identity/status/version/payout state and the attestation issuer configuration. Any missing field or inconsistent block/state is non-PASS. The buyer guard remains the sole evaluator and signer-boundary policy; this interface does not introduce another guard.

## 9. Deployment and testing strategy

1. Compile against the published ENS ABI surface and preserve the existing controller typed-data constants byte-for-byte.
2. Add explicit DNS packet validation and known-vector namehash tests.
3. Use actual published ABI definitions for resolver/registry call encoding. Unit mocks are only for isolated negative cases, not evidence of deployed compatibility.
4. Run local lifecycle/fuzz tests for record reads/writes and fail-closed state transitions.
5. Run Sepolia read-only fork tests against official deployed contracts where available. A fork cannot prove a merchant’s role configuration unless a real resolver/name is supplied; report that as unverified rather than substituting a mock.
6. Before any write deployment, require a separately reviewed resolver permission manifest, actual resolver proxy, confirmed ownership/expiry, dedicated resolver, controller key grants, absent role admins/link/upgrade roles, and dual-RPC finalized read agreement.
7. No contract deployment, ENS mutation, or real key use is part of this task.

## 10. Explicit non-goals and unresolved deployment prerequisites

- No native-merchant or MAR contract is implemented in the ENS compatibility patch.
- No multi-payout support is implemented; one active payout remains required.
- Current controller cannot itself perform independent RPC consensus. Backend trust reads must do that and fail closed.
- Resolver implementation slot validation is an off-chain read because EVM contracts cannot read another account’s storage. The on-chain safety relies on permanently removing resolver upgrade and upgrade-admin authority.
- ENS Sepolia deployment addresses establish protocol ABI/deployment references, not that any particular merchant name, resolver proxy, owner, expiry, roles, or controller permissions are configured.
- No live ENSv2 integration is claimed until a real Sepolia name/resolver configuration is verified.

### Read-only Sepolia evidence observed during this task

At finalized block `12079438` (`0xafee675e2c3e79742feb1697f37b88875a07d74`), one accessible Sepolia RPC reported chain ID `11155111` and non-empty code at all four published addresses above (PermissionedResolverImpl: 15,608 bytes; ETHRegistry: 16,000; RootRegistry: 16,000; UniversalResolverV2: 18,792). The read-only Foundry fork test also passed the Permissioned Resolver `supportsInterface(0x9061b923)` check against the published implementation. Multiple independent public RPC endpoints returned HTTP 403 in this environment; therefore dual-RPC finalized-state agreement was not established. No merchant resolver proxy, name state, EAC role configuration, or controller permissions were read or changed.
