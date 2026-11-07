import { NextRequest, NextResponse } from 'next/server';
import { getRiskSignalHistory } from '../../../lib/arkiv-dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20;

    const result = await getRiskSignalHistory(limit);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch risk signal history', message: err.message },
      { status: 500 }
    );
  }
}
