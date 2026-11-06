import { z } from 'zod';

const Hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex string (0x...)') as z.ZodType<`0x${string}`>;

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be 20-byte address (0x...)') as z.ZodType<`0x${string}`>;

// =============================================================================
// IDENTITY TYPES & SCHEMAS
// =============================================================================

export const IdentityTypeSchema = z.enum(['ENSV2', 'QUOTESEAL_NATIVE']);
export type IdentityType = z.infer<typeof IdentityTypeSchema>;

export const DomainChallengeTypeSchema = z.enum(['DNS_TXT', 'HTTPS_WELL_KNOWN']);
export type DomainChallengeType = z.infer<typeof DomainChallengeTypeSchema>;

export const ChallengeStatusSchema = z.enum(['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED']);
export type ChallengeStatus = z.infer<typeof ChallengeStatusSchema>;

export const PayoutWalletStatusSchema = z.enum(['PENDING', 'ACTIVE', 'ARCHIVED', 'REVOKED']);
export type PayoutWalletStatus = z.infer<typeof PayoutWalletStatusSchema>;

// =============================================================================
// NORMALIZED MERCHANT PROFILE
// =============================================================================

export const NormalizedMerchantProfileSchema = z.object({
  id: z.string().uuid(),
  identityType: IdentityTypeSchema,
  identityRef: z.string().min(1).max(255),
  endpointOrigin: z.string().url(),
  ownerAddress: AddressSchema,
  activePayTo: z.string().min(1),
  maxAmount: z.string().default('500000000'),
  network: z.string().default('hedera:testnet'),
  scheme: z.string().default('exact'),
  assetId: z.string().default('0.0.0'),
  profileVersion: z.number().int().positive().default(1),
  status: z.enum(['active', 'suspended', 'pending']).default('pending'),
  // Optional Native identity domain details
  domain: z.string().optional(),
  domainVerifiedAt: z.date().nullable().optional(),
  // Optional ENSv2 details
  ensName: z.string().min(3).max(255).optional(),
  namehash: Hex32Schema.optional(),
  registryAddress: AddressSchema.optional(),
  resolverAddress: AddressSchema.optional(),
  controllerAddress: AddressSchema.optional(),
  nameExpiry: z.number().int().nonnegative().optional(),
  createdAt: z.date().optional()
});
export type NormalizedMerchantProfile = z.infer<typeof NormalizedMerchantProfileSchema>;

// =============================================================================
// DOMAIN CHALLENGE & NONCE
// =============================================================================

export const MerchantDomainChallengeSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  domain: z.string().min(1).max(255),
  challengeType: DomainChallengeTypeSchema,
  token: z.string().min(16).max(128),
  status: ChallengeStatusSchema.default('PENDING'),
  createdAt: z.date(),
  expiresAt: z.date(),
  verifiedAt: z.date().nullable().optional()
});
export type MerchantDomainChallenge = z.infer<typeof MerchantDomainChallengeSchema>;

export const OnboardingNonceSchema = z.object({
  nonce: z.string().min(16).max(128),
  merchantId: z.string().optional(),
  walletAddress: AddressSchema,
  endpointOrigin: z.string().url(),
  expiresAt: z.date(),
  consumedAt: z.date().nullable().optional(),
  createdAt: z.date()
});
export type OnboardingNonce = z.infer<typeof OnboardingNonceSchema>;

// =============================================================================
// OPERATIONAL MULTI-PAYOUT WALLET
// =============================================================================

export const MerchantPayoutWalletSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  payTo: z.string().min(1).max(64),
  isActive: z.boolean().default(false),
  status: PayoutWalletStatusSchema.default('PENDING'),
  label: z.string().max(128).nullable().optional(),
  enrolledAt: z.date(),
  revokedAt: z.date().nullable().optional()
});
export type MerchantPayoutWallet = z.infer<typeof MerchantPayoutWalletSchema>;

// =============================================================================
// EIP-712 TYPED DATA DEFINITIONS FOR NATIVE ONBOARDING
// =============================================================================

export const EIP712_ONBOARDING_TYPES = {
  MerchantOnboarding: [
    { name: 'ownerWallet', type: 'address' },
    { name: 'endpointOrigin', type: 'string' },
    { name: 'domain', type: 'string' },
    { name: 'activePayTo', type: 'string' },
    { name: 'maxAmount', type: 'string' },
    { name: 'nonce', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'expiresAt', type: 'uint256' }
  ]
} as const;

export const OnboardNativeMerchantSchema = z.object({
  ownerWallet: AddressSchema,
  endpointOrigin: z.string().url(),
  domain: z.string().min(1).max(255),
  activePayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  maxAmount: z.string().default('500000000'),
  nonce: z.string().min(16),
  action: z.literal('ONBOARD_MERCHANT').default('ONBOARD_MERCHANT'),
  expiresAt: z.number().int().positive(),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Must be 65-byte hex signature (0x...)')
});
export type OnboardNativeMerchantPayload = z.infer<typeof OnboardNativeMerchantSchema>;

// =============================================================================
// ARKIV ENTITY ATTRIBUTES & SCHEMAS
// =============================================================================

export const ArkivSyncRecordSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  entityKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  entityType: z.string().min(1).max(64),
  version: z.number().int().positive().default(1),
  txHash: z.string().nullable().optional(),
  payloadJson: z.record(z.unknown()).nullable().optional(),
  syncedAt: z.date(),
  status: z.enum(['CONFIRMED', 'PENDING', 'FAILED']).default('CONFIRMED')
});
export type ArkivSyncRecord = z.infer<typeof ArkivSyncRecordSchema>;
