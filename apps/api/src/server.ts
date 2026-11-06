import { validateEnv, createLogger } from '@quoteseal/shared';
import { DualRpcClient, EnsProfileResolver } from '@quoteseal/ens-profile';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createApp } from './app.js';
import { LiveRotationControllerClient } from './services/rotation-controller-client.js';

const logger = createLogger({ name: 'quoteseal-server' });

async function startServer() {
  const env = validateEnv();

  logger.info({
    msg: 'Starting QuoteSeal API server',
    port: env.PORT,
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
    chainId: env.APPLICATION_CHAIN_ID
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
      client.getBlock(params).then((b: any) => ({ number: b.number, hash: b.hash })),
    readContract: (params: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
      blockNumber?: bigint;
    }) =>
      client.readContract({
        address: params.address,
        abi: params.abi as any,
        functionName: params.functionName,
        args: params.args as any,
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

  const rotationControllerClient = new LiveRotationControllerClient(primaryViemClient as any);

  const app = createApp({
    ensResolver,
    rotationControllerClient,
    env,
    checkRpcPrimary: async () => {
      try {
        await primaryViemClient.getBlockNumber();
        return true;
      } catch {
        return false;
      }
    },
    checkRpcSecondary: async () => {
      try {
        await secondaryViemClient.getBlockNumber();
        return true;
      } catch {
        return false;
      }
    }
  });

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

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });
    logger.info({ msg: `QuoteSeal API listening on ${address}` });
  } catch (err) {
    logger.error({ msg: 'Failed to start QuoteSeal API', err });
    process.exit(1);
  }
}

// Only start when invoked directly
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  startServer();
}

export { startServer };
