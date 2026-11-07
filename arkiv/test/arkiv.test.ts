import { describe, expect, it } from 'vitest';
import {
  loadArkivReadConfig,
  loadArkivWriteConfig,
  ArkivConfigurationError,
  ArkivQueryError,
  ArkivWriteError,
  ExpiredArkivEntityError,
  UntrustedArkivEntityError,
  createRiskSignalValues,
  runRiskSignalSmokeTest,
  verifyTrustedRiskSignal,
  type CreatedRiskSignal,
  type RiskSignalInput,
  type RiskSignalSnapshot,
  type RiskSignalStore,
  createTrustedWalletRiskReader,
  type WalletRiskStateCandidate,
  createWalletRiskStateValues,
  createWalletRiskStateStore,
  createRiskSignalStore,
  createMerchantRiskPublisher,
  type WalletRiskStateInput,
  type WalletRiskStateStoreDependencies,
} from '../src/index.js';

const writer = '0x1111111111111111111111111111111111111111' as const;
const otherWriter = '0x2222222222222222222222222222222222222222' as const;
const entityKey = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const txHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

const input: RiskSignalInput = {
  walletKey: '0.0.12345',
  network: 'hedera:testnet',
  signalCode: 'UNAUTHORIZED_PAYEE',
  severity: 'HIGH',
  source: 'payee-guard',
  observedAt: 100n,
  referenceId: 'risk-signal-test',
  evidenceHash: 'sha256:test',
};

const created: CreatedRiskSignal = {
  entityKey,
  txHash,
  expiresAt: 200n,
};

const entity: RiskSignalSnapshot = {
  $key: entityKey,
  $owner: writer,
  $expiresAt: 200n,
  walletKey: { value: input.walletKey },
  network: { value: input.network },
  signalCode: { value: input.signalCode },
  referenceId: { value: input.referenceId },
};

const riskCandidate: WalletRiskStateCandidate = {
  $key: entityKey,
  $owner: writer,
  $expiresAt: 200n,
  walletKey: { value: '0.0.90001' },
  network: { value: 'hedera:testnet' },
  status: { value: 'BLOCK' },
  score: { value: '1' },
  policyVersion: { value: 'test-v1' },
  computedAt: { value: 100n },
};

describe('Arkiv configuration', () => {
  it('parses server-only writer configuration', () => {
    const config = loadArkivWriteConfig({
      ARKIV_ACCESS_KEY: 'access-key',
      ARKIV_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    });

    expect(config.accessKey).toBe('access-key');
    expect(config.privateKey).toHaveLength(66);
  });

  it('rejects missing or malformed configuration', () => {
    expect(() => loadArkivReadConfig({})).toThrow(ArkivConfigurationError);
    expect(() => loadArkivWriteConfig({ ARKIV_ACCESS_KEY: 'key' })).toThrow(ArkivConfigurationError);
    expect(() =>
      loadArkivWriteConfig({ ARKIV_ACCESS_KEY: 'key', ARKIV_PRIVATE_KEY: 'not-a-key' })
    ).toThrow(ArkivConfigurationError);
  });
});

describe('RiskSignal serialization and verification', () => {
  it('serializes a validated RiskSignal for the named Arkiv schema', () => {
    const values = createRiskSignalValues(input);

    expect(values.walletKey).toBe('0.0.12345');
    expect(values.observedAt).toMatchObject({ type: 'u64', value: 100n });
    expect(values.referenceId).toBe('risk-signal-test');
  });

  it('rejects malformed wallet identifiers', () => {
    expect(() => createRiskSignalValues({ ...input, walletKey: 'invalid-wallet' })).toThrow();
  });

  it('rejects a forged owner', () => {
    expect(() =>
      verifyTrustedRiskSignal({
        created,
        entity: { ...entity, $owner: otherWriter },
        expectedOwner: writer,
        currentBlock: 100n,
      })
    ).toThrow(UntrustedArkivEntityError);
  });

  it('rejects expired records', () => {
    expect(() =>
      verifyTrustedRiskSignal({
        created,
        entity,
        expectedOwner: writer,
        currentBlock: 200n,
      })
    ).toThrow(ExpiredArkivEntityError);
  });
});

describe('RiskSignal smoke operation failures', () => {
  it('reports rejected writes', async () => {
    const store: RiskSignalStore = {
      create: async () => {
        throw new ArkivWriteError('Arkiv rejected the RiskSignal write');
      },
      read: async () => entity,
    };

    await expect(
      runRiskSignalSmokeTest({
        store,
        input,
        expectedOwner: writer,
        currentBlock: async () => 100n,
      })
    ).rejects.toThrow(ArkivWriteError);
  });

  it('reports query failures', async () => {
    const store: RiskSignalStore = {
      create: async () => created,
      read: async () => {
        throw new ArkivQueryError('Arkiv RiskSignal query failed');
      },
    };

    await expect(
      runRiskSignalSmokeTest({
        store,
        input,
        expectedOwner: writer,
        currentBlock: async () => 100n,
      })
    ).rejects.toThrow(ArkivQueryError);
  });
});

