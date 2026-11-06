import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, defaultAnchors } from '../../packages/guard/dist/index.js';
import { confirmedPayment } from './confirmed-payment.mjs';

function fixture(payTo = defaultProfile.payTo) {
  let calls = 0;
  const input = {
    originalUrl: 'https://merchant.example/resource', selectedIndex: 0,
    firstSeen: 1000, now: () => 1001,
    readTrust: () => ({ profile: { ...defaultProfile }, anchors: { ...defaultAnchors } }),
    challenge: { x402Version: 2, resource: { url: 'https://merchant.example/resource' }, accepts: [{
      scheme: 'exact', network: 'hedera:testnet', asset: '0.0.0', payTo,
      amount: '10', maxTimeoutSeconds: 60, extra: { feePayer: '0.0.98' }
    }] }
  };
  const signer = { accountId: '0.0.42', async createPartiallySignedTransferTransaction(r) {
    calls++; assert.equal(r.payTo, defaultProfile.payTo); assert.equal(r.amount, '10');
    return 'dGVzdA=='; // Explicit test double: no real transaction or settlement.
  } };
  return { input, signer, calls: () => calls };
}
for (const answer of [false, undefined, 'yes']) test(`no explicit confirmation (${answer}): zero signer calls`, async () => {
  const f = fixture(); await assert.rejects(confirmedPayment(f.input, f.signer, async () => answer)); assert.equal(f.calls(), 0);
});
test('confirmed valid requirement uses real SDK and signs once', async () => {
  const f = fixture(); await confirmedPayment(f.input, f.signer, async summary => {
    assert.equal(f.calls(), 0); assert.ok(Object.isFrozen(summary.requirement)); return true;
  }); assert.equal(f.calls(), 1);
});
test('tampered payTo: zero confirmations and signer calls', async () => {
  const f = fixture('0.0.999999'); let confirmations = 0;
  await assert.rejects(confirmedPayment(f.input, f.signer, async () => { confirmations++; return true; }));
  assert.equal(confirmations, 0); assert.equal(f.calls(), 0);
});
test('trust changes during confirmation fail closed', async () => {
  const f = fixture(); let revoked = false; const read = f.input.readTrust;
  f.input.readTrust = () => revoked ? { ...read(), revision: 2 } : read();
  await assert.rejects(confirmedPayment(f.input, f.signer, async () => { revoked = true; return true; }));
  assert.equal(f.calls(), 0);
});
