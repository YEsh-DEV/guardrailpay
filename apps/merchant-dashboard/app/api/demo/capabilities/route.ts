import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendConfigured = Boolean(process.env.MERCHANT_API_URL?.trim());
  const adminConfigured = Boolean(process.env.QUOTESEAL_DEMO_ADMIN_KEY?.trim());
  const liveEnabled = process.env.QUOTESEAL_DEMO_LIVE_ENABLED?.trim() === 'true' && backendConfigured && adminConfigured;

  return NextResponse.json({
    fixtureEnabled: true,
    liveEnabled,
    backendConfigured,
    mode: liveEnabled ? 'server-controlled' : 'fixture-only',
  });
}
