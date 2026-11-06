import {
  createPublicClient as createArkivPublicClientInternal,
  createWalletClient as createArkivWalletClientInternal,
  type PublicArkivClient,
  type WalletArkivClient
} from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { http, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const RABDI_CHAIN_ID = 7794095;
export const RABDI_RPC_URL = 'https://rpc.rabdi.db-chain.testnet.arkiv.network';

export interface ArkivClientConfig {
  accessKey?: string;
  rpcUrl?: string;
}

export interface ArkivWalletClientConfig extends ArkivClientConfig {
  privateKey: Hex;
}

export function createRabdiPublicClient(config: ArkivClientConfig = {}): PublicArkivClient {
  const accessKey = config.accessKey ?? process.env.ARKIV_ACCESS_KEY ?? '';
  const rpcUrl = config.rpcUrl ?? process.env.ARKIV_RPC_URL;

  return createArkivPublicClientInternal({
    chain: rabdi({ accessKey }),
    transport: http(rpcUrl)
  });
}

export function createRabdiWalletClient(config: ArkivWalletClientConfig): WalletArkivClient {
  const accessKey = config.accessKey ?? process.env.ARKIV_ACCESS_KEY ?? '';
  const rpcUrl = config.rpcUrl ?? process.env.ARKIV_RPC_URL;
  const account = privateKeyToAccount(config.privateKey);

  return createArkivWalletClientInternal({
    chain: rabdi({ accessKey }),
    transport: http(rpcUrl),
    account
  });
}

/**
 * Storage interface for Arkiv interactions.
 * Decouples logic from the live chain network transport for deterministic testing and offline operation.
 */
export interface IArkivStorageClient {
  createEntity(params: {
    schema: unknown;
    values: Record<string, unknown>;
  }): Promise<{ entityKey: string; txHash: string }>;

  queryEntities(params: {
    schema: unknown;
    filters?: Record<string, unknown>;
  }): Promise<Array<{ entityKey: string; values: Record<string, unknown> }>>;

  getEntity(entityKey: string): Promise<{ entityKey: string; values: Record<string, unknown> } | null>;
}

/**
 * In-Memory Arkiv Storage implementation for unit tests and local mock execution.
 */
export class MemoryArkivStorageClient implements IArkivStorageClient {
  private readonly entities = new Map<string, { entityKey: string; schemaName: string; values: Record<string, unknown> }>();

  async createEntity(params: {
    schema: { name?: string } | unknown;
    values: Record<string, unknown>;
  }): Promise<{ entityKey: string; txHash: string }> {
    const serialized = JSON.stringify(params.values, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val
    );
    const rawKey = `0x${Buffer.from(serialized).toString('hex').slice(0, 64).padEnd(64, '0')}`;
    const txHash = `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`;
    const schemaName = (params.schema as { name?: string })?.name ?? 'unknown';

    this.entities.set(rawKey, {
      entityKey: rawKey,
      schemaName,
      values: { ...params.values }
    });

    return { entityKey: rawKey, txHash };
  }

  async queryEntities(params: {
    schema: { name?: string } | unknown;
    filters?: Record<string, unknown>;
  }): Promise<Array<{ entityKey: string; values: Record<string, unknown> }>> {
    const results: Array<{ entityKey: string; values: Record<string, unknown> }> = [];
    const schemaName = (params.schema as { name?: string })?.name;

    for (const item of this.entities.values()) {
      if (schemaName && item.schemaName !== schemaName) continue;

      let matches = true;
      if (params.filters) {
        for (const [k, v] of Object.entries(params.filters)) {
          if (v !== undefined && item.values[k] !== v) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        results.push({ entityKey: item.entityKey, values: { ...item.values } });
      }
    }

    return results;
  }

  async getEntity(entityKey: string): Promise<{ entityKey: string; values: Record<string, unknown> } | null> {
    const found = this.entities.get(entityKey);
    if (!found) return null;
    return { entityKey: found.entityKey, values: { ...found.values } };
  }

  updateEntity(entityKey: string, values: Partial<Record<string, unknown>>): void {
    const found = this.entities.get(entityKey);
    if (found) {
      Object.assign(found.values, values);
    }
  }

  clear(): void {
    this.entities.clear();
  }
}
