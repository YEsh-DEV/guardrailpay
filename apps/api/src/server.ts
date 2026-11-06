import {
  validateEnv,
  createLogger,
  createDatabaseClient,
  checkDatabaseReadiness,
  requireDatabaseConnection,
  ConfigurationError
} from '@quoteseal/shared';
import { DualRpcClient, EnsProfileResolver } from '@quoteseal/ens-profile';
import { createPublicClient, http, keccak256, type Abi } from 'viem';
import { sepolia } from 'viem/chains';
import { createApp } from './app.js';
import { LiveRotationControllerClient } from './services/rotation-controller-client.js';
import { createDbStore } from './services/db-store.js';

const logger = createLogger({ name: 'quoteseal-server' });

async function startServer() {
  try {
    const env = validateEnv();
    if (!env.DATABASE_URL) throw new ConfigurationError('DATABASE_URL is required before API startup');

    const database = createDatabaseClient({ connectionString: env.DATABASE_URL });
    try {
      await requireDatabaseConnection(database.pool);
    } catch (error) {
      await database.close();
      throw error;
    }

    logger.info({
      msg: 'Starting QuoteSeal API server',
      port: env.PORT,
      host: env.HOST,
      nodeEnv: env.NODE_ENV,
      chainId: env.APPLICATION_CHAIN_ID,
      profile: env.APP_PROFILE
    });

    // Setup live viem RPC clients for Dual-RPC verification
    const primaryViemClient = createPublicClient({
      chain: sepolia,
      transport: http(env.SEPOLIA_RPC_URL_PRIMARY)
    });

    const secondaryViemClient = createPublicClient({
      chain: sepolia,
      transport: http(env.SEPOLIA_RPC_URL_SECONDARY)
    });

    // Adapter wrapping viem client to IRpcProvider interface
    const createRpcAdapter = (client: typeof primaryViemClient) => ({
      getBlockNumber: () => client.getBlockNumber(),
      getBlock: (params: { blockTag: 'finalized' | 'latest' }) =>
        client.getBlock(params).then((b) => ({ number: b.number, hash: b.hash })),
      readContract: (params: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args: readonly unknown[];
        blockNumber?: bigint;
      }) =>
        client.readContract({
          address: params.address,
          abi: params.abi as unknown as Abi,
          functionName: params.functionName,
          args: params.args as readonly unknown[],
          blockNumber: params.blockNumber
        })
    });

    const dualRpcClient = new DualRpcClient({
      primary: createRpcAdapter(primaryViemClient),
      secondary: createRpcAdapter(secondaryViemClient),
      maxBlockDivergenceTolerance: env.MAX_BLOCK_DIVERGENCE_TOLERANCE
    });

    const ensResolver = new EnsProfileResolver({
      dualRpcClient,
      registryAddress: env.ENS_REGISTRY_ADDRESS as `0x${string}`
    });

    const rotationControllerClient = new LiveRotationControllerClient(primaryViemClient);
    const dbStore = createDbStore(database.db);
    const liveProfile = env.APP_PROFILE === 'testnet-demo' || env.APP_PROFILE === 'production';
    const controllerAddress = env.ROTATION_CONTROLLER_ADDRESS as `0x${string}` | undefined;
    const ensMerchantName = env.ENS_MERCHANT_NAME;

    const app = createApp({
      ensResolver,
      rotationControllerClient,
      dbStore,
      env,
      checkDatabase: () => checkDatabaseReadiness(database.pool),
      checkRpcPrimary: async () => {
        try {
          const [chainId, blockNumber] = await Promise.all([
            primaryViemClient.getChainId(),
            primaryViemClient.getBlockNumber()
          ]);
          return chainId === env.APPLICATION_CHAIN_ID && blockNumber > 0n;
        } catch {
          return false;
        }
      },
      checkRpcSecondary: async () => {
        try {
          const [chainId, blockNumber] = await Promise.all([
            secondaryViemClient.getChainId(),
            secondaryViemClient.getBlockNumber()
          ]);
          return chainId === env.APPLICATION_CHAIN_ID && blockNumber > 0n;
        } catch {
          return false;
        }
      },
      checkController: !liveProfile ? undefined : async () => {
        if (!controllerAddress || !env.ROTATION_CONTROLLER_CODE_HASH) return false;
        try {
          const [primaryCode, secondaryCode] = await Promise.all([
            primaryViemClient.getBytecode({ address: controllerAddress }),
            secondaryViemClient.getBytecode({ address: controllerAddress })
          ]);
          const expectedHash = env.ROTATION_CONTROLLER_CODE_HASH.toLowerCase();
          return !!primaryCode
            && primaryCode !== '0x'
            && primaryCode === secondaryCode
            && keccak256(primaryCode).toLowerCase() === expectedHash;
        } catch {
          return false;
        }
      },
      checkEns: !liveProfile ? undefined : async () => {
        if (!ensMerchantName || !env.ENS_NAMEHASH || !env.ENS_RESOLVER_ADDRESS || !env.ENS_EXPECTED_OWNER) return false;
        try {
          const [factoryPrimary, factorySecondary] = await Promise.all([
            primaryViemClient.getBytecode({ address: env.ENS_RESOLVER_FACTORY_ADDRESS as `0x${string}` }),
            secondaryViemClient.getBytecode({ address: env.ENS_RESOLVER_FACTORY_ADDRESS as `0x${string}` })
          ]);
          if (!factoryPrimary || factoryPrimary === '0x' || factoryPrimary !== factorySecondary) return false;
          const profile = await ensResolver.resolveProfile(ensMerchantName);
          const merchant = await dbStore.findMerchantByName(ensMerchantName);
          if (!merchant) return false;
          return profile.namehash.toLowerCase() === env.ENS_NAMEHASH.toLowerCase()
            && profile.resolver.toLowerCase() === env.ENS_RESOLVER_ADDRESS.toLowerCase()
            && profile.owner.toLowerCase() === env.ENS_EXPECTED_OWNER.toLowerCase()
            && profile.expiry > Math.floor(Date.now() / 1000)
            && profile.network === env.X402_NETWORK
            && profile.scheme === env.X402_SCHEME
            && profile.assetId === env.X402_ASSET
            && BigInt(profile.maxAmount) <= BigInt(env.MAX_PAYMENT_AMOUNT_DEFAULT)
            && merchant.ensName.toLowerCase() === ensMerchantName.toLowerCase()
            && merchant.chainId === env.APPLICATION_CHAIN_ID
            && merchant.namehash.toLowerCase() === env.ENS_NAMEHASH.toLowerCase()
            && merchant.registryAddress.toLowerCase() === env.ENS_REGISTRY_ADDRESS.toLowerCase()
            && merchant.resolverAddress.toLowerCase() === env.ENS_RESOLVER_ADDRESS.toLowerCase()
            && merchant.ownerAddress.toLowerCase() === env.ENS_EXPECTED_OWNER.toLowerCase()
            && merchant.controllerAddress?.toLowerCase() === controllerAddress?.toLowerCase()
            && merchant.activePayTo === profile.activePayTo
            && merchant.profileVersion === profile.profileVersion
            && merchant.network === env.X402_NETWORK
            && merchant.scheme === env.X402_SCHEME
            && merchant.assetId === env.X402_ASSET
            && BigInt(merchant.maxAmount) <= BigInt(env.MAX_PAYMENT_AMOUNT_DEFAULT)
            && merchant.status === 'active';
        } catch {
          return false;
        }
      },
      checkWorldId: !liveProfile ? undefined : async () => {
        if (!env.WORLD_ID_CLIENT_ID || !env.WORLD_ID_ACTION || !env.WORLD_ID_REDIRECT_URI.startsWith('https://')) return false;
        try {
          const response = await fetch(new URL('/.well-known/openid-configuration', env.WORLD_ID_ISSUER), {
            signal: AbortSignal.timeout(5000)
          });
          if (!response.ok) return false;
          const metadata = await response.json() as { issuer?: string; authorization_endpoint?: string; token_endpoint?: string; jwks_uri?: string };
          return metadata.issuer === env.WORLD_ID_ISSUER
            && !!metadata.authorization_endpoint && !!metadata.token_endpoint && !!metadata.jwks_uri;
        } catch {
          return false;
        }
      },
      checkHedera: !liveProfile ? undefined : async () => {
        if (env.HEDERA_NETWORK !== 'testnet' || !env.HEDERA_ACCOUNT_ID) return false;
        try {
          const url = new URL(`/api/v1/accounts/${env.HEDERA_ACCOUNT_ID}`, env.HEDERA_MIRROR_NODE_URL);
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) return false;
          const account = await response.json() as { account?: string; balance?: { balance?: number } };
          return account.account === env.HEDERA_ACCOUNT_ID && Number.isSafeInteger(account.balance?.balance);
        } catch {
          return false;
        }
      },
      checkFacilitator: !liveProfile ? undefined : async () => {
        if (!env.X402_FACILITATOR_URL || !env.X402_NETWORK || !env.X402_SCHEME) return false;
        try {
          const baseUrl = new URL(env.X402_FACILITATOR_URL);
          baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/supported`;
          const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) return false;
          const supported = await response.json() as { kinds?: Array<{ x402Version?: number; scheme?: string; network?: string }> };
          return supported.kinds?.some((kind) => kind.x402Version === 2 && kind.scheme === env.X402_SCHEME && kind.network === env.X402_NETWORK) ?? false;
        } catch {
          return false;
        }
      }
    });

    app.addHook('onClose', async () => database.close());

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info({ msg: `Received ${signal}, shutting down gracefully...` });
        try {
          await app.close();
          logger.info({ msg: 'Server closed successfully' });
          process.exit(0);
        } catch (err) {
          logger.error({ msg: 'Error during shutdown', err });
          process.exit(1);
        }
      });
    }

    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });
    logger.info({ msg: `QuoteSeal API listening on ${address}` });
  } catch (err) {
    logger.fatal({
      msg: 'Fatal startup failure — QuoteSeal API exiting fail-closed',
      error: err instanceof ConfigurationError ? err.message : (err instanceof Error ? err.name : 'UnknownError')
    });
    process.exit(1);
  }
}

// Only start when invoked directly
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  startServer().catch((err) => {
    logger.fatal({
      msg: 'Fatal startup error — QuoteSeal API exiting fail-closed',
      error: err instanceof ConfigurationError ? err.message : (err instanceof Error ? err.name : 'UnknownError')
    });
    process.exit(1);
  });
}

export { startServer };
