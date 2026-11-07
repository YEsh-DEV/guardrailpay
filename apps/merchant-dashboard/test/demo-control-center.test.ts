import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeDemoRun, getScenarios, SCENARIO_DEFINITIONS } from '../app/lib/demo-api-client';

afterEach(() => vi.unstubAllGlobals());

function backendEvent(runId: string, paymentRequestId: string, overrides: Record<string, unknown> = {}) {
  return {
    runId, scenarioId: 'NORMAL_PAYMENT', eventId: 'event-1', eventType: 'SETTLEMENT_VERIFIED', timestamp: '2026-11-07T07:00:00Z', buyerId: '0.0.54321', merchantId: 'demo-merchant-a', paymentRequestId, network: 'hedera:testnet', stage: 'SETTLING', verdict: 'PASS', reasonCode: 'HEDERA_SETTLEMENT_VERIFIED', dataSource: 'hedera_live', hederaTransactionId: '0.0.54321@1.2', ...overrides,
  };
}

describe('Demo Control Center backend contract', () => {
  it('keeps the three scenario definitions', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(Object.values(SCENARIO_DEFINITIONS)), { status: 200 }));
    const scenarios = await getScenarios();
    expect(scenarios).toHaveLength(3);
  });

  it('uses backend mode and runId, never paymentRequestId, for live evidence', async () => {
    const runId = 'run-123';
    const paymentRequestId = 'payment-456';
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: init?.body?.toString() });
      if (url === '/api/demo/run') return new Response(JSON.stringify({ runId, scenarioId: 'NORMAL_PAYMENT', mode: 'arkiv-live', status: 'completed', verdict: 'PASS', signerCallCount: 1, accessGranted: false, paymentRequestId }), { status: 200 });
      return new Response(JSON.stringify({ events: [backendEvent(runId, paymentRequestId)] }), { status: 200 });
    });

    const result = await executeDemoRun('NORMAL_PAYMENT', 'fixture', () => {});
    expect(result.runId).toBe(runId);
    expect(result.mode).toBe('arkiv-live');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].paymentRequestId).toBe(paymentRequestId);
    expect(result.evidence.settlementVerified).toBe(true);
    expect(requests[0].body).toBe(JSON.stringify({ scenarioId: 'NORMAL_PAYMENT' }));
    expect(requests.some((request) => request.url.includes(`runId=${runId}`))).toBe(true);
    expect(requests.some((request) => request.url.includes(`runId=${paymentRequestId}`))).toBe(false);
  });

  it('keeps blocked-payment signing invariant and does not expose live evidence without a verified record', async () => {
    const runId = 'run-blocked';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/api/demo/run') return new Response(JSON.stringify({ runId, scenarioId: 'SUSPICIOUS_PAYMENT', mode: 'full-live', status: 'blocked', verdict: 'BLOCK', signerCallCount: 0, accessGranted: false, paymentRequestId: 'payment-different' }), { status: 200 });
      return new Response(JSON.stringify({ events: [backendEvent(runId, 'payment-different', { eventType: 'SIGNER_SKIPPED', stage: 'BLOCKED', verdict: 'BLOCK', reasonCode: 'RAW_SIGNER_NOT_CALLED', hederaTransactionId: undefined })] }), { status: 200 });
    });
    const result = await executeDemoRun('SUSPICIOUS_PAYMENT', 'arkiv-live', () => {});
    expect(result.finalVerdict).toBe('BLOCK');
    expect(result.evidence.signerCallCount).toBe(0);
    expect(result.evidence.hederaTransactionId).toBeUndefined();
    expect(result.evidence.deliveredResource).toBeUndefined();
  });

  it('reports backend failures without switching to fixture mode', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { code: 'LIVE_DEPENDENCY_UNAVAILABLE', message: 'Arkiv unavailable' } }), { status: 424 }));
    const result = await executeDemoRun('CROSS_MERCHANT_BLOCK', 'full-live', () => {});
    expect(result.status).toBe('failed');
    expect(result.isSimulated).toBe(false);
    expect(result.liveError?.httpStatus).toBe(424);
  });
});
