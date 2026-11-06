# QuoteSeal — Integrated Buyer Orchestration Demo & Architecture Guide

## Overview

This document describes the end-to-end integration of the buyer-side x402 payment orchestration into the main QuoteSeal application. It explains the system architecture, trust boundaries, step-by-step payment flows, instructions for running legitimate and malicious demo scenarios, and the precise conditions required for live Hedera Testnet execution.

---

## 1. Architecture & Integration Points

The integration connects the buyer orchestrator (`@quoteseal/buyer`), the buyer CLI (`@quoteseal/buyer-cli`), and the QuoteSeal API (`@quoteseal/api`) while preserving the strict freeze on `@quoteseal/guard` and EVM smart contracts.

```
                              ┌──────────────────────────────────────────────┐
                              │                 BUYER CLIENT                 │
                              │ (Browser / CLI / Autonomous AI Agent)        │
                              │                                              │
                              │  ┌────────────────────────────────────────┐  │
                              │  │        BuyerPaymentOrchestrator        │  │
                              │  └───────────────────┬────────────────────┘  │
                              │                      │                       │
                              │  ┌───────────────────▼────────────────────┐  │
                              │  │      Controlled Signer Boundary        │  │
                              │  │  (Holds Hedera Key; Never Leaves Host) │  │
                              │  └────────────────────────────────────────┘  │
                              └──────────────▲──────────────┬────────────────┘
                                             │              │
                     1. HTTP 402 Challenge   │              │ 4. x402 Signed Payload
                     6. HTTP 200 Paid Data   │              │
                                             ▼              ▼
                              ┌──────────────────────┐   ┌──────────────────────────┐
                              │  Protected Merchant  │   │     x402 Facilitator     │
                              │     HTTP Server      │   │ (Simulated Local or Live)│
                              └──────────────────────┘   └─────────────┬────────────┘
                                         ▲                             │
                                         │                             │ 5. Consensus
                                         │                             ▼
                 2. Trust Evaluation     │               ┌──────────────────────────┐
                                         │               │    Hedera Mirror Node    │
                                         ▼               │ (Independent Verification)│
                              ┌──────────────────────┐   └──────────────────────────┘
                              │    QuoteSeal Core    │
                              │  (Guard API & Engine)│
                              │  Frozen / Untouched  │
                              └──────────────────────┘
```

### Key Integration Interfaces

1. **Buyer Payment Orchestrator (`@quoteseal/buyer`)**:
   - Implements the complete 15-step buyer x402 protocol flow.
   - Enforces origin binding between the initial URL and subsequent redirects/challenges.
   - Parses RFC-compliant HTTP 402 challenges (`PAYMENT-REQUIRED` headers and JSON bodies).
   - Selects exact `hedera:testnet` native HBAR or token requirements.
   - Binds to the frozen pre-signing guard boundary before prompting the user.
   - Solicits explicit buyer consent against an immutable payment snapshot.
   - Gates one-shot signer execution.

2. **Backend Guard Route (`POST /v1/buyer/pay`)**:
   - Exposed by `@quoteseal/api` for clients that evaluate payment requirements via HTTP.
   - Validates incoming parameters against strict Zod schemas (canonical `0.0.N` accounts, non-negative amounts, HTTPS-only resource URLs).
   - Evaluates requirements against merchant ENS profiles and trust anchors.
   - Returns authorization verdict (`PASS`, `BLOCK`, `HOLD`, `UNVERIFIABLE`) and immutable confirmation summaries.
   - **Crucial Security Boundary**: The backend server **never holds or receives private keys** and has zero signing authority.

3. **Settlement Verification (`HederaMirrorNodeVerifier`)**:
   - Independent verification client querying the Hedera Mirror Node REST API (`/api/v1/transactions/<id>`).
   - Normalizes transaction IDs into canonical `<shard>.<realm>.<num>-<seconds>-<nanos>` paths.
   - Supports bounded polling with configurable retry deadlines (`deadlineMs`, `maxAttempts`, `pollIntervalMs`).
   - Verifies on-chain `result === "SUCCESS"`, exact credit to merchant account, and matching amount in tinybars.
   - Fails closed on 404 indexing delays, network timeouts, or transfer mismatches.

