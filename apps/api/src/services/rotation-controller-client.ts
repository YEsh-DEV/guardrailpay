import {
  type Address,
  type Hex,
  type PublicClient
} from 'viem';
import {
  ContractExecutionError,
  ProposalStateError,
  UnauthorizedError,
  ROTATION_CONTROLLER_ABI,
  type RotationApprovalData,
  type RotationState
} from '@quoteseal/shared';

export { ROTATION_CONTROLLER_ABI };

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

export interface IRotationControllerClient {
  getProposalState(controllerAddress: Address): Promise<ContractProposal>;
  payoutVerdict(controllerAddress: Address, payTo: string): Promise<'PASS' | 'BLOCK' | 'HOLD'>;
  previewProposalId?(
    controllerAddress: Address,
    operator: Address,
    newPayTo: string,
    proposalExpiry: bigint
  ): Promise<Hex>;
  enrollOperator?(
    controllerAddress: Address,
    enrollment: {
      merchantId: Hex;
      operator: Address;
      role: bigint;
      expiry: bigint;
      nonce: bigint;
      controller: Address;
    },
    ownerSignature: Hex,
    walletClient: any
  ): Promise<Hex>;
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
  constructor(private readonly publicClient: PublicClient<any, any>) {}

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

  async previewProposalId(
    controllerAddress: Address,
    operator: Address,
    newPayTo: string,
    proposalExpiry: bigint
  ): Promise<Hex> {
    return (await this.publicClient.readContract({
      address: controllerAddress,
      abi: ROTATION_CONTROLLER_ABI,
      functionName: 'previewProposalId',
      args: [operator, newPayTo, proposalExpiry]
    })) as Hex;
  }

  async enrollOperator(
    controllerAddress: Address,
    enrollment: {
      merchantId: Hex;
      operator: Address;
      role: bigint;
      expiry: bigint;
      nonce: bigint;
      controller: Address;
    },
    ownerSignature: Hex,
    walletClient: any
  ): Promise<Hex> {
    try {
      const txHash = await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'enrollOperator',
        args: [enrollment, ownerSignature]
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new ContractExecutionError(`enrollOperator transaction reverted: ${txHash}`);
      }
      return txHash;
    } catch (err: any) {
      throw new ContractExecutionError(`enrollOperator transaction failed: ${err.message}`);
    }
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

      // Wait for confirmation to ensure proposal is mined into a block
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new ContractExecutionError(`proposeRotation transaction reverted: ${txHash}`);
      }

      // Fetch confirmed on-chain proposal state
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
      const txHash = await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'approveWithAttestation',
        args: [approval, signature]
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new ContractExecutionError(`approveWithAttestation transaction reverted: ${txHash}`);
      }
      return txHash;
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
      const txHash = await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'activateRotation',
        args: [proposalId]
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new ContractExecutionError(`activateRotation transaction reverted: ${txHash}`);
      }
      return txHash;
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
      const txHash = await walletClient.writeContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'cancelPendingRotation',
        args: [proposalId, reasonCode]
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new ContractExecutionError(`cancelPendingRotation transaction reverted: ${txHash}`);
      }
      return txHash;
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

    const proposedAt = BigInt(Math.floor(Date.now() / 1000));
    const effectiveAt = proposedAt + 86400n;

    this.proposal = {
      id: proposalId,
      operator: caller,
      oldPayTo: this.activePayToValue,
      newPayTo,
      proposedAt,
      effectiveAt,
      expiry: proposalExpiry,
      nonce,
      state: 'PROPOSED'
    };

    return { txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', proposalId };
  }

  async previewProposalId(
    _controllerAddress: Address,
    _operator: Address,
    _newPayTo: string,
    _proposalExpiry: bigint
  ): Promise<Hex> {
    return `0x${'aa'.repeat(32)}` as Hex;
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
