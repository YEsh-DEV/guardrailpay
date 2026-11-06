import {
  privateKeyToAccount,
  type PrivateKeyAccount
} from 'viem/accounts';
import {
  stringToBytes,
  keccak256,
  encodeAbiParameters,
  type Address,
  type Hex
} from 'viem';
import {
  AttestationError,
  NotFoundError,
  ProposalStateError,
  OperatorRevokedError,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  type RotationApprovalData
} from '@quoteseal/shared';
import type { FastifyBaseLogger } from 'fastify';

export interface AttestorConfig {
  attestorPrivateKey: Hex;
  attestationTtlSeconds: number;
  maxAuthAgeSeconds: number;
  chainId: number;
}

export interface GenerateAttestationInput {
  proposalId: string;
  operatorId: string;
  authAttemptId: string;
  authTime: number; // unix epoch seconds
  acr: string;
  amr: string[];
}

export interface AttestationResult {
  approvalData: RotationApprovalData;
  signature: Hex;
  signatureHash: Hex;
  attestorAddress: Address;
  effectiveAt: bigint;
  attestationExpiry: bigint;
}

export const ROTATION_APPROVAL_TYPES = {
  RotationApproval: [
    { name: 'merchantId', type: 'bytes32' },
    { name: 'proposalId', type: 'bytes32' },
    { name: 'operator', type: 'address' },
    { name: 'resolver', type: 'address' },
    { name: 'namehash', type: 'bytes32' },
    { name: 'oldPayToHash', type: 'bytes32' },
    { name: 'newPayToHash', type: 'bytes32' },
    { name: 'effectiveAt', type: 'uint64' },
    { name: 'proposalExpiry', type: 'uint64' },
    { name: 'proposalNonce', type: 'uint256' },
    { name: 'authTime', type: 'uint64' },
    { name: 'attestationExpiry', type: 'uint64' }
  ]
} as const;

export class AttestorService {
  private readonly attestorAccount: PrivateKeyAccount;

  constructor(
    private readonly config: AttestorConfig,
    private readonly dbStore: any,
    private readonly logger: FastifyBaseLogger
  ) {
    this.attestorAccount = privateKeyToAccount(this.config.attestorPrivateKey);
  }

  getAttestorAddress(): Address {
    return this.attestorAccount.address;
  }

  /**
   * Validates proposal state and operator enrollment, then signs the EIP-712 RotationApproval.
   */
  async signProposalApproval(input: GenerateAttestationInput): Promise<AttestationResult> {
    const proposal = await this.dbStore.findProposalById(input.proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${input.proposalId}' not found`);
    }

    if (proposal.state !== 'PROPOSED') {
      throw new ProposalStateError(
        `Cannot approve proposal in state '${proposal.state}'; only 'PROPOSED' state may be approved`
      );
    }

    if (new Date(proposal.expiresAt) <= new Date()) {
      throw new AttestationError('Proposal has expired on-chain');
    }

    const merchant = await this.dbStore.findMerchantById(proposal.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${proposal.merchantId}' not found`);
    }

    const operator = await this.dbStore.findOperatorById(input.operatorId);
    if (!operator) {
      throw new NotFoundError(`Operator '${input.operatorId}' not found`);
    }

    if (operator.status !== 'active') {
      throw new OperatorRevokedError(`Operator is not active (status: ${operator.status})`);
    }

    if (new Date(operator.expiresAt) <= new Date()) {
      throw new AttestationError('Operator enrollment has expired');
    }

    // Validate authTime freshness against maxAuthAge
    const nowEpoch = BigInt(Math.floor(Date.now() / 1000));
    const authTimeBigInt = BigInt(input.authTime);

    if (nowEpoch - authTimeBigInt > BigInt(this.config.maxAuthAgeSeconds)) {
      throw new AttestationError(
        `Authentication is too old: authTime was ${nowEpoch - authTimeBigInt}s ago, max allowed is ${this.config.maxAuthAgeSeconds}s`
      );
    }

    const rotationDelaySeconds = BigInt(merchant.rotationDelaySeconds ?? 86400);
    const effectiveAt = nowEpoch + rotationDelaySeconds;
    const proposalExpiryBigInt = BigInt(Math.floor(new Date(proposal.expiresAt).getTime() / 1000));

    if (effectiveAt >= proposalExpiryBigInt) {
      throw new AttestationError('Proposal expires before rotation delay would elapse');
    }

    // Attestation TTL calculation: authTime + attestationTTL, capped at proposalExpiry
    const maxAttestationExpiry = authTimeBigInt + BigInt(this.config.attestationTtlSeconds);
    const attestationExpiry = maxAttestationExpiry < proposalExpiryBigInt ? maxAttestationExpiry : proposalExpiryBigInt;

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;
    const resolverAddress = merchant.resolverAddress as Address;
    const namehash = merchant.namehash as `0x${string}`;
    const merchantIdBytes32 = (merchant.namehash ?? '0x' + merchant.id.replace(/-/g, '').padEnd(64, '0')) as `0x${string}`;

    const oldPayToHash = keccak256(stringToBytes(proposal.oldPayTo));
    const newPayToHash = keccak256(stringToBytes(proposal.newPayTo));

    const proposalIdBytes32 = proposal.proposalHash as `0x${string}`;
    const proposalNonceBigInt = BigInt(proposal.proposalNonce);

    const approvalData: RotationApprovalData = {
      merchantId: merchantIdBytes32,
      proposalId: proposalIdBytes32,
      operator: operator.walletAddress as Address,
      resolver: resolverAddress,
      namehash,
      oldPayToHash,
      newPayToHash,
      effectiveAt,
      proposalExpiry: proposalExpiryBigInt,
      proposalNonce: proposalNonceBigInt,
      authTime: authTimeBigInt,
      attestationExpiry
    };

    // Sign EIP-712 typed data
    const signature = await this.attestorAccount.signTypedData({
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: BigInt(merchant.chainId ?? this.config.chainId),
        verifyingContract: controllerAddress
      },
      types: ROTATION_APPROVAL_TYPES,
      primaryType: 'RotationApproval',
      message: approvalData
    });

    const signatureHash = keccak256(signature);

    // Save approval record
    await this.dbStore.saveApproval({
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      operatorId: operator.id,
      authAttemptId: input.authAttemptId,
      authTime: input.authTime,
      acr: input.acr,
      amr: input.amr.join(','),
      attestor: this.attestorAccount.address,
      signature,
      signatureHash,
      attestationExpiry: Number(attestationExpiry),
      expiresAt: new Date(Number(attestationExpiry) * 1000),
      consumedAt: null
    });

    // Update proposal in DB
    await this.dbStore.updateProposalState(proposal.id, 'PENDING_APPROVED', {
      effectiveAt: new Date(Number(effectiveAt) * 1000)
    });

    this.logger.info(
      {
        proposalId: proposal.id,
        attestor: this.attestorAccount.address,
        signatureHash,
        effectiveAt: Number(effectiveAt)
      },
      'EIP-712 rotation approval signed successfully'
    );

    return {
      approvalData,
      signature,
      signatureHash,
      attestorAddress: this.attestorAccount.address,
      effectiveAt,
      attestationExpiry
    };
  }
}
