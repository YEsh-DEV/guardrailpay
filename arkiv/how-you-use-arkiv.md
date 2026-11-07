# How the firewall will use Arkiv

Arkiv is an evidence read and write path around the existing local evaluation. It does not replace the local `PayeeGuard` decision or the wallet signer.

## Before signing

1. Parse the x402 402 challenge.
2. Resolve the merchant ENS profile and normalize the payment request with the existing `packages/payee-guard` rules.
3. Query the service-owned `WalletRiskState` and recent `RiskSignal` records for the relevant canonical wallet and network.
4. Apply the local buyer policy and the Arkiv-derived risk policy.
5. Write a `PaymentDecision` with the final verdict and a bounded reason code.
6. Invoke the guarded signer only when the existing evaluation returns `PASS` and the implementation's risk policy also permits the payment.

If Arkiv is unavailable, the system must not claim that the wallet is safe. Return `UNVERIFIABLE` or apply an explicitly documented fail-closed policy.

## After settlement

After payment-proof verification and actual settlement exist, attach only a non-secret correlation value to a later decision or signal. Do not write raw payment headers or private wallet material. The current client returns a demo receipt, so the repository is not ready to record settlement as a verified fact.

## User-visible behavior

The dashboard can show a decision, reason code, data freshness, and whether the signer ran. It must distinguish `PASS` from "payment settled" and distinguish `BLOCK` from "wallet permanently malicious". The current dashboard uses mock data and has no Arkiv adapter.
