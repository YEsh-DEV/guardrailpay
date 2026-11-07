import { NextResponse } from 'next/server';
import { getArkivOverview } from '../../../lib/arkiv-dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await getArkivOverview();
    return NextResponse.json(overview);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch Arkiv overview', message: err.message },
      { status: 500 }
    );
  }
}
