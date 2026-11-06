import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from './app.js';
import { createMockDatabase, validateEnv } from '@quoteseal/shared';
import { MemoryArkivStorageClient, ArkivPublisher, ArkivDiscoveryService } from '@quoteseal/arkiv';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

describe('Arkiv Merchant Discovery Endpoint (/v1/merchants/discovery)', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;
  let storageClient: MemoryArkivStorageClient;
  let publisher: ArkivPublisher;
  let discoveryService: ArkivDiscoveryService;
  let app: ReturnType<typeof createApp>;

  const ownerPrivateKey = generatePrivateKey();
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  beforeEach(() => {
    mockDb = createMockDatabase();
    storageClient = new MemoryArkivStorageClient();
    publisher = new ArkivPublisher(storageClient);
    discoveryService = new ArkivDiscoveryService(storageClient);

    const mockEnsResolver = {
      resolveProfile: async () => {
        throw new Error('Not implemented in mock');
      }
    } as any;

    app = createApp({
      ensResolver: mockEnsResolver,
      db: mockDb,
      arkivStorageClient: storageClient,
      arkivDiscoveryService: discoveryService,
      env: {
        ...validateEnv({ NODE_ENV: 'test' }),
        APPLICATION_CHAIN_ID: 11155111
      }
    });
  });

  it('returns empty list when no merchants exist in Arkiv', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.merchants).toEqual([]);
    expect(body.data.count).toBe(0);
  });

  it('discovers verified merchants published to Arkiv', async () => {
    await publisher.publishMerchantProfile(
      {
        merchantId: 'mer_discovered_1',
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: 'superstore.eth.limo',
        domain: 'superstore.eth.limo',
        endpointOrigin: 'https://superstore.eth.limo',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.778899',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active'
      },
      ownerPrivateKey
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(1);
    expect(body.data.merchants[0].merchantId).toBe('mer_discovered_1');
    expect(body.data.merchants[0].verified).toBe(true);
    expect(body.data.merchants[0].activePayTo).toBe('0.0.778899');
  });

  it('filters discovery by domain and activePayTo', async () => {
    // Merchant A
    await publisher.publishMerchantProfile(
      {
        merchantId: 'mer_a',
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: 'alpha.com',
        domain: 'alpha.com',
        endpointOrigin: 'https://alpha.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.111111',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active'
      },
      ownerPrivateKey
    );

    // Merchant B
    await publisher.publishMerchantProfile(
      {
        merchantId: 'mer_b',
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: 'beta.com',
        domain: 'beta.com',
        endpointOrigin: 'https://beta.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.222222',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active'
      },
      ownerPrivateKey
    );

    const resDomain = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery?domain=alpha.com'
    });
    expect(resDomain.statusCode).toBe(200);
    const bodyDomain = JSON.parse(resDomain.body);
    expect(bodyDomain.data.count).toBe(1);
    expect(bodyDomain.data.merchants[0].merchantId).toBe('mer_a');

    const resPayTo = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery?activePayTo=0.0.222222'
    });
    expect(resPayTo.statusCode).toBe(200);
    const bodyPayTo = JSON.parse(resPayTo.body);
    expect(bodyPayTo.data.count).toBe(1);
    expect(bodyPayTo.data.merchants[0].merchantId).toBe('mer_b');
  });

  it('retrieves single merchant profile by merchantId', async () => {
    const pub = await publisher.publishMerchantProfile(
      {
        merchantId: 'mer_single',
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: 'single.com',
        domain: 'single.com',
        endpointOrigin: 'https://single.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.333333',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active'
      },
      ownerPrivateKey
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery/mer_single'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.merchant.merchantId).toBe('mer_single');
    expect(body.data.merchant.entityKey).toBe(pub.entityKey);
  });

  it('returns 404 for unknown merchant identifier in discovery', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants/discovery/non_existent_id'
    });
    expect(res.statusCode).toBe(404);
  });
});
