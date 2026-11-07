import { NextResponse } from 'next/server';
import { getPaymentDecisions } from '../../../lib/arkiv-dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getPaymentDecisions();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch payment decisions', message: err.message },
      { status: 500 }
    );
  }
}
