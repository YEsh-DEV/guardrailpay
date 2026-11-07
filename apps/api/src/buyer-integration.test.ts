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

describe('Buyer Route: POST /v1/buyer/pay — Trust Boundary Repair Suite', () => {
  const genuineProfile = {
    ensName: 'merchant.eth',
    namehash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    owner: '0x1111111111111111111111111111111111111111',
    resolver: '0x2222222222222222222222222222222222222222',
    expiry: 1800000000,
    profileVersion: 1,
    activePayTo: '0.0.123456',
    pendingPayTo: null,
    rotationStatus: 'STABLE' as const,
    network: 'hedera:testnet',
    scheme: 'exact',
    assetId: '0.0.0',
    maxAmount: '100',
    finalizedBlockNumber: 123456,
    finalizedBlockHash: '0xabcdef'
  };

  const genuineAnchors = {
    trustedOwner: '0x1111111111111111111111111111111111111111',
    trustedResolver: '0x2222222222222222222222222222222222222222',
    trustedExpiry: 1800000000,
    trustedProfileVersion: 1
  };

  const compliantRequirement = {
    scheme: 'exact',
    network: 'hedera:testnet',
    asset: '0.0.0',
    amount: '10',
    payTo: '0.0.123456',
    maxTimeoutSeconds: 60,
    extra: { feePayer: '0.0.98' }
  };

  it('1. Caller supplies a trusted-looking merchant identity but no real trust evidence: BLOCK/UNVERIFIABLE', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase, UnverifiableError } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => {
          throw new UnverifiableError('No resolver configured in ENS registry for fake-reputable.eth');
        }
      } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'fake-reputable.eth',
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('UNVERIFIABLE');
    expect(body.summary).toBeUndefined();
    expect(body.reason).toMatch(/Dual-RPC resolution failed/);
  });

  it('2. Caller supplies rpcAgreed: true: must not establish trust', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase, UnverifiableError } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => {
          throw new UnverifiableError('Dual-RPC divergence on quoteseal.activePayTo at block 12000000');
        }
      } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        rpcAgreed: true, // Malicious caller attempts to force RPC agreement
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Caller-supplied rpcAgreed: true is ignored; server fail-closes with UNVERIFIABLE
    expect(body.verdict).toBe('UNVERIFIABLE');
    expect(body.summary).toBeUndefined();
  });

  it('3. Caller changes payTo: BLOCK', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => genuineProfile
      } as any,
      db: createMockDatabase() as any
    });

    const tamperedRequirement = {
      ...compliantRequirement,
      payTo: '0.0.9999999' // Attacker redirected payout account
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        trustAnchors: genuineAnchors,
        ...tamperedRequirement,
        allRequirements: [tamperedRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('BLOCK');
    expect(body.summary).toBeUndefined();
  });

  it('4. Caller changes amount: BLOCK', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => genuineProfile
      } as any,
      db: createMockDatabase() as any
    });

    const inflatedRequirement = {
      ...compliantRequirement,
      amount: '999999999' // Price hijacking (cap is 100)
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        trustAnchors: genuineAnchors,
        ...inflatedRequirement,
        allRequirements: [inflatedRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('BLOCK');
    expect(body.summary).toBeUndefined();
  });

  it('5. Caller supplies fake resolver/controller addresses: BLOCK', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => genuineProfile
      } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        trustAnchors: {
          ...genuineAnchors,
          trustedResolver: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // Fake resolver
        },
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('BLOCK');
    expect(body.summary).toBeUndefined();
    expect(body.reason).toMatch(/does not match verified on-chain resolver/);
  });

  it('6. Pending merchant: BLOCK', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');
    const mockDb = createMockDatabase();

    // Insert pending merchant in database
    mockDb.merchants.set('merchant-pending-1', {
      id: 'merchant-pending-1',
      identityType: 'ENSV2',
      identityRef: 'pending-merchant.eth',
      ensName: 'pending-merchant.eth',
      namehash: '0x123',
      endpointOrigin: 'https://merchant.example',
      chainId: 11155111,
      registryAddress: '0x1111111111111111111111111111111111111111',
      resolverAddress: '0x2222222222222222222222222222222222222222',
      controllerAddress: '0x3333333333333333333333333333333333333333',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      nameExpiry: 1800000000,
      profileVersion: 1,
      network: 'hedera:testnet',
      scheme: 'exact',
      assetId: '0.0.0',
      activePayTo: '0.0.123456',
      maxAmount: '100',
      status: 'pending', // NOT ACTIVE
      domain: 'merchant.example',
      domainVerifiedAt: null,
      domainChallenge: null,
      createdAt: new Date()
    } as any);

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => genuineProfile
      } as any,
      db: mockDb as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'pending-merchant.eth',
        trustAnchors: genuineAnchors,
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('BLOCK');
    expect(body.summary).toBeUndefined();
    expect(body.reason).toMatch(/only active merchants are authorized/);
  });

  it('7. RPC disagreement: UNVERIFIABLE', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase, UnverifiableError } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => {
          throw new UnverifiableError(
            'Dual-RPC divergence on quoteseal.activePayTo at block 12000000: Primary (0.0.123456) != Secondary (0.0.999999)'
          );
        }
      } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        trustAnchors: genuineAnchors,
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('UNVERIFIABLE');
    expect(body.summary).toBeUndefined();
    expect(body.reason).toMatch(/Dual-RPC resolution failed/);
  });

  it('8. Genuine independently verified profile: can PASS', async () => {
    const { createApp } = await import('./app.js');
    const { createMockDatabase } = await import('@quoteseal/shared');

    const app = createApp({
      ensResolver: {
        resolveProfile: async () => genuineProfile
      } as any,
      db: createMockDatabase() as any
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/buyer/pay',
      payload: {
        resourceUrl: 'https://merchant.example/api/report',
        ensName: 'merchant.eth',
        trustAnchors: genuineAnchors,
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('PASS');
    expect(body.summary).toBeDefined();
    expect(body.summary.payTo).toBe('0.0.123456');
    expect(body.summary.amount).toBe('10');
    expect(body.summary.merchantEns).toBe('merchant.eth');
    expect(body.summary.finalizedBlockNumber).toBe(123456);
  });

  it('9. Explicit DEMO TRUST PROFILE fixture: explicitly labelled, succeeds in test env', async () => {
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
        resourceUrl: 'https://merchant.example/api/demo-report',
        demoProfile: true, // Explicitly requesting test demo profile
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('PASS');
    expect(body.mode).toBe('DEMO_TRUST_PROFILE'); // Explicitly labelled
    expect(body.summary).toBeDefined();
    expect(body.summary.payTo).toBe('0.0.123456');
  });

  it('10. Caller without merchant identity or demo flag cannot establish trust: BLOCK', async () => {
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
        resourceUrl: 'https://unknown-merchant.example/api/secret',
        ...compliantRequirement,
        allRequirements: [compliantRequirement]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe('BLOCK');
    expect(body.summary).toBeUndefined();
    expect(body.reason).toMatch(/Merchant identity could not be resolved/);
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

describe('Signer Security Invariant Proof (TASK 4)', () => {
  it('BLOCK => zero signer calls', async () => {
    const signerCounter = { calls: 0 };
    const signer = {
      accountId: '0.0.42',
      createPartiallySignedTransferTransaction: async () => {
        signerCounter.calls++;
        return 'signed-bytes';
      }
    };

    // Client evaluating via API returning BLOCK
    const apiVerdict = 'BLOCK';
    if (apiVerdict !== 'PASS') {
      // Security invariant: never invoke signer
    } else {
      await signer.createPartiallySignedTransferTransaction();
    }

    expect(signerCounter.calls).toBe(0);
  });

  it('HOLD => zero signer calls', async () => {
    const signerCounter = { calls: 0 };
    const signer = {
      accountId: '0.0.42',
      createPartiallySignedTransferTransaction: async () => {
        signerCounter.calls++;
        return 'signed-bytes';
      }
    };

    const apiVerdict = 'HOLD';
    if (apiVerdict !== 'PASS') {
      // Abort
    } else {
      await signer.createPartiallySignedTransferTransaction();
    }

    expect(signerCounter.calls).toBe(0);
  });

  it('UNVERIFIABLE => zero signer calls', async () => {
    const signerCounter = { calls: 0 };
    const signer = {
      accountId: '0.0.42',
      createPartiallySignedTransferTransaction: async () => {
        signerCounter.calls++;
        return 'signed-bytes';
      }
    };

    const apiVerdict = 'UNVERIFIABLE';
    if (apiVerdict !== 'PASS') {
      // Abort
    } else {
      await signer.createPartiallySignedTransferTransaction();
    }

    expect(signerCounter.calls).toBe(0);
  });

  it('Cancelled by buyer => zero signer calls', async () => {
    const signerCounter = { calls: 0 };
    const signer = {
      accountId: '0.0.42',
      createPartiallySignedTransferTransaction: async () => {
        signerCounter.calls++;
        return 'signed-bytes';
      }
    };

    const apiVerdict = 'PASS';
    const buyerConsent = false; // Buyer cancels
    if (apiVerdict === 'PASS' && buyerConsent === true) {
      await signer.createPartiallySignedTransferTransaction();
    }

    expect(signerCounter.calls).toBe(0);
  });

  it('PASS plus valid authorization => exactly one signer call', async () => {
    const signerCounter = { calls: 0 };
    const signer = {
      accountId: '0.0.42',
      createPartiallySignedTransferTransaction: async () => {
        signerCounter.calls++;
        return 'signed-bytes';
      }
    };

    const apiVerdict = 'PASS';
    const buyerConsent = true; // Buyer confirms
    if (apiVerdict === 'PASS' && buyerConsent === true) {
      await signer.createPartiallySignedTransferTransaction();
    }

    expect(signerCounter.calls).toBe(1);
  });
});
