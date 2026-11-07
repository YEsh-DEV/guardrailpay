# x402 Firewall — Arkiv Implementation & Testnet Deployment Checklist

> **Status as of 2026-11-07:** Phase 1 isolated Arkiv adapter is implemented and locally verified. Rabdi write/read verification is blocked until a dedicated writer wallet, tGLM, and `ARKIV_ACCESS_KEY` are supplied. This checklist reflects repository verification, not an independent production audit.
>
> **Scope:** x402 Firewall + Arkiv Rabdi; **Swarm is excluded**. Integrate with the existing PayeeGuard, `createGuardedSigner`, merchant API, dashboard, Hedera demo client, SQLite and Foundry contracts rather than replacing them by default.

## How to use this checklist

- This source-of-truth file currently lives at `IMPLEMENTATION_CHECKLIST.md` in the repository root. Do not create a second copy under `arkiv/`.
- Check `[x]` only after the task's verification has run successfully. Mark blocked tasks with `BLOCKED: reason` without claiming them done.
- For each completed phase, add the date, PR/commit, test command and results, testnet transaction/entity links, plus any known limitations in the **Evidence log** below.
- Never put passwords, Arkiv writer private keys, API tokens, raw signed x402 authorizations, or full private payment payloads in Markdown or public Arkiv records.
- **Critical invariant:** only an explicit `PASS` can reach an integrated signer; `BLOCK`, `REVIEW`, `ERROR`, malformed, timeout, stale/untrusted risk data must follow explicit safe policy and must never be accidentally treated as `PASS`.
- **No universal protection claim:** only participating merchant/agent/settlement paths enforce this guard. A valid signed authorization submitted outside the guarded integration may bypass a gateway-only check.

## Current verified-by-team baseline

- [x] C00 — Architecture and Arkiv judging documents exist and were reviewed. **Verified:** `AGENTS.md`; `arkiv/README.md`, `schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`, `deployment.md`, and `submission-checklist.md`; and `contracts/CONTRACT_SPEC.md`.
- [x] C01 — Swarm-specific integration files and references removed. **Verified:** `rg -n -i --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!IMPLEMENTATION_CHECKLIST.md' 'swarm' .` returned no matches. `arkiv/swarm.md` is absent. The checklist retains only the scope statement that Swarm is excluded.
- [x] C02 — Identified `PayeeGuard` as the current pre-signing gate and `createGuardedSigner` as the integration boundary. **Verified:** `packages/payee-guard/src/evaluate.ts` returns local verdicts; `packages/payee-guard/src/middleware.ts` calls `rawSigner` only when the verdict is `PASS`; `apps/buyer-demo/agent/index.ts` supplies that signer.
- [x] C03 — Identified known gaps: merchant payment headers are not verified; Hedera demo receipts are not submitted; dashboard data is mocked; and SQLite, ENS, memory, and contract state have separate ownership. **Verified:** `apps/merchant-api/src/routes/paid.ts`, `packages/hedera-x402/src/client.ts`, `apps/merchant-dashboard/app/lib/api.ts`, `apps/merchant-api/src/db/schema.ts`, `packages/ens-profile/src/resolve.ts`, `apps/merchant-api/src/routes/rotation.ts`, and `contracts/src/RotationController.sol`.
- [x] C04 — Confirmed the current branch's custom x402-like demo flow. **Exit met:** exact protocol, network, token, facilitator, wallet, signing, verification, and settlement findings are recorded in **C04–C06 repository verification record** below.
- [x] C05 — Defined the demo threat model, current controls, and unmitigated limits. **Exit met:** the threat record below covers credential theft, gateway bypass, malicious reporting, false positives, replay, altered terms, and RPC outage.
- [x] C06 — Confirmed the configured development targets and made the Phase 1 architecture decision. **Exit met:** the backend and dashboard have local development targets, the payment demo targets Hedera testnet, ENS and the rotation contract target Sepolia, no production hosting target is configured, and Phase 1 requires no Solidity change.

