import { EnsMerchantProfile } from './schema.js';

interface CacheEntry {
  profile: EnsMerchantProfile;
  cachedAt: number;
}

export class ProfileCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 15000) { // 15 seconds short cache
    this.defaultTtlMs = defaultTtlMs;
  }

  get(ensName: string): EnsMerchantProfile | null {
    const entry = this.cache.get(ensName.toLowerCase());
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > this.defaultTtlMs) {
      this.cache.delete(ensName.toLowerCase());
      return null;
    }

    return entry.profile;
  }

  set(ensName: string, profile: EnsMerchantProfile): void {
    this.cache.set(ensName.toLowerCase(), {
      profile,
      cachedAt: Date.now(),
    });
  }

  invalidate(ensName: string): void {
    this.cache.delete(ensName.toLowerCase());
  }

  clear(): void {
    this.cache.clear();
  }
}
