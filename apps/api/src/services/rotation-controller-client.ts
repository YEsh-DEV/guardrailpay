import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from 'viem';
import {
  ContractExecutionError,
  ProposalStateError,
  UnauthorizedError,
  type RotationApprovalData,
  type RotationState
} from '@quoteseal/shared';

export interface ContractProposal {
  id: Hex;
  operator: Address;
  oldPayTo: string;
  newPayTo: string;
  proposedAt: bigint;
  effectiveAt: bigint;
  expiry: bigint;
  nonce: bigint;
  state: RotationState;
}

export const ROTATION_CONTROLLER_ABI = [
  {
    type: 'function',
    name: 'activateRotation',
    inputs: [{ name: 'proposalId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'approveWithAttestation',
    inputs: [
      {
        name: 'a',
        type: 'tuple',
        internalType: 'struct RotationController.RotationApproval',
        components: [
          { name: 'merchantId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'proposalId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'operator', type: 'address', internalType: 'address' },
          { name: 'resolver', type: 'address', internalType: 'address' },
          { name: 'namehash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'oldPayToHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'newPayToHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'effectiveAt', type: 'uint64', internalType: 'uint64' },
          { name: 'proposalExpiry', type: 'uint64', internalType: 'uint64' },
          { name: 'proposalNonce', type: 'uint256', internalType: 'uint256' },
          { name: 'authTime', type: 'uint64', internalType: 'uint64' },
          { name: 'attestationExpiry', type: 'uint64', internalType: 'uint64' }
        ]
      },
      { name: 'signature', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'cancelPendingRotation',
    inputs: [
      { name: 'proposalId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'reasonCode', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'enrollOperator',
    inputs: [
      {
        name: 'e',
        type: 'tuple',
        internalType: 'struct RotationController.Enrollment',
        components: [
          { name: 'merchantId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'operator', type: 'address', internalType: 'address' },
          { name: 'role', type: 'uint256', internalType: 'uint256' },
          { name: 'expiry', type: 'uint64', internalType: 'uint64' },
          { name: 'nonce', type: 'uint256', internalType: 'uint256' },
          { name: 'controller', type: 'address', internalType: 'address' }
        ]
      },
      { name: 'ownerSignature', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getRotationState',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct RotationController.Proposal',
        components: [
          { name: 'id', type: 'bytes32', internalType: 'bytes32' },
          { name: 'operator', type: 'address', internalType: 'address' },
          { name: 'oldPayTo', type: 'string', internalType: 'string' },
          { name: 'newPayTo', type: 'string', internalType: 'string' },
          { name: 'proposedAt', type: 'uint64', internalType: 'uint64' },
          { name: 'effectiveAt', type: 'uint64', internalType: 'uint64' },
          { name: 'expiry', type: 'uint64', internalType: 'uint64' },
          { name: 'nonce', type: 'uint256', internalType: 'uint256' },
          { name: 'state', type: 'uint8', internalType: 'enum RotationController.State' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'payoutVerdict',
    inputs: [{ name: 'payTo', type: 'string', internalType: 'string' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum RotationController.Verdict' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'proposeRotation',
    inputs: [
      { name: 'newPayTo', type: 'string', internalType: 'string' },
      { name: 'proposalExpiry', type: 'uint64', internalType: 'uint64' }
    ],
    outputs: [{ name: 'id', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'revokeOperator',
    inputs: [{ name: 'operator', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'activePayTo',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'pendingPayTo',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'profileVersion',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'operatorExpiry',
    inputs: [{ name: 'operator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint64', internalType: 'uint64' }],
    stateMutability: 'view'
  }
] as const;

export interface IRotationControllerClient {
  getProposalState(controllerAddress: Address): Promise<ContractProposal>;
  payoutVerdict(controllerAddress: Address, payTo: string): Promise<'PASS' | 'BLOCK' | 'HOLD'>;
  proposeRotation(
    controllerAddress: Address,
    newPayTo: string,
    proposalExpiry: bigint,
    walletClient: any
  ): Promise<{ txHash: Hex; proposalId: Hex }>;
  approveWithAttestation(
    controllerAddress: Address,
    approval: RotationApprovalData,
    signature: Hex,
    walletClient: any
  ): Promise<Hex>;
  activateRotation(
    controllerAddress: Address,
    proposalId: Hex,
    walletClient: any
  ): Promise<Hex>;
  cancelPendingRotation(
    controllerAddress: Address,
    proposalId: Hex,
    reasonCode: Hex,
    walletClient: any
  ): Promise<Hex>;
  isOperatorActive(controllerAddress: Address, operator: Address): Promise<boolean>;
}

const STATE_MAP: Record<number, RotationState> = {
  0: 'STABLE',
  1: 'PROPOSED',
  2: 'PENDING_APPROVED',
  3: 'ACTIVATED',
  4: 'CANCELLED'
};

const VERDICT_MAP: Record<number, 'PASS' | 'BLOCK' | 'HOLD'> = {
  0: 'PASS',
  1: 'BLOCK',
  2: 'HOLD'
};

export class LiveRotationControllerClient implements IRotationControllerClient {
  constructor(private readonly publicClient: PublicClient) {}

  async getProposalState(controllerAddress: Address): Promise<ContractProposal> {
    const raw: any = await this.publicClient.readContract({
      address: controllerAddress,
      abi: ROTATION_CONTROLLER_ABI,
      functionName: 'getRotationState'
    });

    return {
      id: raw.id,
      operator: raw.operator,
      oldPayTo: raw.oldPayTo,
      newPayTo: raw.newPayTo,
      proposedAt: raw.proposedAt,
      effectiveAt: raw.effectiveAt,
      expiry: raw.expiry,
      nonce: raw.nonce,
      state: STATE_MAP[raw.state] ?? 'STABLE'
    };
  }

  async payoutVerdict(controllerAddress: Address, payTo: string): Promise<'PASS' | 'BLOCK' | 'HOLD'> {
    const raw: any = await this.publicClient.readContract({
      address: controllerAddress,
      abi: ROTATION_CONTROLLER_ABI,
      functionName: 'payoutVerdict',
      args: [payTo]
    });

    return VERDICT_MAP[raw] ?? 'BLOCK';
  }

  async proposeRotation(
    controllerAddress: Address,
    newPayTo: string,
    proposalExpiry: bigint,
    walletClient: any
  ): Promise<{ txHash: Hex; proposalId: Hex }> {
    try {
      const txHash = await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'proposeRotation',
        args: [newPayTo, proposalExpiry]
      });

      // Fetch new proposal state to get assigned proposalId
      const proposal = await this.getProposalState(controllerAddress);
      return { txHash, proposalId: proposal.id };
    } catch (err: any) {
      throw new ContractExecutionError(`proposeRotation transaction failed: ${err.message}`);
    }
  }

  async approveWithAttestation(
    controllerAddress: Address,
    approval: RotationApprovalData,
    signature: Hex,
    walletClient: any
  ): Promise<Hex> {
    try {
      return await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'approveWithAttestation',
        args: [approval, signature]
      });
    } catch (err: any) {
      throw new ContractExecutionError(`approveWithAttestation transaction failed: ${err.message}`);
    }
  }

  async activateRotation(
    controllerAddress: Address,
    proposalId: Hex,
    walletClient: any
  ): Promise<Hex> {
    try {
      return await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'activateRotation',
        args: [proposalId]
      });
    } catch (err: any) {
      throw new ContractExecutionError(`activateRotation transaction failed: ${err.message}`);
    }
  }

  async cancelPendingRotation(
    controllerAddress: Address,
    proposalId: Hex,
    reasonCode: Hex,
    walletClient: any
  ): Promise<Hex> {
    try {
      return await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'cancelPendingRotation',
        args: [proposalId, reasonCode]
      });
    } catch (err: any) {
      throw new ContractExecutionError(`cancelPendingRotation transaction failed: ${err.message}`);
    }
  }

  async isOperatorActive(controllerAddress: Address, operator: Address): Promise<boolean> {
    const expiry: any = await this.publicClient.readContract({
      address: controllerAddress,
      abi: ROTATION_CONTROLLER_ABI,
      functionName: 'operatorExpiry',
      args: [operator]
    });
    const now = BigInt(Math.floor(Date.now() / 1000));
    return expiry > now;
  }
}

/**
 * In-memory Mock Rotation Controller Client for unit testing.
 * Replicates smart contract state machine rules deterministically.
 */
export class MockRotationControllerClient implements IRotationControllerClient {
  public proposal: ContractProposal | null = null;
  public activePayToValue: string = '0.0.987654';
  public pendingPayToValue: string | null = null;
  public profileVersionValue: bigint = 1n;
  public operators = new Map<string, bigint>();
  public shouldFailTx: boolean = false;
  public failErrorMessage: string = 'Execution reverted: simulated failure';
  public bypassTimelock: boolean = false;

  setShouldRevert(shouldRevert: boolean, message?: string) {
    this.shouldFailTx = shouldRevert;
    if (message) this.failErrorMessage = message;
  }

  setBypassTimelock(bypass: boolean) {
    this.bypassTimelock = bypass;
  }

  async getProposalState(_controllerAddress: Address): Promise<ContractProposal> {
    if (!this.proposal) {
      return {
        id: '0x0000000000000000000000000000000000000000000000000000000000000000',
        operator: '0x0000000000000000000000000000000000000000',
        oldPayTo: this.activePayToValue,
        newPayTo: '',
        proposedAt: 0n,
        effectiveAt: 0n,
        expiry: 0n,
        nonce: 0n,
        state: 'STABLE'
      };
    }
    return this.proposal;
  }

  async payoutVerdict(_controllerAddress: Address, payTo: string): Promise<'PASS' | 'BLOCK' | 'HOLD'> {
    if (payTo === this.activePayToValue) return 'PASS';
    if (this.proposal && this.proposal.state === 'PENDING_APPROVED' && payTo === this.pendingPayToValue) {
      return 'HOLD';
    }
    return 'BLOCK';
  }

  async proposeRotation(
    _controllerAddress: Address,
    newPayTo: string,
    proposalExpiry: bigint,
    walletClient: any
  ): Promise<{ txHash: Hex; proposalId: Hex }> {
    if (this.shouldFailTx) {
      throw new ContractExecutionError(this.failErrorMessage);
    }
    const caller = (walletClient?.account?.address ?? '0x1111111111111111111111111111111111111111') as Address;
    const proposalId = `0x${'aa'.repeat(32)}` as Hex;
    const nonce = (this.proposal ? this.proposal.nonce + 1n : 1n);

    this.proposal = {
      id: proposalId,
      operator: caller,
      oldPayTo: this.activePayToValue,
      newPayTo,
      proposedAt: BigInt(Math.floor(Date.now() / 1000)),
      effectiveAt: 0n,
      expiry: proposalExpiry,
      nonce,
      state: 'PROPOSED'
    };

    return { txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', proposalId };
  }

  async approveWithAttestation(
    _controllerAddress: Address,
    approval: RotationApprovalData,
    _signature: Hex,
    _walletClient: any
  ): Promise<Hex> {
    if (this.shouldFailTx) {
      throw new ContractExecutionError(this.failErrorMessage);
    }
    if (!this.proposal || this.proposal.state !== 'PROPOSED') {
      throw new ProposalStateError('Contract state is not PROPOSED');
    }

    this.proposal.state = 'PENDING_APPROVED';
    this.proposal.effectiveAt = approval.effectiveAt;
    this.pendingPayToValue = this.proposal.newPayTo;

    return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  }

  async activateRotation(
    _controllerAddress: Address,
    proposalId: Hex,
    _walletClient: any
  ): Promise<Hex> {
    if (this.shouldFailTx) {
      throw new ContractExecutionError(this.failErrorMessage);
    }
    if (!this.proposal || this.proposal.id !== proposalId || this.proposal.state !== 'PENDING_APPROVED') {
      throw new ProposalStateError('Contract state is not PENDING_APPROVED for this proposalId');
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < this.proposal.effectiveAt && !this.bypassTimelock) {
      throw new ContractExecutionError('Delay timelock has not elapsed');
    }

    this.proposal.state = 'ACTIVATED';
    this.activePayToValue = this.proposal.newPayTo;
    this.pendingPayToValue = null;
    this.profileVersionValue++;

    return '0x9999999999999999999999999999999999999999999999999999999999999999';
  }

  async cancelPendingRotation(
    _controllerAddress: Address,
    proposalId: Hex,
    _reasonCode: Hex,
    _walletClient: any
  ): Promise<Hex> {
    if (this.shouldFailTx) {
      throw new ContractExecutionError(this.failErrorMessage);
    }
    if (!this.proposal || this.proposal.id !== proposalId) {
      throw new ProposalStateError('Proposal ID mismatch');
    }

    this.proposal.state = 'CANCELLED';
    this.pendingPayToValue = null;

    return '0x8888888888888888888888888888888888888888888888888888888888888888';
  }

  async isOperatorActive(_controllerAddress: Address, operator: Address): Promise<boolean> {
    const expiry = this.operators.get(operator.toLowerCase());
    if (!expiry) return false;
    return expiry > BigInt(Math.floor(Date.now() / 1000));
  }
}
