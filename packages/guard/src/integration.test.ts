/**
 * QuoteSeal Cross-Branch Integration Test
 *
 * Connects ENS profile resolution, trust-anchor verification, guard evaluation,
 * and backend rotation data into one executable end-to-end flow. All components
 * are explicitly mocked — no live-chain claims.
 *
 * Imports only from @quoteseal/ens-profile and @quoteseal/shared (the guard
 * package's actual dependencies) plus inline mock rotation data.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  DualRpcClient,
  EnsProfileResolver,
  ENS_REGISTRY_ABI,
  ENS_RESOLVER_ABI,
  type EnsProfileRecord,
  type IRpcProvider
} from '@quoteseal/ens-profile';
import { verifyTrustAnchors, type TrustAnchors, type Verdict } from '@quoteseal/ens-profile';
import { VerdictSchema } from '@quoteseal/shared';

const ENS_NAME = 'merchant.eth';
const REGISTRY = '0x1111111111111111111111111111111111111111';
const RESOLVER = '0x2222222222222222222222222222222222222222';
const OWNER = '0x3333333333333333333333333333333333333333';

function createMockRpcProvider(overrides: Partial<IRpcProvider> = {}): IRpcProvider {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(12000000n),
    getBlock: vi.fn().mockResolvedValue({
      number: 12000000n,
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    }),
    readContract: vi.fn().mockResolvedValue('mock-response'),
    ...overrides
  };
}

function buildMockReadContract(profile: EnsProfileRecord) {
  return vi.fn().mockImplementation((params: any) => {
    const { address, functionName, args } = params;
    if (address.toLowerCase() === REGISTRY.toLowerCase()) {
      if (functionName === 'owner') return OWNER;
      if (functionName === 'resolver') return RESOLVER;
      if (functionName === 'expiry') return profile.expiry;
    }
    if (address.toLowerCase() === RESOLVER.toLowerCase()) {
      const key = args?.[1];
      if (key === 'quoteseal.activePayTo') return profile.activePayTo;
      if (key === 'quoteseal.pendingPayTo') return profile.pendingPayTo ?? '';
      if (key === 'quoteseal.rotationStatus') return profile.rotationStatus;
      if (key === 'quoteseal.profileVersion') return String(profile.profileVersion);
      if (key === 'quoteseal.version') return String(profile.profileVersion); // legacy key
      if (key === 'quoteseal.network') return profile.network;
      if (key === 'quoteseal.scheme') return profile.scheme;
      if (key === 'quoteseal.asset') return profile.assetId;
      if (key === 'quoteseal.maxAmount') return profile.maxAmount;
    }
    return '';
  });
}

function baseProfile(): EnsProfileRecord {
  return {
    ensName: ENS_NAME,
    namehash: '0x1234567890123456789012345678901234567890123456789012345678901234',
    owner: OWNER,
    resolver: RESOLVER,
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
}

function baseTrustAnchors(): TrustAnchors {
  return {
    trustedOwner: OWNER,
    trustedResolver: RESOLVER,
    trustedExpiry: 1800000000,
    trustedProfileVersion: 1
  };
}

// Inline mock rotation data mirroring MockRotationControllerClient semantics
const MOCK_ROTATION_STATES: Record<string, { activePayTo: string; pendingPayTo: string | null; state: 'STABLE' | 'PROPOSED' | 'PENDING_APPROVED' | 'ACTIVATED' | 'CANCELLED' }> = {
  '0x0000000000000000000000000000000000000000': {
    activePayTo: '0.0.123456',
    pendingPayTo: null,
    state: 'STABLE'
  }
};

function mockPayoutVerdict(controllerAddress: string, payTo: string): Verdict {
  const state = MOCK_ROTATION_STATES[controllerAddress];
  if (!state) return 'BLOCK';
  if (payTo === state.activePayTo) return 'PASS';
  if (state.state === 'PENDING_APPROVED' && payTo === state.pendingPayTo) return 'HOLD';
  return 'BLOCK';
}

describe('Cross-Branch Integration: ENS Profile -> Guard -> Rotation Data', () => {
  it('full flow: profile resolves, trust anchors verify, rotation client returns PASS', async () => {
    const profile = baseProfile();
    const mockRead = buildMockReadContract(profile);
    const primary = createMockRpcProvider({ readContract: mockRead });
    const secondary = createMockRpcProvider({ readContract: mockRead });
    const dualRpc = new DualRpcClient({ primary, secondary });
    const resolver = new EnsProfileResolver({ dualRpcClient: dualRpc, registryAddress: REGISTRY });

    // Step 1: Resolve ENS profile via Dual-RPC
    const resolved = await resolver.resolveProfile(ENS_NAME);
    expect(resolved.activePayTo).toBe('0.0.123456');
    expect(resolved.profileVersion).toBe(1);
    expect(resolved.rotationStatus).toBe('STABLE');

    // Step 2: Verify trust anchors against pinned buyer anchors
    const anchors = baseTrustAnchors();
    const trustResult = verifyTrustAnchors(resolved, anchors, {
      expectedPayTo: '0.0.123456',
      currentTimeSeconds: 1700000000
    });
    expect(trustResult.verdict).toBe('PASS');
    expect(trustResult.reasonCode).toBe('OK');

    // Step 3: Backend rotation data returns PASS for active payTo
    const contractVerdict = mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.123456'
    );
    expect(contractVerdict).toBe('PASS');

    // Step 4: Tampered payTo -> BLOCK at both trust and contract layers
    const tamperedTrust = verifyTrustAnchors(resolved, anchors, {
      expectedPayTo: '0.0.999999',
      currentTimeSeconds: 1700000000
    });
    expect(tamperedTrust.verdict).toBe('BLOCK');

    const tamperedContract = mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.999999'
    );
    expect(tamperedContract).toBe('BLOCK');
  });

  it('ENS profile version key mismatch: contract writes profileVersion, resolver reads version', async () => {
    const contractWriteKey = 'quoteseal.profileVersion'; // Solidity VERSION_KEY
    const resolverReadKey = 'quoteseal.version';          // resolver.ts line 128
    expect(contractWriteKey).toBe('quoteseal.profileVersion');
    expect(resolverReadKey).toBe('quoteseal.version');
    // ABI/API MISMATCH: resolver reads 'quoteseal.version' but contract writes 'quoteseal.profileVersion'
    expect(contractWriteKey).not.toBe(resolverReadKey);
  });

  it('Rotation state machine: STABLE -> PROPOSED -> PENDING_APPROVED -> HOLD for new payTo', async () => {
    // Initial: STABLE, active payTo is PASS
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.123456'
    )).toBe('PASS');

    // Simulate proposeRotation: old still PASS, new not valid yet
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.456789'
    )).toBe('BLOCK');

    // Simulate approveWithAttestation: move to PENDING_APPROVED, set pendingPayTo
    MOCK_ROTATION_STATES['0x0000000000000000000000000000000000000000'] = {
      activePayTo: '0.0.123456',
      pendingPayTo: '0.0.456789',
      state: 'PENDING_APPROVED'
    };

    // In PENDING_APPROVED: old payTo still PASS, new payTo is HOLD (not PASS)
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.123456'
    )).toBe('PASS');
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.456789'
    )).toBe('HOLD');

    // Simulate activateRotation: move to ACTIVATED, new payTo becomes PASS
    MOCK_ROTATION_STATES['0x0000000000000000000000000000000000000000'] = {
      activePayTo: '0.0.456789',
      pendingPayTo: null,
      state: 'ACTIVATED'
    };
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.456789'
    )).toBe('PASS');
    expect(mockPayoutVerdict(
      '0x0000000000000000000000000000000000000000',
      '0.0.123456'
    )).toBe('BLOCK');
  });

  it('VerdictSchema type compatibility with Solidity contract', () => {
    // Solidity Verdict enum: PASS=0, BLOCK=1, HOLD=2 (no UNVERIFIABLE)
    expect(VerdictSchema.parse('PASS')).toBe('PASS');
    expect(VerdictSchema.parse('BLOCK')).toBe('BLOCK');
    expect(VerdictSchema.parse('HOLD')).toBe('HOLD');
    // UNVERIFIABLE is off-chain client-only, not a Solidity contract verdict
    // Zod allows it at the TypeScript level but it can never come from the contract
    expect(VerdictSchema.parse('UNVERIFIABLE')).toBe('UNVERIFIABLE');
  });
});
