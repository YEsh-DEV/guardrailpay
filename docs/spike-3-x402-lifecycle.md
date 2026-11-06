# Actual SDK lifecycle — 2.30.0

Source paths below are relative to `spikes/x402-pre-sign-guard/node_modules/`:

- `@x402/core/dist/esm/client/index.mjs`: registration line 187; creation line 253; selection line 258; before hooks line 263; abort line 270; scheme creation line 279; failure recovery line 327; hook ordering line 631.
- `@x402/core/dist/esm/x402Client-CWf4x4tk.d.mts`: PaymentCreationContext line 1852; BeforePaymentCreationHook line 1865; registration declaration line 2133.
- `@x402/fetch/dist/esm/index.mjs`: wrapFetchWithPayment, 402 decoding, createPaymentPayload, paid retry and recovery retry.
- `@x402/hedera/dist/esm/chunk-WP6D5IUW.mjs`: real ExactHederaScheme implementation, scheme/network/feePayer checks followed by signer invocation.
- `@x402/hedera/dist/esm/signer-DCjZrivX.d.mts`: ClientHederaSigner.createPartiallySignedTransferTransaction(requirements): Promise<string>.

```ts
type BeforePaymentCreationHook = (context: {
  paymentRequired: PaymentRequired;
  selectedRequirements: PaymentRequirements;
}) => Promise<void | { abort: true; reason: string }>;
```

```mermaid
sequenceDiagram
 participant Buyer
 participant Fetch as Real x402 fetch adapter
 participant Core as Real x402Client
 participant Guard
 participant Scheme as ExactHederaScheme
 participant Signer as Instrumented Hedera signer
 Buyer->>Fetch: original URL, redirect:error
 Fetch->>Fetch: fetch and decode 402
 Fetch->>Core: createPaymentPayload(paymentRequired)
 Core->>Core: filter/select requirements
 Core->>Guard: before hook(context)
 alt non-PASS or exception
 Guard-->>Core: abort or throw
 Core-->>Fetch: reject outside failure recovery
 Fetch-->>Buyer: reject; zero signer calls
 else PASS
 Guard-->>Core: void
 Core->>Core: remaining hooks (mutable selection risk)
 Core->>Scheme: createPaymentPayload(version, selected, context)
 Scheme->>Signer: createPartiallySignedTransferTransaction(selected)
 Signer-->>Scheme: test serialized transaction
 Scheme-->>Core: payload
 Core-->>Fetch: assembled payment payload
 Fetch->>Fetch: encode payment header, retry original request
 end
```

The default selector uses the first eligible entry, but a custom selector can choose another; tests select the last entry and reject a fabricated nonmember. Core retains the same selected reference for hooks, scheme invocation and accepted payload metadata. It does not freeze or revalidate it after every hook. Manual hooks run before scheme adapters and registered extension hooks; declaring a registered extension can cause its hook to participate. This is why claiming immutability from hook placement alone is unsafe.

Hook abort and hook exceptions cannot enter onPaymentCreationFailure, which surrounds later scheme creation. Transport recovery calls createPaymentPayload again, so the guard runs again. The SDK is not a capability sandbox: calling a scheme/signer directly or using another client can bypass guard configuration. Keep these references inaccessible to model-controlled tools.
