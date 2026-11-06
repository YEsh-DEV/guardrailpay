/**
 * QuoteSeal x402 MVP Scenario Demo Runner
 *
 * Reuses and adapts the Meigi scenario test pattern (services/x402-demo/src/scenario.ts)
 * for QuoteSeal's dual-layer pre-signing bypass protection.
 *
 * Executes the required scenarios:
 * 1. Legitimate payment (PASS -> 1 signer call -> Access Granted)
 * 2. Unauthorized recipient / tampered payTo (BLOCK -> 0 signer calls)
 * 3. Altered amount / price hijacking (BLOCK -> 0 signer calls)
 * 4. Undeclared merchant / bypass attempt (BLOCK -> 0 signer calls)
 * 5. Tampered identity declaration / impostor ENS (BLOCK -> 0 signer calls)
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BuyerPaymentOrchestrator,
  MockFacilitatorClient,
  QuoteSealSecurityRejectionError
} from '@quoteseal/buyer';
import {
  defaultProfile,
  defaultAnchors,
  quoteSealPayeeDeclaration,
  type TrustSnapshot
} from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';

interface DemoStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly payTo: string;
  readonly amount: string;
  readonly declaration: Record<string, unknown> | null;
  readonly expectedVerdict: 'PASS' | 'BLOCK';
  readonly expectedSignerCalls: number;
}

const DEMO_STEPS: readonly DemoStep[] = [
  {
    id: 'legitimate',
    name: '1. Legitimate Merchant Payment',
    description: 'Merchant declares merchant.eth with authorized payTo and valid amount (10 HBAR)',
    payTo: defaultProfile.payTo ?? '0.0.123456',
    amount: '10',
    declaration: quoteSealPayeeDeclaration({ ens: 'merchant.eth' }),
    expectedVerdict: 'PASS',
    expectedSignerCalls: 1
  },
  {
    id: 'tampered-payto',
    name: '2. Unauthorized Recipient (Tampered payTo)',
    description: 'Merchant declares merchant.eth but silently routes payout to attacker 0.0.9999999',
    payTo: '0.0.9999999',
    amount: '10',
    declaration: quoteSealPayeeDeclaration({ ens: 'merchant.eth' }),
    expectedVerdict: 'BLOCK',
    expectedSignerCalls: 0
  },
  {
    id: 'altered-amount',
    name: '3. Altered Amount (Price Hijacking)',
    description: 'Merchant declares merchant.eth but inflates price to 999999999 HBAR (cap: 100)',
    payTo: defaultProfile.payTo ?? '0.0.123456',
    amount: '999999999',
    declaration: quoteSealPayeeDeclaration({ ens: 'merchant.eth' }),
    expectedVerdict: 'BLOCK',
    expectedSignerCalls: 0
  },
  {
    id: 'undeclared',
    name: '4. Undeclared Merchant (Meigi Fallback Hook)',
    description: 'Plain HTTP 402 with no QuoteSeal extension attempting to bypass guard',
    payTo: defaultProfile.payTo ?? '0.0.123456',
    amount: '10',
    declaration: null,
    expectedVerdict: 'BLOCK',
    expectedSignerCalls: 0
  },
  {
    id: 'impostor-ens',
    name: '5. Impostor Identity Declaration',
    description: 'Merchant attempts to masquerade with unauthorized identity (attacker.eth)',
    payTo: defaultProfile.payTo ?? '0.0.123456',
    amount: '10',
    declaration: quoteSealPayeeDeclaration({ ens: 'attacker.eth' }),
    expectedVerdict: 'BLOCK',
    expectedSignerCalls: 0
  }
];

export interface StepReport {
  id: string;
  name: string;
  verdict: string;
  signerCalls: number;
  outcome: 'SUCCESS' | 'BLOCKED_AS_EXPECTED' | 'UNEXPECTED_FAILURE';
  reason?: string;
}

export async function runDemoSuite(): Promise<{ reports: StepReport[]; allPassed: boolean }> {
  console.log('\n' + '='.repeat(80));
  console.log('  QUOTESEAL x402 MVP DEMO: PRE-SIGNING PROTECTION & HARDENED BOUNDARY');
  console.log('='.repeat(80));
  console.log('Mode: Controlled Local Hedera Signer + Mock Facilitator');
  console.log('Enforcing Meigi Dual-Layer Pre-Signing Bypass Protection\n');

  let activeStep: DemoStep = DEMO_STEPS[0];
  let serverPort = 0;

  // Standalone local HTTP merchant server
  const server = createServer(async (req, res) => {
    const authHeader = req.headers['payment-signature'];

    if (!authHeader) {
      const challenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: 'https://merchant.example/api/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: activeStep.amount,
            payTo: activeStep.payTo,
            maxTimeoutSeconds: 60,
            extra: { feePayer: '0.0.98' }
          }
        ],
        ...(activeStep.declaration ? { extensions: activeStep.declaration } : {})
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'PAID_ACCESS_GRANTED',
        merchant: 'merchant.eth',
        resource: 'confidential-market-intelligence-data'
      })
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverPort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  const resourceUrl = 'https://merchant.example/api/data';

  // Custom fetch routing https://merchant.example -> 127.0.0.1:port
  const demoFetch: typeof fetch = async (request, init) => {
    const rawUrl = typeof request === 'string' ? request : 'url' in request ? request.url : request.href;
    const target = new URL(rawUrl);
    if (target.origin === 'https://merchant.example') {
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(serverPort);
    }
    return globalThis.fetch(target, init);
  };

  const reports: StepReport[] = [];

  for (const step of DEMO_STEPS) {
    activeStep = step;
    let signerCalls = 0;

    const instrumentedSigner: ClientHederaSigner = {
      accountId: '0.0.4242',
      async createPartiallySignedTransferTransaction(req: PaymentRequirements) {
        signerCalls++;
        return Buffer.from(JSON.stringify({ tx: 'signed-tx-bytes', to: req.payTo, amount: req.amount })).toString('base64');
      }
    };

    const orchestrator = new BuyerPaymentOrchestrator();
    const facilitator = new MockFacilitatorClient();

    let actualVerdict = 'PASS';
    let rejectionReason = '';

    console.log(`\n▶ [Executing] ${step.name}`);
    console.log(`  Details: ${step.description}`);
    console.log(`  Parameters: payTo=${step.payTo}, amount=${step.amount}, declared=${step.declaration ? 'YES' : 'NO'}`);

    try {
      const result = await orchestrator.execute({
        resourceUrl,
        mode: 'local',
        signer: instrumentedSigner,
        facilitator,
        fetch: demoFetch,
        now: () => 1000,
        readTrust: () => ({
          profile: {
            ...defaultProfile,
            origin: 'https://merchant.example',
            ensName: 'merchant.eth',
            checkedAt: 1000
          },
          anchors: { ...defaultAnchors }
        }),
        confirm: async (summary) => {
          console.log(`  [Buyer Consent] Prompted with verified merchant=${summary.merchantEns}, payTo=${summary.payTo}, amount=${summary.amount}`);
          return true; // Explicit confirmation
        }
      });

      if (result.success) {
        actualVerdict = 'PASS';
        console.log(`  [Outcome] PASS — Access granted (HTTP 200). Signer calls: ${signerCalls}`);
      }
    } catch (err) {
      if (err instanceof QuoteSealSecurityRejectionError) {
        actualVerdict = err.verdict;
        rejectionReason = err.message;
      } else {
        actualVerdict = 'BLOCK';
        rejectionReason = (err as Error).message;
      }
      console.log(`  [Outcome] ${actualVerdict} — Payment refused: ${rejectionReason}`);
      console.log(`  [Security] Controlled signer invocations: ${signerCalls}`);
    }

    const matchesExpected =
      actualVerdict === step.expectedVerdict &&
      signerCalls === step.expectedSignerCalls;

    reports.push({
      id: step.id,
      name: step.name,
      verdict: actualVerdict,
      signerCalls,
      outcome: matchesExpected
        ? step.expectedVerdict === 'PASS'
          ? 'SUCCESS'
          : 'BLOCKED_AS_EXPECTED'
        : 'UNEXPECTED_FAILURE',
      reason: rejectionReason
    });
  }

  server.close();

  // Print Summary Table
  console.log('\n' + '='.repeat(90));
  console.log('                          FINAL MVP DEMO SCENARIO MATRIX');
  console.log('='.repeat(90));
  console.log(
    'Scenario'.padEnd(35) +
    'Verdict'.padEnd(10) +
    'Signer Calls'.padEnd(15) +
    'Status'.padEnd(15)
  );
  console.log('-'.repeat(90));

  let allPassed = true;
  for (const r of reports) {
    const status = r.outcome === 'UNEXPECTED_FAILURE' ? 'FAIL' : 'PASS';
    if (status === 'FAIL') allPassed = false;
    console.log(
      r.name.padEnd(35) +
      r.verdict.padEnd(10) +
      String(r.signerCalls).padEnd(15) +
      status.padEnd(15)
    );
  }
  console.log('='.repeat(90));

  console.log(`\nOverall Result: ${allPassed ? 'ALL SCENARIOS PASSED SECURELY' : 'SOME SCENARIOS FAILED'}`);
  console.log('Signer Boundary Guarantee: For every non-PASS scenario, signerCalls === 0.\n');

  return { reports, allPassed };
}

if (process.argv[1]?.endsWith('demo-runner.js') || process.argv[1]?.endsWith('demo-runner.ts')) {
  runDemoSuite().then(({ allPassed }) => {
    if (!allPassed) process.exit(1);
  });
}
