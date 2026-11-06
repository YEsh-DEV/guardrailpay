# Spike 3 results

Verdict: **FAIL for the unrestricted acceptance claim; the configured minimal pre-sign abort path is proven.**

Executed 23 tests, all passed. One deliberately proves a bypass under additional local hooks: a hook registered after validation mutates the selected recipient, then the real SDK invokes the Hedera signer for that changed recipient. Thus a safe interception point exists, but the SDK does not make a validated selection immutable. This is a trusted-code/extension configuration risk, not evidence that a remote merchant alone can register hooks. Before claiming full PASS, constrain hooks/extensions and add an executable immutable-selection defense and regression test. No after-signing guard is used.

## Versions and reproduction

Isolated package: `spikes/x402-pre-sign-guard`. Root package and lockfile were not replaced. Root currently depends on `@coinbase/agentkit` with a range and has transitive x402 core/fetch 2.30.0; it has no Hedera scheme installed. The spike pins core, fetch and hedera each to **2.30.0** in its own package.json and package-lock.json. Fetch depends on core ~2.30.0; Hedera depends on core ~2.30.0, Hiero SDK 2.90.1 and proto 2.32.0. These package manifests declare no peerDependencies. Tooling: TypeScript 5.9.3, tsx 4.21.0, @types/node 24.10.0. Executed with Node 26.12.0 and npm 11.20.0; the planned Node 24 runtime remains untested.

```sh
cd /home/yesh/Projects/eth/spikes/x402-pre-sign-guard
npm ci
npm run typecheck
npm test
```

`test-results.tap` contains the actual captured run and per-case counts. Typecheck passed. The signer is a test implementation of the real Hedera signer interface; the transport supplies synthetic HTTP 402 responses to the actual fetch adapter, core client and ExactHederaScheme. No keys or transactions are submitted. This proves invocation boundaries, not cryptographic correctness or settlement. The redirect test uses actual local HTTP and native fetch.

## Findings and architecture corrections

- The actual hook requires an async callback returning void or `{abort:true,reason:string}`. Selection precedes the hook, and hook abort/exception occurs outside the scheme failure recovery try/catch.
- The security architecture section 5 manually emulates SDK control flow; that example is insufficient evidence. This spike invokes the real SDK instead.
- Core does not independently establish original offered membership. The evaluator compares against a separately captured original offers snapshot, including all nested fields via deep equality.
- Default SDK spend controls rejected the HBAR fixture before the hook. The spike explicitly disables those controls to isolate the guard; its own amount, asset and recipient policy remains enforced. Production must configure both layers intentionally.
- Fetch defaults do not guarantee redirect rejection. Callers must enforce redirect:error, including paid retries. Expected origin must be captured per request outside merchant metadata; the tests intentionally use an attacker resource.url while a valid buyer URL still passes.
- Fetch recovery can create a second payload. The retry test proves the hook is invoked again and rejects it with zero additional signer calls.
- Later manual hooks, scheme hooks and declared registered extension hooks may act after the guard. Objects are mutable. Restrict these capabilities and signer access; do not expose a raw unguarded client/scheme to an agent.
- RPC/ENS freshness and trust are injected fixtures, not live network verification. Merchant text never chooses the profile. Prompt injection text alone is inert; T7 combines instructions with an unauthorized payTo and blocks the payment.
- ADR statements implying absolute RPC truth or non-reorgability are stronger than this spike or the specification establishes.

## Outstanding limitations

Full source-document review could not be established from the truncated architecture read; the security architecture and relevant SDK/roadmap/decision sections were inspected, and the specification was available from the preceding review. This report does not replace the full independent architecture review. No live ENS reads, RPC provider tests, facilitator settlement, World OIDC, or production guard were built. Profile anchors are minimal synthetic owner/resolver/expiry/version values. Full chain/name/registry/implementation/permission anchors remain integration work. Origin uses a fixed per-test original URL; concurrent production request context still needs design. Local observation freshness does not authenticate when the merchant originally created an offer.

The installed agent-payment-x402 skill was inspected but targets another wallet/MCP stack; its implementation was not adopted. SDK findings use the installed package source and declarations as primary evidence.
