import { z } from 'zod';
import { defineSchema, str, addr, u64, bytes } from '@arkiv-network/sdk/schema';
import type { Address, Hex } from 'viem';

// =============================================================================
// 1. PUBLIC MERCHANT PROFILE
// =============================================================================

export const PublicMerchantProfileSchema = z.object({
  merchantId: z.string().min(1),
  identityType: z.enum(['ENSV2', 'QUOTESEAL_NATIVE']),
  identityRef: z.string().min(1),
  domain: z.string().min(1),
  endpointOrigin: z.string().url(),
  ownerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
  activePayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  maxAmount: z.string(),
  profileVersion: z.number().int().positive().default(1),
  status: z.enum(['active', 'pending', 'suspended']).default('active'),
  timestamp: z.number().int().positive(),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/) as z.ZodType<Hex>
});
export type PublicMerchantProfile = z.infer<typeof PublicMerchantProfileSchema>;

export type PublicMerchantProfileInput = Omit<PublicMerchantProfile, 'signature' | 'timestamp'> & {
  signature?: Hex;
  timestamp?: number;
};

// =============================================================================
// 2. MERCHANT PAYMENT POLICY
// =============================================================================

export const MerchantPaymentPolicySchema = z.object({
  merchantId: z.string().min(1),
  network: z.string().default('hedera:testnet'),
  scheme: z.string().default('exact'),
  assetId: z.string().default('0.0.0'),
  maxAmountPerTx: z.string(),
  profileVersion: z.number().int().positive().default(1),
  updatedAt: z.number().int().positive()
});
export type MerchantPaymentPolicy = z.infer<typeof MerchantPaymentPolicySchema>;

// =============================================================================
// 3. PAYOUT ROTATION ANNOUNCEMENT
// =============================================================================

export const PayoutRotationAnnouncementSchema = z.object({
  merchantId: z.string().min(1),
  proposalId: z.string().min(1),
  oldPayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/),
  newPayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/),
  effectiveAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  state: z.string(),
  announcedAt: z.number().int().positive(),
  announcerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/).optional()
});
export type PayoutRotationAnnouncement = z.infer<typeof PayoutRotationAnnouncementSchema>;

// =============================================================================
// 4. PUBLIC AUTHORIZATION EVIDENCE
// =============================================================================

export const PublicAuthorizationEvidenceSchema = z.object({
  merchantId: z.string().min(1),
  proposalId: z.string().min(1),
  attestorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
  signature: z.string().min(1),
  authTime: z.number().int().positive(),
  publishedAt: z.number().int().positive()
});
export type PublicAuthorizationEvidence = z.infer<typeof PublicAuthorizationEvidenceSchema>;

// =============================================================================
// EIP-712 SIGNATURE TYPES FOR ARKIV PUBLIC ENTITIES
// =============================================================================

export const EIP712_ARKIV_DOMAIN = {
  name: 'QuoteSealArkiv',
  version: '1',
  chainId: 7794095 // Rabdi Testnet
} as const;

export const EIP712_ARKIV_PROFILE_TYPES = {
  PublicMerchantProfile: [
    { name: 'merchantId', type: 'string' },
    { name: 'identityType', type: 'string' },
    { name: 'identityRef', type: 'string' },
    { name: 'domain', type: 'string' },
    { name: 'endpointOrigin', type: 'string' },
    { name: 'ownerWallet', type: 'address' },
    { name: 'activePayTo', type: 'string' },
    { name: 'maxAmount', type: 'string' },
    { name: 'profileVersion', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' }
  ]
} as const;

// =============================================================================
// ARKIV SDK NATIVE ENTITY SCHEMAS
// =============================================================================

export const ArkivMerchantProfileEntitySchema: any = defineSchema('quoteseal_merchants', {
  merchantId: str().indexed(),
  identityType: str().indexed(),
  identityRef: str().indexed(),
  domain: str().indexed(),
  ownerWallet: addr().indexed(),
  activePayTo: str().indexed(),
  profileVersion: u64().indexed(),
  endpointOrigin: str(),
  maxAmount: str(),
  status: str(),
  timestamp: u64(),
  signature: str(),
  payloadJson: bytes()
});

export const ArkivPaymentPolicyEntitySchema: any = defineSchema('quoteseal_policies', {
  merchantId: str().indexed(),
  network: str().indexed(),
  scheme: str().indexed(),
  assetId: str().indexed(),
  maxAmountPerTx: str(),
  profileVersion: u64().indexed(),
  updatedAt: u64()
});

export const ArkivRotationAnnouncementEntitySchema: any = defineSchema('quoteseal_rotations', {
  merchantId: str().indexed(),
  proposalId: str().indexed(),
  oldPayTo: str().indexed(),
  newPayTo: str().indexed(),
  effectiveAt: u64(),
  expiresAt: u64(),
  state: str(),
  announcedAt: u64()
});

export const ArkivAuthorizationEvidenceEntitySchema: any = defineSchema('quoteseal_evidence', {
  merchantId: str().indexed(),
  proposalId: str().indexed(),
  attestorAddress: addr().indexed(),
  authTime: u64(),
  publishedAt: u64(),
  signature: str()
});

// =============================================================================
// DISCOVERY & QUERY RESULT TYPES
// =============================================================================

export interface VerifiedMerchantDiscoveryResult {
  merchantId: string;
  identityType: 'ENSV2' | 'QUOTESEAL_NATIVE';
  identityRef: string;
  domain: string;
  endpointOrigin: string;
  ownerWallet: Address;
  activePayTo: string;
  maxAmount: string;
  profileVersion: number;
  status: string;
  timestamp: number;
  signature: Hex;
  entityKey: string;
  verified: boolean;
  rejectionReason?: string;
}
