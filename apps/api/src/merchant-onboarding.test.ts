import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from './app.js';
import { createMockDatabase, validateEnv } from '@quoteseal/shared';
import { generatePrivateKey, privateKeyToAccount, signTypedData } from 'viem/accounts';
import { EIP712_ONBOARDING_TYPES } from '@quoteseal/shared';
import { DomainVerificationService } from './services/domain-verification.js';
import { createDbStore } from './services/db-store.js';
import type { Address } from 'viem';

describe('Native Merchant Onboarding, Domain Verification & Multi-Payout API', () => {
  const chainId = 11155111;
  const controllerAddress = '0x1234567890123456789012345678901234567890' as Address;

  let mockDb: ReturnType<typeof createMockDatabase>;
  let dbStore: ReturnType<typeof createDbStore>;
  let dnsRecords: Map<string, string[][]>;
  let wellKnownResponses: Map<string, Record<string, unknown>>;
  let domainService: DomainVerificationService;
  let app: ReturnType<typeof createApp>;

  const ownerPrivateKey = generatePrivateKey();
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  beforeEach(() => {
    mockDb = createMockDatabase();
    dbStore = createDbStore(mockDb);
    dnsRecords = new Map();
    wellKnownResponses = new Map();

    domainService = new DomainVerificationService(dbStore, {
      dnsResolver: async (domain: string) => dnsRecords.get(domain) ?? [],
      fetchFn: async (url: string | URL | Request) => {
        const urlStr = url.toString();
        const data = wellKnownResponses.get(urlStr);
        if (!data) return new Response('Not found', { status: 404 });
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    });

    const mockEnsResolver = {
      resolveProfile: async () => {
        throw new Error('Not implemented in mock');
      }
    } as any;

    app = createApp({
      ensResolver: mockEnsResolver,
      db: mockDb,
      domainVerificationService: domainService,
      env: {
        ...validateEnv({ NODE_ENV: 'test' }),
        APPLICATION_CHAIN_ID: chainId,
        ROTATION_CONTROLLER_ADDRESS: controllerAddress
      }
    });
  });

  describe('Single-Use Nonce Lifecycle', () => {
    it('issues a cryptographically random single-use nonce with 10m TTL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard/nonce',
        payload: {
          walletAddress: ownerAccount.address,
          endpointOrigin: 'https://shop.acme.com'
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.nonce).toMatch(/^qs_nonce_[a-f0-9]{48}$/);
      expect(body.data.domain.chainId).toBe(chainId);
      expect(body.data.domain.name).toBe('QuoteSeal');
      expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects invalid wallet address or malformed URL origin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard/nonce',
        payload: {
          walletAddress: '0xinvalid',
          endpointOrigin: 'not-a-url'
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('EIP-712 Native Merchant Onboarding', () => {
    async function getNonce(walletAddress = ownerAccount.address, endpointOrigin = 'https://shop.acme.com') {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard/nonce',
        payload: { walletAddress, endpointOrigin }
      });
      return JSON.parse(res.body).data.nonce as string;
    }

    it('onboards native merchant with valid EIP-712 owner signature', async () => {
      const nonce = await getNonce();
      const domain = 'shop.acme.com';
      const endpointOrigin = 'https://shop.acme.com';
      const activePayTo = '0.0.123456';
      const maxAmount = '500000000';
      const action = 'ONBOARD_MERCHANT';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      const signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract: controllerAddress
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt: BigInt(expiresAt)
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard',
        payload: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt,
          ownerSignature: signature,
          challengeType: 'DNS_TXT'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.merchantId).toBeDefined();
      expect(body.data.status).toBe('PENDING_ONBOARDING_CHALLENGE');
      expect(body.data.challenge.dnsRecordName).toBe('_quoteseal-challenge.shop.acme.com');
      expect(body.data.challenge.token).toMatch(/^qs_[a-f0-9]{64}$/);
    });

    it('prevents replay attacks: second attempt with same nonce is rejected', async () => {
      const nonce = await getNonce();
      const domain = 'shop.acme.com';
      const endpointOrigin = 'https://shop.acme.com';
      const activePayTo = '0.0.123456';
      const maxAmount = '500000000';
      const action = 'ONBOARD_MERCHANT';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      const signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract: controllerAddress
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt: BigInt(expiresAt)
        }
      });

      const payload = {
        ownerWallet: ownerAccount.address,
        endpointOrigin,
        domain,
        activePayTo,
        maxAmount,
        nonce,
        action,
        expiresAt,
        ownerSignature: signature
      };

      // First call succeeds
      const res1 = await app.inject({ method: 'POST', url: '/v1/merchants/onboard', payload });
      expect(res1.statusCode).toBe(201);

      // Replay attempt with same nonce MUST be rejected!
      const res2 = await app.inject({ method: 'POST', url: '/v1/merchants/onboard', payload });
      expect(res2.statusCode).toBe(401);
      const err = JSON.parse(res2.body);
      expect(err.error.message).toContain('consumed');
    });

    it('rejects onboarding with signature signed by an attacker key', async () => {
      const nonce = await getNonce();
      const attackerKey = generatePrivateKey();
      const domain = 'shop.acme.com';
      const endpointOrigin = 'https://shop.acme.com';
      const activePayTo = '0.0.123456';
      const maxAmount = '500000000';
      const action = 'ONBOARD_MERCHANT';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      // Attacker signs payload claiming owner is ownerAccount.address
      const signature = await signTypedData({
        privateKey: attackerKey,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract: controllerAddress
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt: BigInt(expiresAt)
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard',
        payload: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt,
          ownerSignature: signature
        }
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error.message).toContain('signature');
    });

    it('rejects when endpointOrigin does not match the nonce origin', async () => {
      const nonce = await getNonce(ownerAccount.address, 'https://legit.com');
      const domain = 'phishing.com';
      const endpointOrigin = 'https://phishing.com'; // Mismatched!
      const activePayTo = '0.0.123456';
      const maxAmount = '500000000';
      const action = 'ONBOARD_MERCHANT';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      const signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract: controllerAddress
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt: BigInt(expiresAt)
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard',
        payload: {
          ownerWallet: ownerAccount.address,
          endpointOrigin,
          domain,
          activePayTo,
          maxAmount,
          nonce,
          action,
          expiresAt,
          ownerSignature: signature
        }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('origin');
    });
  });

  describe('Domain Verification Challenge & Resolution', () => {
    async function onboardMerchant(domain = 'merchant.example.com', challengeType: 'DNS_TXT' | 'HTTPS_WELL_KNOWN' = 'DNS_TXT') {
      const nonceRes = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard/nonce',
        payload: { walletAddress: ownerAccount.address, endpointOrigin: `https://${domain}` }
      });
      const nonce = JSON.parse(nonceRes.body).data.nonce;
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      const signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract: controllerAddress
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin: `https://${domain}`,
          domain,
          activePayTo: '0.0.989898',
          maxAmount: '500000000',
          nonce,
          action: 'ONBOARD_MERCHANT',
          expiresAt: BigInt(expiresAt)
        }
      });

      const onboardRes = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard',
        payload: {
          ownerWallet: ownerAccount.address,
          endpointOrigin: `https://${domain}`,
          domain,
          activePayTo: '0.0.989898',
          maxAmount: '500000000',
          nonce,
          action: 'ONBOARD_MERCHANT',
          expiresAt,
          ownerSignature: signature,
          challengeType
        }
      });

      return JSON.parse(onboardRes.body).data;
    }

    it('fails domain verification if DNS TXT record is missing', async () => {
      const data = await onboardMerchant('unverified.com', 'DNS_TXT');
      const verifyRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${data.merchantId}/verify-domain`
      });

      expect(verifyRes.statusCode).toBe(422);
      expect(JSON.parse(verifyRes.body).error.code).toBe('DOMAIN_VERIFICATION_FAILED');
    });

    it('succeeds domain verification when DNS TXT record matches token', async () => {
      const data = await onboardMerchant('verified-dns.com', 'DNS_TXT');
      // Set matching TXT record in mock DNS
      dnsRecords.set('_quoteseal-challenge.verified-dns.com', [[`quoteseal-verification=${data.challenge.token}`]]);

      const verifyRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${data.merchantId}/verify-domain`
      });

      expect(verifyRes.statusCode).toBe(200);
      const resBody = JSON.parse(verifyRes.body);
      expect(resBody.data.verified).toBe(true);
      expect(resBody.data.status).toBe('ONBOARDED_UNCOMMITTED');
    });

    it('succeeds domain verification when HTTPS well-known endpoint matches token', async () => {
      const data = await onboardMerchant('verified-https.com', 'HTTPS_WELL_KNOWN');
      // Set matching response in mock well-known endpoint
      wellKnownResponses.set('https://verified-https.com/.well-known/quoteseal-challenge.json', {
        quotesealChallenge: data.challenge.token
      });

      const verifyRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${data.merchantId}/verify-domain`
      });

      expect(verifyRes.statusCode).toBe(200);
      const resBody = JSON.parse(verifyRes.body);
      expect(resBody.data.verified).toBe(true);
      expect(resBody.data.status).toBe('ONBOARDED_UNCOMMITTED');
    });
  });

  describe('Multi-Payout Operational Wallet Storage', () => {
    it('lists and enrolls additional operational payout wallets', async () => {
      // First onboard a merchant
      const nonceRes = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard/nonce',
        payload: { walletAddress: ownerAccount.address, endpointOrigin: 'https://store.corp' }
      });
      const nonce = JSON.parse(nonceRes.body).data.nonce;
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      const signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: { name: 'QuoteSeal', version: '1', chainId, verifyingContract: controllerAddress },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: ownerAccount.address,
          endpointOrigin: 'https://store.corp',
          domain: 'store.corp',
          activePayTo: '0.0.100001',
          maxAmount: '500000000',
          nonce,
          action: 'ONBOARD_MERCHANT',
          expiresAt: BigInt(expiresAt)
        }
      });

      const onboardRes = await app.inject({
        method: 'POST',
        url: '/v1/merchants/onboard',
        payload: {
          ownerWallet: ownerAccount.address,
          endpointOrigin: 'https://store.corp',
          domain: 'store.corp',
          activePayTo: '0.0.100001',
          maxAmount: '500000000',
          nonce,
          action: 'ONBOARD_MERCHANT',
          expiresAt,
          ownerSignature: signature
        }
      });

      const merchantId = JSON.parse(onboardRes.body).data.merchantId;

      // 1. Initial wallet list contains the primary payout
      const list1 = await app.inject({
        method: 'GET',
        url: `/v1/merchants/${merchantId}/payout-wallets`
      });
      expect(list1.statusCode).toBe(200);
      const wallets1 = JSON.parse(list1.body).data.wallets;
      expect(wallets1).toHaveLength(1);
      expect(wallets1[0].payTo).toBe('0.0.100001');

      // 2. Add an alternate operational payout wallet
      const addRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${merchantId}/payout-wallets`,
        payload: {
          payTo: '0.0.200002',
          label: 'Cold Storage Alternate'
        }
      });
      expect(addRes.statusCode).toBe(201);

      // 3. Check updated list contains both
      const list2 = await app.inject({
        method: 'GET',
        url: `/v1/merchants/${merchantId}/payout-wallets`
      });
      expect(list2.statusCode).toBe(200);
      const wallets2 = JSON.parse(list2.body).data.wallets;
      expect(wallets2).toHaveLength(2);
      expect(wallets2.some((w: any) => w.payTo === '0.0.200002')).toBe(true);
    });
  });
});
