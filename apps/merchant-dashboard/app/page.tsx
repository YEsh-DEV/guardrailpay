import React from 'react';

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">QuoteSeal Merchant Operations</h1>
        <p className="text-slate-400 mt-2">
          Manage ENSv2 payment identity, domain binding challenges, and timelocked payout address rotations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="/onboard" className="block p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/50 transition">
          <h2 className="text-lg font-semibold text-blue-400">1. Onboarding</h2>
          <p className="text-sm text-slate-400 mt-2">Bind domain with RFC /.well-known challenge and ENS ownership.</p>
        </a>

        <a href="/profile" className="block p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/50 transition">
          <h2 className="text-lg font-semibold text-blue-400">2. ENS Profile</h2>
          <p className="text-sm text-slate-400 mt-2">View active records, allowed assets, limits, and EAC role assignments.</p>
        </a>

        <a href="/rotation" className="block p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/50 transition">
          <h2 className="text-lg font-semibold text-blue-400">3. Payout Rotation</h2>
          <p className="text-sm text-slate-400 mt-2">Propose new payout address, complete World ID Agent Pass auth, and activate.</p>
        </a>
      </div>
    </div>
  );
}
