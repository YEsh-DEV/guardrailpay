/**
 * Buyer Integration Test Suite
 *
 * End-to-end tests verifying the BuyerPaymentOrchestrator with:
 * - Local HTTP merchant server returning actual 402 challenges
 * - Instrumented signer to track invocation count
 * - MockFacilitatorClient for simulated settlement
 * - Guard evaluation (in-process, not via HTTP)
 *
 * Scenarios:
 * 1. Legitimate flow: signer called exactly once, resource returned
 * 2. Guard rejection: signer called zero times
 * 3. Malicious merchant: tampered payTo -> rejected
 * 4. Malicious merchant: wrong amount -> rejected
 * 5. Malicious merchant: wrong network -> rejected
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BuyerPaymentOrchestrator,
  MockFacilitatorClient,
  QuoteSealSecurityRejectionError
} from '@quoteseal/buyer';
import { defaultProfile, defaultAnchors } from '@quoteseal/guard';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequired } from '@x402/core/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────────────

function makeLocalFetch(serverPort: number): typeof fetch {
  return async (request, init) => {
    const rawUrl =
      typeof request === 'string' ? request : 'url' in request ? request.url : (request as Request).href;
    const target = new URL(rawUrl);
    if (target.hostname.endsWith('merchant.example')) {
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(serverPort);
    }
    return globalThis.fetch(target, init);
  };
}

function makeInstrumentedSigner(counter: { calls: number }): ClientHederaSigner {
  return {
    accountId: '0.0.42',
    async createPartiallySignedTransferTransaction() {
      counter.calls++;
      return Buffer.from('mock-signed-hedera-tx-bytes').toString('base64');
    }
  };
}

function makeServer(challenge: PaymentRequired): { server: Server; url: string } {
  let serverPort = 0;

  const server = createServer(async (req, res) => {
    const authHeader = req.headers['payment-signature'];
    if (!authHeader) {
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(challenge));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'paid', access: 'granted' }));
  });

  // Listen synchronously returns promise we'll resolve externally
  return {
    server,
    get url() {
      return `https://merchant.example/api/data?port=${serverPort}`;
    }
  };
}

async function startServer(server: Server): Promise<number> {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Buyer Integration: BuyerPaymentOrchestrator', () => {
  const legitChallenge: PaymentRequired = {
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
    extensions: {
      quoteseal: {
        ens: 'merchant.eth'
      }
    }
  };

  it('legitimate flow: signer called exactly once, resource returned', async () => {
    const { server } = makeServer(legitChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      const result = await orchestrator.execute({
        resourceUrl: 'https://merchant.example/api/data',
        mode: 'local',
        signer: instrumentedSigner,
        now: () => 1000,
        readTrust: () => ({
          profile: { ...defaultProfile, origin: 'https://merchant.example' },
          anchors: { ...defaultAnchors }
        }),
        facilitator: mockFacilitator,
        fetch: makeLocalFetch(serverPort),
        confirm: async () => true
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(signerCounter.calls).toBe(1); // INVARIANT: exactly once
      expect(mockFacilitator.calls).toHaveLength(1);
    } finally {
      server.close();
    }
  });

  it('guard rejection when buyer aborts confirmation: signer called zero times', async () => {
    const { server } = makeServer(legitChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => false // buyer rejects
        })
      ).rejects.toThrow('explicit buyer confirmation was not granted');

      expect(signerCounter.calls).toBe(0); // signer never called
    } finally {
      server.close();
    }
  });

  it('malicious merchant: tampered payTo -> guard rejects, signer not called', async () => {
    const tamperedChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'https://merchant.example/api/data' },
      accepts: [{ ...legitChallenge.accepts[0], payTo: '0.0.9999999' }]
    };

    const { server } = makeServer(tamperedChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => true
        })
      ).rejects.toThrow();

      expect(signerCounter.calls).toBe(0);
    } finally {
      server.close();
    }
  });

  it('malicious merchant: altered amount exceeds cap -> guard rejects, signer not called', async () => {
    const alteredChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'https://merchant.example/api/data' },
      accepts: [{ ...legitChallenge.accepts[0], amount: '999999999' }]
    };

    const { server } = makeServer(alteredChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => true
        })
      ).rejects.toThrow();

      expect(signerCounter.calls).toBe(0);
    } finally {
      server.close();
    }
  });

  it('malicious merchant: wrong network -> guard rejects, signer not called', async () => {
    const wrongNetworkChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'https://merchant.example/api/data' },
      accepts: [{ ...legitChallenge.accepts[0], network: 'hedera:mainnet' }]
    };

    const { server } = makeServer(wrongNetworkChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => true
        })
      ).rejects.toThrow();

      expect(signerCounter.calls).toBe(0);
    } finally {
      server.close();
    }
  });

  it('malicious merchant: wrong asset -> guard rejects, signer not called', async () => {
    const wrongAssetChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'https://merchant.example/api/data' },
      accepts: [{ ...legitChallenge.accepts[0], asset: '0.0.9999' }]
    };

    const { server } = makeServer(wrongAssetChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => true
        })
      ).rejects.toThrow();

      expect(signerCounter.calls).toBe(0);
    } finally {
      server.close();
    }
  });

  it('malicious merchant: cross-origin resource URL -> guard rejects, signer not called', async () => {
    const crossOriginChallenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'https://evil-merchant.example/api/data' },
      accepts: [{ ...legitChallenge.accepts[0] }]
    };

    const { server } = makeServer(crossOriginChallenge);
    const serverPort = await startServer(server);
    const signerCounter = { calls: 0 };
    const instrumentedSigner = makeInstrumentedSigner(signerCounter);
    const mockFacilitator = new MockFacilitatorClient();
    const orchestrator = new BuyerPaymentOrchestrator();

    try {
      await expect(
        orchestrator.execute({
          resourceUrl: 'https://evil-merchant.example/api/data',
          mode: 'local',
          signer: instrumentedSigner,
          now: () => 1000,
          readTrust: () => ({
            profile: { ...defaultProfile, origin: 'https://merchant.example' },
            anchors: { ...defaultAnchors }
          }),
          facilitator: mockFacilitator,
          fetch: makeLocalFetch(serverPort),
          confirm: async () => true
        })
      ).rejects.toThrow();

      expect(signerCounter.calls).toBe(0);
    } finally {
      server.close();
    }
  });
});

describe('Buyer Route: POST /v1/buyer/pay', () => {
  it('returns PASS and immutable summary for compliant payment challenge', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');
    const app = createApp({
      ensResolver: { resolveProfile: async () => ({} as any) } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/premium-report',
        payTo: '0.0.123456',
        amount: '10',
        asset: '0.0.0',
        network: 'hedera:testnet',
        scheme: 'exact',
        maxTimeoutSeconds: 60,
        extra: { feePayer: '0.0.98' },
        allRequirements: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.123456',
            maxTimeoutSeconds: 60,
            extra: { feePayer: '0.0.98' }
          }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('PASS');
    expect(body.summary).toBeDefined();
    expect(body.summary.payTo).toBe('0.0.123456');
    expect(body.summary.amount).toBe('10');
    expect(body.summary.merchantOrigin).toBe('https://merchant.example');
  });

  it('rejects non-https resourceUrl with 400 validation error', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');
    const app = createApp({
      ensResolver: { resolveProfile: async () => ({} as any) } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'http://merchant.example/api/insecure',
        payTo: '0.0.123456',
        amount: '10',
        asset: '0.0.0',
        network: 'hedera:testnet',
        scheme: 'exact',
        maxTimeoutSeconds: 60,
        extra: { feePayer: '0.0.98' },
        allRequirements: []
      }
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
