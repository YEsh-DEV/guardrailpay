import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';
import { ProfileResolutionError } from '@quoteseal/shared';
import { ENS_RECORD_KEYS, EnsMerchantProfile, EnsMerchantProfileSchema } from './schema.js';
import { ProfileCache } from './cache.js';

export interface ResolveOptions {
  rpcUrl?: string;
  cache?: ProfileCache;
  bypassCache?: boolean;
  mockRegistry?: Map<string, EnsMerchantProfile>;
}

export async function resolveProfile(
  ensName: string,
  options: ResolveOptions = {}
): Promise<EnsMerchantProfile> {
  const normalizedName = ensName.trim().toLowerCase();

  // 1. Check mock registry if configured (e.g. for deterministic unit / simulation tests)
  if (options.mockRegistry && options.mockRegistry.has(normalizedName)) {
    const mock = options.mockRegistry.get(normalizedName);
    if (!mock) throw new ProfileResolutionError(`No mock profile for ${ensName}`);
    return EnsMerchantProfileSchema.parse(mock);
  }

  // 2. Check cache
  if (options.cache && !options.bypassCache) {
    const cached = options.cache.get(normalizedName);
    if (cached) return cached;
  }

  // 3. Resolve via viem public client on Sepolia
  try {
    const rpcUrl = options.rpcUrl || process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl, { timeout: 8000 }),
    });

    const normalizedEns = normalize(normalizedName);

    // Fetch required QuoteSeal text records from ENS resolver
    const [
      serviceEndpoint,
      hederaNetwork,
      assetId,
      activePayTo,
      maxAmount,
      profileVersion,
      rotationStatus,
      pendingPayTo,
      pendingEffectiveAt,
    ] = await Promise.all([
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.SERVICE_ENDPOINT }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.HEDERA_NETWORK }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.ASSET_ID }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.ACTIVE_PAY_TO }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.MAX_AMOUNT }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.PROFILE_VERSION }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.ROTATION_STATUS }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.PENDING_PAY_TO }),
      client.getEnsText({ name: normalizedEns, key: ENS_RECORD_KEYS.PENDING_EFFECTIVE_AT }),
    ]);

    if (!activePayTo || !serviceEndpoint) {
      throw new ProfileResolutionError(
        `Incomplete ENS payment profile records for '${ensName}'. Missing activePayTo or serviceEndpoint.`
      );
    }

    const profileData = {
      ensName: normalizedName,
      serviceEndpoint,
      hederaNetwork: hederaNetwork || 'hedera:testnet',
      assetId: assetId || 'HBAR',
      activePayTo,
      maxAmount: maxAmount ? BigInt(maxAmount) : 1000000000n,
      profileVersion: profileVersion ? parseInt(profileVersion, 10) : 1,
      rotationStatus: (rotationStatus as any) || 'none',
      pendingPayTo: pendingPayTo || undefined,
      pendingEffectiveAt: pendingEffectiveAt ? parseInt(pendingEffectiveAt, 10) : undefined,
    };

    const validated = EnsMerchantProfileSchema.parse(profileData);

    if (options.cache) {
      options.cache.set(normalizedName, validated);
    }

    return validated;
  } catch (err: unknown) {
    if (err instanceof ProfileResolutionError) throw err;
    throw new ProfileResolutionError(
      `Failed to resolve ENS profile for '${ensName}': ${(err as Error).message}`,
      err
    );
  }
}
