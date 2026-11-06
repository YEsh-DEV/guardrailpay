# QuoteSeal: Execution Plan

> Merchant-authorized payment identity for autonomous x402 agents
> ETHGlobal Mumbai 2026 | Plan prepared 06 Nov 2026
> Source of truth for scope: `QuoteSeal_Project_Brief.docx`

---

## 0. How to use this plan

- Work **top to bottom**. Each phase has a goal, tasks, and a **gate** (a pass/fail check). Do not start the next phase until the gate passes, unless the phase says it can run in parallel.
- Tick checkboxes as you go. Keep this file in the repo root and update it daily.
- The hackathon deadline is not in the brief. **Set it below** and back-calculate your days.

```
Hackathon submission deadline: ____________________
Total working days available:   ____
Team members / roles:           ____________________
```

If you have fewer than 5 working days, follow the **Compressed schedule** in section 11.

---

## 1. Goal and definition of done

**One-sentence product:** Before an AI agent signs an x402 payment, QuoteSeal checks that the requested recipient (`payTo`) matches the merchant's trusted ENSv2 payment profile. Legitimate payout changes go through an announced, delayed, human-approved rotation.

**MVP = exactly this:**

1. One merchant with one ENSv2 payment profile (Sepolia)
2. One buyer-side guard that runs immediately before the x402 signer
3. One protected Hedera x402 endpoint with one real settled payment
4. One controlled payout rotation protected by World ID Agent Pass

**Done means all of these are true:**

- [ ] Normal agent payment passes the guard and settles on Hedera, with a HashScan link
- [ ] An attack proxy rewrites `payTo` and the guard blocks it with **signer call count = 0**
- [ ] A rotation with successful World auth activates the new `payTo` after the delay
- [ ] A rotation with denied/expired World auth does **not** activate
- [ ] No merchant values are hardcoded; everything resolves from ENSv2
- [ ] Public repo, README, architecture diagram, live demo link, demo video (5 min or less)
- [ ] Tests T1 to T11 pass

---

## 2. Scope rules (read before every planning decision)

**In scope:** ENSv2, Hedera x402, World ID Agent Pass.
**Optional only after the core works:** Hedera HCS audit log.
**Out of scope (do not add):** Arkiv, Chainlink CRE, Arc/Circle, custom facilitator, marketplace, x402 signed-offer extension.

Rule of thumb: if a task does not make T1 to T11 pass or does not appear in the submission checklist, it waits.

---

## 3. Team roles (adjust to your team size)

| Role | Owns | Packages / areas |
|---|---|---|
| **Core / guard lead** | Verdict engine, normalization, tests, guarded signer | `packages/payee-guard`, `tests/` |
| **ENS / contracts lead** | ENSv2 spike, EAC roles, rotation contract | `contracts/`, `packages/ens-profile`, `packages/rotation-controller` |
| **Payments / backend lead** | Hedera x402, merchant API, attack proxy, World backend | `packages/hedera-x402`, `packages/world-auth`, `apps/merchant-api`, `apps/attack-proxy` |
| **Frontend / demo lead** | Dashboards, buyer demo UI, README, video | `apps/merchant-dashboard`, `apps/buyer-demo`, `docs/` |

Solo builder: follow the phase order strictly and skip anything marked *(stretch)*.

---

## 4. Risk-ordered build strategy

The brief orders work by **integration risk**, not by what is most fun. The riskiest unknowns are ENSv2 (docs may change) and Hedera x402 (real facilitator). Prove those first with small spikes. The guard itself is pure logic and can be built in parallel at any time.

```
Phase 0  Setup
Phase 1  Guard core (pure logic)           ─┐ parallel
Phase 2  Spike 1: ENSv2 on Sepolia          ─┤
Phase 3  Spike 2: Hedera x402 payment       ─┘
Phase 4  Spike 3: Guard before signer + attack proxy
Phase 5  Rotation controller + World ID flow
Phase 6  Merchant onboarding + dashboards
Phase 7  Hardening, full test suite
Phase 8  (stretch) HCS audit log
Phase 9  Polish, docs, demo, submission
```

---

## 5. Phase 0: Setup and accounts

