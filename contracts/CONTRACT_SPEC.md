# Arkiv and contract boundary

The existing `contracts/src/RotationController.sol` remains unchanged. It owns payout rotation on Ethereum and exposes `activePayTo`, rotation status, timestamps, proposer, and approver through contract state and events.

Arkiv does not replace this contract. The future adapter may copy a verified rotation identifier, payee, and lifecycle event into `PaymentDecision` or `RiskSignal` as correlation data. It must read and validate the contract state before treating that data as current.

The contract does not currently contain Arkiv references, risk state, wallet reputation, or payment-decision storage. Do not document an on-chain Arkiv link until a separate implementation adds and tests one.