describe('trusted WalletRiskState reads', () => {
  it('ignores forged and expired records while accepting a trusted live state', async () => {
    const reader = createTrustedWalletRiskReader(
      {
        async fetchWalletRiskStates() {
          return {
            blockNumber: 100n,
            candidates: [
              { ...riskCandidate, $owner: otherWriter, status: { value: 'BLOCK' } },
              { ...riskCandidate, $expiresAt: 100n, status: { value: 'BLOCK' } },
              { ...riskCandidate, walletKey: { value: '0.0.99999' }, status: { value: 'BLOCK' } },
              { ...riskCandidate, status: { value: 'ALLOW' } },
            ],
          };
        },
      },
      writer
    );

    const result = await reader.getTrustedWalletRiskState({ walletKey: '0.0.90001', network: 'hedera:testnet' });
    expect(result).toMatchObject({ kind: 'trusted', state: { status: 'ALLOW', owner: writer } });
  });

  it('retries bounded query failures and returns an unavailable result without trusting data', async () => {
    let attempts = 0;
    const reader = createTrustedWalletRiskReader(
      {
        async fetchWalletRiskStates() {
          attempts += 1;
          throw new Error('RPC unavailable');
        },
      },
      writer,
      { timeoutMs: 20, retries: 1 }
    );

    const result = await reader.getTrustedWalletRiskState({ walletKey: '0.0.90001', network: 'hedera:testnet' });
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'RPC unavailable' });
    expect(attempts).toBe(2);
  });
});

describe('WalletRiskState serialization and validation', () => {
  const validStateInput: WalletRiskStateInput = {
    walletKey: '0.0.90001',
    network: 'hedera:testnet',
    status: 'BLOCK',
    score: '0.95',
    policyVersion: 'quoteseal-risk-v1',
    signalCount: 2n,
    lastSignalAt: 100n,
    computedAt: 110n,
  };

  it('serializes valid WalletRiskState values for the named Arkiv schema', () => {
    const values = createWalletRiskStateValues(validStateInput);
    expect(values.walletKey).toBe('0.0.90001');
    expect(values.network).toBe('hedera:testnet');
    expect(values.status).toBe('BLOCK');
    expect(values.score).toMatchObject({ type: 'dec', value: '0.95' });
    expect(values.signalCount).toMatchObject({ type: 'u64', value: 2n });
    expect(values.stateHash).toBeDefined();
  });

  it('rejects malformed scores not between 0 and 1', () => {
    expect(() => createWalletRiskStateValues({ ...validStateInput, score: '1.5' })).toThrow();
    expect(() => createWalletRiskStateValues({ ...validStateInput, score: '-0.1' })).toThrow();
    expect(() => createWalletRiskStateValues({ ...validStateInput, score: 'invalid' })).toThrow();
  });

  it('rejects invalid status enums', () => {
    expect(() => createWalletRiskStateValues({ ...validStateInput, status: 'INVALID' as any })).toThrow();
  });

  it('rejects invalid wallet identifiers', () => {
    expect(() => createWalletRiskStateValues({ ...validStateInput, walletKey: 'not-a-wallet' })).toThrow();
  });
});

