# x402 final authorization boundary

## Verdict and threat boundary

**PASS for the controlled QuoteSeal payment integration.** The original unrestricted SDK remains unsafe and its regression test is preserved. No claim is made that JavaScript with access to raw keys, raw signer, dependency prototypes, the trust adapter or process globals can be contained by an in-process wrapper. If “unrestricted” includes that authority, it is **BLOCKED** and requires process/key isolation; installing a hook is not such isolation.

The supported entry point is `createPaymentAttempt()` in `spikes/x402-pre-sign-guard/final-boundary.ts`. Buyer-owned composition code supplies the raw signer, original buyer URL, original parsed 402, exact selected index, local observation time and independently trusted snapshot adapter. Only a frozen, single-use `createPaymentPayload()` capability escapes. No SDK client, scheme, signer, extension-registration or recovery-registration capability escapes. `createFinalBoundary()` is an internal integration primitive exported for adversarial SDK tests, not an agent/tool API; using it without the controlled facade's lifecycle and registration policy is unsupported.

## Evidence and source review

Read the complete DOCX body including tables, architecture.md, docs/security-architecture.md, prior three Spike 3 reports and spike implementation. The prior architecture's section 10 hook is necessary but not sufficient. The security architecture's manually simulated test is not evidence for SDK ordering. This change uses the pinned SDK, not that simulation.

All SDK paths below are relative to the spike's node_modules:

| Evidence | Source |
|---|---|
| Selection, pre-hooks, scheme creation, recovery | `@x402/core/dist/esm/client/index.mjs:253` |
| Hook ordering: manual, scheme, declared registered extensions | `@x402/core/dist/esm/client/index.mjs:631` |
| Context and async hook declaration | `@x402/core/dist/esm/x402Client-CWf4x4tk.d.mts:1852` |
| Exact Hedera scheme calls signer | `@x402/hedera/dist/esm/chunk-WP6D5IUW.mjs:36` |
| Raw signer builds HBAR/HTS transfers and calls tx.sign | `@x402/hedera/dist/esm/index.mjs:146` |
| Signer interface | `@x402/hedera/dist/esm/signer-DCjZrivX.d.mts:7` |
| HTTP recovery re-enters core creation | `@x402/fetch/dist/esm/index.mjs` |

Core selects a local `requirements` reference and also exposes it through `context.selectedRequirements`. Mutating fields changes both; replacing the context property changes only the exposed reference. We check both identity and deep data equality so either is rejected. The scheme calls `createPartiallySignedTransferTransaction(requirements)`. The default raw Hedera signer reads destination/amount/asset, constructs the transfer, freezes it and calls `tx.sign(privateKey)`. The wrapper immediately before that signer method is the last controllable boundary before raw transaction creation/signing.

## Enforcement

1. Copy the original challenge and buyer-selected option before running SDK hooks. Save the normalized original buyer URL, observation time and initial trusted profile/anchor/identity/revision snapshot privately. Never derive trust from `resource.url` or response text.
2. The actual core selector selects only the exact buyer-approved offered option; absence rejects rather than selecting an alternative. Initial guard confirms full original challenge equality, selected membership and exact terms, trusted origin, profile/anchors, amount, scheme, network, asset, timeout, fee payer and freshness.
3. Later buyer-configured pre-hooks may run. The SDK remains real and mutable; tests actively mutate its references. Initial approval grants only a pending single-use authorization, not direct access to the raw signer.
4. At the real Hedera signer interface, reject unless that authorization exists. Check selected and challenge reference identities, full challenge equality, final requirement equality and the approved private snapshot. This includes all fields and nested `extra`, not only payTo.
5. Re-read the trusted adapter's current snapshot synchronously and require exact equality with the approved snapshot. Re-evaluate origin, membership, policy and freshness with the current clock. Adapter failure, revision/anchor/profile/identity changes, stale data or any non-PASS aborts before raw signer invocation.
6. Consume authorization before delegation. Pass a detached recursively frozen data copy to the raw signer. There is no await or untrusted callback between final checks, consumption and the call. Later mutations of SDK references cannot alter that copy, even while the signer awaits.
7. Close the attempt in finally on success or failure. Second/concurrent calls cannot reuse it. Returned accepted/resource metadata is derived from private originals, avoiding mutable SDK metadata aliases. No automatic recovery, extensions, post-sign hooks or arbitrary replacement schemes are registered in the supported facade.

Freeze is supplementary: security comes from captured original data, exact revalidation, private signer capability and single-use state. Registration order alone is not relied on. Data copying rejects accessors/proxies/symbols/non-data objects rather than invoking getters that can return different values at check and use time. It has a recursion bound. Finite scalar checks and existing evaluator BigInt validation remain in effect, plus a positive-amount check matching the raw signer.

## Registration, retry and alternate paths

The facade copies startup pre-hook functions and provides no runtime registration method. The caller retaining the original hook array cannot add a new plugin. No arbitrary extension enrichers run after signing. Tests separately wire malicious registered extensions and scheme hooks into the actual SDK with the internal final boundary and demonstrate rejection. Direct scheme calls without guard authorization reject. SDK failure recovery cannot sign after boundary rejection. SDK response recovery tries core creation again, but consumed authorization rejects it; a fresh challenge and new attempt are required.

A normal SDK abort happens outside its scheme failure catch. Final-boundary rejection happens inside scheme creation and can reach SDK failure handlers; the facade deliberately registers none. The adversarial recovery test confirms that even a handler attempting the wrapped signer again cannot consume a rejected authorization. A malicious handler could fabricate a payload without signing if exposed; this is why the facade also removes that capability.

## Limits and integration responsibilities

- This is a spike, with an injected synchronous trusted snapshot and clock. It does not perform ENS/RPC reads. A real adapter must publish fresh independently verified state and revisions; comparing a snapshot does not prove RPC truth or eliminate the Sepolia-to-Hedera state race.
- The buyer must capture originalUrl and challenge at the trusted HTTP boundary before passing them to this facade. Existing native-fetch redirect test is preserved; HTTPS is enforced by the new boundary. Full HTTP composition and per-request trust resolution remain application work.
- Raw signer and SDK internals must remain inaccessible to hooks/agent tools. Arbitrary in-process code with raw signer/key access can bypass every wrapper. This design does not claim otherwise.
- The raw signer implementation and pinned SDK are trusted to create/sign the transaction represented by supplied requirements. Test doubles count that exact interface; actual funded settlement is still Spike 2.
- Pre-sign rejection has zero raw signer calls. A mutation attempted after a valid signer invocation cannot undo that invocation; the detached approved copy prevents it from changing the signed payment. SDK/transport errors after a valid signature are not pre-sign rejections.
- SDK spend controls are disabled only for this isolated fixture because its HBAR fixture otherwise fails before the guard; QuoteSeal's own caps and exact selected amount remain enforced.
