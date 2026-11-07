import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.MERCHANT_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${backendUrl}/api/demo/scenarios`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({ error: { code: 'BACKEND_ERROR', message: `Backend returned HTTP ${res.status}` } }));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Backend unavailable';
    return NextResponse.json({ error: { code: 'BACKEND_UNAVAILABLE', message } }, { status: 503 });
  }
}
