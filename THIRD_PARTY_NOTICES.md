# Third-Party Notices and Licenses

QuoteSeal incorporates software, patterns, and design principles from third-party open-source projects under permissive licenses.

---

## 1. Meigi

- **Repository:** https://github.com/KaranSinghBisht/meigi
- **Authors:** Karan Singh Bisht and Adithya Prasanna Suriya Prakash
- **License:** MIT License
- **Reference Commit Used:** `8ed65f6217affdad05c7229e0906b1cbe5d79c79` (`8ed65f6`)

### Adapted Components and Architecture Patterns:

1. **Dual-Layer x402 Pre-Signing Bypass Protection:**
   - **Meigi Reference:** `packages/x402-guard/src/extension.ts` & `packages/x402-guard/src/check.ts`
   - **QuoteSeal Implementation:** `packages/guard/src/extension.ts`
   - **Description:** Implements dual-layer registration on `@x402/core`:
     - Merchant-declared `ClientExtension` hook for declared identity verification (`onBeforePaymentCreation`).
     - Global fallback `BeforePaymentCreationHook` (`requireQuoteSealPayee`) ensuring plain HTTP 402 challenges lacking the extension declaration cannot bypass pre-signing verification.

2. **Scenario Matrix and Test Runner Pattern:**
   - **Meigi Reference:** `services/x402-demo/src/scenario.ts` & `services/x402-demo/src/merchant.ts`
   - **QuoteSeal Implementation:** `apps/buyer-cli/src/demo-runner.ts`, `apps/api/src/routes/demo-merchant.ts`, and `packages/buyer/src/meigi-hardening.test.ts`
   - **Description:** Multi-step scenario job runner inspecting payment parameters, pre-signing guard verdicts, signer call counts, and settlement outcomes across legitimate, tampered payTo, altered amount, and undeclared merchant requests.

### Original License Text:

```text
MIT License

Copyright (c) 2026 Karan Singh Bisht and Adithya Prasanna Suriya Prakash

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
