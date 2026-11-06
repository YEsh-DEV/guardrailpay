import { describe, it, expect, vi } from 'vitest';
import { DualRpcClient } from './dual-rpc.js';
import { EnsProfileResolver, ENS_REGISTRY_ABI, ENS_RESOLVER_ABI } from './resolver.js';
import { verifyTrustAnchors } from './trust.js';
import type { IRpcProvider, EnsProfileRecord } from './types.js';
import { UnverifiableError } from '@quoteseal/shared';

// =============================================================================
// MOCKED PROVIDER HELPERS
// =============================================================================

function createMockRpcProvider(overrides: Partial<IRpcProvider> = {}): IRpcProvider {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(12000000n),
    getBlock: vi.fn().mockResolvedValue({
      number: 12000000n,
      hash: '0x1111111111111111111111111111111111111111111111111111111111111111'
    }),
    readContract: vi.fn().mockResolvedValue('mock-response'),
    ...overrides
  };
}

describe('DualRpcClient (MOCKED TEST VECTORS)', () => {
  it('[MOCKED] succeeds when primary and secondary agree on finalized block and data', async () => {
    const primary = createMockRpcProvider({
      readContract: vi.fn().mockResolvedValue('0.0.123456')
    });
    const secondary = createMockRpcProvider({
      readContract: vi.fn().mockResolvedValue('0.0.123456')
    });

    const client = new DualRpcClient({ primary, secondary });
    const res = await client.readContract<string>({
      address: '0x1234567890123456789012345678901234567890',
      abi: ENS_RESOLVER_ABI,
      functionName: 'text',
      args: ['0x00', 'quoteseal.activePayTo']
    });

    expect(res.data).toBe('0.0.123456');
    expect(res.blockNumber).toBe(12000000);
  });

  it('[MOCKED] throws UnverifiableError when block divergence exceeds tolerance', async () => {
    const primary = createMockRpcProvider({
      getBlock: vi.fn().mockResolvedValue({ number: 12000010n, hash: '0xaaaa' })
    });
    const secondary = createMockRpcProvider({
      getBlock: vi.fn().mockResolvedValue({ number: 12000000n, hash: '0xbbbb' })
    });

    const client = new DualRpcClient({ primary, secondary, maxBlockDivergenceTolerance: 3 });

    await expect(
      client.readContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: ENS_RESOLVER_ABI,
        functionName: 'text',
        args: ['0x00', 'quoteseal.activePayTo']
      })
    ).rejects.toThrow(UnverifiableError);
  });

  it('[MOCKED] throws UnverifiableError when RPC providers return conflicting data', async () => {
    const primary = createMockRpcProvider({
      readContract: vi.fn().mockResolvedValue('0.0.123456')
    });
    const secondary = createMockRpcProvider({
      readContract: vi.fn().mockResolvedValue('0.0.999999') // Attacker manipulated node
    });

    const client = new DualRpcClient({ primary, secondary });

    await expect(
      client.readContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: ENS_RESOLVER_ABI,
        functionName: 'text',
        args: ['0x00', 'quoteseal.activePayTo']
      })
    ).rejects.toThrow(/Dual-RPC divergence/);
  });

  it('[MOCKED] throws UnverifiableError when an RPC call fails (fail-closed)', async () => {
    const primary = createMockRpcProvider({
      readContract: vi.fn().mockRejectedValue(new Error('Connection timeout'))
    });
    const secondary = createMockRpcProvider();

    const client = new DualRpcClient({ primary, secondary });

    await expect(
      client.readContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: ENS_RESOLVER_ABI,
        functionName: 'text',
        args: ['0x00', 'quoteseal.activePayTo']
      })
    ).rejects.toThrow(UnverifiableError);
  });
});

