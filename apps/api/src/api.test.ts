import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import type { EnsProfileResolver, EnsProfileRecord } from '@quoteseal/ens-profile';
import { createMockDatabase } from '@quoteseal/shared';

describe('QuoteSeal Fastify API Endpoints', () => {
  const sampleProfile: EnsProfileRecord = {
    ensName: 'researchpro.eth',
    namehash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    owner: '0x1111111111111111111111111111111111111111',
    resolver: '0x2222222222222222222222222222222222222222',
    expiry: 1800000000,
    profileVersion: 1,
    activePayTo: '0.0.123456',
    pendingPayTo: null,
    rotationStatus: 'STABLE',
    network: 'hedera:testnet',
    scheme: 'exact',
    assetId: '0.0.0',
    maxAmount: '500000000',
    finalizedBlockNumber: 12000000,
    finalizedBlockHash: '0x1111'
  };

  const mockEnsResolver = {
    resolveProfile: vi.fn().mockResolvedValue(sampleProfile)
  } as unknown as EnsProfileResolver;

  const mockDb = createMockDatabase();

  const app = createApp({
    ensResolver: mockEnsResolver,
    db: mockDb,
    checkDatabase: vi.fn().mockResolvedValue(true),
    checkRpcPrimary: vi.fn().mockResolvedValue(true),
    checkRpcSecondary: vi.fn().mockResolvedValue(true)
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns 200 OK with service identifier', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.service).toBe('quoteseal-api');
    expect(json.timestamp).toBeDefined();
  });

  it('GET /ready returns 200 OK when all checks pass', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ready');
    expect(json.checks).toEqual({
      database: 'ok',
      rpcPrimary: 'ok',
      rpcSecondary: 'ok'
    });
  });

  it('GET /ready returns 503 Service Unavailable when a critical check fails', async () => {
    const degradedApp = createApp({
      ensResolver: mockEnsResolver,
      checkDatabase: vi.fn().mockResolvedValue(false), // DB is down
      checkRpcPrimary: vi.fn().mockResolvedValue(true),
      checkRpcSecondary: vi.fn().mockResolvedValue(true)
    });

    const res = await degradedApp.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(503);
    const json = res.json();
    expect(json.status).toBe('unready');
    expect(json.checks.database).toBe('unavailable');
  });

  it('GET /v1/merchants/:ensName/profile returns resolved merchant profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/profile'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.profile.ensName).toBe('researchpro.eth');
    expect(json.data.profile.activePayTo).toBe('0.0.123456');
    expect(json.data.profile.profileVersion).toBe(1);
    expect(mockEnsResolver.resolveProfile).toHaveBeenCalledWith('researchpro.eth');
  });

  it('GET /v1/merchants/:ensName/profile returns 400 on invalid ENS name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/a/profile' // length < 3
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /v1/merchants/:ensName/trust returns pinned trust anchors and verification verdict', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/trust'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.ensName).toBe('researchpro.eth');
    expect(json.data.status).toBe('PASS');
    expect(json.data.trustAnchors.trustedOwner).toBe(sampleProfile.owner);
    expect(json.data.trustAnchors.trustedResolver).toBe(sampleProfile.resolver);
  });

  it('GET /v1/merchants/:ensName/rotation-status returns current payout and rotation state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/rotation-status'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.ensName).toBe('researchpro.eth');
    expect(json.data.activePayTo).toBe('0.0.123456');
    expect(json.data.rotationStatus).toBe('STABLE');
  });

  it('POST /v1/merchants/onboard validates payload schema and returns 202', async () => {
    const validPayload = {
      ensName: 'newmerchant.eth',
      endpointOrigin: 'https://api.newmerchant.com',
      activePayTo: '0.0.555555',
      maxAmount: '1000000000',
      ownerSignature: '0x' + 'ab'.repeat(65)
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/merchants/onboard',
      payload: validPayload
    });

    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.data.ensName).toBe('newmerchant.eth');
    expect(json.data.status).toBe('PENDING_ONBOARDING_CHALLENGE');
  });

  it('POST /v1/merchants/onboard rejects invalid signature with 400', async () => {
    const invalidPayload = {
      ensName: 'newmerchant.eth',
      endpointOrigin: 'https://api.newmerchant.com',
      activePayTo: '0.0.555555',
      ownerSignature: '0xinvalid'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/merchants/onboard',
      payload: invalidPayload
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /v1/merchants/:ensName/proposals creates pending rotation proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/merchants/researchpro.eth/proposals',
      payload: {
        newPayTo: '0.0.789012',
        reasonCode: 'KEY_UPGRADE'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.data.newPayTo).toBe('0.0.789012');
    expect(json.data.state).toBe('PROPOSED');
  });

  it('POST /v1/world/start returns proposal-bound authorization URL and state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId: 'a0000000-0000-0000-0000-000000000001'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.state).toContain('st_a0000000');
    expect(json.data.redirectUrl).toContain('id.worldcoin.org');
  });
});
