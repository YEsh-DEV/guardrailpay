import { UnverifiableError } from '@quoteseal/shared';
import type { DualRpcReadResult, IRpcProvider } from './types.js';

export interface DualRpcClientConfig {
  primary: IRpcProvider;
  secondary: IRpcProvider;
  maxBlockDivergenceTolerance?: number; // default: 3 blocks
}

export class DualRpcClient {
  private readonly primary: IRpcProvider;
  private readonly secondary: IRpcProvider;
  private readonly maxDivergence: number;

  constructor(config: DualRpcClientConfig) {
    this.primary = config.primary;
    this.secondary = config.secondary;
    this.maxDivergence = config.maxBlockDivergenceTolerance ?? 3;
  }

  /**
   * Verify finalized block alignment across both RPC providers.
   * If providers disagree on finalized state, fail-closed by throwing UnverifiableError.
   */
  async getAgreedFinalizedBlock(): Promise<{ blockNumber: bigint; blockHash: string }> {
    let blockA: { number: bigint; hash: `0x${string}` };
    let blockB: { number: bigint; hash: `0x${string}` };

    try {
      [blockA, blockB] = await Promise.all([
        this.primary.getBlock({ blockTag: 'finalized' }),
        this.secondary.getBlock({ blockTag: 'finalized' })
      ]);
    } catch (err) {
      throw new UnverifiableError(`Dual-RPC read failed to retrieve finalized block: ${(err as Error).message}`, {
        originalError: String(err)
      });
    }

    const diff = blockA.number > blockB.number
      ? blockA.number - blockB.number
      : blockB.number - blockA.number;

    if (diff > BigInt(this.maxDivergence)) {
      throw new UnverifiableError(
        `Dual-RPC finalized block divergence exceeds tolerance (${diff} > ${this.maxDivergence}). Primary: ${blockA.number}, Secondary: ${blockB.number}`,
        {
          primaryBlockNumber: Number(blockA.number),
          secondaryBlockNumber: Number(blockB.number),
          difference: Number(diff)
        }
      );
    }

    // Use the lower (more conservative / definitely finalized on both) block number
    const agreedBlockNumber = blockA.number <= blockB.number ? blockA.number : blockB.number;
    const agreedBlockHash = blockA.number <= blockB.number ? blockA.hash : blockB.hash;

    return {
      blockNumber: agreedBlockNumber,
      blockHash: agreedBlockHash
    };
  }

  /**
   * Executes a read contract call on both RPC providers at the agreed finalized block number,
   * verifying that both providers return identical data.
   */
  async readContract<T>(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<DualRpcReadResult<T>> {
    const { blockNumber, blockHash } = await this.getAgreedFinalizedBlock();

    let resultA: unknown;
    let resultB: unknown;

    try {
      [resultA, resultB] = await Promise.all([
        this.primary.readContract({ ...params, blockNumber }),
        this.secondary.readContract({ ...params, blockNumber })
      ]);
    } catch (err) {
      throw new UnverifiableError(
        `Dual-RPC contract read failed for ${params.functionName} at ${params.address}: ${(err as Error).message}`,
        { originalError: String(err), functionName: params.functionName }
      );
    }

    // Deep equality / string serialization comparison
    const serializedA = JSON.stringify(resultA, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    const serializedB = JSON.stringify(resultB, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

    if (serializedA !== serializedB) {
      throw new UnverifiableError(
        `Dual-RPC divergence on ${params.functionName} at block ${blockNumber}: Primary and Secondary returned conflicting results`,
        {
          functionName: params.functionName,
          blockNumber: Number(blockNumber),
          primaryResult: serializedA,
          secondaryResult: serializedB
        }
      );
    }

    return {
      data: resultA as T,
      blockNumber: Number(blockNumber),
      blockHash
    };
  }
}