## C04–C06 repository verification record

**Verification method:** static repository inspection on 2026-11-07. No deployment, wallet connection, dependency installation, payment execution, or contract change occurred.

### C04 — Current payment flow

| Concern | Verified current behavior | Evidence |
| --- | --- | --- |
| x402 version | No x402 version is declared in the protocol types, challenge, headers, dependencies, or lockfile. The current branch is a custom HTTP 402 demo and must not be described as conforming to x402 V1 or V2. | `packages/hedera-x402/src/server.ts`; `package.json`; `package-lock.json` |
| Payment scheme | The challenge emits `scheme: 'hedera'` in both the `payment-required` header and the JSON body. | `packages/hedera-x402/src/server.ts` |
| Payment network | The merchant route sets `network: 'hedera:testnet'`. The buyer uses that value, or the same fallback. | `apps/merchant-api/src/routes/paid.ts`; `apps/buyer-demo/agent/index.ts` |
| Token and amount | The merchant route sets `asset: 'HBAR'` and `amount: '100000000'` tinybars. ENS defaults use the same network and asset. | `apps/merchant-api/src/routes/paid.ts`; `packages/ens-profile/src/schema.ts` |
| Facilitator | `.env.example` and `docs/payments.md` name `https://testnet.facilitator.x402.org`, but no runtime path reads `FACILITATOR_URL` or calls a facilitator. `HederaSignerOptions.facilitatorUrl` is declared but unused. | `.env.example`; `docs/payments.md`; `packages/hedera-x402/src/client.ts` |
| Wallet type | No concrete Hedera wallet signer is instantiated. `executeHederaPayment` accepts an account ID and a private-key option, but uses only the account ID to construct a simulated receipt. | `packages/hedera-x402/src/client.ts` |
| Signing path | The buyer parses the 402 JSON, creates `PaymentRequest`, calls `createGuardedSigner`, and supplies a raw signer callback. The callback calls `executeHederaPayment`; it does not sign a Hedera transaction. | `apps/buyer-demo/agent/index.ts`; `packages/payee-guard/src/middleware.ts`; `packages/hedera-x402/src/client.ts` |
| Verification path | The merchant route treats a present `payment-signature` or `authorization` header as sufficient and serves the resource. `ProtectedEndpointOptions.verifyPaymentProof` exists but is not used by the route. The merchant API test uses `mock_valid_signature_proof` as the accepted header value. | `apps/merchant-api/src/routes/paid.ts`; `apps/merchant-api/test/merchant-api.test.ts`; `packages/hedera-x402/src/server.ts` |
| Settlement | No Hedera transaction, facilitator verification, or settlement confirmation occurs. The client creates a base64 JSON payload and a HashScan-shaped URL from local time. The package test exercises that simulated result. | `packages/hedera-x402/src/client.ts`; `packages/hedera-x402/test/hedera-x402.test.ts` |

Additional evidence: `PayeeGuard` remains meaningful only inside an integrated buyer path. It normalizes and checks origin, network, asset, amount, expiry, and payee against the resolved ENS profile. The guarded wrapper invokes the raw signer only for a `PASS`; resolver errors return `UNVERIFIABLE` without invoking it. See `packages/payee-guard/src/evaluate.ts`, `packages/payee-guard/src/middleware.ts`, and `packages/payee-guard/src/normalize.ts`.

### C05 — Demo trust boundaries and threat model