**Goal:** Everyone can run the repo and has the accounts they need.

### Tasks
- [ ] Create GitHub repo `quoteseal` (public, MIT license)
- [ ] Initialize pnpm workspace + Turborepo
- [ ] Add `packages/config` (shared tsconfig strict, eslint, prettier)
- [ ] Add `packages/shared` (types, error classes, logger, Zod env loader)
- [ ] Create folder skeleton exactly as below
- [ ] Add GitHub Actions CI (install, lint, typecheck, test, `forge build`)
- [ ] Create `.env.example` (see section 8) and add `.env` to `.gitignore`
- [ ] Get a Sepolia RPC URL and fund a **testnet-only** wallet
- [ ] Create Hedera testnet accounts: buyer, merchant (and fund buyer)
- [ ] Register for World ID Agent Pass access (confirm current dev/test setup in the docs)
- [ ] Read the reference docs listed in section 13

### Repository skeleton
```
quoteseal/
├── apps/
│   ├── merchant-dashboard/    # Next.js
│   ├── merchant-api/          # Fastify
│   ├── buyer-demo/            # agent + demo UI
│   └── attack-proxy/          # rewrites payTo
├── packages/
│   ├── payee-guard/
│   ├── ens-profile/
│   ├── rotation-controller/
│   ├── world-auth/
│   ├── hedera-x402/
│   ├── shared/
│   └── config/
├── contracts/                 # Foundry
├── tests/                     # cross-package e2e
├── docs/
├── plan.md
├── README.md
├── pnpm-workspace.yaml
└── turbo.json
```

### Gate 0
- [ ] `pnpm install && pnpm test` runs green on a fresh clone (even if tests are empty)
- [ ] CI passes on `main`
- [ ] All team members have testnet keys in their own local `.env`

---

## 6. Phase 1: Guard core (pure logic, no network)

**Goal:** A fully tested verdict engine. This is the heart of the project and needs no external accounts, so it can start on day 1.

### Tasks
- [ ] Define types in `packages/payee-guard/src/types.ts`:
  - `Verdict = "PASS" | "HOLD" | "BLOCK" | "UNVERIFIABLE"`
  - `PaymentRequest`, `MerchantProfile`, `BuyerPolicy`, `EvaluationResult { verdict, reason }`
- [ ] Implement `normalize.ts` with canonical forms for:
  - URLs / origins (scheme, host lowercase, default ports, no trailing-slash tricks)
  - Network IDs (e.g. `hedera:testnet`)
  - Asset/token identifiers
  - Hedera account IDs (`0.0.x` format)
- [ ] Implement `evaluate(payment, profile, policy, now)` per the brief:
  1. profile missing or expired → BLOCK
  2. origin mismatch → BLOCK
  3. network mismatch → BLOCK
  4. asset mismatch → BLOCK
  5. amount > min(profile.maxAmount, policy.maxAmount) → BLOCK
  6. payTo == activePayTo → PASS (or HOLD if rotation policy prohibits)
  7. payTo == pendingPayTo and now < pendingEffectiveAt → HOLD
  8. anything else → BLOCK
  9. Stale 402 offer (expired) → BLOCK / require fresh request
- [ ] Implement `guardedSigner(signer, deps)` wrapper:
  - Resolve profile → on any error return `UNVERIFIABLE`
  - Call `evaluate`
  - Invoke the real signer **only** on PASS
  - Expose a call counter for tests
- [ ] Write unit tests:
  - Match and mismatch for payTo, amount, asset, network, origin, expiry
  - All rotation states (none, pending before effective time, pending after)
  - Normalization edge cases (case, trailing slash, port, whitespace)
  - `UNVERIFIABLE` on resolver error, never PASS
  - Signer call count is 0 for every non-PASS verdict

### Design rules
- `evaluate` is **pure**: no I/O, no clock access (take `now` as a parameter), no LLM.
- Uncertainty always resolves to `UNVERIFIABLE` or `BLOCK`, never `PASS`.
- No loose string comparison anywhere.

