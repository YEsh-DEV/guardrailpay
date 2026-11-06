import { z } from 'zod';

// =============================================================================
// VERDICTS & STATUSES
// =============================================================================

export const VerdictSchema = z.enum(['PASS', 'HOLD', 'BLOCK', 'UNVERIFIABLE']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const RotationStateSchema = z.enum([
  'STABLE',
  'PROPOSED',
  'APPROVED',
  'ACTIVATED',
  'CANCELLED'
]);
export type RotationState = z.infer<typeof RotationStateSchema>;

export const ReasonCodeSchema = z.enum([
  'OK',
  'PAYTO_MISMATCH',
  'ANCHOR_MISMATCH',
  'ANCHOR_OWNER_MISMATCH',
  'ANCHOR_RESOLVER_MISMATCH',
  'ANCHOR_EXPIRY_EXPIRED',
  'ANCHOR_VERSION_MISMATCH',
  'RPC_DISAGREEMENT',
  'RPC_FINALITY_LAG',
  'UNTRUSTED_MERCHANT',
  'INVALID_ORIGIN',
  'AMOUNT_EXCEEDED',
  'UNSUPPORTED_NETWORK',
  'UNSUPPORTED_SCHEME',
  'UNSUPPORTED_ASSET',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_ALREADY_CONSUMED',
  'OPERATOR_UNAUTHORIZED',
  'SIGNATURE_INVALID'
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

// =============================================================================
// DOMAIN MODELS & SCHEMAS
// =============================================================================

export const MerchantProfileSchema = z.object({
  ensName: z.string().min(3).max(255),
  namehash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  endpointOrigin: z.string().url(),
  chainId: z.number().int().positive(),
  registryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  resolverAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nameExpiry: z.number().int().nonnegative(),
  profileVersion: z.number().int().positive().default(1),
  network: z.string().default('hedera:testnet'),
  scheme: z.string().default('exact'),
  assetId: z.string().default('0.0.0'),
  activePayTo: z.string().min(1),
  pendingPayTo: z.string().nullable().optional(),
  rotationStatus: RotationStateSchema.default('STABLE'),
  maxAmount: z.string(),
  status: z.enum(['active', 'suspended', 'pending']).default('active')
});
export type MerchantProfile = z.infer<typeof MerchantProfileSchema>;

export const TrustAnchorsSchema = z.object({
  trustedOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  trustedResolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  trustedExpiry: z.number().int().nonnegative(),
  trustedProfileVersion: z.number().int().positive()
});
export type TrustAnchors = z.infer<typeof TrustAnchorsSchema>;

export const RotationProposalSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  oldPayTo: z.string().min(1),
  newPayTo: z.string().min(1),
  proposalHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  proposalNonce: z.number().int().nonnegative(),
  proposedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  proposedAt: z.date(),
  effectiveAt: z.date().nullable().optional(),
  expiresAt: z.date(),
  state: RotationStateSchema,
  activatedTx: z.string().nullable().optional(),
  cancelledAt: z.date().nullable().optional(),
  reasonCode: z.string().nullable().optional()
});
export type RotationProposal = z.infer<typeof RotationProposalSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  eventType: z.string(),
  decisionId: z.string(),
  proposalId: z.string().uuid().nullable().optional(),
  verdict: VerdictSchema,
  reasonCode: ReasonCodeSchema,
  chainId: z.number().int(),
  blockNumber: z.number().int(),
  blockHash: z.string(),
  txHash: z.string().nullable().optional(),
  metadataJson: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date()
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
