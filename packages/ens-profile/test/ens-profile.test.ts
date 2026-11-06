import { describe, it, expect } from 'vitest';
import { resolveProfile, EnsMerchantProfileSchema, ProfileCache, EnsMerchantProfile } from '../src/index.js';

describe('ens-profile package', () => {
  const mockProfile: EnsMerchantProfile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    hederaNetwork: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: 1000000000n,
    profileVersion: 1,
    rotationStatus: 'none',
  };

  it('validates schema correctly with Zod', () => {
    const parsed = EnsMerchantProfileSchema.parse(mockProfile);
    expect(parsed.ensName).toBe('researchpro.eth');
    expect(parsed.maxAmount).toBe(1000000000n);
  });

  it('manages cache with TTL expiration', async () => {
    const cache = new ProfileCache(50); // 50ms TTL
    cache.set('researchpro.eth', mockProfile);

    expect(cache.get('researchpro.eth')?.activePayTo).toBe('0.0.12345');

    // Wait 60ms to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('researchpro.eth')).toBeNull();
  });

  it('resolves profile using mockRegistry', async () => {
    const registry = new Map<string, EnsMerchantProfile>();
    registry.set('researchpro.eth', mockProfile);

    const resolved = await resolveProfile('researchpro.eth', { mockRegistry: registry });
    expect(resolved.activePayTo).toBe('0.0.12345');
    expect(resolved.serviceEndpoint).toBe('https://api.researchpro.com');
  });

  it('throws ProfileResolutionError if profile is missing', async () => {
    const registry = new Map<string, EnsMerchantProfile>();
    await expect(
      resolveProfile('nonexistent.eth', { mockRegistry: registry })
    ).rejects.toThrow();
  });
});
