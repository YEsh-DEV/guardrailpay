# Arkiv integration friction

This file records known integration friction from the current repository. It does not claim that an Arkiv SDK integration has been attempted.

## Payment verification is incomplete

`apps/merchant-api/src/routes/paid.ts` treats the `payment-signature` or `authorization` header as present proof and returns the protected content. `packages/hedera-x402/src/server.ts` defines a `verifyPaymentProof` callback, but the route does not call it.

Until proof verification exists, Arkiv must not be used to label a payment as settled. Record a decision only after the system distinguishes challenge, evaluation, proof verification, and settlement.

## The current payment client is a demo

`packages/hedera-x402/src/client.ts` creates a deterministic-looking receipt and base64 payment proof. It does not submit a Hedera transaction. Documentation must not use those values as deployment evidence or transaction hashes.

## Current state has multiple owners

ENS Sepolia records, in-memory Fastify state, SQLite schemas, mock dashboard data, and the Ethereum `RotationController` each describe part of the payment identity. The Arkiv adapter needs an explicit source-of-truth rule for each field. It must not merge these sources by last write.

## Reproduction paths for implementation

Use the existing code paths when implementation begins:

1. Request `GET /api/research/paid` without a payment header and inspect the 402 challenge.
2. Run `packages/payee-guard` against a matching, expired, over-limit, and unauthorized `payTo` request.
3. Run a payment through `createGuardedSigner` and verify that non-`PASS` verdicts do not invoke the raw signer.
4. Compare an ENS profile's `activePayTo`, pending rotation fields, and `profileVersion` with the corresponding Arkiv read.
5. Retry an Arkiv write and confirm that the same `decisionId` does not create duplicate decisions.

The repository currently has no Arkiv reproduction result to report.
