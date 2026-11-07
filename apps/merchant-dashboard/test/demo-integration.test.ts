import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeDemoRun } from '../app/lib/demo-api-client';
import type { DemoEvent } from '../app/lib/demo-types';

afterEach(() => vi.unstubAllGlobals());

describe('Demo integration safety', () => {
  it('requires runId-scoped backend events and keeps different paymentRequestId values intact', async () => {
    const runId = 'run-a';
    const paymentRequestId = 'payment-a';
    const foreignRunId = 'run-b';
    const event = (id: string, eventRunId: string): DemoEvent => ({ runId: eventRunId, scenarioId: 'CROSS_MERCHANT_BLOCK', eventId: id, eventType: 'WALLET_RISK_STATE_READ', timestamp: new Date().toISOString(), buyerId: '0.0.90001', merchantId: 'merchant-b.demo', paymentRequestId: eventRunId === runId ? paymentRequestId : 'payment-b', network: 'hedera:testnet', stage: 'RISK_READ', verdict: 'BLOCK', reasonCode: 'TRUSTED_SCHEMA_OWNER_WALLET_NETWORK_EXPIRY_VALIDATED_BLOCK', dataSource: 'arkiv_live' });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/api/demo/run') return new Response(JSON.stringify({ runId, scenarioId: 'CROSS_MERCHANT_BLOCK', mode: 'arkiv-live', status: 'blocked', verdict: 'BLOCK', signerCallCount: 0, accessGranted: false, paymentRequestId }), { status: 200 });
      return new Response(JSON.stringify({ events: [event('target', runId)] }), { status: 200 });
    });
    const result = await executeDemoRun('CROSS_MERCHANT_BLOCK', 'full-live', () => {});
    expect(result.runId).toBe(runId);
    expect(result.events[0].paymentRequestId).toBe(paymentRequestId);
    expect(result.events.some((candidate) => candidate.runId === foreignRunId)).toBe(false);
  });

  it('does not fabricate settlement or resource delivery from a submitted transaction', async () => {
    const runId = 'run-pending';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/api/demo/run') return new Response(JSON.stringify({ runId, scenarioId: 'NORMAL_PAYMENT', mode: 'full-live', status: 'failed', verdict: 'UNVERIFIABLE', signerCallCount: 1, accessGranted: false, paymentRequestId: 'payment-pending' }), { status: 200 });
      return new Response(JSON.stringify({ events: [{ runId, scenarioId: 'NORMAL_PAYMENT', eventId: 'submitted', eventType: 'HEDERA_TRANSACTION_SUBMITTED', timestamp: new Date().toISOString(), buyerId: '0.0.54321', merchantId: 'demo-merchant-a', paymentRequestId: 'payment-pending', network: 'hedera:testnet', stage: 'SETTLING', verdict: 'PASS', reasonCode: 'HEDERA_TESTNET_SUBMITTED', dataSource: 'hedera_live', hederaTransactionId: '0.0.54321@1.2' }] }), { status: 200 });
    });
    const result = await executeDemoRun('NORMAL_PAYMENT', 'full-live', () => {});
    expect(result.evidence.hederaTransactionId).toBe('0.0.54321@1.2');
    expect(result.evidence.settlementVerified).toBe(false);
    expect(result.evidence.deliveredResource).toBeUndefined();
  });

  it('handles mode mismatch: uses backend-confirmed fixture mode, flags isModeMismatch, marks isSimulated, and never claims live settlement', async () => {
    const runId = 'run-mismatch-1';
    const paymentRequestId = 'payment-mismatch-1';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/demo/run') {
        return new Response(
          JSON.stringify({
            runId,
            scenarioId: 'NORMAL_PAYMENT',
            mode: 'fixture',
            status: 'completed',
            verdict: 'PASS',
            signerCallCount: 1,
            accessGranted: true,
            paymentRequestId,
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          events: [
            {
              runId,
              scenarioId: 'NORMAL_PAYMENT',
              eventId: 'event-sim',
              eventType: 'SETTLEMENT_VERIFIED',
              timestamp: new Date().toISOString(),
              buyerId: '0.0.54321',
              merchantId: 'demo-merchant',
              paymentRequestId,
              network: 'hedera:testnet',
              stage: 'COMPLETED',
              verdict: 'PASS',
              reasonCode: 'SIMULATED_TESTNET_FIXTURE',
              dataSource: 'simulated_fixture',
              hederaTransactionId: '0.0.54321@simulated',
            },
          ],
        }),
        { status: 200 }
      );
    });

    const result = await executeDemoRun('NORMAL_PAYMENT', 'full-live', () => {});
    expect(result.mode).toBe('fixture');
    expect(result.requestedMode).toBe('full-live');
    expect(result.isModeMismatch).toBe(true);
    expect(result.isSimulated).toBe(true);
    expect(result.evidence.dataSource).toBe('fixture');
    expect(result.evidence.isSimulated).toBe(true);
    expect(result.evidence.settlementVerified).toBe(false);
  });

  it('handles failed authentication (403): halts with UNAUTHORIZED error without turning into simulated success', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/api/demo/run') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'DEMO_AUTH_REQUIRED',
              message: 'Demo execution requires x-demo-admin-key',
            },
          }),
          { status: 403 }
        );
      }
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    });

    const result = await executeDemoRun('NORMAL_PAYMENT', 'full-live', () => {});
    expect(result.status).toBe('failed');
    expect(result.liveError).toBeDefined();
    expect(result.liveError?.code).toBe('UNAUTHORIZED');
    expect(result.liveError?.httpStatus).toBe(403);
    expect(result.finalVerdict).toBeUndefined();
    expect(result.evidence.deliveredResource).toBeUndefined();
    expect(result.evidence.signerCallCount).toBe(0);
  });

  it('handles missing on-chain settlement evidence: marks settlement UNVERIFIABLE and withholds protected resource delivery', async () => {
    const runId = 'run-missing-settlement';
    const paymentRequestId = 'payment-missing-settlement';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/demo/run') {
        return new Response(
          JSON.stringify({
            runId,
            scenarioId: 'NORMAL_PAYMENT',
            mode: 'full-live',
            status: 'completed',
            verdict: 'PASS',
            signerCallCount: 1,
            accessGranted: false,
            paymentRequestId,
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          events: [
            {
              runId,
              scenarioId: 'NORMAL_PAYMENT',
              eventId: 'event-proof',
              eventType: 'PAYMENT_PROOF_VERIFIED',
              timestamp: new Date().toISOString(),
              buyerId: '0.0.54321',
              merchantId: 'demo-merchant',
              paymentRequestId,
              network: 'hedera:testnet',
              stage: 'VERIFYING',
              verdict: 'PASS',
              reasonCode: 'PROOF_SIGNATURE_VALID',
              dataSource: 'hedera_live',
            },
          ],
        }),
        { status: 200 }
      );
    });

    const result = await executeDemoRun('NORMAL_PAYMENT', 'full-live', () => {});
    expect(result.status).toBe('completed');
    expect(result.finalVerdict).toBe('PASS');
    expect(result.evidence.settlementVerified).toBe(false);
    expect(result.evidence.deliveredResource).toBeUndefined();
    const settlementCheck = result.securityChecks.find((c) => c.name === 'settlement');
    expect(settlementCheck?.status).toBe('UNVERIFIABLE');
  });
});
