# Isolated x402 guard spike

On branch `fix/x402-signer-boundary`, run:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:boundary
```

The original 23 SDK tests remain unchanged, including the raw-SDK negative control that demonstrates one unauthorized signer call. The new 39 tests prove the controlled integration blocks that mutation before the raw signer. See `../../docs/x402-final-boundary-design.md` and `../../docs/x402-final-boundary-results.md` for the scoped PASS verdict and trust assumptions.

Use `createPaymentAttempt` from `final-boundary.ts` as the integration entry point. `createFinalBoundary` is an internal primitive exported for adversarial tests, not an agent tool. Raw signer, trusted snapshot adapter and client configuration belong exclusively to trusted buyer composition code. No real payments are submitted; signer payloads in this spike are synthetic.
