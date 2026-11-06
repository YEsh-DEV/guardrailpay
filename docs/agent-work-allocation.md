# QuoteSeal: Agent Work Allocation & Responsibility Matrix
**Version 1.0 — Pair-Programming Protocol (Antigravity & Codex)**

---

## 1. Operating Model & Two-Agent Dynamics

QuoteSeal uses a **Two-Agent Pair Engineering Architecture**:
- **Antigravity (Primary Software Architect & Lead Builder)**:
  - Responsible for end-to-end system design, repository scaffolding, protocol integration, SDK implementations, smart contract authoring, frontend/API development, and test suite execution.
- **Codex (Independent Security Reviewer & Verification Auditor)**:
  - Responsible for independent adversarial review, smart contract vulnerability audits, invariant verification, edge-case probing, cryptographic review (EIP-712/OIDC), and sign-off on exit gates.

```
+---------------------------------------------------------------------------------------------------------+
|                                    COLLABORATIVE AGENT WORKFLOW                                         |
|                                                                                                         |
|   +--------------------------+       Submits Plan / PR       +--------------------------+               |
|   |       ANTIGRAVITY        | ----------------------------> |          CODEX           |               |
|   |  (Architecture & Code)   |                               |  (Adversarial Audit)     |               |
|   +--------------------------+ <---------------------------- +--------------------------+               |
|                                       Feedback / Approval                                               |
+---------------------------------------------------------------------------------------------------------+
```

### 1.1 Fundamental Collaboration Rules
1. **No Code Without Review**: Every phase deliverable produced by Antigravity must undergo review and verification by Codex before being considered complete.
2. **Security Veto Power**: If Codex identifies a violation of any of the 16 security invariants (especially INV-01, INV-02, INV-08, INV-12, or INV-15), implementation stops immediately until the issue is remediated.
3. **Strict Separation of Concerns**: Antigravity focuses on functionality, protocol integration, and system execution; Codex focuses on threat modeling, bypass vectors, boundary conditions, and test verification.

---

## 2. Phase-by-Phase Ownership Matrix

| Phase | Description | Primary Owner | Review / Audit Owner | Exit Gate / Sign-off Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Project Analysis & Architecture Planning | **Antigravity** | **Codex** | Both agents reconcile architecture; user approves plan. |
| **Phase 1** | Monorepo Bootstrap & Foundations | **Antigravity** | **Codex** | Frozen lockfile; clean CI run; zero extraneous dependencies. |
| **Phase 2A**| Spike 1: ENSv2 Scoped Permission Isolation | **Antigravity** | **Codex** | Proof on Sepolia: only controller can update `activePayTo`. |
| **Phase 2B**| Spike 2: Hedera x402 Settlement | **Antigravity** | **Codex** | Proof on Hedera testnet: 1 live payment + HashScan link. |
| **Phase 2C**| Spike 3: Pre-Signing Hook & Zero Signer Calls| **Antigravity** | **Codex** | Proof in Vitest: `signerCalls === 0` on tampered `payTo`. |
| **Phase 3** | Core Guard Engine & Dual-RPC Adapter | **Antigravity** | **Codex** | 100% unit test coverage; fail-closed on RPC disagreement. |
| **Phase 4** | RotationController Contract & Foundry Suite | **Antigravity** | **Codex** | Slither/Aderyn pass; invariant tests prove delay cannot be skipped. |
| **Phase 5** | World ID Agent Pass Step-Up & Attestor | **Antigravity** | **Codex** | Replay protection audit; EIP-712 domain & struct validation. |
| **Phase 6** | PostgreSQL Database & Fastify REST API | **Antigravity** | **Codex** | Zod validation audit; zero secret leakage in DB or responses. |
| **Phase 7** | Next.js Frontend (Portal & Demo) | **Antigravity** | **Codex** | UX review; wallet connection validation; attack simulation toggle. |
| **Phase 8** | End-to-End Security Validation (T1–T16) | **Antigravity** | **Codex** | 16/16 tests passing deterministically; signer call logs verified. |
| **Phase 9** | (Optional) HCS & Submission Packaging | **Antigravity** | **Codex** | Video script review; documentation & prize track alignment. |

---

## 3. Detailed Responsibilities by Module

### 3.1 Smart Contracts (`contracts/`)
- **Antigravity Responsibilities**:
  - Implement `RotationController.sol` with state machine, time-delay enforcement, and ENS resolver calling logic.
  - Implement Foundry unit and fuzz tests in `contracts/test/`.
  - Write deployment scripts in `contracts/script/`.
- **Codex Responsibilities**:
  - Audit access controls: ensure only enrolled operators with `ROLE_ROTATION_APPROVER` can propose/approve.
  - Audit EIP-712 implementation: verify `chainId`, `verifyingContract`, `proposalNonce`, and struct hash.
  - Audit reentrancy and external call risks when invoking ENS `setText()`.
  - Run Slither / Aderyn static analysis and verify all findings are resolved.

### 3.2 Buyer-Side Guard (`packages/guard` & `packages/ens-profile`)
- **Antigravity Responsibilities**:
  - Implement pure `evaluate()` engine and canonical `isCanonicalMember()` matching.
  - Implement Dual-RPC query engine querying primary and secondary Sepolia endpoints at identical block tags.
  - Wire `onBeforePaymentCreation` hook adapter.
- **Codex Responsibilities**:
  - Adversarial review of `evaluate()` edge cases: overflow, negative timeouts, empty arrays, malformed IDs.
  - Review origin normalization: ensure port, scheme, and hostname cannot be spoofed.
  - Verify that under zero circumstances does a rejected verdict allow the scheme client to proceed to signing.

### 3.3 World ID Authentication & Attestation (`packages/world-auth`)
- **Antigravity Responsibilities**:
  - Implement OIDC Authorization Code + S256 PKCE flow with `max_age=0`.
  - Implement token claim validation (`iss`, `aud`, `exp`, `auth_time`, `acr`, `amr`).
  - Implement backend EIP-712 signer with server-held private key.
- **Codex Responsibilities**:
  - Verify that raw OIDC ID tokens or authorization codes cannot be intercepted or replayed.
  - Verify that authentication attempts are strictly single-use and bound to `proposalHash`.
  - Verify that operator identity mapping (`subject_hmac`) does not leak personally identifiable information.

### 3.4 Hedera x402 Integration (`packages/hedera-x402`)
- **Antigravity Responsibilities**:
  - Integrate `@x402/core` and `@x402/hedera` client logic.
  - Protect Fastify routes with `@x402/fastify`.
  - Handle tinybar currency conversions ($1 \text{ HBAR} = 10^8 \text{ tinybars}$).
- **Codex Responsibilities**:
  - Verify that all financial calculations use `BigInt` arithmetic with zero floating-point math.
  - Review facilitator co-signing integration and fee payer handling.
  - Verify HashScan settlement validation logic.

---

## 4. Review Checkpoints & Communication Protocol

1. **Phase Handoff**: At the completion of each phase, Antigravity will produce a summary of changes, commit hashes, and test output.
2. **Codex Audit Report**: Codex will review the code diff against the specification and security invariants, issuing either:
   - `APPROVED`: Ready to proceed to next phase.
   - `REVISION_REQUIRED`: Specific vulnerabilities or deviations listed for Antigravity to fix.
3. **Escalation to User**: Any dispute between agents regarding scope, trade-offs, or unverified assumptions will be escalated to the user for final decision.
