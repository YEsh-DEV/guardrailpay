# Backend Testnet Readiness Fix

## Scope and baseline

Baseline: `feature/backend-integration` at `fd10be4e2a3289197ac8ddd4a236e2d8d13a6487`. Contract/core sources remain unchanged. The pre-existing preflight and core-freeze reports remain untouched.

The backend previously chose `createMockDatabase()` when callers omitted a store, and `/ready` treated unchecked dependencies as healthy. The server did not initialize PostgreSQL or verify migrations. This change removes that fallback from live startup and makes readiness checks explicit.

## Profiles

- `local-development`: persistent PostgreSQL is required by server startup. Missing controller, merchant, World ID, Hedera, or facilitator setup does not switch to mocks; testnet-only checks are not required in this profile.
- `local-e2e`: requires `NODE_ENV=test`. A test must explicitly inject its in-memory database/store. Only this profile can select `MockWorldOidcService` or `MockRotationControllerClient`.
- `testnet-demo`: requires `NODE_ENV=production` and validates the Sepolia/Hedera testnet configuration. It never selects mock services.
- `production`: currently validates the same Sepolia/Hedera testnet integration because this release has no mainnet profile. It is not authorization to use mainnet.

`APP_PROFILE` defaults from `NODE_ENV` (`test` → `local-e2e`, `production` → `production`, otherwise `local-development`). `NODE_ENV=production` cannot downgrade to a local profile.

## Environment variables

No actual credentials or deployment values are included in the template. Values below are required for a live profile unless marked optional.

| Area | Variables |
|---|---|
| Profile/runtime | `APP_PROFILE`, `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL` |
| Database | `DATABASE_URL` (PostgreSQL URL; required for API startup and live profiles) |
| Sepolia | `APPLICATION_CHAIN_ID` (must be `11155111`), `SEPOLIA_RPC_URL_PRIMARY`, `SEPOLIA_RPC_URL_SECONDARY`, `FINALITY_CONFIRMATIONS`, `MAX_BLOCK_DIVERGENCE_TOLERANCE` |
| Controller | `ROTATION_CONTROLLER_ADDRESS` (non-zero), `ROTATION_CONTROLLER_CODE_HASH` (expected deployed runtime code hash), committed generated controller ABI |
| ENS | `ENS_REGISTRY_ADDRESS`, `ENS_RESOLVER_FACTORY_ADDRESS`, `ENS_MERCHANT_NAME`, `ENS_NAMEHASH`, `ENS_RESOLVER_ADDRESS`, `ENS_EXPECTED_OWNER` |
| World ID | `WORLD_ID_ISSUER`, `WORLD_ID_CLIENT_ID`, `WORLD_ID_CLIENT_SECRET` (optional for registration methods that do not use a shared secret), `WORLD_ID_ACTION`, `WORLD_ID_REDIRECT_URI`, `WORLD_ID_REQUIRED_ACR`, `WORLD_ID_MAX_AUTH_AGE_SECONDS` |
| Attestation/storage | `ATTESTOR_PRIVATE_KEY`, `ATTESTATION_TTL_SECONDS`, `OPERATOR_SUBJECT_HMAC_SECRET`, `ENCRYPTION_KEY_HEX` |
| Hedera | `HEDERA_NETWORK` (must be `testnet`), `HEDERA_ACCOUNT_ID`, `HEDERA_MIRROR_NODE_URL` |
| x402/facilitator | `X402_FACILITATOR_URL`, `X402_NETWORK` (must be `hedera:testnet`), `X402_SCHEME` (must be `exact`), `X402_ASSET` (Hedera token ID; `0.0.0` denotes HBAR), `X402_AMOUNT` (positive integer in asset base units), `MAX_PAYMENT_AMOUNT_DEFAULT` |
| Rotation policy | `ROTATION_TIMELOCK_SECONDS` |

Live profiles reject missing required fields, malformed addresses/hashes/URLs/account IDs, the zero controller address, sample World client/action values, placeholder hosts and merchant names, known development signing keys and development HMAC/encryption values, non-HTTPS RPC/callback/facilitator URLs, same-host dual RPC configuration, a wrong chain/network/scheme, and amounts above the configured cap. Diagnostics name fields and checks only; they do not include supplied values.

`WORLD_ID_ACTION` is required as deployment policy metadata. The current OIDC request implementation does not send an action parameter or cryptographically bind that value; portal registration/action policy still needs independent confirmation. Issuer discovery success does not prove the client is registered.

## Database setup and lifecycle

An optional local PostgreSQL service is defined in `compose.yaml`. It binds only to loopback and stores data in a named persistent volume. Copy `.env.example` to the ignored `.env` file, replace the local-only database password consistently in `DATABASE_URL` and `POSTGRES_PASSWORD`, then start PostgreSQL:

```sh
cp .env.example .env
docker compose up -d postgres
```

The API process does not automatically load `.env`. Export its assignments into the current shell before migration or startup. For live profiles, inject the approved managed database URL through the deployment environment instead. The application does not create/reset a database and does not run migrations automatically.

After PostgreSQL is healthy, load the local environment and apply checked-in migrations using:

```sh
set -a
. ./.env
set +a
pnpm --filter @quoteseal/shared db:migrate
pnpm --filter @quoteseal/api dev
```

The command requires `DATABASE_URL`. Do not use reset/drop commands for an existing database. Startup runs a read-only connection check and aborts with `ConfigurationError` if PostgreSQL is unreachable. The readiness probe reads Drizzle’s migration history and compares every journal timestamp. If migrations are missing, the process may start for diagnosis, but readiness remains `503` until migrations are applied.

## Liveness and readiness

- `GET /health` is liveness only and returns `200` while the process is serving.
- `GET /ready` reports `READY`, `NOT_READY`, or `NOT_CONFIGURED` for database, migrations, primary/secondary RPC, controller, ENS/profile, World issuer/config, Hedera account, and facilitator support. It returns `503` unless every dependency required by the selected profile is `READY`.
- Database and external dependency exceptions are converted to status values; exception messages, RPC URLs, database URLs, and credentials are never returned.
- Live readiness compares controller runtime bytecode hashes from both RPCs with `ROTATION_CONTROLLER_CODE_HASH`, verifies the Sepolia chain ID on both RPC clients, checks the configured ENS profile and matching active merchant database record, checks World issuer discovery/configuration, reads Hedera account status through the configured mirror node, and checks facilitator `/supported` for x402 v2, scheme, and network.
- These are read-only checks. They do not prove merchant ownership/permission writes, World portal action policy, or a payment transaction. The API does not submit x402 payments.

## Changed files

- `apps/api/src/server.ts`, `apps/api/src/app.ts`: explicit PostgreSQL initialization, startup connection failure, store injection, resource close, and no live mock fallback.
- `apps/api/src/routes/health.ts`: dependency-specific readiness states separated from liveness.
- `packages/shared/src/db/index.ts`, `packages/shared/drizzle.config.ts`, `packages/shared/package.json`: safe database initialization, read-only migration readiness, no implicit Drizzle URL, and `db:migrate` command.
- `packages/shared/src/config/index.ts`: explicit profiles and strict live configuration validation.
- `apps/api/src/api.test.ts`, `apps/api/src/backend-integration.test.ts`, `packages/shared/src/shared.test.ts`: regressions for database/configuration failures, mock restrictions, migration readiness, liveness/readiness, and diagnostic redaction.
- `.env.example`, `.gitignore`, `compose.yaml`: configuration names, ignored secret files, and persistent local PostgreSQL service.

## Verification

The following verification completed successfully on the scoped working tree:

| Command | Result |
|---|---|
| `pnpm typecheck` | Passed across all four workspace packages |
| `pnpm test` | 151 tests passed: shared 27, ENS profile 14, guard 45, API 65 |
| `pnpm --filter @quoteseal/guard exec vitest run src/t1-t16.test.ts` | 16/16 passed |
| `pnpm --filter @quoteseal/api exec vitest run src/local-contract-integration.test.ts` | 14/14 passed against the local EVM integration harness |
| `forge test` from `contracts/` | 53 passed, including 4,096 invariant calls |
| `forge test --fuzz-runs 1000` from `contracts/` | 53 passed; 1,000 runs for each fuzz test and 4,096 invariant calls |
| `forge fmt --check src test` from `contracts/` | Passed |

The API test run emits the existing Fastify `disableRequestLogging` deprecation warning. It does not fail tests or expose configuration values.

No PostgreSQL service was started, no migrations were run against an existing database, and no external live readiness checks were performed in this change. The Compose service configuration is supplied for operator controlled local setup; actual database readiness must be established by running the service and migrations.

## Remaining external blockers

- No actual testnet environment values are supplied by this change. A testnet profile remains invalid until the operator configures the database, controller deployment address and runtime hash, merchant ENS profile/anchors, World client/callback/action policy, Hedera account, and facilitator.
- Current World action value is not consumed by the OIDC authorization request; confirm the intended app-side policy or implement an appropriate supported binding before claiming action-specific verification.
- Facilitator capability discovery is not payment execution. No payment signer or transfer path is started by this task.
- No database, contract, ENS permission, World ID session, Hedera payment, or deployment was changed or initiated during this work.