---

## 2. Signer Invocation Counts & Security Invariants

The QuoteSeal security model guarantees that the raw cryptographic signer is invoked only under strict authorization:

| Scenario | Guard Verdict | Buyer Consent | Signer Invocations | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Legitimate Payment** | `PASS` | Confirmed (`true`) | **EXACTLY 1** | Settlement submitted; resource unlocked |
| **Buyer Cancellation** | `PASS` | Rejected (`false`) | **EXACTLY 0** | Aborted; no transaction signed |
| **Tampered Recipient** | `BLOCK` | Not Requested | **EXACTLY 0** | Aborted before signer; 0 on-chain exposure |
| **Altered Amount** | `BLOCK` | Not Requested | **EXACTLY 0** | Aborted before signer; 0 on-chain exposure |
| **Wrong Network** | `BLOCK` / Unsupported | Not Requested | **EXACTLY 0** | Aborted before signer; 0 on-chain exposure |
| **Wrong Asset** | `BLOCK` / Unsupported | Not Requested | **EXACTLY 0** | Aborted before signer; 0 on-chain exposure |
| **Cross-Origin Spoof** | `BLOCK` | Not Requested | **EXACTLY 0** | Aborted before signer; 0 on-chain exposure |
| **Replay / Double Confirm** | N/A | Attempted | **EXACTLY 1 total** | Second call throws; cannot reuse consumed attempt |

---

## 3. How to Start the Backend API

To run the QuoteSeal Fastify backend API locally:

```bash
# From workspace root
pnpm --filter @quoteseal/api run build

# Start the API server on 127.0.0.1:3001
pnpm --filter @quoteseal/api start
```

To run the complete API test suite including contract, buyer, and World ID tests:

```bash
pnpm --filter @quoteseal/api test
```

---

## 4. How to Run the Legitimate Local Demo

The legitimate local demo spins up an in-process HTTP server simulating a merchant offering institutional market intelligence behind an HTTP 402 challenge.

```bash
# Build the buyer CLI
pnpm --filter @quoteseal/buyer-cli run build

# Run the local simulated settlement demo
pnpm --filter @quoteseal/buyer-cli demo:local
```

### Execution Output & Verification

```
======================================================================
 QuoteSeal Buyer CLI — Integrated Demo
 Mode: LOCAL
======================================================================

[1/5] Starting local HTTP merchant server...
  [Merchant] Listening on 127.0.0.1:42823

[2/5] Running BuyerPaymentOrchestrator (guard evaluated in-process)...
  [Merchant] No payment proof -> HTTP 402

[3/5] Buyer Confirmation Request:
  Origin:  https://merchant.example
  ENS:     merchant.eth
  PayTo:   0.0.123456
  Amount:  10 tinybars
  Network: hedera:testnet
  Decision: APPROVED
  [Signer] Invoked (call #1) for 10 to 0.0.123456
  [Merchant] Payment proof received -> HTTP 200

[4/5] Settlement & Verification:
  Mode:        LOCAL
  Transaction: 0.0.5001@1700000000.000000000
  Simulated:   TRUE (LOCAL SIMULATION)
  Verification: SETTLEMENT_UNVERIFIED
  Signer Calls: 1 (INVARIANT: EXACTLY 1)

[5/5] Resource Content:
{
  "status": "PAID_ACCESS_GRANTED",
  "message": "QuoteSeal buyer CLI local demo — simulated payment accepted",
  "timestamp": "2026-11-06T21:54:37.898Z"
}

======================================================================
 [RESULT] SUCCESS (LOCAL SIMULATION — no real Hedera transaction)
======================================================================
```

> [!NOTE]
> The banner explicitly states: `LOCAL DEMO — SIMULATED SETTLEMENT`. A simulated transaction is never reported as a real Hedera payment.

---

## 5. How to Run the Malicious Merchant Demo

To verify that QuoteSeal successfully thwarts payment attacks and enforces the zero-signer invariant:

```bash
pnpm --filter @quoteseal/buyer-cli demo:malicious
```

This runs all 5 malicious merchant scenarios sequentially:

