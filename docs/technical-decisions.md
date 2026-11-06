# QuoteSeal: Architecture Decision Records (ADRs)
**Version 1.0 — Technical Decisions & Rationales (Phase 0 Planning)**

---

## Index of Architecture Decision Records

- **ADR-01**: Monorepo Tooling via pnpm Workspaces and Strict TypeScript
- **ADR-02**: Fastify as Backend API and x402 Resource Server Framework
- **ADR-03**: Next.js App Router for Unified Merchant & Buyer Interface
- **ADR-04**: Official x402 v2 Packages (`@x402/core`, `@x402/hedera`, `@x402/fastify`)
- **ADR-05**: Pinned Native HBAR (`0.0.0`) in Tinybars as Primary Settlement Asset
- **ADR-06**: Dedicated ENSv2 Permissioned Resolver per Merchant (No Multi-Tenant Resolvers)
- **ADR-07**: Solidity 0.8.24 and Foundry for `RotationController`
- **ADR-08**: World ID Agent Pass OIDC Step-Up with Backend EIP-712 Attestation Bridge
- **ADR-09**: Dual-RPC Independent Verification at Identical Finalized Block Tags
- **ADR-10**: Pure Deterministic Guard Evaluator Decoupled from Network I/O and LLMs
- **ADR-11**: PostgreSQL and Drizzle ORM for Durable Application State
- **ADR-12**: Hedera Consensus Service (HCS) as an Optional Post-MVP Audit Extension

---

