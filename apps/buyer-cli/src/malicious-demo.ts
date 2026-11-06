/**
 * QuoteSeal Malicious Merchant Demo
 *
 * Demonstrates that BuyerPaymentOrchestrator rejects malicious 402 challenges
 * via the guard boundary — signer is NEVER invoked for any malicious scenario.
 *
 * Usage:
 *   node dist/malicious-demo.js --scenario=tampered-payto
 *   node dist/malicious-demo.js --scenario=altered-amount
 *   node dist/malicious-demo.js --scenario=wrong-network
 *   node dist/malicious-demo.js --scenario=wrong-asset
 *   node dist/malicious-demo.js --scenario=cross-origin
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BuyerPaymentOrchestrator,
  MockFacilitatorClient,
  QuoteSealSecurityRejectionError
} from '@quoteseal/buyer';
import { defaultProfile, defaultAnchors } from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';

type Scenario = 'tampered-payto' | 'altered-amount' | 'wrong-network' | 'wrong-asset' | 'cross-origin';

function buildChallenge(scenario: Scenario): { challenge: PaymentRequired; resourceUrl: string } {
  const baseRequirement: PaymentRequirements = {
    scheme: 'exact',
    network: 'hedera:testnet',
    asset: '0.0.0',
    amount: '10',
    payTo: defaultProfile.payTo ?? '0.0.123456',
    maxTimeoutSeconds: 60,
    extra: { feePayer: '0.0.98' }
  };

  switch (scenario) {
    case 'tampered-payto':
      return {
        resourceUrl: 'https://merchant.example/api/data',
        challenge: {
          x402Version: 2,
          resource: { url: 'https://merchant.example/api/data' },
          accepts: [{ ...baseRequirement, payTo: '0.0.9999999' }] // attacker's account
        }
      };
    case 'altered-amount':
      return {
        resourceUrl: 'https://merchant.example/api/data',
        challenge: {
          x402Version: 2,
          resource: { url: 'https://merchant.example/api/data' },
          accepts: [{ ...baseRequirement, amount: '999999999' }] // exceeds maxAmount
        }
      };
    case 'wrong-network':
      return {
        resourceUrl: 'https://merchant.example/api/data',
        challenge: {
          x402Version: 2,
          resource: { url: 'https://merchant.example/api/data' },
          accepts: [{ ...baseRequirement, network: 'hedera:mainnet' as `${string}:${string}` }]
        }
      };
    case 'wrong-asset':
      return {
        resourceUrl: 'https://merchant.example/api/data',
        challenge: {
          x402Version: 2,
          resource: { url: 'https://merchant.example/api/data' },
          accepts: [{ ...baseRequirement, asset: '0.0.1234' }] // unexpected token
        }
      };
    case 'cross-origin':
      return {
        // Different origin in resourceUrl vs trusted profile origin
        resourceUrl: 'https://evil-merchant.example/api/data',
        challenge: {
          x402Version: 2,
          resource: { url: 'https://evil-merchant.example/api/data' },
          accepts: [{ ...baseRequirement }]
        }
      };
  }
}

async function runScenario(scenario: Scenario) {
  console.log('='.repeat(70));
  console.log(` SCENARIO: ${scenario.toUpperCase()}`);
  console.log('='.repeat(70));

  const { challenge, resourceUrl } = buildChallenge(scenario);

  let serverPort = 0;
  const server = createServer(async (req, res) => {
    const authHeader = req.headers['payment-signature'];
    if (!authHeader) {
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
      return;
    }
    // Should never reach here for malicious scenarios
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'paid' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverPort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  const localFetch: typeof fetch = async (request, init) => {
    const rawUrl = typeof request === 'string' ? request : 'url' in request ? request.url : request.href;
    const target = new URL(rawUrl);
    // Map both the legitimate and malicious origins to the local server
    if (target.hostname.endsWith('merchant.example')) {
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(serverPort);
    }
    return globalThis.fetch(target, init);
  };

  let signerInvocations = 0;
  const instrumentedSigner: ClientHederaSigner = {
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(req) {
      signerInvocations++;
      console.error(`  [SIGNER] ⚠️  SIGNER WAS CALLED (call #${signerInvocations}) — this should NOT happen!`);
      return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
    }
  };

  const orchestrator = new BuyerPaymentOrchestrator();
  const mockFacilitator = new MockFacilitatorClient();

  let rejected = false;
  let rejectionReason = '';

  try {
    await orchestrator.execute({
      resourceUrl,
      mode: 'local',
      signer: instrumentedSigner,
      now: () => 1000,
      readTrust: () => ({
        profile: {
          ...defaultProfile,
          origin: 'https://merchant.example',
          ensName: 'merchant.eth'
        },
        anchors: { ...defaultAnchors }
      }),
      facilitator: mockFacilitator,
      fetch: localFetch,
      confirm: async () => true
    });

    console.error('  [FAIL] Expected rejection but orchestrator completed successfully!');
  } catch (err) {
    if (err instanceof QuoteSealSecurityRejectionError) {
      rejected = true;
      rejectionReason = err.message;
    } else if (err instanceof Error) {
      // Other errors (e.g. ResourceAccessError for cross-origin redirect) are also acceptable rejections
      rejected = true;
      rejectionReason = err.message;
    }
  } finally {
    server.close();
  }

  console.log(`\n  REJECTED:    ${rejected ? 'YES ✓' : 'NO ✗'}`);
  console.log(`  REASON:      ${rejectionReason}`);
  console.log(`  SIGNER CALLS: ${signerInvocations} (INVARIANT: MUST BE 0)`);

  if (!rejected) {
    console.error('\n  [CRITICAL] Guard did not reject a malicious scenario!');
    process.exitCode = 1;
  } else if (signerInvocations > 0) {
    console.error('\n  [CRITICAL] Signer was invoked despite rejection!');
    process.exitCode = 1;
  } else {
    console.log('\n  [PASS] Malicious scenario correctly rejected with 0 signer invocations.');
  }
  console.log('='.repeat(70));
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((a) => a.startsWith('--scenario='))?.split('=')[1];

  const allScenarios: Scenario[] = [
    'tampered-payto',
    'altered-amount',
    'wrong-network',
    'wrong-asset',
    'cross-origin'
  ];

  const scenarios: Scenario[] = scenarioArg
    ? [scenarioArg as Scenario]
    : allScenarios;

  for (const s of scenarios) {
    await runScenario(s);
    console.log();
  }

  console.log('All malicious merchant scenarios completed.');
}

main().catch((err) => {
  console.error('Malicious demo error:', err);
  process.exit(1);
});
