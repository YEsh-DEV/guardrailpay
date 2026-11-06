# QuoteSeal Live Testnet Readiness Preflight

**Assessment date:** 2026-11-07  
**Scope:** Read-only configuration and connectivity review. No transactions, deployments, signatures, World ID sessions, or HBAR transfers were submitted.

## Verdict

**C — Not ready for direct Sepolia/World ID/Hedera smoke testing.** Sepolia RPC connectivity and World issuer discovery are reachable, but no controller deployment, merchant ENS profile, usable World ID client registration, Hedera account, facilitator, or working database is configured. Starting the API with current defaults would use development settings and an in-memory database, so it would not represent the intended testnet environment.

## Repository and runtime

| Check | Result |
|---|---|
| Branch | `feature/backend-integration` |
| HEAD | `fd10be4e2a3289197ac8ddd4a236e2d8d13a6487` (accepted core freeze) |
| Worktree | Frozen core unchanged; pre-existing untracked `docs/final-core-freeze-acceptance.md` preserved |
| Node.js | `v26.12.0`; repository `mise.toml` selects Node 24, so runtime does not match the declared toolchain |
| pnpm | `12.18.0`; matches root `packageManager` |
| `NODE_ENV` | Unset; schema defaults to `development` |
| Mainnet selection | No mainnet RPC/network selected by the active defaults; RPC clients are explicitly configured as Sepolia and x402 guard registration uses `hedera:testnet` |

## Environment variable checklist

No runtime variables in the following checklist were exported, and no real `.env` file was present. The only environment file found was `.env.example`. Effective values therefore come from schema defaults, several of which are placeholders/local-development settings.

| Area | Names checked | Status |
|---|---|---|
| Runtime | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL` | **BLOCKED** — unset; defaults to development and wildcard host |
| Sepolia | `SEPOLIA_RPC_URL_PRIMARY`, `SEPOLIA_RPC_URL_SECONDARY`, `APPLICATION_CHAIN_ID`, `FINALITY_CONFIRMATIONS`, `MAX_BLOCK_DIVERGENCE_TOLERANCE` | **READY** for read-only RPC checks using public defaults; not application-ready until explicitly configured and pinned |
| Controller | `ROTATION_CONTROLLER_ADDRESS` | **BLOCKED** — zero-address default; no deployed controller configured |
| ENS | `ENS_REGISTRY_ADDRESS`, `ENS_RESOLVER_FACTORY_ADDRESS`, merchant ENS name, resolver, expected owner/profile values | **BLOCKED** — registry and factory defaults exist, but merchant-specific configuration is absent |
| World ID | `WORLD_ID_ISSUER`, `WORLD_ID_CLIENT_ID`, `WORLD_ID_CLIENT_SECRET`, `WORLD_ID_REDIRECT_URI`, `WORLD_ID_REQUIRED_ACR`, `WORLD_ID_MAX_AUTH_AGE_SECONDS`, action | **BLOCKED** — no runtime values; default client ID is a sample placeholder, callback is localhost, no action setting exists in the schema |
| Attestation/storage secrets | `ATTESTOR_PRIVATE_KEY`, `OPERATOR_SUBJECT_HMAC_SECRET`, `ENCRYPTION_KEY_HEX`, `ATTESTATION_TTL_SECONDS` | **BLOCKED** — unset; schema supplies deterministic development defaults. Production validation rejects the known defaults, but current `NODE_ENV` is not production |
| Database | `DATABASE_URL` | **BLOCKED** — unset; default points at local PostgreSQL, which refused the connection |
| Hedera | `HEDERA_NETWORK`, `HEDERA_ACCOUNT_ID`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_PRIVATE_KEY` | **BLOCKED** — no Hedera account/network credentials or corresponding application configuration |
| x402 settlement | `X402_FACILITATOR_URL`, `X402_NETWORK`, `X402_SCHEME`, `X402_ASSET`, `X402_AMOUNT` | **BLOCKED** — no facilitator configuration; API server does not instantiate the x402 payment path |

## Sepolia RPC and contract

Both configured default public endpoints responded to read-only JSON-RPC requests:

| Check | Primary | Secondary |
|---|---|---|
| Chain ID | `11155111` (Sepolia) | `11155111` (Sepolia) |
| Latest block | `0xb84d00` | `0xb84d00` |
| Finalized block | `0xb84ca0` | `0xb84ca0` |
| Hash at common finalized height | `0xd258c0cf2c0a32f2f6a1e1a18758c4931bcf72e2cf881ad466375742c7192430` | Same |

**RPC status: READY** for these read-only checks; finalized block hashes agreed. The endpoints are distinct hosts (PublicNode and Tenderly public gateway), although provider independence cannot be established from RPC responses alone.

The configured RotationController is `0x0000000000000000000000000000000000000000`; both providers returned empty bytecode. **Controller identity: BLOCKED.** The committed ABI exists, but no deployed address, transaction/deployment evidence, or runtime bytecode exists to compare against the expected contract. Non-empty code at another address would not by itself establish identity.

The configured ENS registry and resolver-factory addresses returned non-empty code from both RPCs (14,730 and 1,411 bytes respectively). **ENS contract identity: NOT TESTED.** No deployment manifest/code hash or merchant name is configured to validate those bytecodes and read a merchant-specific profile.

## ENS profile and permissions