### ADR-01: Monorepo Tooling via pnpm Workspaces and Strict TypeScript
- **Status**: **ACCEPTED**
- **Context**: QuoteSeal consists of multiple interdependent packages (`guard`, `ens-profile`, `world-auth`, `hedera-x402`, `shared`), smart contracts, backend API, frontend web app, and test suites. We require fast, reproducible builds and strict dependency isolation.
- **Decision**: Adopt `pnpm` (v9.x) with `pnpm-workspace.yaml`. Pin Node.js to `24.x LTS` via `.nvmrc`. Enforce strict TypeScript compilation (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`) across all workspaces.
- **Consequences**:
  - *Positive*: Fast installs, hard-link disk efficiency, prevention of phantom dependencies, type safety across shared schema boundaries.
  - *Trade-off*: Requires disciplined workspace dependency declarations.

---

### ADR-02: Fastify as Backend API and x402 Resource Server Framework
- **Status**: **ACCEPTED**
- **Context**: The backend API manages merchant onboarding, OIDC callbacks, operator enrollment, and paid API endpoints. We need low-overhead HTTP performance and native support for the official x402 ecosystem.
- **Decision**: Select **Fastify** as the backend framework (`apps/api`), using the official `@x402/fastify` plugin to gate paid resources.
- **Consequences**:
  - *Positive*: High request throughput, clean plugin architecture, direct compatibility with `@x402/fastify`.
  - *Negative*: Separate deployment target from Next.js (Fastify deployed on Railway/Render; Next.js on Vercel).

---

### ADR-03: Next.js App Router for Unified Merchant & Buyer Interface
- **Status**: **ACCEPTED**
- **Context**: The project requires a merchant portal (profile view, operator management, rotation wizard) and an interactive buyer demonstration panel.
- **Decision**: Use **Next.js 15+ App Router** with Tailwind CSS and `shadcn/ui` components (`apps/web`). Wallet connectivity will use `wagmi` and `viem`.
- **Consequences**:
  - *Positive*: Modern React Server Components, fast UI development, unified frontend experience for both merchant and buyer personas.
  - *Constraint*: Server actions must not hold long-lived secrets or act as the primary API; all critical auth flows route through the Fastify API.

---

### ADR-04: Official x402 v2 Packages & `@hiero-ledger/sdk`
- **Status**: **ACCEPTED (SPIKE 2 PREREQUISITE)**
- **Context**: Autonomous micropayments require compatible client and server protocol implementations. Hedera SDKs recently underwent migration from `@hashgraph/sdk` to `@hiero-ledger/sdk`.
- **Decision**: Adopt the official `@x402/core` (v2), `@x402/hedera`, and `@x402/fastify` packages. Use `@hiero-ledger/sdk` for all underlying Hedera transaction encoding. Avoid mixing legacy `@hashgraph/sdk` packages to eliminate type collision risks.
- **Consequences**:
  - *Positive*: Compliance with official x402 v2 payment standards; future-proof Hedera Hiero alignment.
  - *Risk*: Must verify package versions and peer dependencies during Spike 2 before locking dependencies.

---

### ADR-05: Pinned Native HBAR (`0.0.0`) in Tinybars as Primary Settlement Asset
- **Status**: **ACCEPTED**
- **Context**: The Hedera exact scheme supports both native HBAR and HTS fungible tokens (e.g., testnet USDC). However, testnet USDC availability, faucet liquidity, token association requirements, and facilitator support cannot be assumed without live network validation.
- **Decision**: Default to **native HBAR** (`asset = "0.0.0"`) as the baseline settlement asset for the MVP. Represent all monetary amounts strictly as integer strings of **tinybars** ($1 \text{ HBAR} = 10^8 \text{ tinybars}$). Testnet USDC will be evaluated during Spike 2 as an optional enhancement only if the facilitator path is 100% verified.
- **Consequences**:
  - *Positive*: Guaranteed liquidity, zero token association overhead for recipient accounts, deterministic payment execution.
  - *Rule*: Floating-point numbers are strictly forbidden in all financial math.

---

### ADR-06: Dedicated ENSv2 Permissioned Resolver per Merchant
- **Status**: **ACCEPTED (CRITICAL SECURITY DECISION)**
- **Context**: ENSv2 Permissioned Resolvers implement argument-scoped access control. A setter role granted for `"quoteseal.activePayTo"` authorizes writes for that key across *every name* hosted by that resolver.
- **Decision**: **Every merchant must deploy their own dedicated Permissioned Resolver instance.** Shared multi-tenant resolvers are strictly prohibited.
- **Consequences**:
  - *Positive*: Eliminates cross-tenant privilege escalation; allows granting narrow setter permission to `RotationController` without exposing other merchants.
  - *Trade-off*: Requires deploying a resolver proxy during merchant onboarding.

---

### ADR-07: Solidity 0.8.24 and Foundry for `RotationController`
- **Status**: **ACCEPTED**
- **Context**: The payout rotation lifecycle requires a battle-tested smart contract enforcing time-delays, proposal state transitions, EIP-712 attestations, and resolver record mutation.
- **Decision**: Implement `RotationController.sol` using **Solidity 0.8.24** and **Foundry** as the development, testing, and deployment environment. Integrate OpenZeppelin contracts for `ECDSA`, `EIP712`, and `Ownable`.
- **Consequences**:
  - *Positive*: High-speed unit, fuzz, and invariant testing via `forge`; native cheatcodes for time manipulation (`vm.warp`); static analysis integration via Slither / Aderyn.
  - *Requirement*: Deploy to Ethereum Sepolia.

---

### ADR-08: World ID Agent Pass OIDC Step-Up with Backend EIP-712 Attestation
- **Status**: **ACCEPTED (CRITICAL ARCHITECTURE DECISION)**
- **Context**: Smart contracts on EVM chains cannot directly parse JSON Web Tokens (JWTs) or perform HTTPS calls to OIDC discovery endpoints without complex, gas-prohibitive ZK or oracle setups. Furthermore, World ID proves human uniqueness/continuity, not corporate role authority.
- **Decision**: Use a **two-tier hybrid authorization model**:
  1. Operator performs fresh World ID OIDC authentication (`max_age=0`, S256 PKCE) against the QuoteSeal Fastify API.
  2. Fastify API verifies OIDC claims, asserts the subject maps to an enrolled operator, and signs an **EIP-712 `RotationApproval` attestation**.
  3. The `RotationController` verifies the backend attestor's signature, checks the operator's on-chain role, checks nonces, and initiates the time-delay.
- **Consequences**:
  - *Positive*: Efficient, secure on-chain execution; complete separation between human authentication and corporate role mapping.
  - *Trust Boundary*: The backend attestor key is an explicit trust assumption, mitigated by on-chain operator role checks, time-delay windows, and emergency cancellation powers.

---

### ADR-09: Dual-RPC Independent Verification at Identical Finalized Block Tags
- **Status**: **ACCEPTED**
- **Context**: Relying on a single Ethereum RPC provider introduces a single point of failure and vulnerability to DNS spoofing or provider-level tampering.
- **Decision**: Implement a **Dual-RPC consensus client** in `packages/ens-profile`. The client queries two independent RPC providers (Alchemy and Infura), computes the common finalized block tag, and asserts byte-for-byte identity of all resolved records. Any discrepancy immediately results in an `UNVERIFIABLE` verdict.
- **Consequences**:
  - *Positive*: Eliminates single-provider compromise; guarantees queries are executed against finalized, non-reorgable state.
  - *Trade-off*: Adds minor RPC latency (~100ms) prior to payment creation (negligible for agent micropayments).

---

### ADR-10: Pure Deterministic Guard Evaluator Decoupled from Network I/O and LLMs
- **Status**: **ACCEPTED**
- **Context**: The payment guard is the last line of defense preventing unauthorized transactions. Coupling the guard to network requests, UI state, or LLM reasoning introduces non-determinism, timeout failures, and prompt injection vulnerabilities.
- **Decision**: Implement `evaluate()` as a **pure, synchronous, deterministic function** in `packages/guard/evaluate.ts`. All network resolution (ENS, RPCs, contract state) occurs in the hook adapter prior to calling `evaluate()`.
- **Consequences**:
  - *Positive*: 100% deterministic testability; complete immunity to prompt injection; execution time < 1ms.
  - *Rule*: `evaluate()` must never import `fetch`, `viem`, or any external I/O library.

---

### ADR-11: PostgreSQL and Drizzle ORM for Durable Application State
- **Status**: **ACCEPTED**
- **Context**: The application requires relational persistence for merchants, enrolled operators, rotation proposals, one-time auth attempts, approvals, and security audit logs.
- **Decision**: Use **PostgreSQL** managed by **Drizzle ORM** (`apps/api/src/database`). Use Neon or Supabase for production hosting.
- **Consequences**:
  - *Positive*: Type-safe SQL queries, automated schema migrations, robust relational integrity, native support for JSONB audit metadata and UUID keys.
  - *Rule*: Secrets (private keys, World client secrets, raw OIDC tokens) must never be written to the database.

---

### ADR-12: Hedera Consensus Service (HCS) as an Optional Post-MVP Audit Extension
- **Status**: **ACCEPTED**
- **Context**: Publishing security decisions to HCS provides an immutable, verifiable audit log. However, HCS integration must not block the core payment guard or rotation lifecycle.
- **Decision**: Treat HCS strictly as an **optional Phase 9 enhancement**. The core MVP flow (ENS profile, pre-signing guard, Hedera payment settlement, World ID rotation) must be 100% operational and tested before any HCS code is introduced.
- **Consequences**:
  - *Positive*: Eliminates scope creep and ensures the core value proposition is completed and verified first.
  - *Rule*: HCS outages must never cause payment verification to fail.
