import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isScenarioId(value: unknown): value is 'NORMAL_PAYMENT' | 'SUSPICIOUS_PAYMENT' | 'CROSS_MERCHANT_BLOCK' {
  return value === 'NORMAL_PAYMENT' || value === 'SUSPICIOUS_PAYMENT' || value === 'CROSS_MERCHANT_BLOCK';
}

export async function POST(request: NextRequest) {
  const backendUrl = process.env.MERCHANT_API_URL || 'http://localhost:3001';
  const adminKey = process.env.QUOTESEAL_DEMO_ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json(
      { error: { code: 'DEMO_AUTH_NOT_CONFIGURED', message: 'QUOTESEAL_DEMO_ADMIN_KEY is not configured on the server' } },
      { status: 503 }
    );
  }
  if (process.env.QUOTESEAL_DEMO_LIVE_ENABLED?.trim() !== 'true') {
    return NextResponse.json(
      { error: { code: 'DEMO_LIVE_DISABLED', message: 'Live demo execution is disabled on this public frontend. Use fixture mode or configure the merchant API explicitly.' } },
      { status: 503 }
    );
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('scenarioId' in body) || !isScenarioId(body.scenarioId)) {
      return NextResponse.json({ error: { code: 'INVALID_SCENARIO', message: 'scenarioId must be an allowlisted demo scenario' } }, { status: 400 });
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-demo-admin-key': adminKey,
    };

    const res = await fetch(`${backendUrl}/api/demo/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ scenarioId: body.scenarioId }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cannot connect to merchant API backend';
    return NextResponse.json(
      { error: { code: 'BACKEND_UNAVAILABLE', message } },
      { status: 503 }
    );
  }
}
