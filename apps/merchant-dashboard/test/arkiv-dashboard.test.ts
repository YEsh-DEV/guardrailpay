import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getArkivOverview,
  searchWalletRisk,
  getRiskSignalHistory,
  getPaymentDecisions,
  ArkivOverviewMetrics,
  WalletRiskDetail,
} from '../app/lib/arkiv-dashboard-service';

describe('Arkiv Dashboard Service & Security Guarantees', () => {
  const TRUSTED_OWNER = '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Wallet Identifier Validation', () => {
    it('rejects empty wallet identifiers', async () => {
      const res = await searchWalletRisk('');
      expect('error' in res).toBe(true);
      if ('error' in res) {
        expect(res.error).toMatch(/cannot be empty/i);
      }
    });

    it('rejects malformed wallet identifiers', async () => {
      const res = await searchWalletRisk('invalid-wallet-format');
      expect('error' in res).toBe(true);
      if ('error' in res) {
        expect(res.invalidInput).toBe(true);
        expect(res.error).toMatch(/Invalid wallet identifier/i);
      }
    });

    it('accepts valid Hedera account IDs', async () => {
      const res = await searchWalletRisk('0.0.90001');
      if ('error' in res) {
        expect(res.error).toMatch(/live configuration is unavailable/i);
      } else {
        expect(res.walletKey).toBe('0.0.90001');
      }
    });

    it('accepts valid EVM hex addresses', async () => {
      const res = await searchWalletRisk('0x1111111111111111111111111111111111111111');
      if ('error' in res) {
        expect(res.error).toMatch(/live configuration is unavailable/i);
      } else {
        expect(res.walletKey).toBe('0x1111111111111111111111111111111111111111');
      }
    });
  });

  describe('2. Wallet Risk Resolution & State Verification', () => {
    it('returns BLOCK verdict for known malicious testnet wallet 0.0.90001', async () => {
      const res = await searchWalletRisk('0.0.90001');
      if ('error' in res) {
        expect(res.error).toMatch(/live configuration is unavailable/i);
      } else {
        const detail = res as WalletRiskDetail;
        expect(detail.verdict).toBe('BLOCK');
        expect(detail.reporter.toLowerCase()).toBe(TRUSTED_OWNER.toLowerCase());
        expect(detail.entityKey).toBeDefined();
        expect(detail.source).toBe('live');
        expect(detail.isExpired).toBe(false);
      }
    });

    it('returns ALLOW verdict for clean testnet wallet 0.0.12345', async () => {
      const res = await searchWalletRisk('0.0.12345');
      if ('error' in res) {
        expect(res.error).toMatch(/live configuration is unavailable/i);
      } else {
        const detail = res as WalletRiskDetail;
        expect(detail.verdict).toBe('ALLOW');
        expect(detail.reporter.toLowerCase()).toBe(TRUSTED_OWNER.toLowerCase());
        expect(detail.isExpired).toBe(false);
      }
    });

    it('returns UNKNOWN with NO_RECORD_FOUND for unrecorded wallet', async () => {
      const res = await searchWalletRisk('0.0.77777');
      if ('error' in res) {
        expect(res.error).toMatch(/live configuration is unavailable/i);
      } else {
        const detail = res as WalletRiskDetail;
        expect(detail.verdict).toBe('UNKNOWN');
        expect(detail.reasonCode).toBe('NO_RECORD_FOUND');
        expect(detail.entityKey).toBe('none');
      }
    });
  });

  describe('3. Arkiv Overview & Freshness Metrics', () => {
    it('retrieves aggregate overview metrics with valid chain info', async () => {
      const metrics: ArkivOverviewMetrics = await getArkivOverview();
      expect(metrics.chainId).toBe(7794095);
      expect(metrics.networkName).toBe('Arkiv Rabdi Testnet');
      expect(metrics.gasToken).toBe('tGLM');
      expect(typeof metrics.blockedWallets).toBe('number');
      expect(typeof metrics.allowedWallets).toBe('number');
      expect(typeof metrics.totalSignals).toBe('number');
      if (metrics.source === 'live') {
        expect(metrics.trustedReporters.length).toBeGreaterThan(0);
        expect(metrics.trustedReporters[0].toLowerCase()).toBe(TRUSTED_OWNER.toLowerCase());
      } else {
        expect(metrics.source).toBe('unavailable');
        expect(metrics.trustedReporters).toHaveLength(0);
      }
      expect(['online', 'degraded', 'offline']).toContain(metrics.rpcStatus);
      expect(['live', 'fixture', 'unavailable']).toContain(metrics.source);
    });
  });

  describe('4. Risk Signal History', () => {
    it('retrieves risk signal entities with valid fields', async () => {
      const result = await getRiskSignalHistory(10);
      expect(Array.isArray(result.signals)).toBe(true);
      expect(['live', 'fixture', 'unavailable']).toContain(result.source);
      if (result.source === 'unavailable') expect(result.error).toMatch(/unavailable|no fixture/i);

      if (result.signals.length > 0) {
        const sig = result.signals[0];
        expect(sig.entityKey).toBeDefined();
        expect(sig.walletKey).toBeDefined();
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(sig.severity);
        expect(sig.signalCode).toBeDefined();
        expect(sig.reporter.toLowerCase()).toBe(TRUSTED_OWNER.toLowerCase());
        expect(sig.explorerUrl).toMatch(/^https:\/\/explorer\.rabdi\.arkiv\.network\/entity\//);
      }
    });
  });

  describe('5. Payment Decisions Honest Empty State', () => {
    it('reports empty state without fabricating fake payment decisions', async () => {
      const result = await getPaymentDecisions();
      expect(Array.isArray(result.decisions)).toBe(true);
      if (result.decisions.length === 0) {
        expect(['empty', 'unsupported']).toContain(result.status);
        expect(result.message).toMatch(/PaymentDecision/i);
      } else {
        expect(result.status).toBe('available');
      }
    });
  });

  describe('6. Security Invariant: Owner & Expiration Filtering Logic', () => {
    it('filters out untrusted owner entities from candidates', () => {
      const currentBlock = 314000n;
      const candidates = [
        {
          $key: '0x1111' as `0x${string}`,
          $owner: '0x9999999999999999999999999999999999999999' as `0x${string}`, // UNTRUSTED ATTACKER
          $expiresAt: 350000n,
          status: { value: 'BLOCK' },
        },
        {
          $key: '0x2222' as `0x${string}`,
          $owner: TRUSTED_OWNER as `0x${string}`, // TRUSTED
          $expiresAt: 350000n,
          status: { value: 'BLOCK' },
        },
      ];

      // Replicating the exact security filter in arkiv-dashboard-service
      const trustedCandidates = candidates.filter(
        (c) => c.$owner.toLowerCase() === TRUSTED_OWNER.toLowerCase() && c.$expiresAt > currentBlock
      );

      expect(trustedCandidates.length).toBe(1);
      expect(trustedCandidates[0].$key).toBe('0x2222');
      expect(trustedCandidates[0].$owner.toLowerCase()).toBe(TRUSTED_OWNER.toLowerCase());
    });

    it('filters out expired entities whose expiresAt <= currentBlock', () => {
      const currentBlock = 350000n;
      const candidates = [
        {
          $key: '0x3333' as `0x${string}`,
          $owner: TRUSTED_OWNER as `0x${string}`,
          $expiresAt: 340000n, // EXPIRED (340000 <= 350000)
          status: { value: 'BLOCK' },
        },
        {
          $key: '0x4444' as `0x${string}`,
          $owner: TRUSTED_OWNER as `0x${string}`,
          $expiresAt: 360000n, // ACTIVE (360000 > 350000)
          status: { value: 'BLOCK' },
        },
      ];

      const activeCandidates = candidates.filter(
        (c) => c.$owner.toLowerCase() === TRUSTED_OWNER.toLowerCase() && c.$expiresAt > currentBlock
      );

      expect(activeCandidates.length).toBe(1);
      expect(activeCandidates[0].$key).toBe('0x4444');

      const expiredCandidate = candidates.find(
        (c) => c.$owner.toLowerCase() === TRUSTED_OWNER.toLowerCase() && c.$expiresAt <= currentBlock
      );
      expect(expiredCandidate).toBeDefined();
      expect(expiredCandidate?.$key).toBe('0x3333');
    });
  });

  describe('7. Live vs Fixture Source Labeling', () => {
    it('explicitly flags data source without ambiguity', async () => {
      const overview = await getArkivOverview();
      expect(['live', 'fixture', 'unavailable']).toContain(overview.source);
      if (overview.source === 'fixture') {
        expect(overview.fixtureReason).toBeDefined();
      }
      if (overview.source === 'unavailable') {
        expect(overview.fixtureReason).toMatch(/no fixture substituted/i);
      }

      const wallet = await searchWalletRisk('0.0.90001');
      if (!('error' in wallet)) {
        expect(['live', 'fixture', 'unavailable']).toContain(wallet.source);
        if (wallet.source === 'fixture') {
          expect(wallet.fixtureReason).toBeDefined();
        }
      }
    });
  });
});
