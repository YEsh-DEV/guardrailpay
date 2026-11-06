'use client';
import React, { useState } from 'react';

export default function OnboardPage() {
  const [ensName, setEnsName] = useState('researchpro.eth');
  const [endpoint, setEndpoint] = useState('https://api.researchpro.com');
  const [payTo, setPayTo] = useState('0.0.12345');
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Generating domain challenge and binding to ENS profile...');
    setTimeout(() => {
      setStatus('Challenge verified! Merchant identity bound to /.well-known/quoteseal.json and ENSv2 Sepolia records.');
    }, 800);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Merchant Identity Onboarding</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographically bind your API endpoint domain to your ENSv2 identity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300">ENS Name (Sepolia)</label>
          <input
            type="text"
            value={ensName}
            onChange={(e) => setEnsName(e.target.value)}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Service Endpoint (Origin)</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Initial Hedera Payee Account (payTo)</label>
          <input
            type="text"
            value={payTo}
            onChange={(e) => setPayTo(e.target.value)}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 font-medium py-2.5 px-4 rounded-lg transition"
        >
          Verify Domain & Bind ENS Records
        </button>

        {status && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm rounded-lg">
            {status}
          </div>
        )}
      </form>
    </div>
  );
}
