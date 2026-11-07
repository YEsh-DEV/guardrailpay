# Arkiv integration checklist

- [ ] Keep `RiskSignal`, `WalletRiskState`, and `PaymentDecision` as the only domain entities.
- [ ] Assign ownership to the service writer and filter every read by schema tag and owner.
- [ ] Define indexed fields and SDK types in `arkiv/src/schema.ts`.
- [ ] Set expiry per entity and handle expired state as unavailable or `UNKNOWN`.
- [ ] Redact payment headers, private keys, identity data, and full request bodies.
- [ ] Add idempotency for decision writes and retries.
- [ ] Verify the payment proof before recording settlement-related evidence.
- [ ] Keep ENS profile validation and `RotationController` state as separate checks.
- [ ] Preserve the signer gate: only `PASS` reaches the raw signer.
- [ ] Add tests for malformed data, stale data, owner spoofing, RPC failure, and duplicate writes.
- [ ] Connect the dashboard only to verified adapter data and show freshness and uncertainty.
- [ ] Record actual testnet entity keys and transaction hashes only after real runs.
- [ ] Do not claim deployment, settlement, or Arkiv availability before those steps occur.