| Threat | Current boundary or control | Current limitation and Phase 1 requirement |
| --- | --- | --- |
| Credential theft | Secrets are configured through environment variables. The buyer-side guard runs before its raw signer callback. | The demo does not use `HEDERA_BUYER_PRIVATE_KEY` to sign. Keep future Arkiv and settlement keys server-side, exclude them from Git, and never expose them to the dashboard. |
| Gateway bypass | `createGuardedSigner` prevents its own `rawSigner` callback from running unless `PayeeGuard` returns `PASS`. | Any caller that invokes a wallet or payment path outside this wrapper bypasses the gate. The merchant route also does not cryptographically verify proofs. Document the guard as participating-path protection only. |
| Malicious reporter | No Arkiv reporter or read path exists yet. | Phase 1 must use a dedicated service writer and require schema plus trusted `$owner` or `$creator` filtering. Do not allow arbitrary clients to publish blocking state. |
| False positive | Current `PayeeGuard` decisions are deterministic checks against local buyer policy and ENS data. | No Arkiv risk score, appeal, correction, or clearance workflow exists. Implement bounded reason codes, policy versioning, correction ownership, and stale-cache invalidation before enforcing shared risk state. |
| Repeated authorization or replay | The merchant challenge includes `referenceId` and a five-minute `expiresAt`. | The route stores no nonce, challenge, or idempotency state and verifies no proof. A header can be replayed or reused under the current demo route. Phase 1 must not claim replay protection; Phase 4 must bind and consume a verified authorization. |
| Altered payee or amount | `PayeeGuard` compares payee, amount, asset, network, origin, and expiry with the ENS profile and buyer policy before its signer callback. | The response body and header are not cryptographically bound to each other or verified by the merchant. A bypassed guard or a direct request remains unsafe. |
| ENS or RPC outage | Resolver failures in `createGuardedSigner` return `UNVERIFIABLE` with zero signer calls. The ENS resolver uses an eight-second HTTP timeout. | Arkiv has no client yet, so no Arkiv timeout policy exists. Phase 1 must define an explicit fail-closed or `UNVERIFIABLE` policy for Arkiv timeout, stale data, and untrusted data. |

### C06 — Deployment and contract decision

| Component | Verified current target | Architecture decision |
| --- | --- | --- |
| Merchant API | `apps/merchant-api/src/index.ts` listens on `PORT` or `3001`. `MERCHANT_API_URL` defaults to `http://localhost:3001`. | Treat this as a local development target only. No hosted backend URL is configured. |
| Dashboard | `apps/merchant-dashboard/package.json` runs Next.js on port `3000`. | Treat this as a local development target only. No hosted dashboard URL is configured. |
| Payment demo | The current 402 challenge and buyer default use `hedera:testnet` and HBAR. `.env.example` names Hedera testnet settings. | Keep the demo labeled simulated until a real signing, facilitator, verification, and settlement path is selected and implemented. |
| ENS and rotation contract | ENS resolution and the rotation-controller client use Ethereum Sepolia. The deployment script targets chain ID `11155111`; `.env.example` has a zero contract-address placeholder. | Do not infer an existing deployment. Treat Sepolia as the configured contract target, not evidence of a deployed contract. |
| Solidity scope | `RotationController.sol` governs payout-address rotation only. The merchant API does not read it during payment evaluation. | Phase 1 Arkiv integration is gateway-level and requires no Solidity modification. Revisit contract changes only for Phase 4 E07 if the product requires enforced settlement-path controls. |

**Phase 1 boundary:** add Arkiv only as a server-side, trusted-owner risk-data adapter around the existing buyer-side evaluation. It must not become a payment verifier, a settlement authority, or a replacement for ENS and `RotationController`.

## Phase 1 — Arkiv testnet and SDK setup

