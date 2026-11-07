# Arkiv integration

This directory documents the planned Arkiv integration for QuoteSeal, the repository's x402 payment-identity project.

## Current repository boundary

The current codebase has these relevant paths:

- `packages/payee-guard` evaluates a buyer's 402 payment request before the guarded signer runs.
- `packages/ens-profile` reads QuoteSeal ENS text records from Ethereum Sepolia.
- `packages/hedera-x402` creates Hedera payment challenges and a demo payment result. Its client does not submit a Hedera transaction, and its server route does not verify the payment proof.
- `apps/merchant-api` serves the 402 endpoint and keeps the active payee and rotation state in process memory. It also defines SQLite tables, but the Arkiv entities are not present there.
- `contracts/src/RotationController.sol` controls payout rotation on Ethereum. It does not store risk signals or payment decisions.
- `apps/merchant-dashboard` renders mock merchant, rotation, and verdict data. It is not connected to Arkiv.

Arkiv is therefore a planned shared evidence store. It is not the payment facilitator, the buyer wallet, the ENS resolver, or the rotation controller.

## Planned entities

The integration keeps three entities:

- `RiskSignal` records an observed signal about a wallet or payment context.
- `WalletRiskState` records the current derived risk state for a wallet.
- `PaymentDecision` records the firewall decision and the evidence used to make it.

See [schema.md](./schema.md) for the documented fields, query keys, ownership, and expiry policy.

## Implementation status

Ready now:

- The three-entity data model is bounded to the existing `PayeeGuard` inputs and verdicts.
- The documentation identifies the current security and integration gaps.
- The isolated `@quoteseal/arkiv` workspace contains Rabdi public/read and server-side writer clients, named SDK schemas, configuration validation, and a RiskSignal create/read smoke command.
- A trusted `WalletRiskState` reader filters by named schema, indexed wallet/network fields, trusted owner, and live expiry before returning a state. It times out after two seconds and retries once.
- The merchant API exposes that reader at `/api/arkiv/risk/:walletKey`; the dashboard's `/arkiv` page displays its sanitized result. Until G1 succeeds, the API deliberately uses a visibly labeled fixture rather than claiming an Arkiv record.
- `npm run typecheck --workspace=@quoteseal/arkiv`, `npm test --workspace=@quoteseal/arkiv`, and `npm run build --workspace=@quoteseal/arkiv` pass locally.

Needs implementation:

- A dedicated funded Rabdi writer wallet and `ARKIV_ACCESS_KEY` to perform the first real write/read.
- Signed and verified payment-proof handling in the existing x402 flow.
- A policy for reconciling Arkiv data with ENS and `RotationController` state.
- Redaction, ownership, expiry, retry, and observability controls.

The Rabdi evidence record and manual verification procedure are in [deployment.md](./deployment.md). No Arkiv deployment or live transaction has occurred. The current Hedera payment result remains simulated and is not payment-proof verification or settlement.