### Gate 1
- [ ] Tests for T1, T2, T3 (logic only), T4, T5, T6, T7, T10, T11 pass
- [ ] Coverage on `evaluate` and `normalize` is effectively complete
- [ ] A reviewer other than the author has read `evaluate.ts`

---

## 7. Phases 2 to 9 in detail

### Phase 2: Spike 1, ENSv2 on Sepolia

**Goal:** Read and write one payment profile on ENSv2 and prove role separation. This is the highest-risk integration, so do it early.

**Tasks**
- [ ] Read the ENSv2 overview, EAC and Permissioned Resolver docs; note that interfaces may change
- [ ] Register or obtain an ENSv2 name on Sepolia for the demo merchant (e.g. `researchpro.eth` or a Sepolia equivalent)
- [ ] Define the record schema in `packages/ens-profile/src/schema.ts` (Zod):
  ```
  serviceEndpoint, hederaNetwork, assetId, activePayTo, maxAmount,
  profileVersion, rotationStatus (none|pending), pendingPayTo, pendingEffectiveAt
  ```
- [ ] Implement `resolveProfile(ensName)` with viem; any RPC error or malformed record throws → guard maps to `UNVERIFIABLE`
- [ ] Implement `writeProfile(ensName, records)` for initial setup
- [ ] Set up EAC roles:
  - Treasury role: may **propose** only
  - Controller role: the **only** writer of `activePayTo`
  - Avoid accidental root-resource grants (root permissions have broader effects)
- [ ] Write a script that proves: treasury account **cannot** write `activePayTo`; controller account can
- [ ] Document every permission and record owner in `docs/ens-permissions.md` (needed for submission)

**Fallback:** if EAC cannot express the needed separation in time, use a backend-enforced controller and **label it a prototype trust assumption** in the README. Do not hide this.

**Gate 2**
- [ ] Profile resolves from Sepolia with no hardcoded values
- [ ] Role-separation script shows an unauthorized write fails
- [ ] Resolver errors surface as exceptions (not defaults)

---

### Phase 3: Spike 2, Hedera x402 payment

**Goal:** One real autonomous paid request settled on Hedera testnet.

**Tasks**
- [ ] Read Hedera x402 docs and the exact scheme page (see section 13)
- [ ] Build `apps/merchant-api/src/routes/paid.ts`: an x402-protected endpoint returning HTTP 402 with `payTo`, amount, asset, network
- [ ] Build `packages/hedera-x402/src/client.ts`: pay-and-fetch using the **official** client and a **documented** facilitator
- [ ] Run buyer → 402 → sign → facilitator → settlement end to end
- [ ] Record the transaction ID and HashScan link in `docs/payments.md` and the README
- [ ] Confirm no human approval is needed in the normal payment path

**Gate 3**
- [ ] One real settled testnet payment with HashScan link saved
- [ ] The agent discovers and calls the endpoint on its own

---

### Phase 4: Spike 3, guard before the signer + attack proxy

**Goal:** Prove the central claim: a modified `payTo` is rejected before signing.

**Tasks**
- [ ] Integrate `guardedSigner` into the Hedera client path so the guard runs **immediately before** the signer
- [ ] Wire `ens-profile.resolveProfile` into the guard (no mocks on the main path)
- [ ] Build `apps/attack-proxy`: an HTTP proxy that rewrites **only** `payTo` in a real 402 response
- [ ] Add an e2e test in `tests/`: buyer → attack proxy → merchant; assert verdict BLOCK and signer call count = 0, and no Hedera transaction created
- [ ] Add buyer onboarding of trusted merchants (config file or table). **Never trust an ENS name found only in the 402 response**
- [ ] Add buyer policy: max amount, trusted merchant list

**Gate 4 (the key milestone)**
- [ ] T1 passes with real settlement
- [ ] T2 passes with the attack proxy and signer count = 0
- [ ] T3 passes (unknown merchant blocked)

> If you only finish through Gate 4 you still have a strong, honest demo. Everything after it adds the rotation story and the World ID prize.

---

### Phase 5: Rotation controller + World ID Agent Pass

**Goal:** A legitimate payout change that is announced, authenticated, delayed, then activated.

