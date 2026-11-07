import { namehash } from 'viem/ens';
import { type DualRpcClient } from './dual-rpc.js';
import type { EnsProfileRecord } from './types.js';
import { UnverifiableError, normalizeRotationState } from '@quoteseal/shared';

export const ENS_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'resolver',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'expiry',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint64' }]
  }
] as const;

export const ENS_RESOLVER_ABI = [
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' }
    ],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

export interface EnsProfileResolverConfig {
  dualRpcClient: DualRpcClient;
  registryAddress: `0x${string}`;
}

export class EnsProfileResolver {
  private readonly dualRpc: DualRpcClient;
  private readonly registryAddress: `0x${string}`;

  constructor(config: EnsProfileResolverConfig) {
    this.dualRpc = config.dualRpcClient;
    this.registryAddress = config.registryAddress;
  }

  /**
   * Resolve complete QuoteSeal profile records for a merchant's ENS name
   * using Dual-RPC finalized verification.
   */
  async resolveProfile(ensName: string): Promise<EnsProfileRecord> {
    const node = namehash(ensName);

    // Pin agreed finalized block across all contract reads to guarantee consistent snapshot
    const { blockNumber, blockHash } = await this.dualRpc.getAgreedFinalizedBlock();

    // 1. Read registry anchors (owner, resolver, expiry) at the exact agreed block
    const [ownerRes, resolverRes, expiryRes] = await Promise.all([
      this.dualRpc.readContract<`0x${string}`>({
        address: this.registryAddress,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [node],
        blockNumber
      }),
      this.dualRpc.readContract<`0x${string}`>({
        address: this.registryAddress,
        abi: ENS_REGISTRY_ABI,
        functionName: 'resolver',
        args: [node],
        blockNumber
      }),
      this.dualRpc.readContract<bigint>({
        address: this.registryAddress,
        abi: ENS_REGISTRY_ABI,
        functionName: 'expiry',
        args: [node],
        blockNumber
      })
    ]);

    const resolverAddress = resolverRes.data;
    if (resolverAddress === '0x0000000000000000000000000000000000000000') {
      throw new UnverifiableError(`No resolver configured in ENS registry for ${ensName}`, {
        ensName,
        node
      });
    }

    // 2. Read QuoteSeal text records from the dedicated resolver at the exact agreed block
    const keys = [
      'quoteseal.activePayTo',
      'quoteseal.pendingPayTo',
      'quoteseal.rotationStatus',
      'quoteseal.version',
      'quoteseal.profileVersion',
      'quoteseal.network',
      'quoteseal.scheme',
      'quoteseal.asset',
      'quoteseal.maxAmount'
    ] as const;

    const textRecordPromises = keys.map((key) =>
      this.dualRpc
        .readContract<string>({
          address: resolverAddress,
          abi: ENS_RESOLVER_ABI,
          functionName: 'text',
          args: [node, key],
          blockNumber
        })
        .then((res) => ({ key, value: res.data }))
    );

    const textResults = await Promise.all(textRecordPromises);
    const records = Object.fromEntries(textResults.map((r) => [r.key, r.value])) as Record<string, string>;

    const activePayTo = records['quoteseal.activePayTo'];
    if (!activePayTo || activePayTo.trim() === '') {
      throw new UnverifiableError(`Missing required record 'quoteseal.activePayTo' on resolver for ${ensName}`, {
        ensName,
        resolverAddress
      });
    }

    const versionStr = records['quoteseal.profileVersion'] || records['quoteseal.version'] || '1';
    const profileVersion = parseInt(versionStr, 10);

    const rotationStatusRaw = records['quoteseal.rotationStatus'] || 'STABLE';
    const rotationStatus = normalizeRotationState(rotationStatusRaw);

    return {
      ensName,
      namehash: node,
      owner: ownerRes.data,
      resolver: resolverAddress,
      expiry: Number(expiryRes.data),
      profileVersion: isNaN(profileVersion) ? 1 : profileVersion,
      activePayTo,
      pendingPayTo: records['quoteseal.pendingPayTo'] || null,
      rotationStatus,
      network: records['quoteseal.network'] || 'hedera:testnet',
      scheme: records['quoteseal.scheme'] || 'exact',
      assetId: records['quoteseal.asset'] || '0.0.0',
      maxAmount: records['quoteseal.maxAmount'] || '500000000',
      finalizedBlockNumber: ownerRes.blockNumber,
      finalizedBlockHash: ownerRes.blockHash
    };
  }
}
