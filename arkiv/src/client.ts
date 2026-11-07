import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http } from 'viem';
import type { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ArkivReadConfig, ArkivWriteConfig } from './config.js';
import type { WalletRiskStateQuery } from './riskState.js';
import { WalletRiskState } from './schema.js';

export const RABDI_CHAIN_ID = 7794095;
export const RABDI_GAS_TOKEN = 'tGLM';

export function createArkivReadClient(config: ArkivReadConfig) {
  return createPublicClient({
    chain: rabdi({ accessKey: config.accessKey }),
    transport: http(),
  });
}

export function createArkivWriteClient(config: ArkivWriteConfig) {
  const account = privateKeyToAccount(config.privateKey);
  const chain = rabdi({ accessKey: config.accessKey });

  return {
    account,
    publicClient: createPublicClient({ chain, transport: http() }),
    walletClient: createWalletClient({ chain, transport: http(), account }),
  };
}

export function createArkivWalletRiskStateQuery(
  client: ReturnType<typeof createArkivReadClient>,
  trustedOwner: Address
): WalletRiskStateQuery {
  return {
    async fetchWalletRiskStates({ walletKey, network }) {
      const result = await client
        .select({
          $key: true,
          $owner: true,
          $expiresAt: true,
          walletKey: true,
          network: true,
          status: true,
          score: true,
          policyVersion: true,
          computedAt: true,
          signalCount: true,
          lastSignalAt: true,
          stateHash: true,
        })
        .from(WalletRiskState, { onMismatch: 'throw' })
        .where(eq('walletKey', walletKey), eq('network', network))
        .ownedBy(trustedOwner)
        .limit(10)
        .fetch();

      return { blockNumber: result.blockNumber, candidates: result.entities };
    },
  };
}
