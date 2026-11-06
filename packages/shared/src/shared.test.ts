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
import { createLogger, SENSITIVE_PATHS } from './logging/index.js';

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
    ).toThrow(/Production deployment requires real non-default/);

    // Attempt starting with Foundry Key 0 in production
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        ATTESTOR_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        OPERATOR_SUBJECT_HMAC_SECRET: 'production_hmac_secret_longer_than_32_bytes_safe',
        ENCRYPTION_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ROTATION_CONTROLLER_ADDRESS: '0x1234567890123456789012345678901234567890',
        WORLD_ID_CLIENT_ID: 'app_production_world_id'
      })
    ).toThrow(/Production deployment requires real non-default/);
  });

  it('accepts valid production configuration with real non-default secrets', () => {
    const prodEnv = validateEnv({
      NODE_ENV: 'production',
      ATTESTOR_PRIVATE_KEY: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
      OPERATOR_SUBJECT_HMAC_SECRET: 'production_hmac_secret_longer_than_32_bytes_safe',
      ENCRYPTION_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ROTATION_CONTROLLER_ADDRESS: '0x1234567890123456789012345678901234567890',
      WORLD_ID_CLIENT_ID: 'app_production_world_id'
    });
    expect(prodEnv.NODE_ENV).toBe('production');
    expect(prodEnv.ROTATION_CONTROLLER_ADDRESS).toBe('0x1234567890123456789012345678901234567890');
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
