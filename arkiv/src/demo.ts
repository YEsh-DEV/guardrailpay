import { randomUUID } from 'node:crypto';
import { createArkivWriteClient } from './client.js';
import { loadArkivWriteConfig } from './config.js';
import { createRiskSignalStore, runRiskSignalSmokeTest } from './riskSignal.js';

async function main() {
  const config = loadArkivWriteConfig();
  const clients = createArkivWriteClient(config);
  const store = createRiskSignalStore({
    publicClient: {
      async getEntity(entityKey, schema) {
        const entity = await clients.publicClient.getEntity(entityKey, schema);

        return {
          $key: entity.$key,
          $owner: entity.$owner,
          $expiresAt: entity.$expiresAt,
          walletKey: entity.walletKey,
          network: entity.network,
          signalCode: entity.signalCode,
          referenceId: entity.referenceId,
        };
      },
    },
    walletClient: {
      async createEntity(schema, values, options) {
        return clients.walletClient.createEntity(schema, values, options);
      },
    },
  });
  const observedAt = BigInt(Math.floor(Date.now() / 1000));

  const evidence = await runRiskSignalSmokeTest({
    store,
    expectedOwner: clients.account.address,
    currentBlock: () => clients.publicClient.getBlockNumber(),
    input: {
      walletKey: '0.0.12345',
      network: 'hedera:testnet',
      signalCode: 'ARKIV_SMOKE_TEST',
      severity: 'LOW',
      source: 'arkiv-smoke-cli',
      observedAt,
      referenceId: `arkiv-smoke-${randomUUID()}`,
    },
  });

  console.log(
    JSON.stringify(
      evidence,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown Arkiv smoke-test error';
  console.error(`Arkiv smoke test failed: ${message}`);
  process.exitCode = 1;
});
