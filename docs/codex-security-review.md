# QuoteSeal Independent Security Review

**Evidence limit:** Only the complete implementation specification was available. Antigravity architecture files, code, package versions and deployed ENS artifacts were absent. “Documented” below means a design requirement exists; it does not mean runtime enforcement was verified.

## Threat model

The principal threat is a malicious/compromised merchant endpoint or intermediary changing `payTo` in a 402 response before an autonomous buyer signs. Related threats include lookalike origins, malicious agent output, privileged ENS role paths, stale/lying RPC responses, OIDC callback replay, compromised attestor, unauthorized operators, and Hedera facilitator/asset incompatibility. Core safety property: reject before payment payload creation/signing, with signer invocation count zero.

## Security invariant matrix

| # | Invariant | Status | Enforcement/evidence and gap | Required proof |
|---|---|---|---|---|
| 1 | Modified payTo blocked before signing | PARTIAL | Spec requires pre-creation hook; no actual package/hook proof | Mutated real 402 integration test |
| 2 | Rejection causes zero signer calls | PARTIAL | Explicit T2 assertion is specified; unexecuted | Instrument scheme payload signer and assert 0 |
| 3 | Exact selected requirement evaluated | PARTIAL | Conceptual `selectedRequirements`; exact installed types unknown | Multi-accept test across selected entries |
| 4 | Selected item belongs to accepts[] | PARTIAL | Canonical membership required; equality/canonicalization unspecified | Tampering, duplicates, type normalization tests |
| 5 | Expected origin from buyer URL | PASS (design) | Spec explicitly uses original buyer-selected URL, not response resource URL; not implemented | Adapter tests |
| 6 | Cross-origin redirects blocked | PASS (design) | `redirect: error` recommended; actual transport unknown | Redirect integration test, zero signer calls |
| 7 | Unknown merchant never PASS | PASS (design) | Buyer-preconfigured trust and fail-closed verdicts specified | Unknown ID and missing profile tests |
| 8 | Pending rotation cannot authorize new payout | PASS (design) | Table specifies HOLD until activation; verify guard reads controller | State table tests |
| 9 | Delay alone does not activate | PASS (design) | Explicit activation required | Time-warp contract and guard tests |
| 10 | Activation explicit | PASS (design) | Separate `activateRotation` transition | Contract test |
| 11 | Cancelled rotation cannot activate | PARTIAL | State rules prohibit it; no terminal-state implementation evidence | Cancel then activate must revert |
| 12 | Owner/resolver/expiry changes HOLD/re-trust | PARTIAL | Pin/monitor and HOLD required; comparison semantics/expiry boundary absent | Anchor mutation tests |
| 13 | World auth bound to exact proposal | PARTIAL | proposalHash/session/operator binding specified; canonical hash and field consistency not defined | Wrong-field and callback binding tests |
| 14 | World approvals single-use/replay-protected | PARTIAL | DB consumed attempt + contract nonce specified; transaction/concurrency semantics unverified | Duplicate callback/concurrent approval/replay tests |
| 15 | Unauthorized operators cannot rotate | PARTIAL | on-chain role recheck specified; admin/enrollment authority and revocation races unresolved | Role and revoked-role tests |
| 16 | RPC disagreement/outage fails closed | PASS (design) | UNVERIFIABLE and no single/stale fallback explicitly required | Adapter outage/disagreement tests |
| 17 | Attestor trust assumption documented | PASS | Backend verifies OIDC; contract trusts attestor signature explicitly | Operational key governance remains open |
| 18 | No secrets/raw OIDC tokens stored | PASS (requirement) | Spec prohibits tokens/private keys and requires encryption for identity/PKCE; implementation unverified | Storage/log inspection |
| 19 | Rejection responses do not leak sensitive data | PARTIAL | Stable codes and no stack traces/secrets required; reason text in hook embeds `result.reason`, redaction policy unclear | Error/API/log redaction tests |
| 20 | Every critical transition tested | PARTIAL | T1–T16 and Foundry/Vitest coverage planned; tests not present, and some races/authority paths absent | Executed traceability matrix incl. cases below |

No invariant can be reported as implementation-verified PASS. The PASS entries above refer to unambiguous design constraints only.

## ENSv2 permissions and bypass analysis

**Can a merchant owner or another privileged actor bypass the rotation controller and redirect payout? Yes, unless every alternate authority path is actually removed or guarded.** The specification itself recognizes the paths but contains no deployed role snapshot or successful unauthorized-call proof.

Potential paths: (1) owner retains key-scoped setter permission, or retains its admin role and re-grants setter; (2) resolver `ROOT_RESOURCE` setter/admin overrides narrow key grants; (3) `ROLE_LINK` relinks the name to another record bundle; (4) `ROLE_UPGRADE` on UUPS resolver upgrades logic to bypass checks; (5) Permissioned Registry name-level `ROLE_SET_RESOLVER` or registry root authority changes the resolver; (6) registry root/admin roles re-grant resolver-setting authority; (7) ERC1155 operator approval lets another actor inherit owner permissions; (8) resolver shared across names makes key-scoped setter permission apply across all names served by it; (9) expiry/re-registration changes effective owner and trust anchor.