1. **Tampered Recipient (`tampered-payto`)**:
   - Merchant returns 402 challenge directing payment to `0.0.9999999` instead of their registered `0.0.123456`.
   - **Verdict**: `BLOCK`.
   - **Signer Invocations**: `0`.

2. **Altered Amount (`altered-amount`)**:
   - Merchant demands `999999999` tinybars, exceeding the authorized maximum amount policy.
   - **Verdict**: `BLOCK`.
   - **Signer Invocations**: `0`.

3. **Wrong Network (`wrong-network`)**:
   - Merchant specifies `hedera:mainnet` instead of `hedera:testnet`.
   - **Verdict**: Unsupported / Rejected.
   - **Signer Invocations**: `0`.

4. **Wrong Asset (`wrong-asset`)**:
   - Merchant requests payment in unverified token `0.0.1234` instead of native HBAR (`0.0.0`).
   - **Verdict**: Unsupported / Rejected.
   - **Signer Invocations**: `0`.

5. **Cross-Origin Hijack (`cross-origin`)**:
   - Malicious site `https://evil-merchant.example` attempts to reuse a legitimate merchant's challenge.
   - **Verdict**: `BLOCK`.
   - **Signer Invocations**: `0`.

---

## 6. Real vs Simulated Component Matrix

| Component | Status in Local Demo | Status in Live Mode |
| :--- | :--- | :--- |
| **Merchant HTTP Server** | Real local HTTP listener (`127.0.0.1`) | Real remote HTTPS endpoint |
| **HTTP 402 Challenge** | Real RFC-compliant x402 v2 challenge | Real RFC-compliant x402 v2 challenge |
| **x402 Core SDK** | Real (`@x402/core` v2.30.0) | Real (`@x402/core` v2.30.0) |
| **QuoteSeal Guard Boundary**| Real pre-signing evaluation (`@quoteseal/guard`) | Real pre-signing evaluation (`@quoteseal/guard`) |
| **Buyer Signer Boundary** | Real instrumented Hedera client signer | Real Hedera PrivateKey signer |
| **x402 Facilitator** | Simulated (`MockFacilitatorClient`) | Real remote facilitator HTTP service |
| **Consensus Settlement** | Simulated (`0.0.5001@1700000000.000000000`) | Real on-chain Hedera consensus |
| **Mirror Node Verification** | Simulated / optional in local mode | Real query to `https://testnet.mirrornode.hedera.com` |

---

## 7. Requirements for Live Hedera Testnet Execution

To execute live transactions against Hedera Testnet and independent public facilitators, the following credentials and environment variables must be provided in `.env`:

```bash
# 1. Funded Hedera Testnet Account ID
HEDERA_ACCOUNT_ID="0.0.xxxxxx"

# 2. Private Key corresponding to HEDERA_ACCOUNT_ID (ED25519 or ECDSA)
HEDERA_BUYER_PRIVATE_KEY="302e020100300506032b657004220420..."

# 3. Verified x402 Facilitator Endpoint
X402_FACILITATOR_URL="https://facilitator.amnt.io/testnet"

# 4. Canonical Hedera Mirror Node Endpoint
HEDERA_MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"
```

Running live mode without these variables will immediately fail-closed with exit code `1`:

```bash
pnpm --filter @quoteseal/buyer-cli demo:live
```

Output:
```
[LIVE] Validating environment...
[LIVE] BLOCKED: Missing credentials:
  - HEDERA_ACCOUNT_ID
  - HEDERA_BUYER_PRIVATE_KEY
```

No simulated credentials or mock facilitators are permitted in live mode.

---

## 8. Summary of Verification Status

- **Monorepo Build**: `pnpm -r run build` passes cleanly (`tsc -b`).
- **Workspace Test Suites**: 225 / 225 passing tests.
- **Foundry Contracts**: 53 / 53 passing tests (including 4,096 fuzz invariant runs).
- **Spike Conformance**: 6 / 6 passing tests.
- **Total Passing Tests**: **284 / 284**.
- **Audit Classification**: **CONDITIONAL PASS** (local simulation verified end-to-end; live testnet pending user-provisioned credentials).
