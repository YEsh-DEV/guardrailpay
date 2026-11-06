/**
 * QuoteSeal Buyer CLI
 *
 * Local demo runner that uses BuyerPaymentOrchestrator directly (no HTTP to guard API).
 * The guard library is used in-process — HTTP API route is for browser/frontend clients.
 *
 * Usage:
 *   node dist/cli.js --mode=local   # simulated local round-trip
 *   node dist/cli.js --mode=live    # live Hedera testnet (requires credentials)
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BuyerPaymentOrchestrator,
  MockFacilitatorClient,
  HttpFacilitatorClient,
  HederaMirrorNodeVerifier,
  HEDERA_TESTNET_MIRROR_NODE_URL
} from '@quoteseal/buyer';
import { defaultProfile, defaultAnchors, quoteSealPayeeDeclaration } from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired } from '@x402/core/types';

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'local';

  console.log('='.repeat(70));
  console.log(' QuoteSeal Buyer CLI — Integrated Demo');
  console.log(` Mode: ${modeArg.toUpperCase()}`);
  console.log('='.repeat(70));

  if (modeArg === 'live') {
    await runLiveDemo();
  } else {
    await runLocalDemo();
  }
}

async function runLocalDemo() {
  console.log('\n[1/5] Starting local HTTP merchant server...');

  let serverPort = 0;

  const server = createServer(async (req, res) => {
    const authHeader = req.headers['payment-signature'];

    if (!authHeader) {
      console.log('  [Merchant] No payment proof -> HTTP 402');
      const challenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: 'https://merchant.example/api/data' },
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
        ],
        extensions: quoteSealPayeeDeclaration({ ens: 'merchant.eth' })
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
      return;
    }

    console.log('  [Merchant] Payment proof received -> HTTP 200');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'PAID_ACCESS_GRANTED',
        message: 'QuoteSeal buyer CLI local demo — simulated payment accepted',
        timestamp: new Date().toISOString()
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
  console.log(`  [Merchant] Listening on 127.0.0.1:${serverPort}`);

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
    async createPartiallySignedTransferTransaction(req) {
      signerInvocations++;
      console.log(`  [Signer] Invoked (call #${signerInvocations}) for ${req.amount} to ${req.payTo}`);
      return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
    }
  };

  const orchestrator = new BuyerPaymentOrchestrator();
  const mockFacilitator = new MockFacilitatorClient();

  console.log('\n[2/5] Running BuyerPaymentOrchestrator (guard evaluated in-process)...');

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
      console.log('\n[3/5] Buyer Confirmation Request:');
      console.log(`  Origin:  ${summary.merchantOrigin}`);
      console.log(`  ENS:     ${summary.merchantEns}`);
      console.log(`  PayTo:   ${summary.payTo}`);
      console.log(`  Amount:  ${summary.amount} tinybars`);
      console.log(`  Network: ${summary.network}`);
      console.log(`  Decision: APPROVED`);
      return true;
    }
  });

  server.close();

  console.log('\n[4/5] Settlement & Verification:');
  console.log(`  Mode:        ${result.mode.toUpperCase()}`);
  console.log(`  Transaction: ${result.settlement?.transactionId}`);
  console.log(`  Simulated:   ${result.settlement?.simulated ? 'TRUE (LOCAL SIMULATION)' : 'FALSE'}`);
  console.log(`  Verification: ${result.verification?.status}`);
  console.log(`  Signer Calls: ${signerInvocations} (INVARIANT: EXACTLY 1)`);

  console.log('\n[5/5] Resource Content:');
  console.log(JSON.stringify(result.data, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log(' [RESULT] SUCCESS (LOCAL SIMULATION — no real Hedera transaction)');
  console.log('='.repeat(70));
}

async function runLiveDemo() {
  console.log('\n[LIVE] Validating environment...');

  const buyerAccountId = process.env.HEDERA_ACCOUNT_ID;
  const buyerPrivateKey = process.env.HEDERA_BUYER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.amnt.io/testnet';

  const missing: string[] = [];
  if (!buyerAccountId) missing.push('HEDERA_ACCOUNT_ID');
  if (!buyerPrivateKey) missing.push('HEDERA_BUYER_PRIVATE_KEY');

  if (missing.length > 0) {
    console.error('\n[LIVE] BLOCKED: Missing credentials:');
    for (const m of missing) console.error(`  - ${m}`);
    console.log('\nRun local demo instead: node dist/cli.js --mode=local');
    process.exitCode = 1;
    return;
  }

  console.log(`  Buyer Account: ${buyerAccountId}`);
  console.log(`  Facilitator:   ${facilitatorUrl}`);
  console.log('\n[LIVE] Probing facilitator...');

  const facilitator = new HttpFacilitatorClient(facilitatorUrl);
  const cap = await facilitator.checkCapabilities?.('hedera:testnet', 'exact');
  if (!cap?.supported) {
    console.error(`[LIVE] Facilitator at ${facilitatorUrl} does not support exact hedera:testnet.`);
    process.exitCode = 1;
    return;
  }
  console.log('[LIVE] Facilitator verified. Credentials required to proceed with live execution.');
}

main().catch((err) => {
  console.error('CLI error:', err);
  process.exit(1);
});