Dedicated resolver per merchant is mandatory. Revoking ordinary setter alone is insufficient. For each path, enumerate effective role and admin grants on actual contracts, check root overrides and operator approvals, exercise writes/relinks/upgrades/resolver changes with real wallets, and monitor the pinned resolver/owner/expiry/implementation. If any governance actor can bypass, state the residual trust and require immediate HOLD on detected anchor/permission change. A “controller is intended writer” statement does not enforce exclusive write authority.

## Rotation state machine

Expected behavior is sound: STABLE old PASS/new BLOCK; PROPOSED/approved before time old PASS/new HOLD; elapsed-but-not-activated old PASS/new HOLD; ACTIVATED old BLOCK/new PASS; CANCELLED old PASS/new BLOCK. No new payout acceptance on elapsed time alone.

Open items: proposal expiry versus activation deadline; what happens when resolver write fails; activation and profile version update must be atomic or revert; concurrent cancel/activate ordering; pause/unpause authority and quorum; whether expired pending proposals auto-terminalize or require a transaction; cancellation after attestation issuance; pending rotation when owner/resolver/expiry/implementation changes; whether re-trust cancels the pending proposal; nonce domain and monotonicity; controller pause visibility to the buyer guard. `pendingPayTo` must be written only after approval is recorded; approval and state transition must be in one transaction. Emergency cancel should be immediately executable and preserve old payout; emergency pause should fail closed.

## World OIDC and EIP-712

The spec includes Auth Code + PKCE S256, state, nonce, `max_age=0`, ID token signature/JWKS, issuer/audience/expiry/iat, auth_time/acr/amr, operator mapping, session/proposal binding, explicit approve and short-lived typed attestation. This is the correct trust split: backend validates World; contract does not verify OIDC, but trusts the configured attestor and checks signature/operator/nonce/expiry.

The explicit attestor trust is a critical operational dependency. Set `acr`/`amr` allowlists and `auth_time` tolerance; define issuer discovery and JWKS rotation behavior; bind PKCE verifier and callback to same browser session; rate-limit and make callback consumption transactional. EIP-712 fields listed (merchant, proposal, operator, resolver, namehash, old/new payout hashes, effectiveAt, proposal expiry, nonce, auth time, attestation expiry) are appropriate, but hashing Hedera account IDs must use a defined canonical representation and chain/controller domain. Ensure every signed field is checked against stored state, not merely accepted as signed. Define attestor key rotation, revocation and outstanding-signature exposure.

## x402 pre-sign guard

Highest-risk unresolved integration. Verify actual v2 package types and hook lifecycle at pinned compatible versions. Confirm hook runs after the client selects and before any signer/payload creation; inspect retries and alternate code paths. Require the exact selected object to be one of the offered `accepts[]`; never inspect only index 0. Tie expected origin to original buyer URL, reject cross-origin redirects before payment handling, and do not trust `resource.url` as identity.

Validate x402 version, exact scheme, network, Hedera account `payTo`, asset, base-unit integer amount using BigInt, amount cap, timeout/freshness, and fee payer policy. Bind profile to buyer's explicit merchant trust and verify current owner/resolver/expiry/profile/implementation anchors and controller state from two agreeing RPC providers. BLOCK, HOLD and UNVERIFIABLE all abort. Do not leak raw challenge, identity, provider diagnostics, or internal policy in responses. A check-to-sign race remains: ENS can change after verification but before Hedera signature. Document the accepted exposure and minimize/bound that interval; re-read on material uncertainty.

## RPC and Hedera integrity

Dual independent RPCs at the same finalized block with exact result comparison and no stale/single fallback are appropriate mitigation, not cryptographic proof. Specify finality source, common-block selection, reorg behavior, provider independence, timeout policy and block-tag support. Outage/disagreement -> UNVERIFIABLE.

Hedera assumptions still requiring Spike 2: exact `hedera:testnet` scheme compatibility; HBAR versus HTS; tinybar/token base units and token decimals; canonical Hedera account IDs; recipient association; facilitator fee payer and its validation; facilitator `/supported` capabilities; testnet USDC availability; client signing and actual settlement; transaction ID/HashScan evidence. Package presence is not evidence of a working payment. HBAR fallback should be fixed before demo if USDC is not proven.

## Security test gaps

In addition to specified T1–T16, cover resolver root/admin regrant, ROLE_LINK, ROLE_UPGRADE, registry root and name roles, ERC1155 operator approval, expiry/re-registration, profile implementation changes, atomic resolver write failure, simultaneous activation/cancel, expired/revoked operator, callback concurrency/replay, OIDC wrong issuer/audience/nonce/auth_time/acr/amr, attestor key rotation, malformed/ambiguous selected requirements, cross-origin redirect, stale challenge/retry, SDK fallback signing, signer exception behavior, and sensitive error/log redaction. Do not claim test coverage until tests execute in the actual integrated lifecycle.
