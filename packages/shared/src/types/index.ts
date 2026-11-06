import { z } from 'zod';

// =============================================================================
// VERDICTS & STATUSES
// =============================================================================

// 1:1 Solidity Contract Verdicts (RotationController.sol: enum Verdict { PASS, BLOCK, HOLD })
export const SolidityVerdict = {
  PASS: 0,
  BLOCK: 1,
  HOLD: 2
} as const;

export const OnChainVerdictSchema = z.enum(['PASS', 'BLOCK', 'HOLD']);
export type OnChainVerdict = z.infer<typeof OnChainVerdictSchema>;

// Off-Chain Verdict Schema: includes 'UNVERIFIABLE' for RPC/transport divergence
export const VerdictSchema = z.enum(['PASS', 'BLOCK', 'HOLD', 'UNVERIFIABLE']);
export type Verdict = z.infer<typeof VerdictSchema>;

export function toOnChainVerdict(solidityIndex: number): OnChainVerdict {
  if (solidityIndex === 0) return 'PASS';
  if (solidityIndex === 1) return 'BLOCK';
  if (solidityIndex === 2) return 'HOLD';
  throw new Error(`Invalid Solidity verdict index: ${solidityIndex}`);
}

export function toSolidityVerdictIndex(verdict: OnChainVerdict): number {
  if (verdict === 'PASS') return SolidityVerdict.PASS;
  if (verdict === 'BLOCK') return SolidityVerdict.BLOCK;
  if (verdict === 'HOLD') return SolidityVerdict.HOLD;
  throw new Error(`Cannot convert verdict '${verdict}' to on-chain Solidity index`);
}

// 1:1 Solidity Contract States (RotationController.sol: enum State { STABLE, PROPOSED, PENDING_APPROVED, ACTIVATED, CANCELLED })
export const SolidityRotationState = {
  STABLE: 0,
  PROPOSED: 1,
  PENDING_APPROVED: 2,
  ACTIVATED: 3,
  CANCELLED: 4
} as const;

export const OnChainRotationStateSchema = z.enum([
  'STABLE',
  'PROPOSED',
  'PENDING_APPROVED',
  'ACTIVATED',
  'CANCELLED'
]);
export type OnChainRotationState = z.infer<typeof OnChainRotationStateSchema>;

export const RotationStateSchema = OnChainRotationStateSchema;
export type RotationState = OnChainRotationState;

export function toRotationState(solidityIndex: number): RotationState {
  switch (solidityIndex) {
    case 0:
      return 'STABLE';
    case 1:
      return 'PROPOSED';
    case 2:
      return 'PENDING_APPROVED';
    case 3:
      return 'ACTIVATED';
    case 4:
      return 'CANCELLED';
    default:
      throw new Error(`Invalid Solidity State enum index: ${solidityIndex}`);
  }
}

export function toSolidityStateIndex(state: RotationState | string): number {
  const normalized = normalizeRotationState(state);
  return SolidityRotationState[normalized];
}

/**
 * Normalizes backend workflow states or text records to canonical on-chain RotationState.
 * E.g., 'pending' or 'APPROVED' -> 'PENDING_APPROVED', 'stable' -> 'STABLE'
 */
export function normalizeRotationState(state: string): RotationState {
  const upper = state.trim().toUpperCase();
  switch (upper) {
    case 'STABLE':
      return 'STABLE';
    case 'PROPOSED':
      return 'PROPOSED';
    case 'PENDING':
    case 'PENDING_APPROVED':
    case 'APPROVED':
      return 'PENDING_APPROVED';
    case 'ACTIVATED':
      return 'ACTIVATED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'STABLE';
  }
}

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
  'OPERATOR_REVOKED',
  'OPERATOR_EXPIRED',
  'SIGNATURE_INVALID',
  'OIDC_STATE_MISMATCH',
  'OIDC_NONCE_MISMATCH',
  'OIDC_STALE_AUTH_TIME',
  'OIDC_INVALID_ACR',
  'OIDC_REPLAY_DETECTED',
  'PROPOSAL_HASH_MISMATCH',
  'CONTRACT_REVERTED'
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

// =============================================================================
// OPERATORS & ENROLLMENT
// =============================================================================

export const OperatorSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  role: z.string().default('ROLE_ROTATION_APPROVER'),
  issuer: z.string(),
  subjectHmac: z.string().length(64),
  status: z.enum(['active', 'revoked', 'expired']),
  enrolledAt: z.date(),
  expiresAt: z.date(),
  revokedAt: z.date().nullable().optional()
});
export type Operator = z.infer<typeof OperatorSchema>;

// =============================================================================
// EIP-712 ROTATION APPROVAL & ENROLLMENT TYPED DATA
// =============================================================================

export const EIP712_DOMAIN_NAME = 'QuoteSeal';
export const EIP712_DOMAIN_VERSION = '1';

export const Hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex string (0x...)') as z.ZodType<`0x${string}`>;

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be 20-byte address (0x...)') as z.ZodType<`0x${string}`>;

export const RotationApprovalDataSchema = z.object({
  merchantId: Hex32Schema,
  proposalId: Hex32Schema,
  operator: AddressSchema,
  resolver: AddressSchema,
  namehash: Hex32Schema,
  oldPayToHash: Hex32Schema,
  newPayToHash: Hex32Schema,
  effectiveAt: z.coerce.bigint(),
  proposalExpiry: z.coerce.bigint(),
  proposalNonce: z.coerce.bigint(),
  authTime: z.coerce.bigint(),
  attestationExpiry: z.coerce.bigint()
});
export type RotationApprovalData = z.infer<typeof RotationApprovalDataSchema>;

export const OperatorEnrollmentDataSchema = z.object({
  merchantId: Hex32Schema,
  operator: AddressSchema,
  role: z.coerce.bigint(),
  expiry: z.coerce.bigint(),
  nonce: z.coerce.bigint(),
  controller: AddressSchema
});
export type OperatorEnrollmentData = z.infer<typeof OperatorEnrollmentDataSchema>;

export * from './merchant-identity.js';

