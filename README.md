# QuoteSeal

> **Merchant-Authorized Payment Identity for Autonomous x402 Agents**  
> *ETHGlobal Mumbai 2026*

QuoteSeal provides cryptographic payee identity verification for autonomous AI agents paying for HTTP 402 (x402) micropayments on Hedera. Before signing any payment, QuoteSeal's **PayeeGuard** checks that the requested recipient (`payTo`) matches the merchant's trusted ENSv2 payment profile on Sepolia. Legitimate payout changes go through an announced, delayed, human-approved rotation guarded by World ID Agent Pass.

---

## The Problem: Recipient-Substitution (MITM) in x402 Agent Commerce

When an autonomous AI agent encounters an HTTP 402 Payment Required response, it receives payment instructions specifying:
`{ network: "hedera:testnet", asset: "HBAR", payTo: "0.0.12345", amount: "100000000" }`

In autonomous workflows without human-in-the-loop:
1. An attacker (compromised proxy, DNS hijack, or malicious middleware) can rewrite `payTo` to their own account (`0.0.66666`).
2. The agent's wallet blind-signs and transfers funds to the attacker.
3. The facilitator settles the transaction because the seller-supplied requirements matched the payment proof, but the merchant never received the funds.

**QuoteSeal stops this attack at the agent layer.** PayeeGuard verifies the requested `payTo` against the seller's verified ENSv2 profile **before the signer is ever invoked**. If tampered, the payment is blocked with **Signer Call Count = 0**.

---

## Architecture

```
                           +---------------------------------------+
                           |           Merchant Server             |
                           |   (Protected x402 Hedera Endpoint)    |
                           +-------------------+-------------------+
                                               |
                                     1. HTTP 402 Payment
                                        Required (payTo,
                                        amount, asset, network)
                                               |
                                               v
+-----------------------+           +----------+------------+
|  Merchant ENSv2 Name  |           |     Attack Proxy      | (MITM Tampering:
|    (Sepolia Testnet)  |           |  (Rewrites payTo)     |  substitutes evil payTo)
+-----------+-----------+           +----------+------------+
            |                                  |
            |                                  v
            |                       +----------+------------+
            | 2. Resolve Profile    |      Buyer Agent      |
            +---------------------->|                       |
                                    |   +---------------+   |
                                    |   |  PayeeGuard   |   | (Pure Verdict Engine)
                                    |   +-------+-------+   |
                                    +-----------|-----------+
                                                |
                                    3. Verdict: PASS / BLOCK / HOLD / UNVERIFIABLE
                                                |
                          +---------------------+---------------------+
                          |                                           |
                    [Verdict == PASS]                       [Verdict != PASS]
                          |                                           |
                          v                                           v
               Signer executes payment                  ABORT: Signer NOT called
               Settles on Hedera (HashScan)             Signer call count = 0
```

---

## Monorepo Layout

```
quoteseal/
├── apps/
│   ├── merchant-dashboard/        # Next.js: onboarding, DNS/.well-known, rotation & World ID UI
│   ├── merchant-api/              # Fastify: x402 seller endpoint, rotation routes, Drizzle ORM
│   ├── buyer-demo/                # Autonomous buyer agent loop + live verdict timeline & HashScan
│   └── attack-proxy/              # MITM proxy intercepting & rewriting 402 payTo headers/body
├── packages/
│   ├── payee-guard/               # CORE: Verdict engine (PASS/HOLD/BLOCK/UNVERIFIABLE) + T1–T11
│   ├── ens-profile/               # ENSv2 records reader/writer & Zod validation
│   ├── rotation-controller/       # Off-chain client for smart contract timelocked rotations
│   ├── world-auth/                # World ID Agent Pass OIDC operator validation
│   ├── hedera-x402/               # Hedera client/server wrappers & HCS audit logging
│   ├── shared/                    # Types, errors, logger, env helpers
│   └── config/                    # Shared tsconfig, eslint configs
├── contracts/                     # Foundry project (RotationController.sol + tests)
├── tests/                         # Cross-package E2E attack simulations (T1 to T11)
├── docs/                          # Specs, threat model, architecture
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Quickstart & Installation

### Prerequisites
- Node.js >= 22
- pnpm >= 10
- Foundry (`forge`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Smart Contract Tests (Foundry)
```bash
pnpm forge:test
```
*Output: 8 passed; 0 failed.*

### 3. Run Test Matrix (T1 to T11)
```bash
pnpm test
```

---

## Test Scenarios (T1 to T11)

| ID | Scenario | Expected Verdict | Verified |
|---|---|---|---|
| **T1** | Normal payment, matching ENS profile | **PASS**, signer called, settles on Hedera | Passed |
| **T2** | Proxy rewrites payTo (MITM attack) | **BLOCK**, signer never called (count = 0) | Passed |
| **T3** | Unknown / untrusted merchant | **BLOCK** | Passed |
| **T4** | Look-alike origin domain (`.co` vs `.com`) | **BLOCK** | Passed |
| **T5** | Amount / asset / network drift | **BLOCK** | Passed |
| **T6** | Unannounced payout rotation | **BLOCK** | Passed |
| **T7** | Payment during rotation delay | **HOLD**, no signature | Passed |
| **T8** | Approved rotation after delay | **New payTo passes, old rejected** | Passed |
| **T9** | Denied / unauthorized World ID auth | **No activation, old profile remains** | Passed |
| **T10** | ENS / RPC failure | **UNVERIFIABLE** (fail-closed, count = 0) | Passed |
| **T11** | Stale / replayed 402 offer | **BLOCK**, do not sign stale terms | Passed |

---

## Track Implementations

### 1. ENSv2 Payment Identity
- Merchant records stored on ENSv2 resolver on Sepolia (e.g. `researchpro.eth`).
- Records: `serviceEndpoint`, `hederaNetwork`, `assetId`, `activePayTo`, `maxAmount`, `profileVersion`, `rotationStatus`.
- Role separation: Treasury role proposes rotations; `RotationController.sol` is the only entity authorized to update `activePayTo`.

### 2. Hedera x402 Micropayments
- Server endpoint: HTTP 402 with `PAYMENT-REQUIRED` header & JSON challenge.
- Hedera client: autonomous pay-and-fetch generating transaction receipts.
- HashScan Explorer URL format: `https://hashscan.io/testnet/transaction/{id}`.
- Audit trail: `submitAuditEventToHcs` hashes security verdicts and rotation milestones to Hedera Consensus Service (HCS).

### 3. World ID Agent Pass
- OIDC flow (`/world/start`, `/world/callback`) ensuring that only verified human operators can approve payout address rotations.
- Denied, cancelled, and unauthorized attempts are rejected; old profile remains strictly active.

---

## Honest Limitations

- QuoteSeal reduces a defined class of **recipient-substitution and unauthorized-rotation** risk. It does not stop all payment fraud, compromised governance, malicious onboarding, stolen buyer keys, or prove service quality.
- ENS ownership and domain control are **not** legal business verification.
- World authentication gives fresh authentication, not proof of corporate authority; hackathon proofs are mocked.
- EAC controls who can edit records; the **delay** is enforced by the rotation controller (or a clearly disclosed backend policy).
- Signed-offer verification is future work.

---

## License
MIT
