import { z } from 'zod';
import {
  VerdictSchema,
  ReasonCodeSchema,
  RotationStateSchema,
  type Verdict,
  type ReasonCode,
  type RotationState,
  type TrustAnchors
} from '@quoteseal/shared';

export const EnsProfileRecordSchema = z.object({
  ensName: z.string(),
  namehash: z.string(),
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  resolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  expiry: z.number().int().nonnegative(),
  profileVersion: z.number().int().positive(),
  activePayTo: z.string(),
  pendingPayTo: z.string().nullable().optional(),
  rotationStatus: RotationStateSchema,
  network: z.string(),
  scheme: z.string(),
  assetId: z.string(),
  maxAmount: z.string(),
  finalizedBlockNumber: z.number().int().positive(),
  finalizedBlockHash: z.string()
});
export type EnsProfileRecord = z.infer<typeof EnsProfileRecordSchema>;

export interface TrustAnchorVerificationResult {
  verdict: Verdict;
  reasonCode: ReasonCode;
  message: string;
  divergentFields?: string[];
  currentProfile?: EnsProfileRecord;
}

export interface DualRpcReadResult<T> {
  data: T;
  blockNumber: number;
  blockHash: string;
}

export interface IRpcProvider {
  getBlockNumber(): Promise<bigint>;
  getBlock(params: { blockTag: 'finalized' | 'latest' }): Promise<{ number: bigint; hash: `0x${string}` }>;
  readContract(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
}
