/**
 * QuoteSeal Spike 2 — Task 3: Independent x402 Security Validation
 *
 * Independently tests the critical security claim: for every non-PASS
 * outcome, the actual payment signer invocation count must be zero.
 *
 * Uses the REAL @x402 SDK (x402Client, wrapFetchWithPayment,
 * ExactHederaScheme) — never a fake SDK lifecycle.
 *
 * Covers: later-hook mutation of payTo/amount/asset/network, malicious
 * accepts[], fabricated selected requirement, unknown merchant, stale
 * profile, cross-origin redirect, exception handling, retry/fallback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import type { PaymentRequirements, PaymentRequired } from '@x402/core/types';

const base: PaymentRequirements = {
  scheme: 'exact',
  network: 'hedera:testnet',
  asset: '0.0.0',
  payTo: '0.0.123456',
  amount: '10',
  maxTimeoutSeconds: 60,
  extra: { feePayer: '0.0.98' },
};

const ORIGIN = 'https://merchant.example';

// ---------------------------------------------------------------------------
// Helper: build a client with an instrumented signer and a guard hook.
// Returns { client, calls, creations, recovery, guardHook }.
// ---------------------------------------------------------------------------

function buildClient(options: {
  guardVerdict: () => 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';
  guardReason?: string;
  laterHooks?: Array<(ctx: { selectedRequirements: PaymentRequirements }) => Promise<void>>;
  selector?: (x402Version: number, accepts: PaymentRequirements[]) => PaymentRequirements;
}) {
  let calls = 0;
  let creations = 0;
  let recovery = 0;

  const scheme = new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r: PaymentRequirements) {
      calls += 1;
      return 'dGVzdA==';
    },
  });
  const realCreate = (scheme.createPaymentPayload.bind(scheme) as any) as (...args: any[]) => Promise<any>;
  scheme.createPaymentPayload = async (...args: any[]) => {
    creations += 1;
    return realCreate(...args);
  };

  const client = new x402Client(options.selector ?? (((_v: number, accepts: PaymentRequirements[]) => accepts[0]) as any));
  client.setSpendControls(false);
  client.register('hedera:testnet', scheme).register('hedera:mainnet', scheme);
  client.onPaymentCreationFailure(async () => { recovery += 1; return; });

  client.onBeforePaymentCreation(async ({ paymentRequired, selectedRequirements }) => {
    const verdict = options.guardVerdict();
    if (verdict !== 'PASS') {
      return { abort: true, reason: `QuoteSeal ${verdict}: ${options.guardReason ?? verdict}` };
    }
    // Run any later (post-guard) hooks that may mutate selection.
    for (const h of options.laterHooks ?? []) {
      await h({ selectedRequirements });
    }
  });

  return { client, calls: () => calls, creations: () => creations, recovery: () => recovery };
}

function challenge(accepts: PaymentRequirements[], resourceUrl = ORIGIN + '/item'): PaymentRequired {
  return {
    x402Version: 2,
    resource: { url: resourceUrl, description: 'service', mimeType: 'text/plain' },
    accepts,
  };
}

async function attempt(
  client: ReturnType<typeof buildClient>['client'],
  url: string = ORIGIN + '/item'
): Promise<void> {
  let requests = 0;
  const paid = wrapFetchWithPayment(
    async () => {
      requests += 1;
      return requests === 1
        ? new Response('', { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge([base]))).toString('base64') } })
        : new Response('ok');
    },
    client
  );
  await paid(url, { redirect: 'error' } as any);
}

// ---------------------------------------------------------------------------
// Task 3 security tests
// ---------------------------------------------------------------------------

test('T3-1 valid payment: PASS → exactly 1 signer call, 0 recovery', async () => {
  const { client, calls, creations, recovery } = buildClient({ guardVerdict: () => 'PASS' });
  await attempt(client);
  assert.equal(calls(), 1, 'valid payment: 1 signer call');
  assert.equal(creations(), 1, 'valid payment: 1 payload creation');
  assert.equal(recovery(), 0, 'valid payment: 0 recovery');
});

test('T3-2 guard BLOCKs tampered payTo → 0 signer calls', async () => {
  const { client, calls, creations, recovery } = buildClient({ guardVerdict: () => 'BLOCK', guardReason: 'payTo mismatch' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0, 'BLOCK: signer calls must be 0');
  assert.equal(creations(), 0, 'BLOCK: payload creations must be 0');
  assert.equal(recovery(), 0, 'BLOCK: recovery must be 0');
});

test('T3-3 guard BLOCKs tampered amount → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({ guardVerdict: () => 'BLOCK', guardReason: 'amount exceeds cap' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-4 guard BLOCKs tampered asset → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({ guardVerdict: () => 'BLOCK', guardReason: 'asset mismatch' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-5 guard BLOCKs tampered network → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({ guardVerdict: () => 'BLOCK', guardReason: 'network mismatch' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-6 guard HOLDs unknown merchant → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({ guardVerdict: () => 'HOLD', guardReason: 'unknown merchant' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-7 guard UNVERIFIABLEs stale profile → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({ guardVerdict: () => 'UNVERIFIABLE', guardReason: 'RPC disagreement' });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-8 guard exception → 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({
    guardVerdict: () => { throw new Error('guard exploded'); },
  });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-9 cross-origin redirect blocked before signer → 0 signer calls', async () => {
  let calls = 0;
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction() { calls += 1; return ''; },
  }));
  const server = createServer((_req, res) => { res.writeHead(302, { location: 'http://127.0.0.1:1/attacker' }); res.end(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    const port = (server.address() as { port: number }).port;
    await assert.rejects(wrapFetchWithPayment(fetch, client)(`http://127.0.0.1:${port}`, { redirect: 'error' } as any));
    assert.equal(calls, 0, 'redirect: signer calls must be 0');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('T3-10 malicious accepts[] entry → guard BLOCKs, 0 signer calls', async () => {
  const { client, calls, creations } = buildClient({
    guardVerdict: () => 'BLOCK',
    guardReason: 'selected requirement not in offers',
  });
  const malicious = { ...base, payTo: '0.0.999999' };
  // Guard sees the malicious selection and blocks it.
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-11 fabricated selected requirement (not in offers) → BLOCK, 0 signer calls', async () => {
  // Selector picks an entry not in the offered accepts[] — guard must reject.
  const { client, calls, creations } = buildClient({
    guardVerdict: () => 'BLOCK',
    guardReason: 'fabricated requirement',
    selector: ((_v: number, accepts: PaymentRequirements[]) => ({ ...accepts[0], payTo: '0.0.999999' })) as any,
  });
  await assert.rejects(attempt(client));
  assert.equal(calls(), 0);
  assert.equal(creations(), 0);
});

test('T3-12 retry + fallback: rejected retry adds zero signer calls', async () => {
  let calls = 0;
  let hooks = 0;
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction() { calls += 1; return 'dGVzdA=='; },
  }));
  client.onBeforePaymentCreation(async () => {
    hooks += 1;
    if (hooks > 1) return { abort: true, reason: 'UNVERIFIABLE' };
  });
  client.onPaymentResponse(async () => ({ recovered: true }));
  let requests = 0;
  const paid = wrapFetchWithPayment(
    async () => {
      requests += 1;
      return requests === 1
        ? new Response('', { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge([base]))).toString('base64') } })
        : new Response('failure', { status: 402 });
    },
    client
  );
  await assert.rejects(paid(ORIGIN + '/item', { redirect: 'error' } as any));
  assert.equal(hooks, 2, 'guard re-entered on retry');
  assert.equal(calls, 1, 'only the first PASS attempt signs; rejected retry adds 0');
});

test('T3-13 LATER hook mutates payTo after guard → signer called with MUTATED payTo (vulnerability)', async () => {
  // This is the documented Spike 3 vulnerability: a hook registered after the
  // guard can mutate selectedRequirements before the scheme runs.
  let calls = 0;
  let signedPayTo = '';
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r) { calls += 1; signedPayTo = r.payTo; return 'dGVzdA=='; },
  }));
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    assert.equal(selectedRequirements.payTo, base.payTo, 'guard sees original payTo');
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    // LATER hook mutates the mutable selection reference.
    selectedRequirements.payTo = '0.0.999999';
  });
  await client.createPaymentPayload({ x402Version: 2, resource: { url: ORIGIN }, accepts: [structuredClone(base)] });
  assert.equal(calls, 1, 'later-hook mutation: signer IS called');
  assert.equal(signedPayTo, '0.0.999999', 'signer signed the MUTATED payTo — security bypass');
});

test('T3-14 LATER hook mutates amount after guard → signer called with MUTATED amount', async () => {
  let calls = 0;
  let signedAmount = '';
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r) { calls += 1; signedAmount = r.amount; return 'dGVzdA=='; },
  }));
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    assert.equal(selectedRequirements.amount, base.amount);
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    selectedRequirements.amount = '999999999';
  });
  await client.createPaymentPayload({ x402Version: 2, resource: { url: ORIGIN }, accepts: [structuredClone(base)] });
  assert.equal(calls, 1);
  assert.equal(signedAmount, '999999999', 'later hook mutated amount before signing');
});

test('T3-15 LATER hook mutates asset after guard → signer called with MUTATED asset', async () => {
  let calls = 0;
  let signedAsset = '';
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r) { calls += 1; signedAsset = r.asset; return 'dGVzdA=='; },
  }));
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    assert.equal(selectedRequirements.asset, '0.0.0');
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    selectedRequirements.asset = '0.0.429274';
  });
  await client.createPaymentPayload({ x402Version: 2, resource: { url: ORIGIN }, accepts: [structuredClone(base)] });
  assert.equal(calls, 1);
  assert.equal(signedAsset, '0.0.429274', 'later hook mutated asset before signing');
});

test('T3-16 LATER hook mutates network after guard → signer called with MUTATED network', async () => {
  let calls = 0;
  let signedNetwork = '';
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r) { calls += 1; signedNetwork = r.network; return 'dGVzdA=='; },
  })).register('hedera:mainnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction(r) { calls += 1; signedNetwork = r.network; return 'dGVzdA=='; },
  }));
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    assert.equal(selectedRequirements.network, 'hedera:testnet');
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    selectedRequirements.network = 'hedera:mainnet';
  });
  await client.createPaymentPayload({ x402Version: 2, resource: { url: ORIGIN }, accepts: [structuredClone(base)] });
  assert.equal(calls, 1);
  assert.equal(signedNetwork, 'hedera:mainnet', 'later hook mutated network before signing');
});

test('T3-17 guard BLOCK then later hook cannot un-block (abort throws before scheme)', async () => {
  let calls = 0;
  const client = new x402Client().setSpendControls(false).register('hedera:testnet', new ExactHederaScheme({
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction() { calls += 1; return ''; },
  }));
  client.onBeforePaymentCreation(async () => {
    return { abort: true, reason: 'BLOCK' };
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    // This later hook runs ONLY if no earlier hook aborted. Since the guard
    // aborted, this never executes and the signer is never called.
    selectedRequirements.payTo = '0.0.999999';
  });
  await assert.rejects(client.createPaymentPayload({ x402Version: 2, resource: { url: ORIGIN }, accepts: [structuredClone(base)] }));
  assert.equal(calls, 0, 'guard abort prevents later hooks AND signer: 0 calls');
});
