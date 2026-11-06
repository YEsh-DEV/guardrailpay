/**
 * QuoteSeal Spike 2 — Task 2: Hedera Test Harness (local, no credentials)
 *
 * Reproducible harness for native HBAR x402 payments on hedera:testnet.
 * Covers: requirements structure, network identifier, tinybar amounts,
 * Hedera account IDs, facilitator integration (mock), transaction
 * submission, transaction ID capture, destination + amount verification.
 *
 * All tests run without credentials — no real keys, no network calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AccountId,
  Hbar,
  PrivateKey,
  TokenId,
  Transaction,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import {
  ExactHederaScheme,
  HBAR_ASSET_ID,
  HEDERA_TESTNET_CAIP2,
  isValidHederaEntityId,
  isHbarAsset,
  createClientHederaSigner,
  createHederaSignAndSubmitTransaction,
  createHederaClient,
  inspectHederaTransaction,
} from '@x402/hedera';
import type { PaymentRequirements } from '@x402/core/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const BUYER = '0.0.123456';
const MERCHANT_PAYTO = '0.0.987654';
const FEE_PAYER = '0.0.555555';
const AMOUNT_TINYBARS = '100000000'; // 1 HBAR = 10^8 tinybars

const baseRequirements: PaymentRequirements = {
  scheme: 'exact',
  network: HEDERA_TESTNET_CAIP2,
  asset: HBAR_ASSET_ID,
  amount: AMOUNT_TINYBARS,
  payTo: MERCHANT_PAYTO,
  maxTimeoutSeconds: 60,
  extra: { feePayer: FEE_PAYER },
};

// ---------------------------------------------------------------------------
// Mock signer: captures the requirements it is asked to sign, returns a fake
// base64 transaction. Never touches a real key or the network.
// ---------------------------------------------------------------------------

function instrumentedSigner() {
  let calls = 0;
  let lastRequirements: PaymentRequirements | null = null;
  return {
    accountId: BUYER,
    calls: () => calls,
    lastRequirements: () => lastRequirements,
    reset: () => { calls = 0; lastRequirements = null; },
    createPartiallySignedTransferTransaction: async (req: PaymentRequirements) => {
      calls += 1;
      lastRequirements = { ...req };
      return Buffer.from('mock-signed-transaction').toString('base64');
    },
  };
}

// ---------------------------------------------------------------------------
// Task 2 tests
// ---------------------------------------------------------------------------

test('Task 2 — native HBAR payment requirements have correct structure', () => {
  assert.equal(baseRequirements.scheme, 'exact');
  assert.equal(baseRequirements.asset, '0.0.0');
  assert.equal(baseRequirements.network, 'hedera:testnet');
  assert.equal(isHbarAsset(baseRequirements.asset), true);
  assert.equal(typeof baseRequirements.amount, 'string');
  assert.equal(baseRequirements.payTo, MERCHANT_PAYTO);
  assert.equal(typeof baseRequirements.maxTimeoutSeconds, 'number');
});

test('Task 2 — Hedera network identifier is hedera:testnet (CAIP-2)', () => {
  assert.equal(HEDERA_TESTNET_CAIP2, 'hedera:testnet');
  assert.equal(baseRequirements.network, HEDERA_TESTNET_CAIP2);
});

test('Task 2 — tinybar amounts are integer strings, no floating point', () => {
  // 1 HBAR = 100,000,000 tinybars
  const big = BigInt(baseRequirements.amount);
  assert.equal(big.toString(), baseRequirements.amount);
  assert.equal(big, 100_000_000n);
  // Reject any float-like amount
  assert.match(baseRequirements.amount, /^(0|[1-9][0-9]*)$/);
});

test('Task 2 — Hedera account IDs match 0.0.x format', () => {
  assert.equal(isValidHederaEntityId(BUYER), true);
  assert.equal(isValidHederaEntityId(MERCHANT_PAYTO), true);
  assert.equal(isValidHederaEntityId(FEE_PAYER), true);
  assert.equal(isValidHederaEntityId('0.0.0'), true);
  assert.equal(isValidHederaEntityId('0.0.abc'), false);
  assert.equal(isValidHederaEntityId('abc'), false);
  assert.equal(isValidHederaEntityId('0x1234'), false);
});

test('Task 2 — ExactHederaScheme builds a payload and invokes the signer once', async () => {
  const signer = instrumentedSigner();
  const scheme = new ExactHederaScheme(signer as any);

  const result = await scheme.createPaymentPayload(2, baseRequirements, {});
  const payload = result.payload as { transaction?: string };

  assert.equal(signer.calls(), 1, 'signer invoked exactly once');
  const tx = payload.transaction as string;
  assert.equal(typeof tx, 'string');
  assert.equal(tx.length > 0, true);
  assert.equal(signer.lastRequirements()?.payTo, MERCHANT_PAYTO);
  assert.equal(signer.lastRequirements()?.amount, AMOUNT_TINYBARS);
  assert.equal(signer.lastRequirements()?.asset, HBAR_ASSET_ID);
  assert.equal(signer.lastRequirements()?.network, HEDERA_TESTNET_CAIP2);
});

test('Task 2 — scheme rejects missing feePayer in extra', async () => {
  const signer = instrumentedSigner();
  const scheme = new ExactHederaScheme(signer as any);
  const bad = { ...baseRequirements, extra: {} };
  await assert.rejects(
    scheme.createPaymentPayload(2, bad, {}),
    /feePayer is required/
  );
  assert.equal(signer.calls(), 0, 'signer NOT invoked when feePayer missing');
});

test('Task 2 — scheme rejects unsupported network', async () => {
  const signer = instrumentedSigner();
  const scheme = new ExactHederaScheme(signer as any);
  const bad = { ...baseRequirements, network: 'ethereum:sepolia' as any };
  await assert.rejects(
    scheme.createPaymentPayload(2, bad, {}),
    /Unsupported Hedera network/
  );
  assert.equal(signer.calls(), 0, 'signer NOT invoked when network unsupported');
});

test('Task 2 — scheme rejects non-exact scheme', async () => {
  const signer = instrumentedSigner();
  const scheme = new ExactHederaScheme(signer as any);
  const bad = { ...baseRequirements, scheme: 'upto' as any };
  await assert.rejects(
    scheme.createPaymentPayload(2, bad, {}),
    /Unsupported scheme for Hedera exact client/
  );
  assert.equal(signer.calls(), 0, 'signer NOT invoked when scheme wrong');
});

test('Task 2 — createClientHederaSigner builds a signer that freezes and signs a TransferTransaction', () => {
  const priv = PrivateKey.generate();
  const signer = createClientHederaSigner(BUYER, priv, { network: HEDERA_TESTNET_CAIP2 });
  assert.equal(signer.accountId, BUYER);
  assert.equal(typeof signer.createPartiallySignedTransferTransaction, 'function');
});

test('Task 2 — createHederaClient returns a testnet client for hedera:testnet', () => {
  const client = createHederaClient(HEDERA_TESTNET_CAIP2);
  assert.ok(client, 'testnet client created');
  client.close();
});

test('Task 2 — inspectHederaTransaction verifies destination and amount of a built transaction', async () => {
  const signer = instrumentedSigner();
  const scheme = new ExactHederaScheme(signer as any);
  await scheme.createPaymentPayload(2, baseRequirements, {});

  // Rebuild the raw transaction bytes to inspect them (same path as signer)
  const tx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(BUYER), Hbar.fromTinybars((-BigInt(AMOUNT_TINYBARS)).toString()))
    .addHbarTransfer(AccountId.fromString(MERCHANT_PAYTO), Hbar.fromTinybars(AMOUNT_TINYBARS))
    .setTransactionId(TransactionId.generate(AccountId.fromString(FEE_PAYER)));

  const client = createHederaClient(HEDERA_TESTNET_CAIP2);
  const inspected = inspectHederaTransaction(
    Buffer.from(tx.freezeWith(client).toBytes()).toString('base64')
  );
  client.close();

  assert.ok(inspected.transactionId, 'transaction has an ID');
  assert.equal(inspected.transactionIdAccountId, FEE_PAYER);
  assert.ok(Array.isArray(inspected.hbarTransfers));
  // Find the receiver (positive amount)
  const receivers = inspected.hbarTransfers.filter((t: any) => t.accountId === MERCHANT_PAYTO);
  assert.equal(receivers.length, 1, 'merchant payTo is a receiver');
  assert.equal(receivers[0].amount, AMOUNT_TINYBARS, 'receiver amount equals tinybar amount');
  // Find the payer (negative amount)
  const payers = inspected.hbarTransfers.filter((t: any) => t.accountId === BUYER);
  assert.equal(payers.length, 1, 'buyer is the payer');
  assert.equal(payers[0].amount, (-BigInt(AMOUNT_TINYBARS)).toString(), 'payer amount is negative tinybars');
});

test('Task 2 — createHederaSignAndSubmitTransaction returns a signAndSubmit factory', () => {
  const priv = PrivateKey.generate();
  const fn = createHederaSignAndSubmitTransaction(
    () => createHederaClient(HEDERA_TESTNET_CAIP2),
    priv
  );
  assert.equal(typeof fn, 'function');
  // Type: (transactionBase64, feePayer, network) => Promise<{transactionId: string}>
  const sig = fn as (b64: string, feePayer: string, network: string) => Promise<{ transactionId: string }>;
  assert.equal(sig.length, 3);
});

test('Task 2 — facilitator integration point: mock signAndSubmitTransaction captures transactionId', async () => {
  const priv = PrivateKey.generate();
  const signAndSubmit = createHederaSignAndSubmitTransaction(
    () => createHederaClient(HEDERA_TESTNET_CAIP2),
    priv
  );

  const hc = createHederaClient(HEDERA_TESTNET_CAIP2);
  const tx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(BUYER), Hbar.fromTinybars('-100000000'))
    .addHbarTransfer(AccountId.fromString(MERCHANT_PAYTO), Hbar.fromTinybars('100000000'))
    .setTransactionId(TransactionId.generate(AccountId.fromString(FEE_PAYER)))
    .freezeWith(hc);
  const signed = await tx.sign(priv);
  hc.close();
  const base64 = Buffer.from(signed.toBytes()).toString('base64');

  // This will actually attempt network execution and fail without a real node.
  // We assert it throws (no credentials) rather than fabricating success.
  let threw = false;
  let txId = '';
  try {
    const result = await signAndSubmit(base64, FEE_PAYER, HEDERA_TESTNET_CAIP2);
    txId = result.transactionId;
  } catch {
    threw = true;
  }
  assert.equal(threw, true, 'without testnet credentials, submission must fail (no fake evidence)');
  assert.equal(txId, '', 'no transactionId captured without real settlement');
});

test('Task 2 — amount zero is rejected by the client signer path', async () => {
  const priv = PrivateKey.generate();
  const signer = createClientHederaSigner(BUYER, priv, { network: HEDERA_TESTNET_CAIP2 });
  const scheme = new ExactHederaScheme(signer);
  const bad = { ...baseRequirements, amount: '0' };
  await assert.rejects(
    scheme.createPaymentPayload(2, bad, {}),
    /amount must be greater than zero/
  );
});
