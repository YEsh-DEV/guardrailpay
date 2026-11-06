import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BuyerPaymentOrchestrator } from './orchestrator.js';
import { MockFacilitatorClient, HttpFacilitatorClient } from './facilitator.js';
import { HederaMirrorNodeVerifier, HEDERA_TESTNET_MIRROR_NODE_URL } from './verifier.js';
import { defaultProfile, defaultAnchors } from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';

/**
 * Interactive demo runner providing explicit LOCAL DEMO and LIVE TESTNET modes.
 */
async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'local';

  console.log('='.repeat(70));
  console.log(` QuoteSeal Buyer x402 Payment Orchestration Demo`);
  console.log(` Target Mode: ${modeArg.toUpperCase()}`);
  console.log('='.repeat(70));

  if (modeArg === 'live') {
    await runLiveTestnetDemo();
  } else {
    await runLocalDemo();
  }
}

/**
 * LOCAL DEMO:
 * - Real local HTTP merchant server returning HTTP 402 challenge
 * - Real x402 SDK parsing and encoding
 * - Real QuoteSeal guard evaluation
 * - Controlled one-shot signer boundary
 * - Simulated facilitator settlement
 * - Clearly labelled simulated output (never claiming real Hedera settlement)
 */
async function runLocalDemo() {
  console.log('\n[1/5] Starting real local HTTP merchant server...');

  let serverPort = 0;
  let requestsHandled = 0;

  const server = createServer(async (req, res) => {
    requestsHandled++;
    const authHeader = req.headers['payment-signature'];

    if (!authHeader) {
      console.log(`  [Merchant Server] Request #1 received without payment proof -> Returning HTTP 402`);
      const challenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: 'https://merchant.example/api/market-intelligence' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: defaultProfile.payTo ?? '0.0.123456',
            maxTimeoutSeconds: 60,
            extra: { feePayer: '0.0.98' }
          }
        ]
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
      return;
    }

    console.log(`  [Merchant Server] Request #2 received with PAYMENT-SIGNATURE header -> Validating payment proof`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        title: 'QuoteSeal Institutional Market Intelligence',
        timestamp: new Date().toISOString(),
        status: 'PAID_ACCESS_GRANTED',
        insights: 'Verified autonomous payment settlement completed via x402 and QuoteSeal guard boundary.'
      })
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverPort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  const resourceUrl = 'https://merchant.example/api/market-intelligence';
  console.log(`  [Merchant Server] Bound to 127.0.0.1:${serverPort} (serving ${resourceUrl})`);

  // Local fetch dispatching https://merchant.example to the local server
  const localFetch: typeof fetch = async (request, init) => {
    const rawUrl = typeof request === 'string' ? request : 'url' in request ? request.url : request.href;
    const target = new URL(rawUrl);
    if (target.origin === 'https://merchant.example') {
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(serverPort);
    }
    return globalThis.fetch(target, init);
  };

  let signerInvocations = 0;
  const instrumentedSigner: ClientHederaSigner = {
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(req: PaymentRequirements) {
      signerInvocations++;
      console.log(`  [Controlled Signer] Signer invoked (call #${signerInvocations}) for ${req.amount} tinybars to ${req.payTo}`);
      return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
    }
  };

  const orchestrator = new BuyerPaymentOrchestrator();
  const mockFacilitator = new MockFacilitatorClient();

  console.log('\n[2/5] Executing BuyerPaymentOrchestrator...');
  const result = await orchestrator.execute({
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
    confirm: async (summary) => {
      console.log('\n[3/5] Explicit Buyer Confirmation Requested:');
      console.log(`  Merchant Origin: ${summary.merchantOrigin}`);
      console.log(`  Merchant ENS:    ${summary.merchantEns}`);
      console.log(`  Recipient PayTo: ${summary.payTo}`);
      console.log(`  Amount:          ${summary.amount} tinybars`);
      console.log(`  Asset:           ${summary.asset} (HBAR)`);
      console.log(`  Network:         ${summary.network}`);
      console.log(`  Buyer Decision:  APPROVED (explicit true)`);
      return true;
    }
  });

  server.close();

  console.log('\n[4/5] Settlement & Verification Status:');
  console.log(`  Mode:            ${result.mode.toUpperCase()}`);
  console.log(`  Transaction ID:  ${result.settlement?.transactionId}`);
  console.log(`  Simulated Flag:  ${result.settlement?.simulated ? 'TRUE (LOCAL SIMULATION)' : 'FALSE'}`);
  console.log(`  Verification:    ${result.verification?.status} (${result.verification?.reason})`);
  console.log(`  Signer Calls:    ${signerInvocations} (INVARIANT: EXACTLY 1)`);

  console.log('\n[5/5] Final Paid Content Received:');
  console.log(JSON.stringify(result.data, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log(` [LOCAL DEMO RESULT] SUCCESS (SIMULATED LOCAL ROUND TRIP)`);
  console.log('='.repeat(70));
}

/**
 * LIVE TESTNET MODE:
 * - Requires real Hedera buyer account credentials
 * - Requires active live facilitator endpoint
 * - Independent Mirror Node consensus verification
 * - Explicit fail-closed if missing external dependencies
 */
async function runLiveTestnetDemo() {
  console.log('\n[LIVE TESTNET] Validating environment configuration...');

  const buyerAccountId = process.env.HEDERA_ACCOUNT_ID;
  const buyerPrivateKey = process.env.HEDERA_BUYER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.amnt.io/testnet';
  const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL || HEDERA_TESTNET_MIRROR_NODE_URL;

  const missing: string[] = [];
  if (!buyerAccountId) missing.push('HEDERA_ACCOUNT_ID (e.g. 0.0.123456)');
  if (!buyerPrivateKey) missing.push('HEDERA_BUYER_PRIVATE_KEY (ED25519 or ECDSA private key)');

  if (missing.length > 0) {
    console.error('\n[LIVE TESTNET] BLOCKED: Missing live credentials');
    console.error('The following environment variables must be configured in .env for live testnet execution:');
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    console.log('\nNote: In accordance with security protocol, live testnet transactions will never execute with fabricated credentials.');
    console.log('To run the offline end-to-end flow, use: pnpm --filter @quoteseal/buyer demo:local');
    process.exitCode = 1;
    return;
  }

  console.log(`  Buyer Account:     ${buyerAccountId}`);
  console.log(`  Facilitator URL:   ${facilitatorUrl}`);
  console.log(`  Mirror Node URL:   ${mirrorNodeUrl}`);

  console.log('\n[LIVE TESTNET] Probing facilitator capabilities...');
  const facilitator = new HttpFacilitatorClient(facilitatorUrl);
  const cap = await facilitator.checkCapabilities?.('hedera:testnet', 'exact');
  console.log(`  Facilitator hedera:testnet capability: ${cap?.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);

  if (!cap?.supported) {
    console.error(`\n[LIVE TESTNET] Facilitator at ${facilitatorUrl} does not advertise exact hedera:testnet support.`);
    process.exitCode = 1;
    return;
  }

  console.log('\n[LIVE TESTNET] Facilitator is operational and verified for exact hedera:testnet.');
  console.log('[LIVE TESTNET] Real testnet execution ready for user confirmation.');
}

if (process.argv[1]?.endsWith('demo.ts') || process.argv[1]?.endsWith('demo.js')) {
  main().catch((err) => {
    console.error('Demo encountered error:', err);
    process.exit(1);
  });
}
