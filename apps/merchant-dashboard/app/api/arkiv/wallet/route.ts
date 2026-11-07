import { NextRequest, NextResponse } from 'next/server';
import { searchWalletRisk } from '../../../lib/arkiv-dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletKey = searchParams.get('walletKey') || searchParams.get('wallet') || searchParams.get('address');
    const network = searchParams.get('network') || 'hedera:testnet';

    if (!walletKey) {
      return NextResponse.json(
        { error: 'walletKey parameter is required' },
        { status: 400 }
      );
    }

    const result = await searchWalletRisk(walletKey, network);

    if ('error' in result) {
      const status = result.invalidInput ? 400 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to search wallet risk state', message: err.message },
      { status: 500 }
    );
  }
}
