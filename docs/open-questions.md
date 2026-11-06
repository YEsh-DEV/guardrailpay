# QuoteSeal: Open Questions, Technical Risks & Unverified Assumptions
**Version 1.0 — Risk Register & Decision Log (Phase 0 Planning)**

---

## 1. Overview
This document tracks all unverified assumptions, external dependency constraints, technical spike gates, and strategic decisions that require validation or explicit human approval prior to or during implementation.

Any item marked **UNVERIFIED — MUST VALIDATE** cannot be treated as settled architecture until its associated technical spike or empirical verification test passes.

---

## 2. Technical Spike Unknowns & Validation Gates

### 2.1 Spike 1: ENSv2 Scoped Permission Model on Sepolia
- **Status**: **UNVERIFIED — MUST VALIDATE**
- **Unknowns**:
  1. *Exact Deployed Sepolia Addresses*: What are the canonical deployed addresses for the ENSv2 Permissioned Registry, Subregistry, and Verifiable Factory on Ethereum Sepolia?
  2. *Scoped Role Grant ABI*: What is the exact function signature on the Permissioned Resolver for granting a setter role scoped to a single text key (`quoteseal.activePayTo`)?
  3. *Revocation Verification*: When the merchant owner's direct setter role is revoked, does the owner retain an admin role that permits self-re-granting without triggering an alert?
  4. *UUPS Upgradeability*: Does the deployed Permissioned Resolver proxy expose an upgrade function (`upgradeTo` / `upgradeToAndCall`) that the owner or deployer can invoke, and how can that upgrade authority be safely pinned or governed?
- **Validation Action**: Execute Spike 1 on Sepolia using Foundry scripts and live wallet transactions to read effective roles directly from contract bytecode.

---

### 2.2 Spike 2: Hedera x402 Testnet Settlement & Package Compatibility
- **Status**: **UNVERIFIED — MUST VALIDATE**
- **Unknowns**:
  1. *Package Ecosystem Alignment*: Are the current npm releases of `@x402/core`, `@x402/hedera`, `@x402/fastify`, and `@hiero-ledger/sdk` mutually compatible, or are there peer dependency conflicts?
  2. *Hedera Facilitator URL & Health*: What is the public URL of the official Hedera testnet x402 facilitator? Does its `GET /health` and `GET /supported` endpoints confirm active operation for the `exact` scheme?
  3. *Fee Payer Account Funding*: Is the facilitator's fee payer account sufficiently funded with testnet HBAR to subsidize client micropayments during testing?
  4. *USDC vs HBAR Settlment*: Does the testnet facilitator currently support testnet USDC transfers with automated token association, or must QuoteSeal lock native HBAR (`0.0.0`) as the MVP settlement currency?
- **Validation Action**: Run Spike 2 standalone script to execute a live 1 HBAR testnet payment and verify HashScan receipt.

---

### 2.3 Spike 3: Pre-Signing Hook Signature & Abort Mechanics
- **Status**: **UNVERIFIED — MUST VALIDATE**
- **Unknowns**:
  1. *Hook Signature in `@x402/core`*: Does `client.onBeforePaymentCreation()` receive `{ paymentRequired, selectedRequirements }` directly, and does returning `{ abort: true, reason: string }` cleanly abort execution, or does it require throwing an exception?
  2. *Selected Requirement Object*: Does the x402 client expose the exact selected requirement object by reference or by value, and does it guarantee that the object has not been mutated between 402 receipt and hook execution?
  3. *Signer Decoupling*: Can the scheme signer be wrapped in a test spy to assert that zero crypto operations or key accesses occur when the hook aborts?
- **Validation Action**: Construct Vitest test harness in Spike 3 with an instrumented signer spy.

---

## 3. World ID Agent Pass & OIDC Authentication Unknowns

| Item | Description | Impact | Required Resolution |
| :--- | :--- | :--- | :--- |
| **World OIDC Credentials** | QuoteSeal requires a valid `WORLD_CLIENT_ID` and `WORLD_CLIENT_SECRET` configured in the World Developer Portal. | Blocks Phase 5 (OIDC step-up implementation). | Developer team must register the app on `developer.worldcoin.org` and configure the public callback URL. |
| **Verification Level (`acr`)** | Will the hackathon demo accept `device` level verification (World app simulation / simulator), or is `orb` level strictly required? | Simulator vs physical phone verification during demo. | Configure policy to accept `device` or `orb` verification levels for demo flexibility. |
| **Callback HTTPS Requirement** | World OIDC redirects require public HTTPS URLs; `http://localhost` callbacks may be rejected by World's OIDC provider. | Local development flow. | Use ngrok or cloudflare tunnels during local development, and Railway/Vercel for deployed demo. |

---

## 4. Infrastructure & Operational Questions

### 4.1 Dual-RPC Provider Rate Limits & Costs
- **Question**: Will free-tier API keys for Alchemy and Infura Sepolia handle the query volume required during automated integration test runs?
- **Risk**: Rate-limiting (HTTP 429) during test runs could trigger false `UNVERIFIABLE` verdicts.
- **Mitigation**: Implement a local test RPC mock in Vitest for rapid unit testing, reserving live RPC queries for end-to-end integration tests.

### 4.2 Time-Delay Window Duration
- **Question**: What duration should be configured for `ROTATION_DELAY_SECONDS`?
- **Recommendation**:
  - **Testnet Demo Environment**: `90 seconds` (allows demonstrating the `HOLD` state and subsequent activation within a 3–4 minute video presentation).
  - **Production Default**: `48 hours` (provides sufficient time for security guardians to detect and cancel malicious proposals).

---

## 5. Decisions Requiring Explicit Human / User Approval

Before proceeding past Phase 0, the following user decisions are required:

1. **Authorization to Begin Phase 1**:
   - Explicit confirmation to initialize the repository, install package dependencies, and establish the monorepo tooling.
2. **Sepolia Deployer & Testnet Accounts**:
   - Provisioning of low-balance testnet private keys for:
     - Sepolia Deployer / Merchant Owner.
     - Rotation Attestor Key (backend EIP-712 signer).
     - Hedera Testnet Buyer Account ID & Private Key.
     - Hedera Testnet Merchant Payout Account ID.
3. **Demo Merchant ENS Name**:
   - Confirmation of the registered Sepolia ENS name to be used for the demo (e.g., `researchpro.eth`).
4. **Codex Review Alignment**:
   - Confirmation that the Codex agent has reviewed the architecture, threat model, and open questions, and that any conflicting recommendations have been reconciled.
