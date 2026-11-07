# Arkiv Rabdi Phase 1 evidence

## Implemented locally

- Isolated npm workspace: `@quoteseal/arkiv`.
- SDK: `@arkiv-network/sdk@^1.0.1`, using Rabdi chain ID `7794095` and tGLM gas through the SDK's `rabdi` chain helper.
- Server-only configuration: `ARKIV_ACCESS_KEY` and `ARKIV_PRIVATE_KEY`; missing or malformed values fail with safe configuration errors.
- Clients: public read client and dedicated wallet-backed write client in `src/client.ts`.
- Schemas: `RiskSignal`, `WalletRiskState`, and `PaymentDecision` in `src/schema.ts`.
- Smoke path: `src/demo.ts` creates a synthetic readonly `RiskSignal`, reads it using the public client, and verifies entity key, trusted owner, named schema, and returned expiry block.

## Local verification — 2026-11-07

| Command | Result |
| --- | --- |
| `npm run typecheck --workspace=@quoteseal/arkiv` | Passed. |
| `npm test --workspace=@quoteseal/arkiv` | Passed: 1 file, 8 tests. Covers serialization, malformed input, missing configuration, rejected writes, query failures, forged owner, and expired records. |
| `npm run build --workspace=@quoteseal/arkiv` | Passed. |
| `npm run smoke --workspace=@quoteseal/arkiv` | Safely stopped before any network call: `ARKIV_ACCESS_KEY is required for Arkiv Rabdi access`. |

## Rabdi testnet evidence

No on-chain entity has been created and no Rabdi request has been made. On 2026-11-07, the local smoke command loaded the configured credentials but rejected `ARKIV_PRIVATE_KEY` before network access because it was not a 32-byte `0x`-prefixed EVM private key. Consequently, there is no writer address, entity key, transaction hash, expiry block, explorer link, or query output to report.

## Manual verification procedure

1. Create a disposable service wallet outside the repository, fund it with Rabdi tGLM, and use its 32-byte `0x`-prefixed EVM private key.
2. Obtain an Arkiv access key and set `ARKIV_ACCESS_KEY`, `ARKIV_PRIVATE_KEY`, and `ARKIV_TRUSTED_OWNER` only in the server environment.
3. Run `npm run smoke --workspace=@quoteseal/arkiv`.
4. Record the command output's writer address, entity key, transaction hash, expiry block, and public-client query result here only after the command succeeds.
5. Independently query the returned entity through Rabdi/explorer and confirm the named schema, `$owner`, and `$expiresAt` before marking Gate G1 complete.

This Phase 1 adapter is isolated from PayeeGuard, the payment demo, merchant API, dashboard, Hedera client, and Solidity contracts.
