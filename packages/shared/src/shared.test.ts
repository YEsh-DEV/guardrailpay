import { describe, it, expect } from 'vitest';
import {
  QuoteSealError,
  ValidationError,
  SecurityHoldError,
  SecurityBlockError,
  UnverifiableError,
  NotFoundError,
  SolidityRotationState,
  SolidityVerdict,
  OnChainRotationStateSchema,
  OnChainVerdictSchema,
  VerdictSchema,
  toRotationState,
  toSolidityStateIndex,
  normalizeRotationState,
  toOnChainVerdict,
  toSolidityVerdictIndex,
  RotationApprovalDataSchema,
  computeProposalId,
  ROTATION_CONTROLLER_ABI
} from './index.js';
import { validateEnv, EnvSchema } from './config/index.js';
import { checkDatabaseReadiness, createDatabaseClient, requireDatabaseConnection } from './db/index.js';
import { createLogger, SENSITIVE_PATHS } from './logging/index.js';

const liveTestConfig = () => ({
  NODE_ENV: 'production',
  APP_PROFILE: 'testnet-demo',
  DATABASE_URL: 'postgresql://app:pw@db.quoteseal.org:5432/quoteseal',
  ATTESTOR_PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
  OPERATOR_SUBJECT_HMAC_SECRET: 'production_hmac_secret_longer_than_32_bytes_safe',
  ENCRYPTION_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ROTATION_CONTROLLER_ADDRESS: '0x1234567890123456789012345678901234567890',
  ROTATION_CONTROLLER_CODE_HASH: '0x' + 'ab'.repeat(32),
  ENS_MERCHANT_NAME: 'quotesealmerchant.eth',
  ENS_NAMEHASH: '0x' + 'cd'.repeat(32),
  ENS_RESOLVER_ADDRESS: '0x2222222222222222222222222222222222222222',
  ENS_EXPECTED_OWNER: '0x1111111111111111111111111111111111111111',
  WORLD_ID_CLIENT_ID: 'app_live_quoteseal_2026',
  WORLD_ID_ACTION: 'rotation-approval',
  WORLD_ID_REDIRECT_URI: 'https://api.quoteseal.org/v1/world/callback',
  HEDERA_NETWORK: 'testnet',
  HEDERA_ACCOUNT_ID: '0.0.123456',
  X402_FACILITATOR_URL: 'https://facilitator.quoteseal.org',
  X402_NETWORK: 'hedera:testnet',
  X402_SCHEME: 'exact',
  X402_ASSET: '0.0.0',
  X402_AMOUNT: '1000000'
});

describe('Shared Error Hierarchy', () => {
  it('instantiates ValidationError with 400 status code', () => {
    const err = new ValidationError('Bad request field', { field: 'ensName' });
    expect(err).toBeInstanceOf(QuoteSealError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.toJSON()).toEqual({
      error: {
        name: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Bad request field',
        statusCode: 400,
        details: { field: 'ensName' }
      }
    });
  });

  it('instantiates SecurityHoldError with 422 status code', () => {
    const err = new SecurityHoldError('Trust anchor mismatch detected');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('SECURITY_HOLD');
  });

  it('instantiates SecurityBlockError with 403 status code', () => {
    const err = new SecurityBlockError('Changed payTo address unauthorized');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('SECURITY_BLOCK');
  });

  it('instantiates UnverifiableError with 502 status code', () => {
    const err = new UnverifiableError('Dual RPC divergence beyond threshold');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('UNVERIFIABLE');
  });
});

