import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as runPost } from '../app/api/demo/run/route';
import { GET as eventsGet } from '../app/api/demo/events/route';
import { GET as scenariosGet } from '../app/api/demo/scenarios/route';
import { GET as runGet } from '../app/api/demo/runs/[runId]/route';
import { GET as capabilitiesGet } from '../app/api/demo/capabilities/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('demo route proxy contract', () => {
  it('proxies scenario discovery without manufacturing definitions on backend failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'BACKEND_UNAVAILABLE' } }), { status: 503 })));
    const response = await scenariosGet();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'BACKEND_UNAVAILABLE' } });
  });

  it('sends only scenarioId and requires a configured server admin key', async () => {
    vi.stubEnv('QUOTESEAL_DEMO_ADMIN_KEY', 'server-secret');
    vi.stubEnv('QUOTESEAL_DEMO_LIVE_ENABLED', 'true');
    let requestBody = '';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ runId: 'run-1', paymentRequestId: 'payment-1', mode: 'arkiv-live' }), { status: 200 });
    }));
    const response = await runPost(new NextRequest('http://dashboard.test/api/demo/run', { method: 'POST', body: JSON.stringify({ scenarioId: 'NORMAL_PAYMENT', mode: 'fixture' }) }));
    expect(response.status).toBe(200);
    expect(requestBody).toBe(JSON.stringify({ scenarioId: 'NORMAL_PAYMENT' }));

    vi.stubEnv('QUOTESEAL_DEMO_ADMIN_KEY', '');
    const missingKey = await runPost(new NextRequest('http://dashboard.test/api/demo/run', { method: 'POST', body: JSON.stringify({ scenarioId: 'NORMAL_PAYMENT' }) }));
    expect(missingKey.status).toBe(503);
    expect(await missingKey.json()).toMatchObject({ error: { code: 'DEMO_AUTH_NOT_CONFIGURED' } });

    vi.stubEnv('QUOTESEAL_DEMO_ADMIN_KEY', 'server-secret');
    const invalid = await runPost(new NextRequest('http://dashboard.test/api/demo/run', { method: 'POST', body: JSON.stringify({ scenarioId: 'NOPE', mode: 'full-live' }) }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'INVALID_SCENARIO' } });
  });

  it('keeps live proxy execution disabled unless explicitly enabled server-side', async () => {
    vi.stubEnv('QUOTESEAL_DEMO_ADMIN_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ runId: 'must-not-run' }), { status: 200 })));
    const response = await runPost(new NextRequest('http://dashboard.test/api/demo/run', { method: 'POST', body: JSON.stringify({ scenarioId: 'NORMAL_PAYMENT' }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'DEMO_LIVE_DISABLED' } });
  });

  it('reports fixture capability without exposing server credentials', async () => {
    vi.stubEnv('QUOTESEAL_DEMO_LIVE_ENABLED', 'false');
    vi.stubEnv('QUOTESEAL_DEMO_ADMIN_KEY', 'server-secret');
    const response = await capabilitiesGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fixtureEnabled: true, liveEnabled: false, mode: 'fixture-only' });
  });

  it('forwards runId and never filters by paymentRequestId', async () => {
    let requestedUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ events: [{ runId: 'run-1', paymentRequestId: 'payment-9' }] }), { status: 200 });
    }));
    const response = await eventsGet(new NextRequest('http://dashboard.test/api/demo/events?runId=run-1&after=2026-11-07T00:00:00.000Z'));
    expect(response.status).toBe(200);
    expect(requestedUrl).toContain('runId=run-1');
    expect(requestedUrl).not.toContain('paymentRequestId');
    expect((await response.json()).events).toHaveLength(1);
  });

  it('uses the dedicated run endpoint and does not synthesize a run from a global event list', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ runId: 'run-1', paymentRequestId: 'payment-9', mode: 'fixture', status: 'completed' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await runGet(new NextRequest('http://dashboard.test/api/demo/runs/run-1'), { params: Promise.resolve({ runId: 'run-1' }) });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ runId: 'run-1', paymentRequestId: 'payment-9' });
  });
});
