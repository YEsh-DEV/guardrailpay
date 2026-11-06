# Final boundary regression results

**PASS — corrected controlled integration.** All rejected/modified attempts reaching the final boundary invoke the raw payment signer zero times. Authorized payments invoke it once with the exact approved destination, amount and other requirements. This is not an assertion that an unconstrained raw x402 client or arbitrary code with the raw key is secure; see the design's explicit capability boundary.

Worktree: `/home/yesh/Projects/eth-signer-boundary`  
Branch: `fix/x402-signer-boundary`  
Date: 2026-11-06

## Reproduce

```sh
cd /home/yesh/Projects/eth-signer-boundary/spikes/x402-pre-sign-guard
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:boundary
```

Pinned core/fetch/Hedera: **2.30.0** each; Hiero SDK transitive **2.90.1**. TypeScript **5.9.3**, tsx **4.21.0**, @types/node **24.10.0**. Executed on Node **26.12.0**, npm **11.20.0**. No SDK dependency versions changed. Node 24 and live settlement remain unverified. npm ci reported five dependency advisories; no automatic dependency upgrades were applied in this focused correction.

## Executed results

Typecheck PASS. **62 tests passed, 0 failed: all original 23 preserved plus 39 new tests.** Actual run retained in `spikes/x402-pre-sign-guard/final-boundary-results.tap`. Original files `evaluate.ts`, `proof.test.ts` and historical `test-results.tap` remain unchanged. New implementation and tests passed before the package test command was expanded.

| Regression group | Raw signer calls | Result |
|---|---:|---|
| Later hook changes payTo, amount (even still within cap), asset, network, scheme, fee payer or timeout | 0 each | Reject |
| Replaces selected requirement or uses a deep-equal replacement reference | 0 each | Reject |
| Replaces challenge reference or modifies original offered collection | 0 each | Reject |
| Getter or Proxy replaces data | 0 each | Reject |
| Later hook throws or returns abort | 0 each | Reject; attempt cannot be reused |
| BLOCK/HOLD/UNVERIFIABLE followed by direct wrapped-signer attempt | 0 each | Reject |
| Current profile, anchors, implementation identity, freshness, or adapter failure changes after initial guard | 0 each | Reject |
| Real registered extension / scheme hook mutation | 0 each | Reject |
| Real SDK re-entry after rejected mutation | 0 total | Reject again |
| SDK selects another originally offered option | 0 | Reject |
| Direct scheme execution without approval | 0 | Reject |
| Failure recovery attempts signer after rejection | 0 | Reject |
| Valid exact payment / second offered valid option | 1 each | Exact destination and amount asserted |
| HTTP recovery retry after a valid signature | 1 total; 0 additional | Consumed authorization rejects retry |
| Concurrent invocation of one attempt | 1 total | Exactly one invocation succeeds |
| Mutation through retained SDK reference during signer await | 1 approved call | Signer input remains exact approved detached data |
| Late addition to startup hooks array | 1 approved call | Added hook never runs |
| Runtime plugin/extension registration through facade | 0 | Capability absent; facade frozen |

The original raw-SDK mutation demonstration still intentionally signs once; it is preserved as a negative control. The corresponding new protected mutation regression signs zero times. Green tests therefore demonstrate both the original SDK limitation and the corrected integration, rather than hiding the old weakness.

## Remaining limits

No live ENS/RPC, OIDC, facilitator settlement or frontend was implemented. The snapshot adapter, selector policy, raw signer and host runtime remain trusted capabilities. Access to raw keys or arbitrary mutation of host globals/dependencies is not mitigated by this in-process correction. The supported API must be integrated as designed; merely importing the internal test primitive or continuing to expose the raw client does not provide the stated guarantee. A literal guarantee against arbitrary privileged plugins remains BLOCKED without process/key isolation.

No merge or deployment was performed. The shared checkout was switched by another agent during inspection, so all changes are in the separate worktree above.
