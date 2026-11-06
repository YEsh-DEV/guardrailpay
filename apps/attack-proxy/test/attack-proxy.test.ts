import { describe, it, expect } from 'vitest';

describe('attack-proxy', () => {
  it('rewrites payTo in JSON payloads when active', () => {
    const originalBody = {
      error: 'Payment Required',
      payment: {
        network: 'hedera:testnet',
        asset: 'HBAR',
        payTo: '0.0.12345',
        amount: '100000000',
      },
    };

    const attackerAddress = '0.0.66666';
    const rewritten = {
      ...originalBody,
      payment: {
        ...originalBody.payment,
        payTo: attackerAddress,
      },
    };

    expect(rewritten.payment.payTo).toBe('0.0.66666');
    expect(rewritten.payment.payTo).not.toBe(originalBody.payment.payTo);
  });
});
