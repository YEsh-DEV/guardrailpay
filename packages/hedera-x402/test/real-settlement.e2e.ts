/**
 * Standalone End-to-End Live Hedera Testnet Settlement & Verification Runner.
 *
 * Requirements:
 * - HEDERA_BUYER_ACCOUNT_ID
 * - HEDERA_BUYER_PRIVATE_KEY
 * - HEDERA_MERCHANT_ACCOUNT_ID
 *
 * Flow:
 * 1. Creates a real merchant payment challenge for 1 HBAR (100000000 tinybars).
 * 2. Buyer signs and submits real TransferTransaction to Hedera Testnet.
 * 3. Buyer creates cryptographically signed payment proof payload.
 * 4. Awaits Hedera Mirror Node indexing.
 * 5. Merchant independently verifies proof on-chain (reconciliation + signature check).
 * 6. Merchant checks SQLite replay protection (ACCEPTED).
 * 7. Merchant attempts duplicate verification -> rejected as REPLAYED.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import {
  createX402Challenge,
  executeHederaPayment,
  verifyPaymentProof,
  SqliteReplayProtection,
  X402PaymentTerms,
} from '../src/index.js';

async function runLiveTestnetSettlement() {
  console.log('================================================================');
  console.log(' Hedera Testnet End-to-End Settlement & Verification Test');
  console.log('================================================================\n');

  const buyerId = process.env.HEDERA_BUYER_ACCOUNT_ID;
  const buyerKey = process.env.HEDERA_BUYER_PRIVATE_KEY;
  const merchantId = process.env.HEDERA_MERCHANT_ACCOUNT_ID;

  if (!buyerId || !buyerKey || !merchantId) {
    console.error('ERROR: Missing required Hedera credentials in .env');
    console.error({
      hasBuyerId: !!buyerId,
      hasBuyerKey: !!buyerKey,
      hasMerchantId: !!merchantId,
    });
    process.exit(1);
  }

  console.log('Participants:');
  console.log(`- Buyer Account:    ${buyerId}`);
  console.log(`- Merchant Account: ${merchantId}`);
  console.log(`- Network:          Hedera Testnet\n`);

  // Step 1: Merchant creates challenge
  const referenceId = `e2e_settlement_${Date.now()}`;
  const terms: X402PaymentTerms = {
    network: 'hedera:testnet',
    asset: 'HBAR',
    payTo: merchantId,
    amount: '100000000', // 1 HBAR
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    referenceId,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  };

  const challenge = createX402Challenge(terms);
  console.log('Step 1: Merchant Challenge Created');
  console.log(`- Status Code:  ${challenge.statusCode}`);
  console.log(`- Reference ID: ${referenceId}`);
  console.log(`- Amount:       1 HBAR (${terms.amount} tinybars)`);
  console.log(`- Pay To:       ${terms.payTo}\n`);

  // Step 2: Buyer executes real payment on Hedera Testnet
  console.log('Step 2: Submitting Real Payment to Hedera Testnet consensus nodes...');
  const startTime = Date.now();
  const paymentResult = await executeHederaPayment(terms, { mode: 'real' });
  const submissionDuration = Date.now() - startTime;

  console.log(`Payment successfully submitted and consensus receipt received in ${submissionDuration}ms!`);
  console.log(`- Transaction ID:        ${paymentResult.receipt.transactionId}`);
  console.log(`- Consensus Timestamp:   ${paymentResult.receipt.consensusTimestamp}`);
  console.log(`- HashScan Explorer URL: ${paymentResult.receipt.hashScanUrl}`);
  console.log(`- Payment Proof (bytes): ${paymentResult.paymentProof.length}\n`);

  // Step 3: Await mirror node consensus indexing
  console.log('Step 3: Awaiting Hedera Mirror Node indexing...');
  const maxWaitMs = 15000;
  const pollIntervalMs = 2000;
  const pollStart = Date.now();
  let mirrorReady = false;

  const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${paymentResult.receipt.transactionId.replace('@', '-').replace('.', '-')}`;

  while (Date.now() - pollStart < maxWaitMs) {
    try {
      const res = await fetch(mirrorUrl);
      if (res.ok) {
        const body = (await res.json()) as any;
        if (body.transactions && body.transactions.length > 0) {
          mirrorReady = true;
          console.log(`Mirror Node indexed transaction in ${Date.now() - pollStart}ms!`);
          break;
        }
      }
    } catch {
      // Continue polling
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (!mirrorReady) {
    console.warn('Warning: Mirror node taking longer than usual to index; proceeding to verification attempt');
  }

  // Step 4: Merchant independently verifies proof
  console.log('Step 4: Merchant Independently Verifying Payment Proof...');
  const sqliteDb = new Database(':memory:');
  const replay = new SqliteReplayProtection(sqliteDb);

  const verificationConfig = {
    network: 'hedera:testnet',
    timeoutMs: 8000,
    supportedSchemes: [
      {
        scheme: 'exact',
        network: 'hedera:testnet',
        verifiableWithoutFacilitator: true,
      },
      {
        scheme: 'hedera',
        network: 'hedera:testnet',
        verifiableWithoutFacilitator: true,
      },
    ],
  };

  const verificationResult = await verifyPaymentProof(
    paymentResult.paymentProof,
    terms,
    verificationConfig,
    replay
  );

  console.log('Verification Outcome:');
  console.log(`- Result Type: ${verificationResult.type}`);

  if (verificationResult.type !== 'VERIFIED') {
    console.error('FAILED: Verification did not return VERIFIED:', verificationResult);
    process.exit(1);
  }

  console.log(`- Verified Payer:              ${verificationResult.payload.payer}`);
  console.log(`- Verified Recipient:          ${verificationResult.payload.payTo}`);
  console.log(`- Verified Amount:             ${verificationResult.payload.amount} tinybars`);
  console.log(`- On-Chain Consensus Result:   ${verificationResult.onChainRecord?.result}`);
  console.log(`- On-Chain Consensus Timestamp:${verificationResult.onChainRecord?.consensusTimestamp}`);
  console.log(`- On-Chain Bound Memo:         ${verificationResult.onChainRecord?.memo}\n`);

  // Step 5: Merchant tests replay rejection
  console.log('Step 5: Testing Replay Prevention...');
  const replayResult = await verifyPaymentProof(
    paymentResult.paymentProof,
    terms,
    verificationConfig,
    replay
  );

  console.log(`- Replay Attempt Result: ${replayResult.type}`);
  if (replayResult.type !== 'REPLAYED') {
    console.error('FAILED: Duplicate proof was not rejected as REPLAYED:', replayResult);
    process.exit(1);
  }
  console.log(`- Replay Rejection Reason: ${replayResult.reason}\n`);

  console.log('================================================================');
  console.log(' ALL HEDERA TESTNET LIVE SETTLEMENT CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runLiveTestnetSettlement().catch((err) => {
  console.error('Live Testnet Settlement Error:', err);
  process.exit(1);
});
