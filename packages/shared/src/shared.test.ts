import { describe, it, expect } from 'vitest';
import {
  QuoteSealError,
  ValidationError,
  SecurityHoldError,
  SecurityBlockError,
  UnverifiableError,
  NotFoundError
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