**5a. Rotation controller**
- [ ] Write `contracts/src/RotationController.sol`:
  - `proposeRotation(newPayTo)` (treasury role)
  - `approveRotation(id)` (approver role, called after World validation)
  - `activate(id)` (callable after the delay)
  - `revoke(id)` (emergency path; payments blocked until re-authorization)
  - Stores pending address and effective timestamp; active address unchanged during the delay
- [ ] Write Foundry tests: propose, early activate fails, activate after delay, unauthorized caller fails, revoke
- [ ] Deploy to Sepolia; grant it the EAC role that lets it write `activePayTo`
- [ ] Make configurable delay (demo: 60 to 120 seconds)
- [ ] Implement `packages/rotation-controller` client (`propose`, `activate`, `status`)
- [ ] Update `ens-profile` to publish `rotationStatus`, `pendingPayTo`, `pendingEffectiveAt` so guards can return HOLD

**5b. World ID Agent Pass**
- [ ] Read the Agent Pass docs and prize requirements (full journey is required)
- [ ] Implement `packages/world-auth`:
  - `startAuth(operatorId)` → auth request URL
  - `validateCallback(code)` → verify signature, nonce, expiry, issuer and subject
  - `isAuthorized(issuer, subject, role)` → your own mapping to authorized operators
- [ ] Add `/world/start` and `/world/callback` routes in `merchant-api`
- [ ] Gate approval: only a validated + authorized subject can trigger `approveRotation`
- [ ] Handle denied, cancelled and expired results: the rotation stays pending/cancelled and the old profile remains active
- [ ] Clearly label in README and UI: event proofs are mocked, not production identity assurance

**Gate 5**
- [ ] T7 (HOLD during delay), T8 (approved rotation), T9 (denied/expired World auth) pass
- [ ] After activation: new `payTo` passes, old `payTo` is blocked for new requests
- [ ] T6 passes (unannounced rotation blocked)

---

### Phase 6: Merchant onboarding + dashboards

**Goal:** Usable interfaces for the demo, plus the initial trust binding.

**Onboarding (merchant-api + dashboard)**
- [ ] Merchant enters ENS name + endpoint
- [ ] One-time challenge: DNS TXT **or** `/.well-known/` file, plus an ENS-owner signature (wagmi + viem)
- [ ] Store verified merchant in DB (`merchants`, `challenges`)
- [ ] Buyer accepts the merchant as trusted
- [ ] Label every merchant as **demo/test** (domain + ENS control is not legal-company verification)

**Merchant dashboard (`apps/merchant-dashboard`)**
- [ ] Profile view (live from ENS)
- [ ] Propose rotation form
- [ ] Rotation status page (pending, countdown, active) with World auth step
- [ ] Permissions/roles view (supports the ENS prize explanation)

**Buyer demo (`apps/buyer-demo`)**
- [ ] Agent loop that pays for the API
- [ ] Verdict timeline (PASS/HOLD/BLOCK/UNVERIFIABLE with reasons)
- [ ] HashScan link for settled payments
- [ ] Toggle for the attack proxy

**Data model (SQLite via Drizzle):** `merchants`, `challenges`, `operators`, `rotations`, `audit_events`.

**Gate 6**
- [ ] A new merchant can onboard end to end through the UI
- [ ] The full demo script (section 10) can be run from the UIs without touching the terminal

---

### Phase 7: Hardening and full test suite

**Goal:** Cover every risk from the brief and make it reproducible.

- [ ] Implement and pass **all** of T1 to T11 (table below)
- [ ] Add tests for replayed/stale 402 and request timeout
- [ ] Verify `UNVERIFIABLE` on ENS/RPC failure (simulate a dead RPC)
- [ ] Ensure the ENS cache (if any) is short and **never** used to approve a new or changed recipient
- [ ] Lint rule / module boundary: only `payee-guard` may reach the Hedera signer
- [ ] Secrets check: no keys in git; all env vars validated by Zod at startup
- [ ] Run a fresh-clone setup test following only the README

