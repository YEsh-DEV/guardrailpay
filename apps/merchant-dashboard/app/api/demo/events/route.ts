import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const backendUrl = process.env.MERCHANT_API_URL || 'http://localhost:3001';
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId') || '';
  const after = searchParams.get('after') || '';

  if (!runId) {
    return NextResponse.json({ error: { code: 'RUN_ID_REQUIRED', message: 'runId query parameter is required' } }, { status: 400 });
  }

  try {
    const url = new URL(`${backendUrl}/api/demo/events`);
    url.searchParams.set('runId', runId);
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json().catch(() => ({ error: { code: 'BACKEND_ERROR', message: `Backend returned HTTP ${res.status}` } }));
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backend unreachable';
    return NextResponse.json({ error: { code: 'BACKEND_UNAVAILABLE', message } }, { status: 503 });
  }
}
