import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ROTATION_CONTROLLER_ABI } from './abi.js';

export interface RotationRecord {
  id: bigint;
  currentPayTo: string;
  pendingPayTo: string;
  proposedAt: bigint;
  approvedAt: bigint;
  effectiveAt: bigint;
  status: 'NONE' | 'PROPOSED' | 'APPROVED' | 'ACTIVE' | 'REVOKED';
  proposer: `0x${string}`;
  approver: `0x${string}`;
}

const STATUS_MAP = ['NONE', 'PROPOSED', 'APPROVED', 'ACTIVE', 'REVOKED'] as const;

export async function getRotationStatus(
  contractAddress: `0x${string}`,
  rotationId: bigint,
  rpcUrl = 'https://rpc.sepolia.org'
): Promise<RotationRecord> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const res = await client.readContract({
    address: contractAddress,
    abi: ROTATION_CONTROLLER_ABI,
    functionName: 'getRotation',
    args: [rotationId],
  });

  return {
    id: res.id,
    currentPayTo: res.currentPayTo,
    pendingPayTo: res.pendingPayTo,
    proposedAt: res.proposedAt,
    approvedAt: res.approvedAt,
    effectiveAt: res.effectiveAt,
    status: STATUS_MAP[res.status] || 'NONE',
    proposer: res.proposer,
    approver: res.approver,
  };
}
