import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ProfileResolutionError } from '@quoteseal/shared';
import { ENS_RECORD_KEYS, EnsMerchantProfile } from './schema.js';

export interface WriteProfileOptions {
  rpcUrl?: string;
  privateKey: `0x${string}`;
  resolverAddress: `0x${string}`;
}

export async function writeProfileRecords(
  ensName: string,
  profile: Partial<EnsMerchantProfile>,
  options: WriteProfileOptions
): Promise<string[]> {
  try {
    const account = privateKeyToAccount(options.privateKey);
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(options.rpcUrl || 'https://rpc.sepolia.org'),
    });

    const txHashes: string[] = [];

    // Map each provided field to its ENS text record key
    const recordsToWrite: [string, string][] = [];
    if (profile.serviceEndpoint) recordsToWrite.push([ENS_RECORD_KEYS.SERVICE_ENDPOINT, profile.serviceEndpoint]);
    if (profile.hederaNetwork) recordsToWrite.push([ENS_RECORD_KEYS.HEDERA_NETWORK, profile.hederaNetwork]);
    if (profile.assetId) recordsToWrite.push([ENS_RECORD_KEYS.ASSET_ID, profile.assetId]);
    if (profile.activePayTo) recordsToWrite.push([ENS_RECORD_KEYS.ACTIVE_PAY_TO, profile.activePayTo]);
    if (profile.maxAmount) recordsToWrite.push([ENS_RECORD_KEYS.MAX_AMOUNT, profile.maxAmount.toString()]);
    if (profile.profileVersion) recordsToWrite.push([ENS_RECORD_KEYS.PROFILE_VERSION, profile.profileVersion.toString()]);
    if (profile.rotationStatus) recordsToWrite.push([ENS_RECORD_KEYS.ROTATION_STATUS, profile.rotationStatus]);
    if (profile.pendingPayTo) recordsToWrite.push([ENS_RECORD_KEYS.PENDING_PAY_TO, profile.pendingPayTo]);
    if (profile.pendingEffectiveAt) recordsToWrite.push([ENS_RECORD_KEYS.PENDING_EFFECTIVE_AT, profile.pendingEffectiveAt.toString()]);

    // Note: in full production with EAC, the controller contract writes activePayTo,
    // while the treasury writes propose (pendingPayTo).
    return txHashes;
  } catch (err: unknown) {
    throw new ProfileResolutionError(`Failed to write ENS records: ${(err as Error).message}`);
  }
}
