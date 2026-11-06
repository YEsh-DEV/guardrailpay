import {
  type PublicMerchantProfile,
  type PublicMerchantProfileInput,
  type MerchantPaymentPolicy,
  type PayoutRotationAnnouncement,
  type PublicAuthorizationEvidence,
  PublicMerchantProfileSchema,
  MerchantPaymentPolicySchema,
  PayoutRotationAnnouncementSchema,
  PublicAuthorizationEvidenceSchema,
  ArkivMerchantProfileEntitySchema,
  ArkivPaymentPolicyEntitySchema,
  ArkivRotationAnnouncementEntitySchema,
  ArkivAuthorizationEvidenceEntitySchema,
  EIP712_ARKIV_DOMAIN,
  EIP712_ARKIV_PROFILE_TYPES
} from './types.js';
import type { IArkivStorageClient } from './client.js';
import { signTypedData } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';

export interface PublishResult {
  entityKey: string;
  txHash: string;
  version: number;
  publishedAt: number;
}

export class ArkivPublisher {
  constructor(private readonly storageClient: IArkivStorageClient) {}

  /**
   * Publishes a versioned, merchant-signed PublicMerchantProfile to Arkiv.
   */
  async publishMerchantProfile(
    input: PublicMerchantProfileInput,
    ownerPrivateKey?: Hex
  ): Promise<PublishResult> {
    const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);

    let signature = input.signature;
    if (!signature) {
      if (!ownerPrivateKey) {
        throw new Error('Either a valid signature or an ownerPrivateKey must be provided to publish a merchant profile');
      }
      const account = privateKeyToAccount(ownerPrivateKey);
      if (account.address.toLowerCase() !== input.ownerWallet.toLowerCase()) {
        throw new Error(`Owner private key address ${account.address} does not match ownerWallet ${input.ownerWallet}`);
      }

      signature = await signTypedData({
        privateKey: ownerPrivateKey,
        domain: EIP712_ARKIV_DOMAIN,
        types: EIP712_ARKIV_PROFILE_TYPES,
        primaryType: 'PublicMerchantProfile',
        message: {
          merchantId: input.merchantId,
          identityType: input.identityType,
          identityRef: input.identityRef,
          domain: input.domain,
          endpointOrigin: input.endpointOrigin,
          ownerWallet: input.ownerWallet as Address,
          activePayTo: input.activePayTo,
          maxAmount: input.maxAmount,
          profileVersion: BigInt(input.profileVersion),
          timestamp: BigInt(timestamp)
        }
      });
    }

    const fullProfile: PublicMerchantProfile = {
      ...input,
      timestamp,
      signature
    };

    const validated = PublicMerchantProfileSchema.parse(fullProfile);
    const payloadBytes = `0x${Buffer.from(JSON.stringify(validated)).toString('hex')}`;

    const { entityKey, txHash } = await this.storageClient.createEntity({
      schema: ArkivMerchantProfileEntitySchema,
      values: {
        merchantId: validated.merchantId,
        identityType: validated.identityType,
        identityRef: validated.identityRef,
        domain: validated.domain,
        ownerWallet: validated.ownerWallet,
        activePayTo: validated.activePayTo,
        profileVersion: BigInt(validated.profileVersion),
        endpointOrigin: validated.endpointOrigin,
        maxAmount: validated.maxAmount,
        status: validated.status,
        timestamp: BigInt(validated.timestamp),
        signature: validated.signature,
        payloadJson: payloadBytes
      }
    });

    return {
      entityKey,
      txHash,
      version: validated.profileVersion,
      publishedAt: validated.timestamp
    };
  }

  /**
   * Publishes MerchantPaymentPolicy to Arkiv.
   */
  async publishPaymentPolicy(policy: MerchantPaymentPolicy): Promise<PublishResult> {
    const validated = MerchantPaymentPolicySchema.parse(policy);

    const { entityKey, txHash } = await this.storageClient.createEntity({
      schema: ArkivPaymentPolicyEntitySchema,
      values: {
        merchantId: validated.merchantId,
        network: validated.network,
        scheme: validated.scheme,
        assetId: validated.assetId,
        maxAmountPerTx: validated.maxAmountPerTx,
        profileVersion: BigInt(validated.profileVersion),
        updatedAt: BigInt(validated.updatedAt)
      }
    });

    return {
      entityKey,
      txHash,
      version: validated.profileVersion,
      publishedAt: validated.updatedAt
    };
  }

  /**
   * Publishes PayoutRotationAnnouncement to Arkiv.
   */
  async publishRotationAnnouncement(announcement: PayoutRotationAnnouncement): Promise<PublishResult> {
    const validated = PayoutRotationAnnouncementSchema.parse(announcement);

    const { entityKey, txHash } = await this.storageClient.createEntity({
      schema: ArkivRotationAnnouncementEntitySchema,
      values: {
        merchantId: validated.merchantId,
        proposalId: validated.proposalId,
        oldPayTo: validated.oldPayTo,
        newPayTo: validated.newPayTo,
        effectiveAt: BigInt(validated.effectiveAt),
        expiresAt: BigInt(validated.expiresAt),
        state: validated.state,
        announcedAt: BigInt(validated.announcedAt)
      }
    });

    return {
      entityKey,
      txHash,
      version: 1,
      publishedAt: validated.announcedAt
    };
  }

  /**
   * Publishes PublicAuthorizationEvidence to Arkiv.
   */
  async publishAuthorizationEvidence(evidence: PublicAuthorizationEvidence): Promise<PublishResult> {
    const validated = PublicAuthorizationEvidenceSchema.parse(evidence);

    const { entityKey, txHash } = await this.storageClient.createEntity({
      schema: ArkivAuthorizationEvidenceEntitySchema,
      values: {
        merchantId: validated.merchantId,
        proposalId: validated.proposalId,
        attestorAddress: validated.attestorAddress,
        authTime: BigInt(validated.authTime),
        publishedAt: BigInt(validated.publishedAt),
        signature: validated.signature
      }
    });

    return {
      entityKey,
      txHash,
      version: 1,
      publishedAt: validated.publishedAt
    };
  }
}