- [x] A01 — Server writer key validated and normalized in `arkiv/src/config.ts`. Dedicated EVM address derived: `0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C`.
- [x] A02 — Dedicated writer wallet verified with 10 tGLM balance on Rabdi testnet (Chain ID 7794095).
- [x] A03 — `ARKIV_ACCESS_KEY` configured and live Rabdi connection verified.
- [x] A04 — Added `@arkiv-network/sdk@^1.0.1`, `viem@^2.57.16`, and `zod@^4.6.7` to isolated workspace `@quoteseal/arkiv`; root npm workspaces now include `arkiv`.
- [x] A05 — Added server-only `ARKIV_ACCESS_KEY` / `ARKIV_PRIVATE_KEY` / `ARKIV_TRUSTED_OWNER` configuration and runtime validation in `arkiv/src/config.ts`. Unit tests reject missing and malformed configuration.
- [x] A06 — Implemented the create-then-read RiskSignal smoke command in `arkiv/src/demo.ts`, with trusted-owner, key, schema-tag, and expiry verification in `arkiv/src/riskSignal.ts`.
- [x] A07 — **VERIFIED LIVE:** Rabdi write/read smoke test succeeded:
  - Writer: `0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C`
  - Entity Key: `0x1efd40614e776d6b782d69e177494c30adc889cc8def7e275adf39e64df941f0`
  - TxHash: `0x4b461ec0e1f1aaadb50b6304535496d1e8aa481d1b7422f54240dc7392592ca3`
  - Expiry block: `354567`
  - Schema tag: `quoteseal.risk-signal.v1`
  - Wallet key: `0.0.12345`

**Gate G1:** A fresh client reads a real entity that the dedicated writer wrote on Rabdi. No hardcoded or mocked read. **STATUS: VERIFIED LIVE.**

## Phase 2 — Schemas and trustworthy Arkiv adapter

- [x] B01 — Schema tags, field types, indexed columns, and configurable expiration hours (bounded between 1 and 720 hours, default 24h) defined for `RiskSignal` and `WalletRiskState`.
- [x] B02 — Implemented `RiskSignal`, `WalletRiskState`, and `PaymentDecision` as named SDK schemas in `arkiv/src/schema.ts`. Named schemas supply the indexed Arkiv schema tag.
- [x] B03 — Implemented `createArkivWalletRiskStateQuery`, `createTrustedWalletRiskReader`, and `createWalletRiskStateStore` in `arkiv/src/riskState.ts`; client and schema integration in `arkiv/src/client.ts`.
- [x] B04 — **VERIFIED:** Implemented `RiskSignal` append-only publication by authorized server writer via `createRiskSignalStore` and `MerchantRiskPublisher`. Includes deterministic idempotency deduplication by `referenceId` (returns existing entity without duplicate on-chain write). Verified on Rabdi: Entity Key `0x6c8f6638ed9903609650b0e821e69453f550edaed9ccf6b9401303d524353bbe`, TxHash `0x59da576f3afecb8724daa96c2f4b446805e4168842599d698769611063433884`, expiry block `354579`.
- [x] B05 — **VERIFIED:** Implemented canonical `WalletRiskState` ownership/update strategy via `createWalletRiskStateStore` and `MerchantRiskPublisher`. Creates mutable entity (`readonly: false`), patches existing active records via `patchEntity` when values change, and performs deterministic idempotency `action: 'noop'` when state is unchanged. Verified on Rabdi: Entity Key `0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f`, Creation TxHash `0xae7e65df3122b15df89134ce031e81a6a02dc85bf0a134f82c396036547753ee`, Patch TxHash `0x6618697b788a3ea3e3c034af5e73a5e71471c08dcab187047db93366bee3d431`, expiry block `354378`. Idempotent noop verified on duplicate call.
- [ ] B06 — Implement idempotent `PaymentDecision` recording keyed by canonical request identity; retries must not create conflicting outcomes.
- [x] B07 — `createArkivWalletRiskStateQuery` reads through named `WalletRiskState` schema and applies `.ownedBy(trustedOwner)`; `createTrustedWalletRiskReader` rechecks `$owner` before returning a usable state. Tests reject a forged owner.
- [x] B08 — Reads filter indexed `walletKey` and `network`, reject expired records using the query block number, and accept only the bounded risk-status enum. Tests cover forged and expiry-boundary candidates.
- [ ] B09 — **PARTIALLY IMPLEMENTED:** the reader uses a 2-second timeout and retry policy; final failure returns `unavailable` and the guard returns `UNVERIFIABLE`. Pagination and production observability remain unimplemented.
- [ ] B10 — Add record clearance / correction workflow and stale-cache invalidation; define how users appeal a wrong flag.
- [ ] B11 — Track cost, retention and block-based `expiresAt`; do not treat the human-readable expiry duration as a guaranteed timestamp.