describe('Configuration & Environment Validation', () => {
  it('parses valid default environment', () => {
    const env = validateEnv({
      PORT: '5000',
      HOST: '127.0.0.1',
      NODE_ENV: 'test'
    });
    expect(env.PORT).toBe(5000);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.NODE_ENV).toBe('test');
    expect(env.FINALITY_CONFIRMATIONS).toBe(2);
  });

  it('throws ConfigurationError on invalid PORT', () => {
    expect(() =>
      validateEnv({
        PORT: 'not-a-number'
      })
    ).toThrow(/Environment validation failed/);
  });

  it('rejects test fallback keys when NODE_ENV=production (fail-closed)', () => {
    // Attempt starting with default test keys in production
    expect(() =>
      validateEnv({
        NODE_ENV: 'production'
      })
    ).toThrow(/DATABASE_URL|ATTESTOR_PRIVATE_KEY/);

    // Attempt starting with Foundry Key 0 in production
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        ATTESTOR_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        OPERATOR_SUBJECT_HMAC_SECRET: 'production_hmac_secret_longer_than_32_bytes_safe',
        ENCRYPTION_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ROTATION_CONTROLLER_ADDRESS: '0x1234567890123456789012345678901234567890',
        ROTATION_CONTROLLER_CODE_HASH: '0x' + 'ab'.repeat(32),
        DATABASE_URL: 'postgresql://app:pw@example.test:5432/quoteseal',
        ENS_MERCHANT_NAME: 'merchant.eth',
        ENS_NAMEHASH: '0x' + 'cd'.repeat(32),
        ENS_RESOLVER_ADDRESS: '0x2222222222222222222222222222222222222222',
        ENS_EXPECTED_OWNER: '0x1111111111111111111111111111111111111111',
        WORLD_ID_CLIENT_ID: 'app_production_world_id',
        WORLD_ID_ACTION: 'rotation-approval',
        WORLD_ID_REDIRECT_URI: 'https://quoteseal.example/v1/world/callback',
        HEDERA_NETWORK: 'testnet',
        HEDERA_ACCOUNT_ID: '0.0.123456',
        X402_FACILITATOR_URL: 'https://facilitator.example',
        X402_NETWORK: 'hedera:testnet',
        X402_SCHEME: 'exact',
        X402_ASSET: '0.0.0',
        X402_AMOUNT: '1000000'
      })
    ).toThrow(/ATTESTOR_PRIVATE_KEY/);
  });

  it('accepts valid production configuration with real non-default secrets', () => {
    const prodEnv = validateEnv({
      ...liveTestConfig(),
      APP_PROFILE: 'production',
      WORLD_ID_CLIENT_ID: 'app_production_world_id'
    });
    expect(prodEnv.NODE_ENV).toBe('production');
    expect(prodEnv.ROTATION_CONTROLLER_ADDRESS).toBe('0x1234567890123456789012345678901234567890');
  });

  it('rejects testnet profile when database, controller, or external configuration is absent', () => {
    const missingDatabase = liveTestConfig();
    delete (missingDatabase as Partial<typeof missingDatabase>).DATABASE_URL;
    expect(() => validateEnv(missingDatabase)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...liveTestConfig(), WORLD_ID_CLIENT_ID: '' })).toThrow(/WORLD_ID_CLIENT_ID/);
    expect(() => validateEnv({ ...liveTestConfig(), HEDERA_ACCOUNT_ID: '' })).toThrow(/HEDERA_ACCOUNT_ID/);
  });

  it('rejects zero controller address in live profiles', () => {
    expect(() => validateEnv({ ...liveTestConfig(), ROTATION_CONTROLLER_ADDRESS: '0x0000000000000000000000000000000000000000' }))
      .toThrow(/ROTATION_CONTROLLER_ADDRESS/);
    expect(() => validateEnv({ ...liveTestConfig(), ROTATION_CONTROLLER_ADDRESS: undefined })).toThrow(/ROTATION_CONTROLLER_ADDRESS/);
  });

  it('does not allow production NODE_ENV to downgrade to a local profile', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', APP_PROFILE: 'local-development' })).toThrow(/live configuration profile/);
  });

  it('rejects placeholder hosts and World ID values in a live profile', () => {
    expect(() => validateEnv({ ...liveTestConfig(), X402_FACILITATOR_URL: 'https://facilitator.example' })).toThrow(/placeholder host/);
    expect(() => validateEnv({ ...liveTestConfig(), WORLD_ID_CLIENT_ID: 'app_live_test' })).toThrow(/placeholder values/);
  });

  it('does not put secret values in configuration diagnostics', () => {
    const sentinel = 'not-a-real-secret-value';
    try {
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: `postgresql://user:${sentinel}@db.invalid/app` });
      throw new Error('expected configuration rejection');
    } catch (error) {
      expect(String(error)).not.toContain(sentinel);
      expect(String(error)).toContain('ROTATION_CONTROLLER_ADDRESS');
    }
  });
});

