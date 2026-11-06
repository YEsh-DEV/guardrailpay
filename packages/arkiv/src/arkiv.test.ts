import { describe, it, expect, beforeEach } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  PublicMerchantProfileSchema,
  MerchantPaymentPolicySchema,
  PayoutRotationAnnouncementSchema,
  PublicAuthorizationEvidenceSchema,
  EIP712_ARKIV_DOMAIN,
  EIP712_ARKIV_PROFILE_TYPES
} from './types.js';
import { MemoryArkivStorageClient } from './client.js';
import { ArkivPublisher } from './publisher.js';
import { ArkivDiscoveryService } from './query.js';
import { signTypedData } from 'viem/accounts';
import type { Hex } from 'viem';

describe('Arkiv Integration & Verification Suite', () => {
  let storageClient: MemoryArkivStorageClient;
  let publisher: ArkivPublisher;
  let discoveryService: ArkivDiscoveryService;

  const ownerPrivateKey = generatePrivateKey();
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  beforeEach(() => {
    storageClient = new MemoryArkivStorageClient();
    publisher = new ArkivPublisher(storageClient);
    discoveryService = new ArkivDiscoveryService(storageClient);
  });

  describe('Entity Schema Validation', () => {
    it('validates a correct PublicMerchantProfile', () => {
      const valid = {
        merchantId: 'mer_123',
        identityType: 'QUOTESEAL_NATIVE' as const,
        identityRef: 'merchant.acme.com',
        domain: 'merchant.acme.com',
        endpointOrigin: 'https://merchant.acme.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.123456',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active' as const,
        timestamp: 1700000000,
        signature: `0x${'a'.repeat(130)}` as Hex
      };
      expect(() => PublicMerchantProfileSchema.parse(valid)).not.toThrow();
    });

    it('rejects an invalid Hedera payTo account format', () => {
      const invalid = {
        merchantId: 'mer_123',
        identityType: 'QUOTESEAL_NATIVE' as const,
        identityRef: 'merchant.acme.com',
        domain: 'merchant.acme.com',
        endpointOrigin: 'https://merchant.acme.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0x1234567890123456789012345678901234567890', // EVM address instead of 0.0.N
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active' as const,
        timestamp: 1700000000,
        signature: `0x${'a'.repeat(130)}` as Hex
      };
      expect(() => PublicMerchantProfileSchema.parse(invalid)).toThrow();
    });
  });

  describe('Publisher & Cryptographic Attestation', () => {
    it('publishes a merchant profile with valid EIP-712 signature generated from owner key', async () => {
      const result = await publisher.publishMerchantProfile(
        {
          merchantId: 'mer_test_001',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'acmestore.io',
          domain: 'acmestore.io',
          endpointOrigin: 'https://acmestore.io',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.987654',
          maxAmount: '1000000000',
          profileVersion: 1,
          status: 'active'
        },
        ownerPrivateKey
      );

      expect(result.entityKey).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.version).toBe(1);

      // Verify stored in Arkiv storage
      const entity = await storageClient.getEntity(result.entityKey);
      expect(entity).not.toBeNull();
      expect(entity?.values.merchantId).toBe('mer_test_001');
      expect(entity?.values.domain).toBe('acmestore.io');
    });

    it('publishes payment policy, rotation announcement, and authorization evidence', async () => {
      const policyResult = await publisher.publishPaymentPolicy({
        merchantId: 'mer_test_001',
        network: 'hedera:testnet',
        scheme: 'exact',
        assetId: '0.0.0',
        maxAmountPerTx: '1000000000',
        profileVersion: 1,
        updatedAt: 1700000000
      });
      expect(policyResult.entityKey).toBeDefined();

      const rotationResult = await publisher.publishRotationAnnouncement({
        merchantId: 'mer_test_001',
        proposalId: 'prop_001',
        oldPayTo: '0.0.987654',
        newPayTo: '0.0.555555',
        effectiveAt: 1700003600,
        expiresAt: 1700086400,
        state: 'PENDING_APPROVED',
        announcedAt: 1700000000
      });
      expect(rotationResult.entityKey).toBeDefined();

      const evidenceResult = await publisher.publishAuthorizationEvidence({
        merchantId: 'mer_test_001',
        proposalId: 'prop_001',
        attestorAddress: ownerAccount.address,
        signature: '0xmockedattestationsignature',
        authTime: 1700000000,
        publishedAt: 1700000100
      });
      expect(evidenceResult.entityKey).toBeDefined();
    });
  });

  describe('Discovery Service & Tamper Resistance', () => {
    it('discovers and verifies an authentic merchant profile', async () => {
      await publisher.publishMerchantProfile(
        {
          merchantId: 'mer_verified',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'verified-shop.com',
          domain: 'verified-shop.com',
          endpointOrigin: 'https://verified-shop.com',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.443322',
          maxAmount: '500000000',
          profileVersion: 1,
          status: 'active'
        },
        ownerPrivateKey
      );

      const discovered = await discoveryService.discoverMerchants({ domain: 'verified-shop.com' });
      expect(discovered).toHaveLength(1);
      expect(discovered[0]!.verified).toBe(true);
      expect(discovered[0]!.merchantId).toBe('mer_verified');
      expect(discovered[0]!.activePayTo).toBe('0.0.443322');
      expect(discovered[0]!.rejectionReason).toBeUndefined();
    });

    it('rejects verification if the activePayTo is tampered in Arkiv storage', async () => {
      const pub = await publisher.publishMerchantProfile(
        {
          merchantId: 'mer_tamper',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'tamper-target.com',
          domain: 'tamper-target.com',
          endpointOrigin: 'https://tamper-target.com',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.111111',
          maxAmount: '500000000',
          profileVersion: 1,
          status: 'active'
        },
        ownerPrivateKey
      );

      // Malicious entity in Arkiv node modifies activePayTo to attacker address!
      storageClient.updateEntity(pub.entityKey, { activePayTo: '0.0.999999' });

      const discovered = await discoveryService.discoverMerchants({ domain: 'tamper-target.com' });
      expect(discovered).toHaveLength(1);
      // Cryptographic verification MUST fail!
      expect(discovered[0]!.verified).toBe(false);
      expect(discovered[0]!.rejectionReason).toBe('SIGNATURE_INVALID');
    });

    it('rejects verification when profile was signed by an unauthorized key', async () => {
      const imposterKey = generatePrivateKey();
      const timestamp = Math.floor(Date.now() / 1000);

      // Imposter signs their own signature but claims owner is ownerAccount.address
      const imposterSignature = await signTypedData({
        privateKey: imposterKey,
        domain: EIP712_ARKIV_DOMAIN,
        types: EIP712_ARKIV_PROFILE_TYPES,
        primaryType: 'PublicMerchantProfile',
        message: {
          merchantId: 'mer_spoof',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'spoofed.com',
          domain: 'spoofed.com',
          endpointOrigin: 'https://spoofed.com',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.777777',
          maxAmount: '500000000',
          profileVersion: 1n,
          timestamp: BigInt(timestamp)
        }
      });

      await publisher.publishMerchantProfile({
        merchantId: 'mer_spoof',
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: 'spoofed.com',
        domain: 'spoofed.com',
        endpointOrigin: 'https://spoofed.com',
        ownerWallet: ownerAccount.address,
        activePayTo: '0.0.777777',
        maxAmount: '500000000',
        profileVersion: 1,
        status: 'active',
        timestamp,
        signature: imposterSignature
      });

      const discovered = await discoveryService.discoverMerchants({ domain: 'spoofed.com' });
      expect(discovered).toHaveLength(1);
      expect(discovered[0]!.verified).toBe(false);
      expect(discovered[0]!.rejectionReason).toBe('SIGNATURE_INVALID');
    });

    it('filters out unverified records when verifiedOnly=true', async () => {
      // 1 valid
      await publisher.publishMerchantProfile(
        {
          merchantId: 'mer_good',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'good.com',
          domain: 'good.com',
          endpointOrigin: 'https://good.com',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.123123',
          maxAmount: '500000000',
          profileVersion: 1,
          status: 'active'
        },
        ownerPrivateKey
      );

      // 1 tampered
      const tamperedPub = await publisher.publishMerchantProfile(
        {
          merchantId: 'mer_bad',
          identityType: 'QUOTESEAL_NATIVE',
          identityRef: 'bad.com',
          domain: 'bad.com',
          endpointOrigin: 'https://bad.com',
          ownerWallet: ownerAccount.address,
          activePayTo: '0.0.321321',
          maxAmount: '500000000',
          profileVersion: 1,
          status: 'active'
        },
        ownerPrivateKey
      );
      storageClient.updateEntity(tamperedPub.entityKey, { activePayTo: '0.0.666666' });

      const all = await discoveryService.discoverMerchants({ verifiedOnly: false });
      expect(all).toHaveLength(2);

      const verifiedOnly = await discoveryService.discoverMerchants({ verifiedOnly: true });
      expect(verifiedOnly).toHaveLength(1);
      expect(verifiedOnly[0]!.merchantId).toBe('mer_good');
    });
  });
});
