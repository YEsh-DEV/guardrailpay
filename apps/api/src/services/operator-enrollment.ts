import {
  verifyTypedData,
  type Address,
  type Hex
} from 'viem';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION
} from '@quoteseal/shared';
import { computeSubjectHmac } from './crypto.js';
import type { FastifyBaseLogger } from 'fastify';

export interface OperatorEnrollmentInput {
  merchantId: string;
  walletAddress: Address;
  rawSubjectOrHmac: string;
  isPreHashedSubject?: boolean;
  role?: string;
  expirySeconds?: number;
  expiryTimestamp?: number;
  ownerSignature: Hex;
  nonce?: bigint;
}

export interface OperatorRevocationInput {
  merchantId: string;
  operatorAddress: Address;
  ownerSignature?: Hex;
  reason?: string;
}

export interface EnrolledOperatorResult {
  id: string;
  merchantId: string;
  walletAddress: Address;
  role: string;
  issuer: string;
  subjectHmac: string;
  status: 'active' | 'revoked' | 'expired';
  enrolledAt: Date;
  expiresAt: Date;
}

export const OPERATOR_ENROLLMENT_TYPES = {
  OperatorEnrollment: [
    { name: 'merchantId', type: 'bytes32' },
    { name: 'operator', type: 'address' },
    { name: 'role', type: 'uint256' },
    { name: 'expiry', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
    { name: 'controller', type: 'address' }
  ]
} as const;

export class OperatorEnrollmentService {
  constructor(
    private readonly dbStore: any,
    private readonly config: {
      issuer: string;
      hmacSecret: string;
      chainId: number;
    },
    private readonly logger: FastifyBaseLogger
  ) {}

  /**
   * Enrolls an operator after verifying the merchant owner's cryptographic EIP-712 signature.
   */
  async enrollOperator(input: OperatorEnrollmentInput): Promise<EnrolledOperatorResult> {
    const merchant = await this.dbStore.findMerchantById(input.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${input.merchantId}' not found`);
    }

    const expiryTime = input.expiryTimestamp
      ? input.expiryTimestamp
      : input.expirySeconds
        ? Math.floor(Date.now() / 1000) + input.expirySeconds
        : Math.floor(Date.now() / 1000) + 365 * 86400; // 1 year default

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;
    const merchantIdBytes32 = (merchant.namehash ?? '0x' + merchant.id.replace(/-/g, '').padEnd(64, '0')) as `0x${string}`;
    const nonce = input.nonce ?? 0n;

    // Verify merchant owner EIP-712 signature
    const isValidOwnerSignature = await verifyTypedData({
      address: merchant.ownerAddress as Address,
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: BigInt(merchant.chainId ?? this.config.chainId),
        verifyingContract: controllerAddress
      },
      types: OPERATOR_ENROLLMENT_TYPES,
      primaryType: 'OperatorEnrollment',
      message: {
        merchantId: merchantIdBytes32,
        operator: input.walletAddress,
        role: 1n, // ROTATION_OPERATOR
        expiry: BigInt(expiryTime),
        nonce,
        controller: controllerAddress
      },
      signature: input.ownerSignature
    }).catch((err) => {
      this.logger.warn({ error: err.message }, 'Owner signature verification failed');
      return false;
    });

    if (!isValidOwnerSignature) {
      throw new UnauthorizedError('Invalid merchant owner signature for operator enrollment');
    }

    // Pseudonymize subject if raw subject was provided
    const subjectHmac = input.isPreHashedSubject
      ? input.rawSubjectOrHmac
      : computeSubjectHmac(input.rawSubjectOrHmac, this.config.hmacSecret);

    // Check if operator identity is already enrolled and active
    const existing = await this.dbStore.findOperatorBySubjectHmac(merchant.id, subjectHmac);
    if (existing && existing.status === 'active' && new Date(existing.expiresAt) > new Date()) {
      throw new ConflictError('An active operator is already enrolled with this World ID identity');
    }

    const operatorRecord = {
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      walletAddress: input.walletAddress.toLowerCase() as Address,
      role: input.role ?? 'ROLE_ROTATION_APPROVER',
      issuer: this.config.issuer,
      subjectHmac,
      status: 'active' as const,
      enrolledAt: new Date(),
      expiresAt: new Date(expiryTime * 1000),
      revokedAt: null
    };

    await this.dbStore.saveOperator(operatorRecord);

    this.logger.info(
      {
        operatorId: operatorRecord.id,
        merchantId: merchant.id,
        walletAddress: input.walletAddress
      },
      'Operator successfully enrolled by merchant owner'
    );

    return operatorRecord;
  }

  /**
   * Revokes an enrolled operator. Only the merchant owner can authorize revocation.
   */
  async revokeOperator(input: OperatorRevocationInput, callerAddress: Address): Promise<void> {
    const merchant = await this.dbStore.findMerchantById(input.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${input.merchantId}' not found`);
    }

    if (callerAddress.toLowerCase() !== merchant.ownerAddress.toLowerCase()) {
      throw new UnauthorizedError('Only the merchant owner can revoke operators');
    }

    const operator = await this.dbStore.findOperatorByWallet(merchant.id, input.operatorAddress.toLowerCase());
    if (!operator) {
      throw new NotFoundError(`Operator '${input.operatorAddress}' not found for this merchant`);
    }

    await this.dbStore.updateOperatorStatus(operator.id, 'revoked');

    this.logger.info(
      {
        operatorId: operator.id,
        merchantId: merchant.id,
        operatorAddress: input.operatorAddress,
        reason: input.reason
      },
      'Operator revoked by merchant owner'
    );
  }
}
