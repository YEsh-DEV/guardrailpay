import type { Address, Hex } from 'viem';
import type { TrustedWalletRiskLookup, TrustedWalletRiskReader } from './riskState.js';

export const MVP_FIXTURE_WRITER: Address = '0x1111111111111111111111111111111111111111';
export const MVP_FLAGGED_WALLET = '0.0.90001';
const MVP_ENTITY_KEY: Hex = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export function createMvpFixtureRiskReader(): TrustedWalletRiskReader {
  return {
    async getTrustedWalletRiskState(input): Promise<TrustedWalletRiskLookup> {
      if (input.walletKey !== MVP_FLAGGED_WALLET || input.network !== 'hedera:testnet') {
        return { kind: 'not_found' };
      }

      return {
        kind: 'trusted',
        state: {
          entityKey: MVP_ENTITY_KEY,
          owner: MVP_FIXTURE_WRITER,
          expiresAt: 9_999_999_999n,
          walletKey: input.walletKey,
          network: input.network,
          status: 'BLOCK',
          score: '1',
          policyVersion: 'mvp-fixture-v1',
          computedAt: 1n,
        },
      };
    },
  };
}
