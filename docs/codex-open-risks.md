# QuoteSeal Open Risks and Required Decisions

**Evidence boundary:** Specification only; no Antigravity plans, source, manifests, pinned package versions or deployed contracts were present in the workspace.

## Critical blockers

1. **Pre-sign hook unproven:** the exact installed x402 hook types, lifecycle and abort semantics are unknown. Zero signer calls on rejection is the defining guarantee.
2. **ENS exclusive writer unproven:** role, admin/root, link, upgrade, registry and operator-approval bypasses require real ABI/on-chain proof.
3. **Required spikes not passed:** the specification calls ENS permission, Hedera settlement and x402 guard spikes mandatory.
4. **No architecture plan to review:** all six requested Antigravity documents are absent, so repository boundaries and implementation assignments cannot be independently reviewed.

## High risks

- Attestor compromise or misconfiguration permits bad approvals until expiry/revocation; no operational rotation/revocation policy is specified.
- Cross-chain check-to-sign race: ENS state can change after Sepolia reads and before Hedera signing; no atomic coupling exists.
- EIP-712 canonicalization of Hedera account IDs and hashes of old/new payout values is unspecified.
- State-machine races and failure atomicity (activation versus cancellation, resolver write failure, pause recovery) need precise contract semantics.
- OIDC `acr`/`amr` assurance policy, issuer/JWKS lifecycle, session binding and identity retention need concrete policy.
- Error/rejection redaction is underspecified; conceptual hook returns interpolated reason text.
- Dual RPC providers mitigate a single endpoint but do not prove chain truth; provider independence/finality policy is undefined.
- Hedera facilitator support, fee payer, token association, network identifiers and asset availability are unverified.
- Database encryption/key management and transactional one-time consumption need implementation-level design.

## Medium risks

- Large proposed monorepo structure may add unnecessary packages for the single-merchant MVP; maintain pure evaluator and trust boundary separation while minimizing wrappers.
- Profile mirrors may diverge from controller state; document authoritative reads and consistency checks.
- Expiry/re-registration, implementation identity and permission monitoring need exact threshold and re-trust behavior.
- API authorization, CSRF/session configuration, rate limits and audit retention require explicit settings.
- Deployment/key recovery and emergency governance have no runbook.

## Unverified assumptions

- `onBeforePaymentCreation` exists in selected compatible x402 v2 packages with the conceptual arguments/abort return shown.
- The hook can guarantee no payment payload or signature is produced before it runs, including retries.
- Current ENSv2 deployed contracts and official factory expose the required roles/ABIs and allow intended hardening.
- Two selected RPC providers can serve identical finalized historical reads.
- A chosen Hedera facilitator supports the exact testnet scheme and selected asset.
- World issuer configuration and Agent Pass policy satisfy freshness/context requirements.
- Proposed Node, x402, Hiero, viem, openid-client and database versions are mutually compatible.

## Human decisions required

1. Which authority controls resolver upgrade, registry root roles, emergency pause/unpause, and attestor rotation? Which are multisig, and what is the recovery threshold?
2. What is the buyer's re-trust process and user-visible behavior when owner/resolver/expiry/implementation/permission anchors change?
3. Which World `acr`/`amr` values and maximum `auth_time` age qualify for payout approval?
4. What is acceptable time between finalized ENS verification and signer invocation, given cross-chain non-atomicity?
5. Which Hedera asset is fixed for the demo (USDC only after verification, otherwise HBAR), and which facilitator/network is selected?
6. What sensitive reason details may be returned to buyer/UI versus retained only as redacted audit codes?
7. Is a single operator approval sufficient, and what policy governs emergency cancellation and unpause?

## Required technical spikes

- **Spike 1 ENSv2 permissions:** dedicated resolver; inspect real effective key/root/admin/link/upgrade/registry roles and ERC1155 approvals; test owner/other/controller writes and name resolver changes; prove only controller can change payout or document residual privileged trust.
- **Spike 2 Hedera x402:** pinned compatible packages; `/supported`; exact HBAR/HTS and fee-payer behavior; association; real testnet payment; transaction ID and HashScan evidence.
- **Spike 3 x402 pre-sign guard:** use actual package types and signer boundary; valid flow signs; tampered payTo and invalid selection reject with signer call count exactly zero; multiple accepts and redirects tested.

The first two may run in parallel. Spike 3 depends on selecting/pinning compatible x402 packages and can follow or overlap package discovery, but must pass before implementing the general guard/UI. All three are gates before claiming the security architecture works.
