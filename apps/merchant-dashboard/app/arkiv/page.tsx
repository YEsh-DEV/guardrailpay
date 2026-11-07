import Link from 'next/link';

export const dynamic = 'force-dynamic';

type RiskView = {
  mode: 'live' | 'fixture';
  fixtureReason?: string;
  result:
    | { kind: 'trusted'; state: { status: string; owner: string; entityKey: string; expiresAt: string; policyVersion: string } }
    | { kind: 'not_found' }
    | { kind: 'unavailable'; reason: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRiskView(value: unknown): RiskView | null {
  if (!isRecord(value) || (value.mode !== 'live' && value.mode !== 'fixture') || !isRecord(value.result)) {
    return null;
  }

  if (value.result.kind === 'trusted' && isRecord(value.result.state)) {
    const state = value.result.state;
    if (
      typeof state.status === 'string' &&
      typeof state.owner === 'string' &&
      typeof state.entityKey === 'string' &&
      typeof state.expiresAt === 'string' &&
      typeof state.policyVersion === 'string'
    ) {
      return {
        mode: value.mode,
        fixtureReason: typeof value.fixtureReason === 'string' ? value.fixtureReason : undefined,
        result: {
          kind: 'trusted',
          state: {
            status: state.status,
            owner: state.owner,
            entityKey: state.entityKey,
            expiresAt: state.expiresAt,
            policyVersion: state.policyVersion,
          },
        },
      };
    }
  }

  if (value.result.kind === 'not_found') {
    return { mode: value.mode, fixtureReason: typeof value.fixtureReason === 'string' ? value.fixtureReason : undefined, result: { kind: 'not_found' } };
  }

  if (value.result.kind === 'unavailable' && typeof value.result.reason === 'string') {
    return {
      mode: value.mode,
      fixtureReason: typeof value.fixtureReason === 'string' ? value.fixtureReason : undefined,
      result: { kind: 'unavailable', reason: value.result.reason },
    };
  }

  return null;
}

async function loadRiskView(): Promise<{ view: RiskView | null; error?: string }> {
  const baseUrl = process.env.MERCHANT_API_URL ?? 'http://localhost:3001';

  try {
    const response = await fetch(`${baseUrl}/api/arkiv/risk/0.0.90001`, { cache: 'no-store' });
    if (!response.ok) return { view: null, error: `Merchant API returned ${response.status}` };
    const view = parseRiskView(await response.json());
    return view ? { view } : { view: null, error: 'Merchant API returned an invalid Arkiv risk response' };
  } catch {
    return { view: null, error: 'Merchant API is unavailable. Start it to view the Arkiv risk-state demo.' };
  }
}

export default async function ArkivRiskPage() {
  const { view, error } = await loadRiskView();

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-12 text-[#E2E8F0]">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/merchant" className="font-mono text-xs text-[#DD60F7]">← Merchant dashboard</Link>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">Cross-merchant Arkiv risk read</p>
          <h1 className="mt-2 font-title-sans text-3xl font-bold text-white">Wallet 0.0.90001</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">Merchant B reads a risk state before its simulated payment signer is allowed to run.</p>
        </div>

        {error && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 font-mono text-sm text-amber-200">{error}</p>}

        {view && (
          <section className="space-y-4 rounded-3xl border border-[#262626] bg-[#141414] p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs uppercase text-[#94A3B8]">Data source</span>
              <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${view.mode === 'live' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>
                {view.mode === 'live' ? 'Live verified Arkiv read' : 'Fixture — not an Arkiv record'}
              </span>
            </div>

            {view.mode === 'fixture' && <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">{view.fixtureReason}. This demonstrates the UI and guard wiring only; it is not on-chain evidence.</p>}

            {view.result.kind === 'trusted' && (
              <dl className="grid gap-3 font-mono text-sm sm:grid-cols-2">
                <div><dt className="text-[#94A3B8]">Risk status</dt><dd className="mt-1 font-bold text-rose-300">{view.result.state.status}</dd></div>
                <div><dt className="text-[#94A3B8]">Policy</dt><dd className="mt-1">{view.result.state.policyVersion}</dd></div>
                <div><dt className="text-[#94A3B8]">Trusted writer</dt><dd className="mt-1 break-all">{view.result.state.owner}</dd></div>
                <div><dt className="text-[#94A3B8]">Expiry block</dt><dd className="mt-1">{view.result.state.expiresAt}</dd></div>
                <div className="sm:col-span-2"><dt className="text-[#94A3B8]">Entity key</dt><dd className="mt-1 break-all">{view.result.state.entityKey}</dd></div>
              </dl>
            )}

            {view.result.kind === 'not_found' && <p className="text-sm text-[#94A3B8]">No trusted risk state was found. The configured guard treats this as HOLD.</p>}
            {view.result.kind === 'unavailable' && <p className="text-sm text-rose-300">Arkiv lookup unavailable: {view.result.reason}. The configured guard does not invoke the signer.</p>}
          </section>
        )}
      </div>
    </main>
  );
}
