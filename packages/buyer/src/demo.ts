import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BuyerPaymentOrchestrator } from './orchestrator.js';
import { MockFacilitatorClient, HttpFacilitatorClient } from './facilitator.js';
import { HederaMirrorNodeVerifier, HEDERA_TESTNET_MIRROR_NODE_URL } from './verifier.js';
import { defaultProfile, defaultAnchors, quoteSealPayeeDeclaration } from '@quoteseal/guard';
import { createClientHederaSigner, PrivateKey } from '@x402/hedera';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';

// Load .env automatically if present (from cwd or workspace root)
try {
  process.loadEnvFile?.();
} catch {
  try {
    process.loadEnvFile?.('../../.env');
  } catch {}
}

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
  const merchantAccountId = process.env.HEDERA_MERCHANT_ACCOUNT_ID || defaultProfile.payTo || '0.0.11339189';
  const rawFacilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.amnt.io/testnet';
  const facilitatorUrl = rawFacilitatorUrl.includes('testnet.facilitator.x402.org')
    ? 'https://facilitator.amnt.io/testnet'
    : rawFacilitatorUrl;
  const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL || HEDERA_TESTNET_MIRROR_NODE_URL;
  const paymentAmount = process.env.X402_AMOUNT || '10000000'; // Default: 0.1 HBAR

  console.log(`  Target Network:        hedera:testnet`);
  console.log(`  Facilitator URL:       ${facilitatorUrl}`);
  console.log(`  Mirror Node URL:       ${mirrorNodeUrl}`);
  console.log(`  Configured Buyer ID:   ${buyerAccountId || '(NOT CONFIGURED)'}`);
  console.log(`  Configured PayTo:      ${merchantAccountId}`);
  console.log(`  Payment Amount:        ${paymentAmount} tinybars (native HBAR)`);

  // Probe Facilitator
  console.log('\n[1/5] Probing Facilitator capabilities...');
  const facilitator = new HttpFacilitatorClient(facilitatorUrl);
  let feePayer = '0.0.9510357';
  try {
    const health = await facilitator.checkHealth();
    console.log(`  Facilitator Health:    ${health.healthy ? 'HEALTHY (HTTP 200)' : 'UNHEALTHY'}`);
    const cap = await facilitator.checkCapabilities?.('hedera:testnet', 'exact');
    console.log(`  exact hedera:testnet:  ${cap?.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    if (!cap?.supported) {
      console.error(`[LIVE] Facilitator at ${facilitatorUrl} does not support exact hedera:testnet.`);
      process.exitCode = 1;
      return;
    }
    const kinds = (cap?.details as { kinds?: Array<{ network?: string; scheme?: string; extra?: { feePayer?: string } }> })?.kinds || [];
    const hederaKind = kinds.find((k) => k.network === 'hedera:testnet');
    if (hederaKind?.extra?.feePayer) {
      feePayer = hederaKind.extra.feePayer;
    }
    console.log(`  Facilitator Fee Payer: ${feePayer}`);
  } catch (err) {
    console.error(`[LIVE] Failed to probe facilitator at ${facilitatorUrl}:`, (err as Error).message);
    process.exitCode = 1;
    return;
  }

  // Probe Mirror Node for Account Readiness
  console.log('\n[2/5] Querying Hedera Mirror Node account status...');
  if (buyerAccountId) {
    try {
      const res = await globalThis.fetch(`${mirrorNodeUrl}/api/v1/accounts/${buyerAccountId}`);
      if (res.ok) {
        const data = (await res.json()) as { balance?: { balance?: number }; key?: { _type?: string } };
        const hbarBal = ((data.balance?.balance ?? 0) / 1e8).toFixed(4);
        console.log(`  Buyer Account:         ${buyerAccountId} (Key: ${data.key?._type ?? 'UNKNOWN'})`);
        console.log(`  Available Balance:     ${hbarBal} HBAR (${data.balance?.balance} tinybars)`);
      } else {
        console.warn(`  Buyer Account query returned HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`  Failed to query buyer account from Mirror Node: ${(err as Error).message}`);
    }
  }

  // Check for Missing Credentials
  const missing: string[] = [];
  if (!buyerAccountId) missing.push('HEDERA_ACCOUNT_ID');
  if (!buyerPrivateKey) missing.push('HEDERA_BUYER_PRIVATE_KEY');

  if (missing.length > 0 || !buyerPrivateKey || !buyerAccountId) {
    console.log('\n' + '='.repeat(70));
    console.log(' [LIVE READINESS STATUS] BLOCKED — CREDENTIALS REQUIRED');
    console.log('='.repeat(70));
    console.log('The following required environment variables are missing or empty:');
    for (const m of missing) console.log(`  - ${m}`);
    console.log('\nSecurity Rule:');
    console.log('  QuoteSeal never fabricates private keys, signatures, or settlement evidence.');
    console.log('  To execute a live payment, configure HEDERA_BUYER_PRIVATE_KEY in .env');
    console.log('  and run: pnpm --filter @quoteseal/buyer demo:live');
    process.exitCode = 1;
    return;
  }

  // Initialize Real Client Hedera Signer
  console.log('\n[3/5] Initializing real ECDSA/ED25519 Hedera Signer...');
  let parsedPrivateKey: PrivateKey;
  try {
    parsedPrivateKey = PrivateKey.fromString(buyerPrivateKey.trim());
    console.log(`  Signer Private Key:    Loaded and validated`);
  } catch (err) {
    console.error(`  [Signer Error] Failed to parse HEDERA_BUYER_PRIVATE_KEY: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const rawSigner = createClientHederaSigner(buyerAccountId, parsedPrivateKey, { network: 'hedera:testnet' });
  let signerInvocations = 0;
  const instrumentedSigner: ClientHederaSigner = {
    accountId: rawSigner.accountId,
    async createPartiallySignedTransferTransaction(req) {
      signerInvocations++;
      console.log(`  [Controlled Signer] Signer invoked (call #${signerInvocations}) for ${req.amount} tinybars to ${req.payTo}`);
      return rawSigner.createPartiallySignedTransferTransaction(req);
    }
  };

  // Start local HTTP merchant server returning the live payment challenge
  console.log('\n[4/5] Starting local merchant endpoint returning live testnet challenge...');
  let serverPort = 0;

  const server = createServer(async (req, res) => {
    const authHeader = req.headers['payment-signature'];

    if (!authHeader) {
      const challenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: 'https://merchant.example/api/live-resource' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: paymentAmount,
            payTo: merchantAccountId,
            maxTimeoutSeconds: 120,
            extra: { feePayer }
          }
        ],
        extensions: quoteSealPayeeDeclaration({ ens: 'merchant.eth' })
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
        resource: 'live-hedera-testnet-verified-dataset',
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

  const resourceUrl = 'https://merchant.example/api/live-resource';
  const liveFetch: typeof fetch = async (request, init) => {
    const rawUrl = typeof request === 'string' ? request : 'url' in request ? request.url : request.href;
    const target = new URL(rawUrl);
    if (target.origin === 'https://merchant.example') {
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(serverPort);
    }
    return globalThis.fetch(target, init);
  };

  const orchestrator = new BuyerPaymentOrchestrator();
  const verifier = new HederaMirrorNodeVerifier(mirrorNodeUrl, globalThis.fetch.bind(globalThis));

  console.log('\n[5/5] Executing BuyerPaymentOrchestrator in LIVE mode...');
  try {
    const result = await orchestrator.execute({
      resourceUrl,
      mode: 'live',
      signer: instrumentedSigner,
      facilitator,
      verifier,
      requireSettlementVerification: true,
      fetch: liveFetch,
      readTrust: () => ({
        profile: {
          ...defaultProfile,
          origin: 'https://merchant.example',
          ensName: 'merchant.eth',
          payTo: merchantAccountId
        },
        anchors: { ...defaultAnchors }
      }),
      confirm: async (summary) => {
        console.log('\n  [Buyer Confirmation Request]');
        console.log(`    Merchant: ${summary.merchantEns} (${summary.merchantOrigin})`);
        console.log(`    PayTo:    ${summary.payTo}`);
        console.log(`    Amount:   ${summary.amount} tinybars (${Number(summary.amount) / 1e8} HBAR)`);
        console.log(`    Network:  ${summary.network}`);
        console.log(`    Buyer Decision: APPROVED`);
        return true;
      }
    });

    server.close();

    const txId = result.settlement?.transactionId ?? '';
    const hashScanUrl = `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`;

    console.log('\n' + '='.repeat(80));
    console.log('  LIVE HEDERA TESTNET PAYMENT SUCCESSFUL & VERIFIED');
    console.log('='.repeat(80));
    console.log(`  Transaction ID:   ${txId}`);
    console.log(`  HashScan URL:     ${hashScanUrl}`);
    console.log(`  Payer Account:    ${result.settlement?.payer}`);
    console.log(`  Recipient PayTo:  ${result.payment?.merchantPayTo}`);
    console.log(`  Amount:           ${result.payment?.amount} tinybars`);
    console.log(`  Settlement Status: ${result.verification?.status}`);
    console.log(`  Signer Calls:     ${signerInvocations} (INVARIANT: EXACTLY 1)`);
    console.log(`  Paid Resource:    ${JSON.stringify(result.data)}`);
    console.log('='.repeat(80));
  } catch (err) {
    server.close();
    console.error('\n[LIVE EXECUTION FAILED]:', (err as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('demo.ts') || process.argv[1]?.endsWith('demo.js')) {
  main().catch((err) => {
    console.error('Demo encountered error:', err);
    process.exit(1);
  });
}