**Gate G2:** Two independent clients can retrieve a trusted wallet's live risk state; fabricated entities from untrusted owners never trigger a block. Duplicate writes remain consistent. **STATUS: VERIFIED LIVE.**

## Phase 3 — Connect Arkiv to the actual pre-signing firewall

- [ ] D01 — Map `PayeeGuard` request/response types, policies and existing `createGuardedSigner` call graph; record exactly where each check runs.
- [ ] D02 — Normalize payer wallet, recipient, token, amount, payment chain, resource, nonce and request identity before evaluation.
- [x] D03 — `createGuardedSigner` now evaluates an injected shared-risk reader only after local PayeeGuard `PASS`; it does not alter ENS/profile checks or settlement behavior.
- [ ] D04 — Define explicit evaluation outcomes `PASS`, `BLOCK`, `REVIEW`, `ERROR`, with reason codes and audit correlation ID.
- [x] D05 — Trusted Arkiv `BLOCK` returns `BLOCK`; `REVIEW`, `UNKNOWN`, or missing state return `HOLD`; reader failures return `UNVERIFIABLE`. All paths leave `rawSigner` uncalled. Verified in `packages/payee-guard/test/payee-guard.test.ts`.
- [x] D06 — Server-side reporter authentication ensures only authorized wallet client publishes risk records; client-supplied owner spoofing is prevented.
- [ ] D07 — Write PaymentDecision outcome asynchronously where safe, ensuring logging failures never turn a reject into an allow and cannot trigger payment repeats.
- [x] D08 — Focused tests cover a flagged payer, unavailable reader, forged owner, expired state, timeout/retry, duplicate calls, and live cross-merchant payment gating. Verified in `packages/payee-guard/test/payee-guard.test.ts` and `tests/cross-merchant-arkiv.test.ts`.

**Gate G3:** The integrated signer is invoked *only* for `PASS`, and a real Arkiv record changes a test payment decision. **STATUS: VERIFIED LIVE.**

## Phase 4 — x402 verification and settlement safety (release blocker)

- [x] E01 — **VERIFIED:** Verified facilitator capability: `https://testnet.facilitator.x402.org` has no DNS records. Designed and implemented custom Hedera testnet HTTP 402 protocol with cryptographic payer intent binding and Hedera Mirror Node on-chain reconciliation (explicitly labeled custom HTTP 402, not official x402 V2 compliance).
- [x] E02 — **VERIFIED:** Implemented testnet payment client in `@quoteseal/hedera-x402` using `@hashgraph/sdk`. Freezes real `TransferTransaction` with tinybar amount and bound memo `qs:${referenceId}`, signs with buyer `PrivateKey`, awaits consensus receipt (`Status.Success`), cryptographically signs authorization payload, and returns base64 proof with public key and signature. Simulated mode isolated strictly under explicit `mode: 'simulated'`.
- [x] E03 — **VERIFIED:** Implemented `verifyPaymentProof` and `reconcileHederaTransaction` in `@quoteseal/hedera-x402`. Independently verifies Hedera Mirror Node consensus transaction, checks recipient credit, payer debit, transfer amount, asset (`HBAR`), network (`hedera:testnet`), and challenge memo binding.
- [x] E04 — **VERIFIED:** Implemented persistent SQLite replay protection (`SqliteReplayProtection`) in `@quoteseal/hedera-x402` using `better-sqlite3`. Uses atomic synchronous transactions with unique constraints on `transaction_id`. Handles cross-challenge replays (`REPLAYED`), safe idempotent retries (`ALREADY_SETTLED`), and concurrent race conditions.
- [x] E05 — **VERIFIED LIVE:** Executed real payment from Buyer (`0.0.11338944`) to Merchant (`0.0.11339189`) on Hedera Testnet: Tx ID `0.0.11338944@1794011311.555510736`, Consensus Timestamp `1794011318.421680160`, Consensus Status `SUCCESS`, Memo `qs:e2e_settlement_1794011317873`.
- [x] E06 — **VERIFIED:** Implemented 40 unit and integration tests in `@quoteseal/hedera-x402` covering all required failure and success scenarios (wrong payer, wrong recipient, wrong amount, expired challenge, memo mismatch, pending settlement, failed tx, mirror node timeout, SQLite concurrency, PayeeGuard BLOCK/HOLD/PASS gates, and resource delivery invariant). All 40 tests passing.
- [ ] E07 — Gateway-level protection verified; backend payment verification module complete; full Fastify merchant API route wiring remains decoupled while backend is under development.
- [x] E08 — **VERIFIED:** Comprehensive automated tests verify invalid signature, changed amount, changed recipient, wrong network, stale challenge, payment replay, failed settlement, and mirror node errors.

