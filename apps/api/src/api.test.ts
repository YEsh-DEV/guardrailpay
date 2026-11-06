import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import type { EnsProfileResolver, EnsProfileRecord } from '@quoteseal/ens-profile';
import { createMockDatabase, ConfigurationError, validateEnv } from '@quoteseal/shared';

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

  const testMerchantId = 'a0000000-0000-0000-0000-000000000001';
  const testOperatorAddress = '0x1111111111111111111111111111111111111111';
  const testOperatorId = 'b0000000-0000-0000-0000-000000000001';
  const testProposalId = 'c0000000-0000-0000-0000-000000000001';

  mockDb.merchants.set(testMerchantId, {
    id: testMerchantId,
    ensName: 'researchpro.eth',
    namehash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    endpointOrigin: 'https://api.researchpro.com',
    chainId: 11155111,
    registryAddress: '0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2',
    resolverAddress: '0x2222222222222222222222222222222222222222',
    controllerAddress: '0x3333333333333333333333333333333333333333',
    ownerAddress: '0x1111111111111111111111111111111111111111',
    nameExpiry: 1800000000,
    profileVersion: 1,
    network: 'hedera:testnet',
    scheme: 'exact',
    assetId: '0.0.0',
    activePayTo: '0.0.123456',
    maxAmount: '500000000',
    status: 'active',
    createdAt: new Date()
  });

  mockDb.operators.set(testOperatorId, {
    id: testOperatorId,
    merchantId: testMerchantId,
    walletAddress: testOperatorAddress,
    role: 'ROLE_ROTATION_APPROVER',
    issuer: 'https://auth.world.org',
    subjectHmac: '0000000000000000000000000000000000000000000000000000000000000000',
    subjectEncrypted: null,
    status: 'active',
    enrolledAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400 * 1000),
    revokedAt: null
  });

  mockDb.rotationProposals.set(testProposalId, {
    id: testProposalId,
    merchantId: testMerchantId,
    oldPayTo: '0.0.123456',
    newPayTo: '0.0.789012',
    proposalHash: '0x' + 'aa'.repeat(32),
    proposalNonce: 1,
    proposedBy: testOperatorAddress,
    proposedAt: new Date(),
    effectiveAt: null,
    expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    state: 'PROPOSED',
    activatedTx: null,
    cancelledAt: null,
    reasonCode: 'KEY_UPGRADE'
  });

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
    expect(json.checks.database).toBe('ok');
    expect(json.checks.rpcPrimary).toBe('ok');
    expect(json.checks.rpcSecondary).toBe('ok');
  });

  it('GET /ready returns 503 Service Unavailable when RPC check fails', async () => {
    const unhealthyApp = createApp({
      ensResolver: mockEnsResolver,
      db: mockDb,
      checkDatabase: vi.fn().mockResolvedValue(true),
      checkRpcPrimary: vi.fn().mockResolvedValue(false),
      checkRpcSecondary: vi.fn().mockResolvedValue(true)
    });

    const res = await unhealthyApp.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(503);
    const json = res.json();
    expect(json.status).toBe('unready');
  });

  it('M1 regression: throws ConfigurationError when rotationControllerClient is omitted in production', () => {
    expect(() => {
      createApp({
        ensResolver: mockEnsResolver,
        db: mockDb,
        env: {
          ...validateEnv(),
          NODE_ENV: 'production'
        }
      });
    }).toThrow(ConfigurationError);
  });

  it('GET /v1/merchants/:ensName/profile returns resolved profile data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/profile'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.profile.ensName).toBe('researchpro.eth');
    expect(json.data.profile.activePayTo).toBe('0.0.123456');
    expect(json.data.profile.rotationStatus).toBe('STABLE');
  });

  it('GET /v1/merchants/:ensName/profile rejects invalid ENS name format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/a/profile'
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /v1/merchants/:ensName/trust returns pinned trust anchors and verification status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/trust'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.ensName).toBe('researchpro.eth');
    expect(json.data.trustAnchors.trustedOwner).toBe(sampleProfile.owner);
    expect(json.data.verification.verdict).toBe('PASS');
  });

  it('GET /v1/merchants/:ensName/rotation-status returns current payout and pending state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/researchpro.eth/rotation-status'
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.activePayTo).toBe('0.0.123456');
    expect(json.data.rotationStatus).toBe('STABLE');
    expect(json.data.profileVersion).toBe(1);
  });

  it('POST /v1/merchants/onboard validates request schema correctly', async () => {
    const validPayload = {
      ensName: 'merchant.eth',
      endpointOrigin: 'https://api.merchant.com',
      activePayTo: '0.0.654321',
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
    expect(json.data.status).toBe('PENDING_ONBOARDING_CHALLENGE');
    expect(json.data.ensName).toBe('merchant.eth');
  });

  it('POST /v1/merchants/onboard rejects invalid request schema', async () => {
    const invalidPayload = {
      ensName: '', // empty name
      endpointOrigin: 'not-a-url',
      activePayTo: 'invalid-address'
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
        operatorAddress: testOperatorAddress,
        reasonCode: 'KEY_UPGRADE'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.data.proposal.newPayTo).toBe('0.0.789012');
    expect(json.data.proposal.state).toBe('PROPOSED');
  });

  it('POST /v1/world/start returns proposal-bound authorization URL and state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId: testProposalId,
        operatorAddress: testOperatorAddress
      }
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.state).toBeDefined();
    expect(json.data.authorizationUrl).toContain('https://auth.world.org');
    expect(json.data.proposalId).toBe(testProposalId);
  });
});
