# ENSv2 compatibility investigation — BLOCKED

Baseline cd5dbf4. Investigation stopped on concrete security requirements, without changing the frozen contracts or deploying. No claim of completed native integration tests.

## Authoritative versions

The default Git checkout of ensdomains/namechain and contracts-v2 returned 48b3e2d39513b9dd32ef1850877a29009bc807b9, exactly the revision documented in IENSContext.sol. That older implementation really implements the existing interface. The official Sepolia deployment documentation instead pins contracts-v2 revision 07e55a056f5b6a9c90119f501bdd05714e67dddd. Fetching that exact commit confirms the DNS-name-based record architecture. Do not use default branch checkout as deployment evidence.

Official implementation: 0x115eb53f0c60696633855f90b138178fb40b2b2c. Both PublicNode and Tenderly returned 15,608 runtime bytes at finalized state. Raw artifact comparison differs because of immutables. PublicNode runtime matches the published artifact after masking only compiler-declared immutable references (32 bytes at offsets 8284, 8325, 8727); deployed library links are empty. This verifies code correspondence excluding those slots, not merchant proxy configuration or role safety.

Sources:
- https://docs.ens.domains/ensv2/permissioned-resolver/
- https://docs.ens.domains/learn/deployments/
- https://github.com/ensdomains/contracts-v2/tree/07e55a056f5b6a9c90119f501bdd05714e67dddd

## Exact incompatibilities

| Existing call/model | Published deployment |
|---|---|
| Controller setText(bytes32,string,string) | setText(bytes,string,string), with canonical DNS-encoded name |
| Controller/backend standalone text(bytes32,string) | resolve(bytes,bytes) dispatches encoded text(bytes32,string); embedded node is ignored in favor of DNS name |
| Controller getAlias(bytes) | Absent; record linking and root fallback replace this older alias model |
| Controller pins resolver.codehash | Proxy runtime hash stays constant across implementation upgrades |
| Backend owner(bytes32), resolver(bytes32), expiry(bytes32) | Hierarchical registry getSubregistry(string), getResolver(string), findOwner(string), findExpiry(string) |
| Backend version fallback/parseInt | Missing/malformed/unsafe version must fail closed, not become 1 or a truncated integer |
| Old mock permission resource model | Key-scoped roles apply across every name on a resolver; generic grantRoles reverts on current resolver |

The controller's label-based registry read signatures remain compatible. Registry setResolver accepts uint256 anyId; deployment must use the proper current name registry and label/token identity. ERC1155 operator approvals inherit name-owner registry roles. Controller constructor only reads context; prior report's claim that it writes records during construction is incorrect.

## Preferred design: A, native integration

Modify native calls in controller and backend together, preserving merchantId, namehash, DNS name, key names, proposal construction and the 12-field approval schema. Use the same DNS bytes for all reads/writes. Read every protected record through resolve and decode its profile response. No generic name/key write entrypoint should be exposed by the controller.

An adapter would introduce another trusted contract and complicate the pinned resolver identity. The existing controller requires registry.getResolver(label) == its resolver address. Keeping native resolver in the registry while passing adapter as controller resolver fails that check; putting adapter in the registry changes the signed resolver identity and adds proxy forwarding responsibilities. It is not a drop-in compatibility shim.

Store existing keys unchanged: quoteseal.activePayTo, pendingPayTo, pendingEffectiveAt, rotationStatus and profileVersion, with network/scheme/asset/maxAmount policy fields. Create a dedicated merchant record explicitly; do not rely on root fallback. Preserve initial version and increment only on explicit activation. Keep pending state updates after approval and preserve atomic write rollback. The native resolver does not store proposal hashes today; proposal identity remains in controller state and EIP-712, unchanged.

## Security conditions required before implementation is accepted

1. Dedicated merchant resolver proxy; controller bound to exactly one normalized DNS name/namehash. Pin a nonzero record ID and reject relinking, while recognizing that aliases sharing that record also change its values.
2. Controller alone holds setters for protected keys. Permission checks must include root and key scopes and all assignees, using the real EAC implementation. Remove protected setter admins, root text setter/admin, LINK/admin and UPGRADE/admin from every other principal. Check EAC admin escalation paths; revoking ordinary setters alone is insufficient.
3. Retain merchant access to unrelated records through narrowly scoped key permissions and other record-type roles. Do not retain root text admin as a convenience: it can regrant protected payout access.
4. Independently establish proxy implementation identity and role invariants. Current resolver.codehash is not enough. Either prove irreversible removal of upgrade/link/admin authority on the verified native implementation or implement a reviewed trusted verification mechanism. A view on an untrusted upgraded implementation cannot prove its own integrity.
5. Registry root/admin, resolver-setting, inherited ERC1155 operator and name-expiry authorities remain trust boundaries. Every owner/resolver/expiry change must trigger HOLD and explicit re-trust in backend and buyer.
6. Backend must traverse the same root-to-name registry path, read the same DNS name through resolve, and obtain coherent finalized anchors/profile data. Preserve integer version precision or fail closed at unsupported values; no default-to-1 parsing.
7. Native implementation pins Solidity 0.8.25; current controller pins 0.8.24. Keep controller compiler semantics unchanged using a separately compiled pinned native deployment artifact or isolated native test project; do not silently raise the controller compiler to make imports compile.

## Verification status and remaining prerequisites

Completed: direct inspection of controller/interfaces/backend/tests, exact deployment-source checkout, published ABI signature inventory, dual-provider deployed implementation code retrieval and immutable-aware comparison against published artifact.

NOT COMPLETED: real native resolver creation/write/read integration, grant/revoke/admin/upgrade attack tests, native registry deployment lifecycle, backend profile parity, native pending/activation lifecycle, new native contract build. Existing Foundry fixtures use ResolverMock and RegistryMock; they cannot prove these properties. No mock was substituted for a native integration proof, and unchanged legacy tests were not rerun as evidence of compatibility.

Required next: an isolated real ENSv2 proxy/registry fixture pinned to the published revision and dependencies, permission hardening checks against actual EAC, then native controller/backend changes and full local lifecycle/signer regression suite. Sepolia prerequisites: verified merchant ownership/expiry/root path, dedicated proxy and record, exact role grants/revocations, fresh separate owner/guardian/attestor/operator configuration, bytecode provenance and explicit approval of concrete transactions. New controller deployment changes its address and therefore proposal IDs/EIP-712 verifyingContract, even if the formulas and fields remain unchanged; discard signatures from old deployment domains.

Changed contract/interface files: none. No secure completed patch or deployment readiness is claimed.