describe('Database initialization and readiness', () => {
  it('requires an explicit database URL', () => {
    expect(() => createDatabaseClient({ connectionString: '' })).toThrow(/DATABASE_URL is required/);
  });

  it('returns disconnected without leaking the database error', async () => {
    const pool = { query: async () => { throw new Error('credential-bearing URL'); } } as any;
    await expect(checkDatabaseReadiness(pool)).resolves.toEqual({ connected: false, migrationsApplied: false });
    await expect(requireDatabaseConnection(pool)).rejects.toThrow(/PostgreSQL connection failed/);
  });

  it('keeps the database unready when migrations have not been applied', async () => {
    const pool = { query: async (sql: string) => {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('to_regclass')) return { rows: [{ name: null }] };
      throw new Error('unexpected query');
    } } as any;
    await expect(checkDatabaseReadiness(pool)).resolves.toEqual({ connected: true, migrationsApplied: false });
  });

  it('requires every journal migration before reporting migration readiness', async () => {
    const timestamps = ['1793965945372', '1793968201627'];
    const pool = { query: async (sql: string) => {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      if (sql.includes('to_regclass')) return { rows: [{ name: 'drizzle.__drizzle_migrations' }] };
      return { rows: timestamps.map((created_at) => ({ created_at })) };
    } } as any;
    await expect(checkDatabaseReadiness(pool)).resolves.toEqual({ connected: true, migrationsApplied: true });
  });
});

describe('Logging & Secret Redaction', () => {
  it('includes sensitive field names in redaction paths', () => {
    expect(SENSITIVE_PATHS).toContain('authorization');
    expect(SENSITIVE_PATHS).toContain('privateKey');
    expect(SENSITIVE_PATHS).toContain('clientSecret');
    expect(SENSITIVE_PATHS).toContain('pkceVerifier');
  });

  it('creates logger without throwing', () => {
    const log = createLogger({ level: 'silent' });
    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
  });
});