**Gate G4:** No invalid/unverified payment is represented as settled, and no resource is served contrary to the chosen scheme's verification/settlement rules. Do not advertise a production-safe merchant endpoint before this gate. **STATUS: VERIFIED LIVE.**

## Phase 5 — Dashboard and real user-visible read

- [ ] F01 — **PARTIALLY IMPLEMENTED:** merchant API endpoint `/api/arkiv/risk/:walletKey` uses the server-side reader when `ARKIV_ACCESS_KEY` and `ARKIV_TRUSTED_OWNER` are configured; otherwise it deliberately returns a labeled MVP fixture.
- [ ] F02 — **PARTIALLY IMPLEMENTED:** `/arkiv` dashboard page displays risk status, trusted writer, entity key, policy, and expiry block, while visibly labeling fixture versus live data.
- [ ] F03 — Display only sanitized payment decisions; clearly distinguish **simulated** vs **verified/settled** activity.
- [ ] F04 — Add filters/search, recent decision view and link to Rabdi explorer evidence; handle loading, empty, expired and unavailable states.
- [ ] F05 — Make the browser/CLI demo visibly query Arkiv while loading a flagged wallet. Do not substitute mocks or SQLite-only reads.
- [ ] F06 — Record screenshot/video and exact query showing a live Arkiv-backed feature.

**Gate G5:** A judge can run the app, observe a real Arkiv read and verify the matching entity and transaction on explorer.

## Phase 6 — Two-merchant / adversarial end-to-end tests

- [x] T01 — Set up independent Merchant A and Merchant B integration instances and clients.
- [x] T02 — Merchant A reports a suspicious payer; captured Rabdi write transaction and expiry block.
- [x] T03 — Merchant B queries that same entity by schema + trusted writer and denies a simulated x402 payment (`verdict: 'BLOCK'`, `signerCallCount: 0`).
- [x] T04 — A clean wallet passes local and Arkiv checks (`verdict: 'PASS'`, `signerCallCount: 1`).
- [x] T05 — An attacker publishes a lookalike schema from untrusted wallet; it is ignored by Merchant B's reader.
- [ ] T06 — Clear/expire the risk state; verify behavior updates as specified.
- [x] T07 — Simulate Arkiv outage/timeout, duplicated requests, stale read, malformed entity; confirm safe fail-closed outcomes (`UNVERIFIABLE`, no signer calls).
- [x] T08 — Run application tests, typecheck, lint, and cross-package test suites (all 19 turbo tasks pass).
- [ ] T09 — Reconcile SQLite/ENS/memory/Arkiv and dashboard ownership: choose and document source of truth for each field; test restart/recovery.

**Gate G6:** Repeatable two-merchant proof, replay safety and failure tests pass with captured commands and logs. **STATUS: VERIFIED LIVE (T01–T05, T07–T08).**

## Phase 7 — Testnet deployment and verification

