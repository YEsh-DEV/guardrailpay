import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  const backendUrl = process.env.MERCHANT_API_URL || 'http://localhost:3001';

  try {
    // 1. Try dedicated backend endpoint GET /api/demo/runs/:runId
    const res = await fetch(`${backendUrl}/api/demo/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    const data = await res.json().catch(() => ({ error: { code: 'BACKEND_ERROR', message: `Backend returned HTTP ${res.status}` } }));
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch run';
    return NextResponse.json({ error: { code: 'BACKEND_UNAVAILABLE', message } }, { status: 503 });
  }
}
