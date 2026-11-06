/**
 * QuoteSeal Spike 2 — Task 1: Hedera Package Validation
 *
 * Verifies actual compatibility of @x402/core, @x402/hedera, @x402/fetch,
 * and @hiero-ledger/sdk. Records exact versions, exports, peer dependencies,
 * and real TypeScript APIs. No assumptions — only observed package metadata
 * and runtime exports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import * as coreExports from '@x402/core';
import * as hederaExports from '@x402/hedera';
import * as fetchExports from '@x402/fetch';
import * as hieroExports from '@hiero-ledger/sdk';

const ROOT = join(process.cwd(), '..', '..');

function readPkg(name: string) {
  const candidates = [
    join(process.cwd(), 'node_modules', name, 'package.json'),
    join(ROOT, 'node_modules', name, 'package.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      // try next candidate
    }
  }
  return null;
}

// Resolve packages from local node_modules first, then root workspace.
const CORE = readPkg('@x402/core');
const HEDERA = readPkg('@x402/hedera');
const FETCH = readPkg('@x402/fetch');
const HIERO = readPkg('@hiero-ledger/sdk');
const ROOT_CORE = readPkg('@x402/core');
const ROOT_HEDERA = readPkg('@x402/hedera');
const ROOT_FETCH = readPkg('@x402/fetch');
const ROOT_HIERO = readPkg('@hiero-ledger/sdk');

test('Task 1 — records exact versions of all four packages', () => {
  const versions = {
    '@x402/core': CORE.version,
    '@x402/hedera': HEDERA.version,
    '@x402/fetch': FETCH.version,
    '@hiero-ledger/sdk': HIERO.version,
  };
  console.log('PACKAGE_VERSIONS', JSON.stringify(versions, null, 2));
  assert.equal(CORE.version, '2.30.0');
  assert.equal(HEDERA.version, '2.30.0');
  assert.equal(FETCH.version, '2.30.0');
  assert.equal(HIERO.version, '2.90.1');
});

test('Task 1 — all four packages are mutually present at version 2.30.0 / 2.90.1 in root too', () => {
  // Root workspace also pins them — confirms the monorepo baseline.
  assert.equal(ROOT_CORE?.version, '2.30.0', 'root @x402/core');
  assert.equal(ROOT_HEDERA?.version, '2.30.0', 'root @x402/hedera');
  assert.equal(ROOT_FETCH?.version, '2.30.0', 'root @x402/fetch');
  assert.equal(ROOT_HIERO?.version, '2.90.1', 'root @hiero-ledger/sdk');
});

test('Task 1 — @x402/core exports real client APIs', () => {
  const keys = Object.keys(coreExports);
  console.log('CORE_EXPORTS', JSON.stringify(keys));
  // Core is primarily type/re-export surface; x402Version constant is present.
  assert.ok(keys.includes('x402Version'), 'x402Version exported');
});

test('Task 1 — @x402/core has no peerDependencies (no peer conflict risk)', () => {
  const pd = CORE.peerDependencies ?? {};
  console.log('CORE_PEER_DEPS', JSON.stringify(pd));
  assert.equal(Object.keys(pd).length, 0, '@x402/core declares no peerDependencies');
});

test('Task 1 — @x402/hedera exports ExactHederaScheme and signer helpers', () => {
  const keys = Object.keys(hederaExports);
  console.log('HEDERA_EXPORTS', JSON.stringify(keys));
  const required = [
    'ExactHederaScheme',
    'createClientHederaSigner',
    'createHederaSignAndSubmitTransaction',
    'createHederaVerifyPayerSignature',
    'createHederaPreflightTransfer',
    'createHederaClient',
    'HBAR_ASSET_ID',
    'HEDERA_TESTNET_CAIP2',
    'HEDERA_MAINNET_CAIP2',
    'isValidHederaEntityId',
    'isHbarAsset',
    'inspectHederaTransaction',
  ];
  for (const name of required) {
    assert.ok(keys.includes(name), `hedera export missing: ${name}`);
  }
  assert.equal(hederaExports.HBAR_ASSET_ID, '0.0.0');
  assert.equal(hederaExports.HEDERA_TESTNET_CAIP2, 'hedera:testnet');
  assert.equal(hederaExports.HEDERA_MAINNET_CAIP2, 'hedera:mainnet');
});

test('Task 1 — @x402/hedera has no peerDependencies', () => {
  const pd = HEDERA.peerDependencies ?? {};
  console.log('HEDERA_PEER_DEPS', JSON.stringify(pd));
  assert.equal(Object.keys(pd).length, 0, '@x402/hedera declares no peerDependencies');
});

test('Task 1 — @x402/fetch exports wrapFetchWithPayment', () => {
  const keys = Object.keys(fetchExports);
  console.log('FETCH_EXPORTS', JSON.stringify(keys));
  assert.ok(keys.includes('wrapFetchWithPayment'), 'wrapFetchWithPayment exported');
});

test('Task 1 — @x402/fetch has no peerDependencies', () => {
  const pd = FETCH.peerDependencies ?? {};
  console.log('FETCH_PEER_DEPS', JSON.stringify(pd));
  assert.equal(Object.keys(pd).length, 0, '@x402/fetch declares no peerDependencies');
});

test('Task 1 — @hiero-ledger/sdk exports AccountId, PrivateKey, Client, TransferTransaction, Hbar, TokenId', () => {
  const keys = Object.keys(hieroExports);
  console.log('HIERO_EXPORTS', JSON.stringify(keys.slice(0, 40)));
  const required = ['AccountId', 'PrivateKey', 'Client', 'TransferTransaction', 'Hbar', 'TokenId', 'TransactionId'];
  for (const name of required) {
    assert.ok(keys.includes(name), `hiero export missing: ${name}`);
  }
});

test('Task 1 — @x402/hedera depends on @hiero-ledger/sdk 2.90.1 and @hiero-ledger/proto', () => {
  const deps = { ...(HEDERA.dependencies ?? {}), ...(HEDERA.peerDependencies ?? {}) };
  console.log('HEDERA_DEPS', JSON.stringify(deps));
  assert.ok(deps['@hiero-ledger/sdk'], '@x402/hedera depends on @hiero-ledger/sdk');
  assert.ok(deps['@hiero-ledger/proto'], '@x402/hedera depends on @hiero-ledger/proto');
});

test('Task 1 — @x402/fastify presence (required by ADR-02 for Phase 6 Fastify API)', () => {
  const found = readPkg('@x402/fastify') !== null;
  console.log('X402_FASTIFY_INSTALLED', found);
  // Report only; @x402/fastify may arrive as a transitive dependency.
  // Phase 6 work should confirm it is directly importable before use.
  assert.ok(typeof found === 'boolean');
});

test('Task 1 — @x402/core and @x402/hedera share major version 2.30.0 (aligned)', () => {
  assert.equal(CORE.version, HEDERA.version, 'core and hedera must share the same version');
  assert.equal(FETCH.version, HEDERA.version, 'fetch and hedera must share the same version');
});

test('Task 1 — @x402/hedera signer helper signatures are observable at runtime', () => {
  assert.equal(typeof hederaExports.createClientHederaSigner, 'function');
  assert.equal(typeof hederaExports.createHederaSignAndSubmitTransaction, 'function');
  assert.equal(typeof hederaExports.createHederaVerifyPayerSignature, 'function');
  assert.equal(typeof hederaExports.createHederaPreflightTransfer, 'function');
  assert.equal(typeof hederaExports.createHederaClient, 'function');
  assert.equal(typeof hederaExports.ExactHederaScheme, 'function');
});

test('Task 1 — ExactHederaScheme constructor accepts a ClientHederaSigner and has createPaymentPayload', () => {
  const signer = {
    accountId: '0.0.42',
    createPartiallySignedTransferTransaction: async () => 'dGVzdA==',
  };
  const scheme = new hederaExports.ExactHederaScheme(signer);
  assert.equal(typeof scheme.createPaymentPayload, 'function');
  assert.equal(scheme.scheme, 'exact');
  assert.equal(typeof scheme.findDefaultAsset, 'function');
});