describe('WalletRiskStateStore upsert and idempotency', () => {
  const validStateInput: WalletRiskStateInput = {
    walletKey: '0.0.90001',
    network: 'hedera:testnet',
    status: 'BLOCK',
    score: '1.0',
    policyVersion: 'quoteseal-risk-v1',
    signalCount: 1n,
    lastSignalAt: 100n,
  };

  it('creates a new WalletRiskState when no active record exists', async () => {
    let createdValues: any = null;
    const store = createWalletRiskStateStore({
      expectedOwner: writer,
      query: {
        async fetchWalletRiskStates() {
          return { blockNumber: 100n, candidates: [] };
        },
      },
      walletClient: {
        account: { address: writer },
        async createEntity(schema, values, options) {
          createdValues = values;
          return {
            entityKey: '0x1111111111111111111111111111111111111111111111111111111111111111',
            txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            expiresAt: 200n,
          };
        },
        async patchEntity() {
          throw new Error('Should not be called');
        },
      },
    });

    const result = await store.upsert(validStateInput);
    expect(result.action).toBe('created');
    expect(result.isDuplicate).toBe(false);
    expect(result.status).toBe('BLOCK');
    expect(createdValues.walletKey).toBe('0.0.90001');
  });

  it('returns idempotent noop when active record already has identical values', async () => {
    let createCalled = false;
    let patchCalled = false;

    const existingCandidate: WalletRiskStateCandidate = {
      $key: entityKey,
      $owner: writer,
      $expiresAt: 500n,
      walletKey: { value: '0.0.90001' },
      network: { value: 'hedera:testnet' },
      status: { value: 'BLOCK' },
      score: { value: '1.0' },
      policyVersion: { value: 'quoteseal-risk-v1' },
      signalCount: { value: 1n },
      lastSignalAt: { value: 100n },
      computedAt: { value: 100n },
    };

    const store = createWalletRiskStateStore({
      expectedOwner: writer,
      query: {
        async fetchWalletRiskStates() {
          return { blockNumber: 100n, candidates: [existingCandidate] };
        },
      },
      walletClient: {
        account: { address: writer },
        async createEntity() {
          createCalled = true;
          throw new Error('Should not be called');
        },
        async patchEntity() {
          patchCalled = true;
          throw new Error('Should not be called');
        },
      },
    });

    const result = await store.upsert(validStateInput);
    expect(result.action).toBe('noop');
    expect(result.isDuplicate).toBe(true);
    expect(result.entityKey).toBe(entityKey);
    expect(createCalled).toBe(false);
    expect(patchCalled).toBe(false);
  });

  it('patches existing active record when state has changed', async () => {
    let patchedKey: any = null;
    let patchedChanges: any = null;

    const existingCandidate: WalletRiskStateCandidate = {
      $key: entityKey,
      $owner: writer,
      $expiresAt: 500n,
      walletKey: { value: '0.0.90001' },
      network: { value: 'hedera:testnet' },
      status: { value: 'ALLOW' }, // Previously ALLOW
      score: { value: '0.1' },
      policyVersion: { value: 'quoteseal-risk-v1' },
      signalCount: { value: 0n },
      lastSignalAt: { value: 50n },
      computedAt: { value: 50n },
    };

    const store = createWalletRiskStateStore({
      expectedOwner: writer,
      query: {
        async fetchWalletRiskStates() {
          return { blockNumber: 100n, candidates: [existingCandidate] };
        },
      },
      walletClient: {
        account: { address: writer },
        async createEntity() {
          throw new Error('Should not be called');
        },
        async patchEntity(schema, key, changes) {
          patchedKey = key;
          patchedChanges = changes;
          return {
            entityKey: key,
            txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
          };
        },
      },
    });

    // Update to BLOCK
    const result = await store.upsert(validStateInput);
    expect(result.action).toBe('updated');
    expect(result.isDuplicate).toBe(false);
    expect(patchedKey).toBe(entityKey);
    expect(patchedChanges.set.status).toBe('BLOCK');
  });

  it('ignores expired candidate and creates a fresh entity', async () => {
    let createCalled = false;

    const expiredCandidate: WalletRiskStateCandidate = {
      $key: entityKey,
      $owner: writer,
      $expiresAt: 50n, // Expired at block 50, current block is 100
      walletKey: { value: '0.0.90001' },
      network: { value: 'hedera:testnet' },
      status: { value: 'BLOCK' },
      score: { value: '1.0' },
      policyVersion: { value: 'quoteseal-risk-v1' },
      signalCount: { value: 1n },
      lastSignalAt: { value: 100n },
      computedAt: { value: 100n },
    };

    const store = createWalletRiskStateStore({
      expectedOwner: writer,
      query: {
        async fetchWalletRiskStates() {
          return { blockNumber: 100n, candidates: [expiredCandidate] };
        },
      },
      walletClient: {
        account: { address: writer },
        async createEntity() {
          createCalled = true;
          return {
            entityKey: '0x4444444444444444444444444444444444444444444444444444444444444444',
            txHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
            expiresAt: 200n,
          };
        },
        async patchEntity() {
          throw new Error('Should not be called');
        },
      },
    });

    const result = await store.upsert(validStateInput);
    expect(result.action).toBe('created');
    expect(createCalled).toBe(true);
  });
});

describe('RiskSignalStore idempotency', () => {
  it('deduplicates RiskSignal creation on matching referenceId', async () => {
    let createCalled = false;
    const store = createRiskSignalStore({
      expectedOwner: writer,
      publicClient: {
        getEntity: async () => entity,
      },
      walletClient: {
        account: { address: writer },
        async createEntity() {
          createCalled = true;
          return created;
        },
      },
      findExistingByReferenceId: async (refId) => {
        if (refId === input.referenceId) {
          return entity;
        }
        return null;
      },
    });

    const result = await store.create(input);
    expect(result.isDuplicate).toBe(true);
    expect(result.entityKey).toBe(entity.$key);
    expect(createCalled).toBe(false);
  });
});
