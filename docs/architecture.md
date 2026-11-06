# QuoteSeal Architecture

QuoteSeal protects autonomous AI agents from payment hijacking in HTTP 402 (x402) micropayment workflows on Hedera.

```
                           +---------------------------------------+
                           |           Merchant Server             |
                           |   (Protected x402 Hedera Endpoint)    |
                           +-------------------+-------------------+
                                               |
                                     1. HTTP 402 Payment
                                        Required (payTo,
                                        amount, asset, network)
                                               |
                                               v
+-----------------------+           +----------+------------+
|  Merchant ENSv2 Name  |           |     Attack Proxy      | (MITM Tampering:
|    (Sepolia Testnet)  |           |  (Rewrites payTo)     |  substitutes evil payTo)
+-----------+-----------+           +----------+------------+
            |                                  |
            |                                  v
            |                       +----------+------------+
            | 2. Resolve Profile    |      Buyer Agent      |
            +---------------------->|                       |
                                    |   +---------------+   |
                                    |   |  PayeeGuard   |   | (Pure Verdict Engine)
                                    |   +-------+-------+   |
                                    +-----------|-----------+
                                                |
                                    3. Verdict: PASS / BLOCK / HOLD / UNVERIFIABLE
                                                |
                          +---------------------+---------------------+
                          |                                           |
                    [Verdict == PASS]                       [Verdict != PASS]
                          |                                           |
                          v                                           v
               Signer executes payment                  ABORT: Signer NOT called
               Settles on Hedera (HashScan)             Signer call count = 0
```

## Rotation Security Lifecycle

1. **Proposal**: Treasury role proposes a new payout address (`pendingPayTo`).
2. **Authentication**: World ID Agent Pass verifies human operator authenticity via OIDC.
3. **Approval & Timelock**: Contract records approval and enforces delay window (`pendingEffectiveAt`).
4. **Hold Period**: Buyer agent returns `HOLD` if payment is attempted to `pendingPayTo` before delay expires.
5. **Activation**: Controller updates `activePayTo`. New payments `PASS`, previous address `BLOCK`.