| ID | Scenario | Expected |
|---|---|---|
| T1 | Normal payment, matching profile | PASS, signer called, Hedera settles |
| T2 | Proxy rewrites payTo | BLOCK, signer never called |
| T3 | Unknown merchant | BLOCK |
| T4 | Look-alike origin | BLOCK |
| T5 | Amount/asset/network drift | BLOCK |
| T6 | Unannounced rotation | BLOCK |
| T7 | During rotation delay | HOLD, no signature |
| T8 | Approved rotation | New payTo passes, old rejected |
| T9 | Denied/expired World auth | No activation, old profile stays |
| T10 | ENS/RPC unavailable | UNVERIFIABLE (fail closed) |
| T11 | Stale/replayed 402 | Reject, do not sign stale terms |

**Gate 7**
- [ ] `pnpm test` and `forge test` fully green in CI
- [ ] Fresh-clone setup works

---

### Phase 8: *(Stretch)* HCS audit log

Only start if Gate 7 passed with time to spare.

- [ ] Create an HCS topic; save the topic ID
- [ ] Publish rotation and security-decision **event hashes** (not secrets)
- [ ] Add a queryable view in the UI and the topic ID in the README
- [ ] Optional extras: per-merchant spend limits, HTS stablecoin settlement

---

### Phase 9: Polish, docs, demo, submission

- [ ] README with: overview, problem, architecture diagram, setup steps, env vars, test commands, payment flow, rotation flow, **known limitations**
- [ ] Architecture diagram in `docs/` (export as PNG/SVG, link from README)
- [ ] Live demo deployed (frontends on Vercel; API on Railway/Render/Fly)
- [ ] Demo video, **5 minutes or less** (script in section 10)
- [ ] Hedera: transaction ID + HashScan link in README
- [ ] ENS: deployment + records visible on Sepolia, permissions and record owners explained
- [ ] World: full journey documented plus the **integration debrief** (time to first success, friction, missing docs/capabilities, most valuable improvement)
- [ ] Label all seed data as demo data
- [ ] Confirm the three partner tracks in the ETHGlobal dashboard
- [ ] Re-check the live prize page (requirements can change; the dashboard is authoritative)

**Gate 9 (submission-ready)**
- [ ] Every item in section 12 is checked

---

## 8. Environment variables (`.env.example`)

```bash
# Ethereum / ENS
SEPOLIA_RPC_URL=
ENS_MERCHANT_NAME=
ROTATION_CONTROLLER_ADDRESS=
DEPLOYER_PRIVATE_KEY=            # testnet only, never reuse

# Hedera
HEDERA_NETWORK=testnet
HEDERA_BUYER_ACCOUNT_ID=
HEDERA_BUYER_PRIVATE_KEY=
HEDERA_MERCHANT_ACCOUNT_ID=
FACILITATOR_URL=
HCS_TOPIC_ID=                    # optional

# World ID Agent Pass
WORLD_OIDC_ISSUER=
WORLD_CLIENT_ID=
WORLD_CLIENT_SECRET=
WORLD_REDIRECT_URI=

# App
DATABASE_URL=file:./quoteseal.db
BUYER_MAX_AMOUNT=
ROTATION_DELAY_SECONDS=90
```

---

## 9. Daily rhythm and checkpoints

| Cadence | Action |
|---|---|
| Start of day | Re-read the current phase's gate; pick 2 to 3 tasks |
| During | Small commits, PR per task, CI must stay green |
| End of day | Tick boxes in this file; note blockers; record a 30-second screen capture of whatever works (insurance for the demo video) |
| After each gate | 10-minute review: is scope creeping? What can be cut? |

**Blocker rule:** if any spike is stuck for more than a few hours, use the fallback (mock behind an interface, label it honestly) and move on. Never silently hardcode merchant values.

---

## 10. Demo script (3 to 4 minutes)

1. Show ResearchPro's ENSv2 profile: active payout address, token/network, profile version.
2. Run a normal agent purchase. Show **PASS**, then the real Hedera transaction on HashScan.
3. Turn on the attack proxy (changes only `payTo`). Retry. Show **BLOCK** and prove the signer was never called.
4. Start a legitimate rotation. Show the World ID Agent Pass request, backend validation, and the pending delay (**HOLD** on the new address).
5. Show a **denied/expired** World approval: the new payTo is not activated.
6. Complete an approved rotation, wait the short delay, resolve the updated ENS profile, make a second successful payment to the new address. Old address now blocked.

