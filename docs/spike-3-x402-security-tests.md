# Executed security tests

`npm run typecheck`: PASS. `npm test`: 23 passed, 0 failed. Raw run: `spikes/x402-pre-sign-guard/test-results.tap`.

| Cases | Verdict | Signer / scheme creation calls |
|---|---|---|
| T1 valid; T6 selected second valid | PASS | 1 / 1 each |
| T2 payTo; T3 asset/network; T4 amount | BLOCK | 0 / 0 each |
| T5 unknown | HOLD | 0 / 0 |
| T6 selected second malicious; fabricated nonmember | BLOCK | 0 / 0 each |
| T7 malicious instructions plus malicious payTo | BLOCK | 0 / 0 |
| T9 stale; disagreement; outage fixtures | UNVERIFIABLE | 0 / 0 each |
| Owner anchor and profile version changed | HOLD | 0 / 0 each |
| Stale offer; malformed amount; zero timeout | BLOCK | 0 / 0 each |
| Unknown scheme | SDK rejects during selection | 0 / 0 |
| Hook exception | Reject | 0 / 0 |
| T8 actual HTTP cross-origin redirect | Fetch rejects before payment | 0 signer calls |
| Recovery retry | First allowed, second aborted | 1 total; 0 added by rejected retry |
| Later-hook mutation regression | Demonstrates unsafe composition | 1 signer call to mutated recipient |

The unknown scheme test's logged UNVERIFIABLE is an initial harness status, not an evaluator verdict: SDK rejects before entering the guard. RPC outage/disagreement are modeled adapter outcomes; no real RPC availability claim is made. In T1 valid, merchant resource metadata deliberately names another origin and contains malicious instructions; neither can alter buyer trust. T7 blocks because the selected payout is unauthorized, not because text is classified by a model.

Every non-PASS normal lifecycle case asserts zero signer calls and zero scheme payload creation calls. The valid cases assert exactly one of each. Recovery handlers remain uncalled on guard rejection. The later-hook test is a passing test of an unsafe behavior, and prevents interpreting the green suite as an unconditional security PASS.