describe('EnsProfileResolver (MOCKED TEST VECTORS)', () => {
  it('[MOCKED] resolves complete merchant profile from registry and dedicated resolver', async () => {
    const registryAddress = '0x1111111111111111111111111111111111111111';
    const resolverAddress = '0x2222222222222222222222222222222222222222';
    const ownerAddress = '0x3333333333333333333333333333333333333333';

    const mockRead = vi.fn().mockImplementation((params) => {
      if (params.address === registryAddress) {
        if (params.functionName === 'owner') return ownerAddress;
        if (params.functionName === 'resolver') return resolverAddress;
        if (params.functionName === 'expiry') return 1800000000n;
      }
      if (params.address === resolverAddress) {
        const key = params.args[1];
        if (key === 'quoteseal.activePayTo') return '0.0.123456';
        if (key === 'quoteseal.pendingPayTo') return '';
        if (key === 'quoteseal.rotationStatus') return 'STABLE';
        if (key === 'quoteseal.version') return '1';
        if (key === 'quoteseal.network') return 'hedera:testnet';
        if (key === 'quoteseal.scheme') return 'exact';
        if (key === 'quoteseal.asset') return '0.0.0';
        if (key === 'quoteseal.maxAmount') return '500000000';
      }
      return '';
    });

    const primary = createMockRpcProvider({ readContract: mockRead });
    const secondary = createMockRpcProvider({ readContract: mockRead });
    const dualRpc = new DualRpcClient({ primary, secondary });

    const resolver = new EnsProfileResolver({
      dualRpcClient: dualRpc,
      registryAddress
    });

    const profile = await resolver.resolveProfile('merchant.eth');

    expect(profile.ensName).toBe('merchant.eth');
    expect(profile.owner).toBe(ownerAddress);
    expect(profile.resolver).toBe(resolverAddress);
    expect(profile.activePayTo).toBe('0.0.123456');
    expect(profile.profileVersion).toBe(1);
    expect(profile.rotationStatus).toBe('STABLE');
    expect(profile.network).toBe('hedera:testnet');
  });

  it('[MOCKED] prioritizes quoteseal.profileVersion written by Solidity contract over legacy quoteseal.version', async () => {
    const registryAddress = '0x1111111111111111111111111111111111111111';
    const resolverAddress = '0x2222222222222222222222222222222222222222';
    const ownerAddress = '0x3333333333333333333333333333333333333333';

    const mockRead = vi.fn().mockImplementation((params) => {
      if (params.address === registryAddress) {
        if (params.functionName === 'owner') return ownerAddress;
        if (params.functionName === 'resolver') return resolverAddress;
        if (params.functionName === 'expiry') return 1800000000n;
      }
      if (params.address === resolverAddress) {
        const key = params.args[1];
        if (key === 'quoteseal.activePayTo') return '0.0.123456';
        if (key === 'quoteseal.profileVersion') return '5'; // On-chain contract key
        if (key === 'quoteseal.version') return '1';        // Stale legacy key
        if (key === 'quoteseal.rotationStatus') return 'stable';
      }
      return '';
    });

    const primary = createMockRpcProvider({ readContract: mockRead });
    const secondary = createMockRpcProvider({ readContract: mockRead });
    const dualRpc = new DualRpcClient({ primary, secondary });
    const resolver = new EnsProfileResolver({ dualRpcClient: dualRpc, registryAddress });

    const profile = await resolver.resolveProfile('merchant.eth');
    expect(profile.profileVersion).toBe(5);
    expect(profile.rotationStatus).toBe('STABLE');
  });

  it('[MOCKED] falls back to legacy quoteseal.version if quoteseal.profileVersion is absent', async () => {
    const registryAddress = '0x1111111111111111111111111111111111111111';
    const resolverAddress = '0x2222222222222222222222222222222222222222';
    const ownerAddress = '0x3333333333333333333333333333333333333333';

    const mockRead = vi.fn().mockImplementation((params) => {
      if (params.address === registryAddress) {
        if (params.functionName === 'owner') return ownerAddress;
        if (params.functionName === 'resolver') return resolverAddress;
        if (params.functionName === 'expiry') return 1800000000n;
      }
      if (params.address === resolverAddress) {
        const key = params.args[1];
        if (key === 'quoteseal.activePayTo') return '0.0.123456';
        if (key === 'quoteseal.profileVersion') return '';   // Absent
        if (key === 'quoteseal.version') return '3';        // Legacy fallback
        if (key === 'quoteseal.rotationStatus') return 'pending';
      }
      return '';
    });

    const primary = createMockRpcProvider({ readContract: mockRead });
    const secondary = createMockRpcProvider({ readContract: mockRead });
    const dualRpc = new DualRpcClient({ primary, secondary });
    const resolver = new EnsProfileResolver({ dualRpcClient: dualRpc, registryAddress });

    const profile = await resolver.resolveProfile('merchant.eth');
    expect(profile.profileVersion).toBe(3);
    expect(profile.rotationStatus).toBe('PENDING_APPROVED');
  });

  it('[MOCKED] throws UnverifiableError if quoteseal.activePayTo is missing', async () => {
    const registryAddress = '0x1111111111111111111111111111111111111111';
    const resolverAddress = '0x2222222222222222222222222222222222222222';

    const mockRead = vi.fn().mockImplementation((params) => {
      if (params.functionName === 'owner') return '0x3333333333333333333333333333333333333333';
      if (params.functionName === 'resolver') return resolverAddress;
      if (params.functionName === 'expiry') return 1800000000n;
      return ''; // empty activePayTo
    });

    const primary = createMockRpcProvider({ readContract: mockRead });
    const secondary = createMockRpcProvider({ readContract: mockRead });
    const dualRpc = new DualRpcClient({ primary, secondary });
    const resolver = new EnsProfileResolver({ dualRpcClient: dualRpc, registryAddress });

    await expect(resolver.resolveProfile('merchant.eth')).rejects.toThrow(/Missing required record 'quoteseal.activePayTo'/);
  });
});