**Status: BLOCKED.** The registry/factory default addresses have bytecode, but the environment contains no merchant ENS name, expected namehash, resolver address, expected owner, name expiry, active payout, profile version, controller linkage, or expected permission configuration. Consequently, no profile fields or controller/resolver write permissions could be read and compared. No state-changing permission probe was performed. Live ownership, resolver administration, registry roles, and upgrade authority remain unverified.

## World ID

The default issuer’s OpenID discovery endpoint responded with HTTP 200; its metadata issuer matched the configured issuer and exposed authorization, token, and JWKS endpoints on the issuer host. **Issuer discovery: READY.** No authorization flow or verification session was started.

**World ID smoke-test configuration: BLOCKED.** The client ID is a sample default, client secret is absent, callback is localhost, and no action setting is implemented in the environment schema. The configured redirect’s allowlisting in the World application console cannot be established locally. Code review shows `openid-client` performs authorization-code/PKCE token processing and ID-token protocol validation, followed by application checks for nonce, auth time, and assurance claims; this is not live verification evidence. Mock claims are selected only when `NODE_ENV=test`, but no usable live client configuration exists.

## Hedera and x402

The lockfiles pin matching x402 packages: `@x402/core` 2.30.0, `@x402/fetch` 2.30.0, and `@x402/hedera` 2.30.0; the Hedera SDK is `@hiero-ledger/sdk` 2.90.1. **Dependency pinning: READY.**

The guard registers the exact Hedera scheme for `hedera:testnet` and profile defaults include Hedera testnet, asset `0.0.0`, and a maximum amount string. Those are source defaults, not a live merchant profile. There is no configured account ID, account credential, facilitator URL, selected HBAR/HTS asset, or merchant amount. **Account accessibility/balance, asset units, facilitator support, and settlement: BLOCKED / NOT TESTED.** No signer was constructed and no payment was attempted.

## Database and backend startup

The migration source contains two SQL migrations defining the expected tables and indexes. Migration application state is **NOT TESTED** because no database connection is available. A read-only PostgreSQL connection attempt to the configured local default was refused. `psql` is installed; the Node `pg` package could not be resolved from the attempted runtime import path. No migrations or schema changes were run.

**Backend startup: NOT TESTED.** I did not start the server under the current development defaults. Source inspection found that `server.ts` does not construct/inject a PostgreSQL store; `createApp` falls back to `createMockDatabase()` when no store is supplied. The server also omits a database readiness callback. Thus a listening server could appear healthy while persistence is in-memory and database health is not checked. The server explicitly injects a live Sepolia contract client, and production `createApp` rejects a missing controller-client injection, but the injected server still lacks database wiring and a non-zero deployed controller.

Health endpoints expose status/check names only. The logger has redaction paths for common token, key, signature, and password fields. **Diagnostic secret exposure: no issue observed in the inspected health response shape.** This does not establish safety of all runtime error messages under a configured deployment.

## Mock-versus-live classification

| Component | Classification | Evidence / limitation |
|---|---|---|
| Sepolia RPC | **READY** (read-only) | Both endpoints answer on Sepolia and agree at common finalized height |
| RotationController | **BLOCKED** | Zero address, empty code, no deployment evidence |
| ENS registry/factory bytecode | **NOT TESTED** for identity | Code exists; expected deployment identity and merchant profile are unavailable |
| World issuer discovery | **READY** | Official issuer metadata reachable; no client/session verification |
| World ID client/action/redirect | **BLOCKED** | Placeholder client, localhost callback, no action setting or console allowlist evidence |
| Database | **BLOCKED** | Local connection refused; API fallback is mock in-memory storage |
| Hedera account | **BLOCKED** | No account ID or credentials; no balance query possible |
| x402 facilitator/settlement | **NOT IMPLEMENTED / NOT TESTED** | Versions are pinned, but API has no facilitator/payment execution configuration |
| World ID mock claims | **MOCKED** only in test mode | Not enabled by `NODE_ENV=development`, but a real World ID setup is not configured |
| Rotation controller mock | **MOCKED** when app is created without injection outside production | Production guard requires injection; test-mode injection is not a live-chain result |

## Security hygiene

- No real `.env` file was present. `.env` and `.env.local` are ignored, but `.env.production` is **not** ignored by the current `.gitignore`; no such file was found.
- No credential-bearing RPC URLs were printed. No active environment variable values were displayed.
- The tracked configuration includes deliberate deterministic development defaults for signing and encryption material. Production validation blocks several of these defaults, but the runtime currently defaults to development; do not treat these defaults as usable credentials.
- The current branch/HEAD matches the accepted frozen core. No source/configuration files were modified during this preflight; this report is the sole requested addition.
- No mainnet RPC, wallet, or Hedera mainnet setting was found active.

## Required before controlled smoke testing

1. Configure a deployed Sepolia RotationController address and provide deployment evidence/code identity; verify the chain and ABI against it.
2. Configure a real merchant name/profile and verify registry, resolver, owner, expiry, profile records, and controller permissions by read-only calls.
3. Provide a registered World ID client, intended action/assurance policy, approved non-local callback, and verify configuration without creating a session.
4. Configure a testnet Hedera account and exact payment network/scheme/asset/base units, plus a supported facilitator endpoint; independently verify read-only account status/balance.
5. Configure a reachable database, apply and verify migrations through the approved operational process, and change server startup to inject PostgreSQL and report database readiness.
6. Use the repository’s declared Node 24 runtime, configure secrets through a protected runtime source, and add `.env.production` to ignore rules before local secret files are introduced.

**Final classification: C — Not ready for direct controlled Sepolia/World ID/Hedera smoke testing.**
