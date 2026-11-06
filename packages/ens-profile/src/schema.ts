import { z } from 'zod';

export const EnsMerchantProfileSchema = z.object({
  ensName: z.string().min(1),
  serviceEndpoint: z.string().url(),
  hederaNetwork: z.string().default('hedera:testnet'),
  assetId: z.string().default('HBAR'),
  activePayTo: z.string().min(1),
  maxAmount: z.coerce.bigint().default(1000000000n),
  profileVersion: z.coerce.number().default(1),
  rotationStatus: z.enum(['none', 'pending', 'active', 'revoked']).default('none'),
  pendingPayTo: z.string().optional(),
  pendingEffectiveAt: z.coerce.number().optional(),
  expiresAt: z.coerce.number().optional(),
});

export type EnsMerchantProfile = z.infer<typeof EnsMerchantProfileSchema>;

export const ENS_RECORD_KEYS = {
  SERVICE_ENDPOINT: 'quoteseal.serviceEndpoint',
  HEDERA_NETWORK: 'quoteseal.hederaNetwork',
  ASSET_ID: 'quoteseal.assetId',
  ACTIVE_PAY_TO: 'quoteseal.activePayTo',
  MAX_AMOUNT: 'quoteseal.maxAmount',
  PROFILE_VERSION: 'quoteseal.profileVersion',
  ROTATION_STATUS: 'quoteseal.rotationStatus',
  PENDING_PAY_TO: 'quoteseal.pendingPayTo',
  PENDING_EFFECTIVE_AT: 'quoteseal.pendingEffectiveAt',
} as const;
