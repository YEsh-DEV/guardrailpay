import {
  type VerifiedMerchantDiscoveryResult,
  ArkivMerchantProfileEntitySchema,
  EIP712_ARKIV_DOMAIN,
  EIP712_ARKIV_PROFILE_TYPES
} from './types.js';
import type { IArkivStorageClient } from './client.js';
import { verifyTypedData, type Address, type Hex } from 'viem';

export interface DiscoveryFilter {
  domain?: string;
  activePayTo?: string;
  identityType?: string;
  verifiedOnly?: boolean;
}

export class ArkivDiscoveryService {
  constructor(private readonly storageClient: IArkivStorageClient) {}

  /**
   * Discovers and verifies public merchant profiles from Arkiv.
   * Cryptographically verifies the owner wallet signature for every returned profile.
   */
  async discoverMerchants(filter: DiscoveryFilter = {}): Promise<VerifiedMerchantDiscoveryResult[]> {
    const queryFilters: Record<string, unknown> = {};
    if (filter.domain) queryFilters.domain = filter.domain;
    if (filter.activePayTo) queryFilters.activePayTo = filter.activePayTo;
    if (filter.identityType) queryFilters.identityType = filter.identityType;

    const entities = await this.storageClient.queryEntities({
      schema: ArkivMerchantProfileEntitySchema,
      filters: Object.keys(queryFilters).length > 0 ? queryFilters : undefined
    });

    const results: VerifiedMerchantDiscoveryResult[] = [];

    for (const item of entities) {
      const v = item.values;
      const merchantId = String(v.merchantId ?? '');
      const identityType = String(v.identityType ?? 'QUOTESEAL_NATIVE') as 'ENSV2' | 'QUOTESEAL_NATIVE';
      const identityRef = String(v.identityRef ?? '');
      const domain = String(v.domain ?? '');
      const endpointOrigin = String(v.endpointOrigin ?? '');
      const ownerWallet = String(v.ownerWallet ?? '') as Address;
      const activePayTo = String(v.activePayTo ?? '');
      const maxAmount = String(v.maxAmount ?? '0');
      const profileVersion = Number(v.profileVersion ?? 1);
      const status = String(v.status ?? 'active');
      const timestamp = Number(v.timestamp ?? 0);
      const signature = String(v.signature ?? '') as Hex;

      let verified = false;
      let rejectionReason: string | undefined;

      try {
        if (!signature || !ownerWallet) {
          rejectionReason = 'MISSING_SIGNATURE_OR_OWNER';
        } else {
          verified = await verifyTypedData({
            address: ownerWallet,
            domain: EIP712_ARKIV_DOMAIN,
            types: EIP712_ARKIV_PROFILE_TYPES,
            primaryType: 'PublicMerchantProfile',
            message: {
              merchantId,
              identityType,
              identityRef,
              domain,
              endpointOrigin,
              ownerWallet,
              activePayTo,
              maxAmount,
              profileVersion: BigInt(profileVersion),
              timestamp: BigInt(timestamp)
            },
            signature
          });

          if (!verified) {
            rejectionReason = 'SIGNATURE_INVALID';
          }
        }
      } catch (err: unknown) {
        verified = false;
        rejectionReason = `VERIFICATION_ERROR: ${(err as Error).message}`;
      }

      if (filter.verifiedOnly && !verified) {
        continue;
      }

      results.push({
        merchantId,
        identityType,
        identityRef,
        domain,
        endpointOrigin,
        ownerWallet,
        activePayTo,
        maxAmount,
        profileVersion,
        status,
        timestamp,
        signature,
        entityKey: item.entityKey,
        verified,
        rejectionReason
      });
    }

    return results;
  }

  /**
   * Retrieves a single merchant profile by entityKey or merchantId and verifies it.
   */
  async getMerchantProfile(keyOrId: string): Promise<VerifiedMerchantDiscoveryResult | null> {
    let raw = await this.storageClient.getEntity(keyOrId);
    if (!raw) {
      const all = await this.discoverMerchants();
      const match = all.find((m) => m.merchantId === keyOrId || m.entityKey === keyOrId);
      return match ?? null;
    }

    const all = await this.discoverMerchants();
    return all.find((m) => m.entityKey === keyOrId) ?? null;
  }
}
