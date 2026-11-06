# Demo recovery evidence

Baseline: c8bb567 on feature/backend-integration. No live transactions or payment signatures submitted.

- Native PostgreSQL 18.6 started on 127.0.0.1:55432 using the Arch package extracted at `/tmp/quoteseal-postgres-native`. Persistent cluster: `~/.local/share/quoteseal-demo-pg/data`. Docker and noninteractive sudo remain unavailable. No existing volumes modified.
- A fresh local database password was generated into the ignored mode-600 `.env`; no previously supplied credentials reused. Two Drizzle migrations applied. Verified seven public tables: merchants, merchant_trust, operators, rotation_proposals, auth_attempts, approvals, audit_events.
- API running on 127.0.0.1:3001 in **local-development**, using PostgreSQL and LiveRotationControllerClient (no mock database/controller). `/health` returns 200; `/ready` reports database/migrations/both RPCs READY. Controller, ENS, World, Hedera and facilitator remain NOT_CONFIGURED. This is not testnet-demo readiness.
- PublicNode and Tenderly public Sepolia RPCs respond through curl; chain ID 11155111. Compared block 0xb84dfd: both return 0x2670130088c2316c3be43cd5293db252b5c19c542f08b5a5b3232b30dfd1377f. Earlier Python 403 failures are client/request-path dependent; exact upstream cause remains unproven.
- `https://x402.org/facilitator/supported` and `https://facilitator.amnt.io/testnet/supported` both advertise v2 exact hedera:testnet and fee payers. Fixed backend probing to preserve URL prefixes. Asset acceptance and actual settlement remain unverified. HBAR uses asset 0.0.0 and tinybar units (100,000,000 per HBAR); no amount authorized for transfer.
- ENS deployment report is incorrect about constructor writes: the constructor only calls read-only `_checkContext()`. More seriously, current official ENSv2 resolver uses `setText(bytes,...)`, reads through `resolve`, and key-scoped grantSetterRoles; the frozen controller calls `setText(bytes32,...)` and standalone text/getAlias. Do not deploy against that implementation without independently resolving interface compatibility. No controller/resolver deployment approved or performed.
- World issuer discovery responds. External actions still required: rotate the exposed client secret; configure real client ID, registered HTTPS `/v1/world/callback`, and action policy. Backend validates issuer/audience/signature/nonce/auth freshness; action metadata is not cryptographically bound by the current OIDC flow. Merchant-owner-signed enrollment must bind the operator wallet and World subject, followed by on-chain enrollment. No mock claims used.

Sources: https://docs.ens.domains/ensv2/permissioned-resolver/ and https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_hedera.md . Current provider capability discovery is not evidence of a completed payment.

## Runnable confirmation proof

`pnpm build`

`node --test spikes/buyer-confirmation/confirmed-payment.test.mjs`

Six tests pass using the actual pinned x402 2.30.0 SDK and a clearly labelled test-double signer. Explicit boolean confirmation is mandatory. Valid payment signs once; denial, tampered payTo and changed trust sign zero times. No settlement path exists in this proof. Full HTTP 402 orchestration, frozen API integration, buyer UI/terminal confirmation and settlement verification remain unfinished; do not expose the trusted composition function to an LLM.

Workspace build/API typecheck passed. Existing guard suite remains unchanged. Core contract files unchanged.

## Native lifecycle

Start an existing cluster (never rerun initdb over it):

```sh
/tmp/quoteseal-postgres-native/usr/bin/pg_ctl -D "$HOME/.local/share/quoteseal-demo-pg/data" -l "$HOME/.local/share/quoteseal-demo-pg/server.log" -o '-h 127.0.0.1 -p 55432 -k /tmp' start
```

The binaries currently live under `/tmp`; retain/reinstall PostgreSQL before reboot. Inject DATABASE_URL from the ignored local environment into migration/API processes without printing it. Other blank scaffold fields are intentionally invalid; do not source the entire scaffold as live configuration. For system-native installation on this Arch host an administrator can install `postgresql`; no privileged installation was attempted.