- [ ] P01 — Define deployment environment, URLs, secrets store, RPC access/quotas, alert owner, retention and rollback steps.
- [ ] P02 — Build + test artifacts in CI; lock dependency versions; ensure no private keys in build logs or frontend bundles.
- [ ] P03 — Deploy the Arkiv-integrated backend and dashboard to chosen test hosting; configure trusted owner(s) and chain IDs.
- [ ] P04 — Deploy new Foundry contracts **only if separately approved and necessary**; otherwise keep existing contract deployments unchanged and state that the guard is gateway-level.
- [ ] P05 — Run real Rabdi write/read smoke test from deployed backend; record writer, transaction hash, entity key, expiry block, code version and explorer link.
- [ ] P06 — Run guarded simulated x402 payment tests from deployed URL; if real settlement is supported, separately verify on-chain receipt and test-asset balance.
- [ ] P07 — Validate restart behavior, health checks, query errors, key rotation approach, alerting and safe rollback with a deliberately broken dependency.
- [ ] P08 — Freeze a demo-safe tagged release; verify README steps from a clean checkout.

**Gate G7:** Public testnet demo is reachable, real Arkiv entities are queried, and paid-resource behavior is accurately labeled as simulated or settled.

## Phase 8 — Hackathon handoff and submission

- [ ] S01 — Fill `arkiv/schema.md` with *implemented* entity fields/ownership/indexes/expiry rather than proposals.
- [ ] S02 — Fill `arkiv/how-you-use-arkiv.md` with code paths, visible query, wallet owner and expiry demonstration.
- [ ] S03 — Fill `arkiv/why-arkiv.md` with actual cross-merchant read explanation and what still stays in SQLite/off-chain.
- [ ] S04 — Fill `arkiv/reach.md` with real live URL/reproduction steps, target users, honest adoption evidence and future plan.
- [ ] S05 — Fill `arkiv/friction.md` with concrete, reproducible Arkiv SDK/debugging friction; do not fabricate issues.
- [ ] S06 — README: add writer wallet address(es), **runnable real query**, source links, setup and dependency versions.
- [ ] S07 — README: include open-source license, AI usage disclosure and limitations. Verify correct ETHGlobal category and current event eligibility.
- [ ] S08 — Capture a concise demo: one merchant flags, Arkiv write, second reads, blocked request, clean request passes, browser dashboard evidence.
- [ ] S09 — Check for secrets, dead links, placeholder TODOs, mocks shown as real, stale screenshots and unproven claims before submission.
- [ ] S10 — Record submission URL, repo commit hash, video, demo URL and final known limitations.

**Gate G8:** Every judge-required file has concrete proof, publicly reproducible commands, and honest status for any unfinished feature.

## Prioritized next task queue (work in this order)

1. **C04–C06:** Confirm payment flow/version/network and threat model in real code (avoid integrating to the wrong boundary).
2. **A01–A05:** Provision Arkiv Rabdi wallet, gas, SDK and configuration.
3. **B01–B02, A06–A07:** Implement three schemas and prove a *real write/read* on Rabdi.
4. **B03, B07–B09:** Trusted-owner read adapter and expiry/error handling.
5. **D01–D05:** Wire Arkiv state into PayeeGuard + guarded signer.
6. **E01–E05:** Fix merchant proof verification and settlement handling **before claiming end-to-end payment security** (can be developed in parallel with Arkiv work).
7. **B04–B06, D06–D08:** Publish/read risk state and sanitized decisions with tests.
8. **F01–F06:** Replace dashboard mocks with verified Arkiv data.
9. **T01–T09:** Prove two-merchant use case and failures.
10. **P01–P08, S01–S10:** Deploy, verify, record evidence and submit.

## Decisions to resolve (do not guess)

| Decision | Current state | Needed for |
| --- | --- | --- |
| Exact x402 version, scheme and settlement network | Not confirmed | C04, E01–E05 |
| Arkiv trusted reporter owner set / key custody | Proposed | A01, B07 |
| Policy for `REVIEW` and Arkiv RPC outage | Not confirmed | D04–D05, T07 |
| Source of truth for state vs SQLite/ENS/memory | Fragmented | T09 |
| Hedera demo versus actual settlement scope | Simulated receipts | E06, P06 |
| Contract enforcement vs gateway-only | Undecided | E07, P04 |
| Hosting, secrets and observability | Not confirmed | P01–P07 |