describe('Trust Anchor Verification (PURE LOGIC TEST VECTORS)', () => {
  const baseProfile: EnsProfileRecord = {
    ensName: 'merchant.eth',
    namehash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    owner: '0x1111111111111111111111111111111111111111',
    resolver: '0x2222222222222222222222222222222222222222',
    expiry: 1800000000,
    profileVersion: 1,
    activePayTo: '0.0.123456',
    pendingPayTo: null,
    rotationStatus: 'STABLE',
    network: 'hedera:testnet',
    scheme: 'exact',
    assetId: '0.0.0',
    maxAmount: '500000000',
    finalizedBlockNumber: 12000000,
    finalizedBlockHash: '0xaaaa'
  };

  const trustedAnchors = {
    trustedOwner: '0x1111111111111111111111111111111111111111',
    trustedResolver: '0x2222222222222222222222222222222222222222',
    trustedExpiry: 1800000000,
    trustedProfileVersion: 1
  };

  it('returns PASS when all anchors and payTo match exactly', () => {
    const result = verifyTrustAnchors(baseProfile, trustedAnchors, {
      expectedPayTo: '0.0.123456',
      currentTimeSeconds: 1700000000
    });

    expect(result.verdict).toBe('PASS');
    expect(result.reasonCode).toBe('OK');
  });

  it('returns HOLD when name owner changes', () => {
    const tampered = { ...baseProfile, owner: '0x9999999999999999999999999999999999999999' };
    const result = verifyTrustAnchors(tampered, trustedAnchors);

    expect(result.verdict).toBe('HOLD');
    expect(result.reasonCode).toBe('ANCHOR_OWNER_MISMATCH');
    expect(result.divergentFields).toContain('owner');
  });

  it('returns HOLD when resolver address changes in registry', () => {
    const tampered = { ...baseProfile, resolver: '0x9999999999999999999999999999999999999999' };
    const result = verifyTrustAnchors(tampered, trustedAnchors);

    expect(result.verdict).toBe('HOLD');
    expect(result.reasonCode).toBe('ANCHOR_RESOLVER_MISMATCH');
    expect(result.divergentFields).toContain('resolver');
  });

  it('returns HOLD when name expiry changes or is expired', () => {
    const tampered = { ...baseProfile, expiry: 1900000000 };
    const result = verifyTrustAnchors(tampered, trustedAnchors);

    expect(result.verdict).toBe('HOLD');
    expect(result.reasonCode).toBe('ANCHOR_EXPIRY_EXPIRED');
    expect(result.divergentFields).toContain('expiry');
  });

  it('returns HOLD when profile version changes', () => {
    const tampered = { ...baseProfile, profileVersion: 2 };
    const result = verifyTrustAnchors(tampered, trustedAnchors);

    expect(result.verdict).toBe('HOLD');
    expect(result.reasonCode).toBe('ANCHOR_VERSION_MISMATCH');
    expect(result.divergentFields).toContain('profileVersion');
  });

  it('returns BLOCK when activePayTo differs from expected payment requirement', () => {
    const result = verifyTrustAnchors(baseProfile, trustedAnchors, {
      expectedPayTo: '0.0.999999' // Attacker replaced payTo in 402 challenge
    });

    expect(result.verdict).toBe('BLOCK');
    expect(result.reasonCode).toBe('PAYTO_MISMATCH');
    expect(result.divergentFields).toContain('activePayTo');
  });
});
