# Arkiv schema

These are the implemented named SDK schema definitions for the isolated Arkiv adapter. They do not replace the ENS profile, SQLite tables, or `RotationController`, and no live entities have been written.

## Ownership and trust

Use one dedicated Arkiv writer account for the service. Keep its private key outside the repository. The writer owns the records it creates and is the trust anchor for the service's published observations.

Arkiv data is public and any account can write data. Every read must filter by the project schema and the expected owner. A matching schema tag alone is not proof that the service created a record.

Do not store private keys, raw payment headers, bearer tokens, full request bodies, or personal identity data. Store hashes or bounded reason codes when a later audit needs correlation.

## `RiskSignal`

`RiskSignal` is an append-only observation. Create it with the `readonly` flag when the observation must not change.

Proposed attributes:

| Attribute | Type | Indexed | Meaning |
| --- | --- | --- | --- |
| `arkiv.schema` | `str` | yes | Automatically supplied by the named schema as `quoteseal.risk-signal.v1`. |
| `walletKey` | `str` | yes | Canonical wallet or payee identifier. Hedera account IDs remain strings; Arkiv `addr` is for EVM addresses. |
| `network` | `str` | yes | Canonical payment network, such as `hedera:testnet`. |
| `signalCode` | `str` | yes | Bounded code such as `UNAUTHORIZED_PAYEE` or `AMOUNT_EXCEEDED`. |
| `severity` | `str` | yes | Bounded severity selected by policy. |
| `source` | `str` | yes | Code path that observed the signal, such as `payee-guard`. |
| `observedAt` | `u64` | yes | Application Unix time for correlation. |
| `evidenceHash` | `str` | no | Hash of canonical, redacted evidence. |
| `referenceId` | `str` | yes | Non-secret correlation ID from the payment challenge, when present. |

Do not treat a `RiskSignal` as a verdict. It is one input to policy evaluation.

## `WalletRiskState`

`WalletRiskState` is the current derived state for a wallet and network. The writer updates it only after validating the source signals. Use a stable application key, such as a hash of the canonical network and wallet identifier, rather than using an attacker-controlled wallet as the Arkiv owner.

Proposed attributes:

| Attribute | Type | Indexed | Meaning |
| --- | --- | --- | --- |
| `arkiv.schema` | `str` | yes | Automatically supplied by the named schema as `quoteseal.wallet-risk-state.v1`. |
| `walletKey` | `str` | yes | Canonical wallet or payee identifier. |
| `network` | `str` | yes | Canonical payment network. |
| `status` | `str` | yes | Bounded state such as `UNKNOWN`, `ALLOW`, `REVIEW`, or `BLOCK`. |
| `score` | `dec` | yes | Policy-defined score with documented bounds. |
| `policyVersion` | `str` | yes | Version of the rule set that produced the state. |
| `signalCount` | `u64` | no | Count of included signals. |
| `lastSignalAt` | `u64` | yes | Application Unix time of the newest included signal. |
| `computedAt` | `u64` | yes | Application Unix time when the state was derived. |
| `stateHash` | `str` | no | Hash of the canonical input set and policy version. |

Use a short expiry and refresh the state from still-valid signals. An expired state must not silently become `ALLOW`; the caller must treat missing state as `UNKNOWN` and apply fail-closed policy where required.

## Current reader behavior

`src/riskState.ts` reads `WalletRiskState` through the named schema, filters by indexed `walletKey` and `network`, applies the configured trusted-owner constraint, then verifies the returned `$owner` and `$expiresAt` again. It uses a two-second bounded query with one retry. A missing state produces `HOLD`; an unavailable query produces `UNVERIFIABLE`; only a trusted `ALLOW` state permits the shared-risk gate to continue toward the signer. A trusted `BLOCK` is the MVP demo state.

## `PaymentDecision`

`PaymentDecision` is an append-only record of one evaluation. It mirrors the `Verdict` values in `packages/payee-guard`: `PASS`, `HOLD`, `BLOCK`, and `UNVERIFIABLE`.

Proposed attributes:

| Attribute | Type | Indexed | Meaning |
| --- | --- | --- | --- |
| `arkiv.schema` | `str` | yes | Automatically supplied by the named schema as `quoteseal.payment-decision.v1`. |
| `decisionId` | `str` | yes | Unique idempotency key for the evaluation. |
| `requestHash` | `str` | yes | Hash of the canonical payment request and profile version. |
| `walletKey` | `str` | yes | Canonical payer or payee identifier used by policy. |
| `network` | `str` | yes | Canonical payment network. |
| `payTo` | `str` | yes | Normalized requested payee. |
| `amount` | `str` | no | Integer amount in the payment asset's smallest unit. |
| `asset` | `str` | yes | Normalized asset identifier. |
| `verdict` | `str` | yes | `PASS`, `HOLD`, `BLOCK`, or `UNVERIFIABLE`. |
| `reasonCode` | `str` | yes | Stable policy reason code. |
| `profileVersion` | `str` | yes | ENS profile version used by the evaluator. |
| `rotationId` | `str` | no | On-chain rotation identifier when the decision uses rotation data. |
| `signerCalled` | `bool` | yes | Whether the guarded signer was invoked. This must be recorded from the execution boundary, not inferred from `PASS`. |
| `evaluatedAt` | `u64` | yes | Application Unix time of the decision. |

The first Arkiv write must happen after the local decision is known. A `PASS` record is not authorization to settle. The guarded signer remains the only current gate before the demo payment client runs.

## Expiry

Arkiv expiry is measured in blocks, not an application timestamp. Use explicit SDK `ExpirationTime` values and persist the returned `expiresAt` block if the application needs to display or renew a record. Choose lifetimes per entity: short for `PaymentDecision`, longer for `RiskSignal`, and renewable for `WalletRiskState`.

The exact durations are an implementation decision. Do not copy the `expiresAt` field from the x402 challenge into Arkiv as if the two clocks had the same meaning.