Always say: *demo merchant, test data, mocked World identities.*

**Judge Q&A cheat sheet**
- *Why doesn't the facilitator solve it?* It verifies against seller-supplied requirements; we check whether the merchant authorized those requirements.
- *Why not MetaMask/HTTPS?* They protect keys and transport, not the business identity behind a `payTo`.
- *Novelty?* Not allowlisting. It is seller-published ENSv2 payment identity + scoped update authority + delayed, approval-gated rotation, consumed by a pre-sign guard.
- *Does EAC enforce the delay?* No. The rotation controller does.
- *Does World prove the approver is the CFO?* No. It gives fresh authentication; we map the subject to a pre-authorized role.

---

## 11. Compressed schedule (if time is short)

Priority order, cut from the bottom:

1. **Must:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4 (guard + attack proxy). This alone is a credible demo.
2. **Should:** Phase 5 rotation (backend-enforced controller is acceptable if disclosed).
3. **Should:** World ID flow with denied path (needed for that prize track).
4. **Could:** Phase 6 polish dashboards (a minimal UI or scripted CLI demo is acceptable).
5. **Won't (unless time):** HCS, extra spend controls, HTS stablecoin.

Suggested split for roughly 7 days:

| Day | Focus |
|---|---|
| 1 | Phase 0 + start Phase 1 (guard) |
| 2 | Finish Phase 1; Spike 1 (ENS) and Spike 2 (Hedera) in parallel |
| 3 | Gate 2 and 3; Spike 3 (guard before signer, attack proxy) → Gate 4 |
| 4 | Rotation contract + ENS wiring |
| 5 | World ID flow, denied path → Gate 5 |
| 6 | Onboarding + dashboards, full test suite → Gates 6 and 7 |
| 7 | README, deploy, video, debrief, submission → Gate 9 |

---

## 12. Final submission checklist

- [ ] Public repo with setup instructions, architecture diagram and known limitations
- [ ] ENSv2 deployment and records visible on Sepolia (or mainnet); all permissions and record owners explained
- [ ] At least one successful Hedera x402 payment with transaction ID and HashScan link in README
- [ ] World Agent Pass full journey: request, completion, backend validation, protected rotation action, denied/expired path
- [ ] Attack proxy modifies `payTo` in a real 402 response; test proves signer not called
- [ ] Automated tests for matching/mismatching payTo, amount, asset, network, origin, expiry and rotation states
- [ ] World integration debrief written
- [ ] If HCS added: topic ID and a queryable record
- [ ] Live demo link works
- [ ] Demo video is 5 minutes or less
- [ ] Three partner tracks confirmed in the ETHGlobal dashboard
- [ ] All seed data labelled as demo; no claims of production identity or legal KYC

---

## 13. References (re-verify before relying on them)

- x402 V2 spec: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- Hedera x402 docs: https://docs.hedera.com/solutions/ai/x402
- Hedera x402 exact scheme: https://docs.hedera.com/solutions/ai/x402/exact-scheme
- ENSv2 overview: https://docs.ens.domains/ensv2/overview/
- ENSv2 Enhanced Access Control: https://docs.ens.domains/ensv2/enhanced-access-control/
- World ID Agent Pass: https://auth.world.org/docs
- ETHGlobal Mumbai prizes: https://ethglobal.com/events/mumbai/prizes

> Prize requirements and ENSv2 interfaces can change. The live ETHGlobal submission dashboard is authoritative at submission time.

---

## 14. Honest limitations (copy into README)

- QuoteSeal reduces a defined class of **recipient-substitution and unauthorized-rotation** risk. It does not stop all payment fraud, compromised governance, malicious onboarding, stolen buyer keys, or prove service quality.
- ENS ownership and domain control are **not** legal business verification.
- World authentication gives fresh authentication, not proof of corporate authority; hackathon proofs are mocked.
- EAC controls who can edit records; the **delay** is enforced by the rotation controller (or a clearly disclosed backend policy).
- Signed-offer verification is future work.