describe('Solidity Contract Enums & Mappings', () => {
  it('correctly maps all Solidity State enum indices (0..4) 1:1', () => {
    expect(toRotationState(0)).toBe('STABLE');
    expect(toRotationState(1)).toBe('PROPOSED');
    expect(toRotationState(2)).toBe('PENDING_APPROVED');
    expect(toRotationState(3)).toBe('ACTIVATED');
    expect(toRotationState(4)).toBe('CANCELLED');
    expect(() => toRotationState(5)).toThrow(/Invalid Solidity State/);
  });

  it('correctly maps RotationState back to Solidity enum indices', () => {
    expect(toSolidityStateIndex('STABLE')).toBe(SolidityRotationState.STABLE);
    expect(toSolidityStateIndex('PROPOSED')).toBe(SolidityRotationState.PROPOSED);
    expect(toSolidityStateIndex('PENDING_APPROVED')).toBe(SolidityRotationState.PENDING_APPROVED);
    expect(toSolidityStateIndex('ACTIVATED')).toBe(SolidityRotationState.ACTIVATED);
    expect(toSolidityStateIndex('CANCELLED')).toBe(SolidityRotationState.CANCELLED);
  });

  it('normalizes workflow state strings to canonical on-chain states', () => {
    expect(normalizeRotationState('pending')).toBe('PENDING_APPROVED');
    expect(normalizeRotationState('APPROVED')).toBe('PENDING_APPROVED');
    expect(normalizeRotationState('stable')).toBe('STABLE');
    expect(normalizeRotationState('PROPOSED')).toBe('PROPOSED');
    expect(normalizeRotationState('activated')).toBe('ACTIVATED');
    expect(normalizeRotationState('cancelled')).toBe('CANCELLED');
    expect(normalizeRotationState('unknown')).toBe('STABLE');
  });

  it('correctly maps Solidity Verdict enum indices (0..2) 1:1', () => {
    expect(toOnChainVerdict(0)).toBe('PASS');
    expect(toOnChainVerdict(1)).toBe('BLOCK');
    expect(toOnChainVerdict(2)).toBe('HOLD');
    expect(() => toOnChainVerdict(3)).toThrow(/Invalid Solidity verdict/);

    expect(toSolidityVerdictIndex('PASS')).toBe(SolidityVerdict.PASS);
    expect(toSolidityVerdictIndex('BLOCK')).toBe(SolidityVerdict.BLOCK);
    expect(toSolidityVerdictIndex('HOLD')).toBe(SolidityVerdict.HOLD);
  });

  it('keeps UNVERIFIABLE strictly off-chain', () => {
    // VerdictSchema accepts UNVERIFIABLE
    expect(VerdictSchema.parse('UNVERIFIABLE')).toBe('UNVERIFIABLE');
    // OnChainVerdictSchema rejects UNVERIFIABLE
    expect(() => OnChainVerdictSchema.parse('UNVERIFIABLE')).toThrow();
  });

  it('validates 12-field RotationApprovalDataSchema and coerces numbers/strings to bigint', () => {
    const raw = {
      merchantId: '0x' + '11'.repeat(32),
      proposalId: '0x' + '22'.repeat(32),
      operator: '0x1111111111111111111111111111111111111111',
      resolver: '0x2222222222222222222222222222222222222222',
      namehash: '0x' + '33'.repeat(32),
      oldPayToHash: '0x' + '44'.repeat(32),
      newPayToHash: '0x' + '55'.repeat(32),
      effectiveAt: '1700000000',
      proposalExpiry: 1800000000,
      proposalNonce: 1,
      authTime: 1699999900,
      attestationExpiry: '1700000300'
    };

    const parsed = RotationApprovalDataSchema.parse(raw);
    expect(parsed.effectiveAt).toBe(1700000000n);
    expect(parsed.proposalExpiry).toBe(1800000000n);
    expect(parsed.proposalNonce).toBe(1n);
    expect(parsed.authTime).toBe(1699999900n);
    expect(parsed.attestationExpiry).toBe(1700000300n);
  });

  it('computes canonical proposal ID matching RotationController.sol abi.encode formula', () => {
    const proposalId = computeProposalId({
      controllerAddress: '0x1111111111111111111111111111111111111111',
      chainId: 31337,
      merchantId: '0x2222222222222222222222222222222222222222222222222222222222222222',
      proposalNonce: 1,
      operatorAddress: '0x3333333333333333333333333333333333333333',
      activePayTo: '0.0.123',
      newPayTo: '0.0.456',
      proposalExpiry: 2000
    });

    expect(proposalId).toBe('0xb1970ad01da4f26fc45b2fd55829b94db1e593a6129f25fcb9e93a7a7b605716');
    expect(proposalId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('exports generated ROTATION_CONTROLLER_ABI with 65 contract entries', () => {
    expect(Array.isArray(ROTATION_CONTROLLER_ABI)).toBe(true);
    expect(ROTATION_CONTROLLER_ABI.length).toBe(65);

    // Verify key functions are present
    const fnNames = ROTATION_CONTROLLER_ABI.filter((x) => x.type === 'function').map((x: any) => x.name);
    expect(fnNames).toContain('proposeRotation');
    expect(fnNames).toContain('approveWithAttestation');
    expect(fnNames).toContain('activateRotation');
    expect(fnNames).toContain('cancelPendingRotation');
    expect(fnNames).toContain('enrollOperator');
    expect(fnNames).toContain('revokeOperator');
    expect(fnNames).toContain('previewProposalId');
    expect(fnNames).toContain('getRotationState');
    expect(fnNames).toContain('payoutVerdict');
  });
});
