import { describe, it, expect } from 'vitest';
import { loadEnv, getHashScanUrl, QuoteSealError, ConfigurationError } from '../src/index.js';

describe('packages/shared', () => {
  it('creates error instances correctly', () => {
    const err = new ConfigurationError('Missing key', { key: 'TEST' });
    expect(err).toBeInstanceOf(QuoteSealError);
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.message).toBe('Missing key');
  });

  it('generates correct HashScan URLs', () => {
    const url = getHashScanUrl({
      network: 'testnet',
      type: 'transaction',
      id: '0.0.12345@1234567890.000000000',
    });
    expect(url).toBe('https://hashscan.io/testnet/transaction/0.0.12345%401234567890.000000000');
  });

  it('loads default environment configuration safely', () => {
    const env = loadEnv({
      PORT: '4000',
      HEDERA_NETWORK: 'testnet',
    });
    expect(env.PORT).toBe(4000);
    expect(env.HEDERA_NETWORK).toBe('testnet');
  });
});
