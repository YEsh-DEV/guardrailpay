# QuoteSeal Independent Architecture Review

**Review date:** 2026-11-06  
**Evidence available:** `QuoteSeal_Complete_Implementation_Specification.docx` only. The repository contains no Antigravity architecture documents, source, package manifests, dependency lockfiles, or project instructions. This is therefore an independent review of the specification, not a verification of Antigravity's implementation architecture.

## Executive review

The specification describes a coherent security goal: validate the buyer-selected x402 v2 payment requirement against buyer-configured trust and an ENSv2 merchant profile before the x402 scheme creates a payment payload. It also calls out meaningful ENS authority bypasses, a distinct explicit rotation activation, World OIDC/attestor trust, dual RPC reads, and three mandatory spikes.

**Assessment: NOT READY for Phase 1 coding.** The document itself says three technical spikes remain mandatory. More importantly, the exact x402 hook/abort semantics and ENSv2 effective-role behavior are unproven; these sit directly on the critical “zero signer calls on reject” guarantee. The requested Antigravity plans are absent, so no claim that a proposed repository architecture implements the spec can be substantiated.

## Scope and evidence

Read the complete DOCX body, including its architecture, ENS permission model, rotation, World OIDC/EIP-712, buyer guard, RPC rules, database/API, repository/stack, tests, spike gates, deployment and risk sections. The workspace inventory found only that DOCX. No `architecture.md`, `docs/implementation-roadmap.md`, `docs/security-architecture.md`, `docs/technical-decisions.md`, `docs/open-questions.md`, `docs/agent-work-allocation.md`, source tree or dependency versions were present. No installed project-specific skills could be identified from this repository. Package types, ABIs, and live protocol behavior remain unverified.

## Overall architecture assessment

The separation is directionally sound: a pure deterministic evaluator; adapters for URL, x402 hook and chain reads; merchant-side rotation API/authentication; an on-chain RotationController; and a separate Hedera settlement path. The spec correctly says LLM judgment is not enforcement, buyer origin comes from its original URL, and `resource.url` is informational. The contract’s state, not a profile mirror, must be authoritative.

The design is still conceptual at key enforcement boundaries. No exact pinned x402 versions or compiled hook contract exist. The spec's conceptual hook fields and abort return must be proven with the actual package and signer call boundary. Likewise, no deployed ENSv2 ABI/effective-role proof confirms that the controller is the sole writer. No supplied architecture exists to assess module dependencies, code placement or implementation details.

## Requirements and component review

- **Buyer guard:** Appropriate boundary if it truly runs after selection and before payload creation. Prove exact selected-entry identity/membership, signed/used payload parity, and abort behavior in Spike 3. A UI result is not evidence.
- **ENS/profile:** Dedicated resolver per merchant and pinning owner, resolver, expiry, profile version, implementation and permissions are sound requirements. Implementation must not trust profile `rotationStatus`/`activePayTo` mirrors over controller and canonical resolver state.
- **Rotation:** State machine correctly separates proposal, approval, delay, activation, cancellation and pause. Atomic payout-record/controller updates are required; external resolver write failure must revert the whole activation.
- **World/API:** Backend-only OIDC and attestor boundary is explicit. Database one-time consumption requires transactional concurrency control and replay-safe contract nonce consumption. Identity subject data needs minimization, encryption/HMAC key lifecycle and access controls.
- **Hedera:** Spec distinguishes account IDs from EVM addresses and tinybars/token units. Facilitator, fee payer, token association, network, asset and settlement are not proven by package names.
- **RPC:** Two providers at a common block reduce single-provider risk but are not cryptographic truth. A finalized/safe block policy and chain reorg behavior need precise definition.
- **Repository:** Proposed monorepo is plausible but has many packages/apps for a one-merchant MVP. Start with only boundaries that enforce independent trust or deployment/security ownership. Avoid thin `shared`/domain packages and app fragmentation unless actual dependency constraints justify them. Keep pure guard free of network/framework dependencies. HCS stays optional.

## Critical gaps and corrections required

1. Pass Spike 1: demonstrate on-chain that owner, role admin/root, link, registry resolver-setting, operator approval and upgrade authorities cannot silently redirect payout; document remaining governance and require HOLD/re-trust on any change.
2. Pass Spike 2: execute real Hedera testnet exact payment through chosen facilitator; verify fee payer, asset units/association, actual transaction and HashScan evidence.
3. Pass Spike 3: compile against pinned real x402 package types, attack the actual 402 response, and count signer/payload-creation invocations as zero after every rejection. Verify no SDK fallback/retry path signs.
4. Define canonical encoding and equality of selected requirements (including duplicate/equivalent entries), the exact `accepts[]` container, and how the selected item maps to the final payload. Reject ambiguity.
5. Specify origin binding across initial request, redirects, retries and fetch implementation; enforce `redirect: error` before a challenge can reach payment logic.
6. Specify trust-anchor refresh/re-trust UX and race handling between dual-RPC read, guard decision and signer invocation. The ENS and Hedera chains cannot be atomic; bound the check-to-sign window and fail closed on stale state.
7. Reconcile configuration/state: which authority sets initial profile, resolver/controller deployment and contract upgrades; distinguish merchant payout account strings (Hedera IDs) from EVM operator/contract addresses at all interfaces.
8. Define attestor key rotation/revocation, threshold/governance, compromise response and what already-issued short-lived signatures permit.
9. Define OIDC allowed `acr`/`amr` policy, issuer metadata/key rotation and privacy/retention. `max_age=0` alone does not establish an acceptable authentication assurance level.
10. Specify encrypted database fields/key management, session/CSRF protections, authorization boundaries, API rate limits and audit access. Schema alone does not enforce these.

## Readiness

The specification is a useful baseline and explicitly mandates proof gates, but its own unresolved integration assumptions are security-critical. READY FOR PHASE 1 CODING is not justified. The repository bootstrap and proof-of-concept spikes are the first planned coding tasks, but should begin only under the project's agreed gate process; this review did not perform them.