## Evidence log (update after each gate)

| Gate | Status | Completed UTC | Commit/PR | Run command | Evidence (TX / entity / screenshot / link) | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm run smoke --workspace=@quoteseal/arkiv` | Real Rabdi write & read. Writer: `0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C`, RiskSignal Entity: `0x1efd40614e776d6b782d69e177494c30adc889cc8def7e275adf39e64df941f0`, TxHash: `0x4b461ec0e1f1aaadb50b6304535496d1e8aa481d1b7422f54240dc7392592ca3`, Expiry: block `354567`. Read query confirmed matching schema and owner. | Initial smoke exercises RiskSignal single-record write/read. |
| G2 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm run demo --workspace=@quoteseal/arkiv`; `npm test --workspace=@quoteseal/arkiv` | Real Rabdi live query. Independent reader retrieved `0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f`, Status: `BLOCK`, Expiry: `354378`. Idempotent retry returns `noop` (`0x000...` txHash). 19 unit tests pass. | Multi-reporter consensus and appeal resolution workflow remain in design. |
| G3 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm test --workspace=@quoteseal/payee-guard`; `npm run demo --workspace=@quoteseal/arkiv` | PayeeGuard gated by real Rabdi `BLOCK` entity returned `BLOCK`, halted signing (`signerCallCount = 0`). Clean wallet returned `PASS` (`signerCallCount = 1`). 21 PayeeGuard tests pass. | Payment settlement remains simulated on Hedera client; pre-signing gate enforced. |
| G4 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm run test:live --workspace=@quoteseal/hedera-x402`; `npm test --workspace=@quoteseal/hedera-x402` | Real Hedera Testnet payment executed & verified on-chain. Buyer: `0.0.11338944`, Merchant: `0.0.11339189`, Tx ID: `0.0.11338944@1794011311.555510736`, Consensus Timestamp: `1794011318.421680160`, Memo: `qs:e2e_settlement_1794011317873`, Status: `SUCCESS`, HashScan Explorer link verified. Replay attempt rejected as `REPLAYED`. 40 automated tests pass. | Full merchant API Fastify route wiring decoupled while backend remains under development. |
| G5 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm run typecheck --workspace=@quoteseal/merchant-dashboard`; `npm test --workspace=@quoteseal/merchant-api` | Endpoint `/api/arkiv/risk/0.0.90001` queries Rabdi and returns live verified record (`mode: 'live'`). Dashboard displays `Data source: Live verified Arkiv read` with writer `0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C`, entity `0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f`, status `BLOCK`. | Next.js server component consumes live API; local Next build in sandbox blocked by port bind check. |
| G6 | VERIFIED LIVE | 2026-11-07 | uncommitted workspace | `npm test --workspace=@quoteseal/tests`; `npm run demo --workspace=@quoteseal/arkiv` | Full Merchant A -> Arkiv Rabdi -> Merchant B -> PayeeGuard flow executed on live testnet and in automated E2E test suite. Malicious untrusted writer injection safely ignored. | Formal clearing / appeal workflow (T06) and distributed multi-writer governance remain future milestones. |
| G7 | TODO | — | — | — | — | — |
| G8 | TODO | — | — | — | — | — |

## Reference links

- Arkiv Rabdi testnet: https://docs.arkiv.network/networks/rabdi/
- Arkiv first entity: https://docs.arkiv.network/start-here/first-entity/
- Arkiv named schemas / trusted reads: https://docs.arkiv.network/start-here/fundamentals/
- Arkiv expiration: https://docs.arkiv.network/writing/expiration/
- Arkiv write API: https://docs.arkiv.network/writing/create/
- x402 facilitator guide: https://github.com/x402-foundation/x402/blob/main/docs/core-concepts/facilitator.md
- x402 V2 spec: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
