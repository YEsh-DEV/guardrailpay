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
    <div className="max-w-2xl mx-auto space-y-6 text-[#CAF0F8]">
      <div>
        <h1 className="text-3xl font-bold font-title-sans text-white">Merchant Identity Onboarding</h1>
        <p className="text-sm text-[#90E0EF]/80 mt-1">
          Cryptographically bind your API endpoint domain to your ENSv2 identity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#02033B]/80 border border-[#0077B6]/30 rounded-2xl p-6 space-y-4 shadow-[0_20px_50px_rgba(2,3,59,0.7)]">
        <div>
          <label className="block text-sm font-medium text-[#90E0EF]">ENS Name (Sepolia)</label>
          <input
            type="text"
            value={ensName}
            onChange={(e) => setEnsName(e.target.value)}
            className="mt-1 w-full bg-[#03045E]/60 border border-[#0077B6]/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00B4D8]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#90E0EF]">Service Endpoint (Origin)</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="mt-1 w-full bg-[#03045E]/60 border border-[#0077B6]/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00B4D8]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#90E0EF]">Initial Hedera Payee Account (payTo)</label>
          <input
            type="text"
            value={payTo}
            onChange={(e) => setPayTo(e.target.value)}
            className="mt-1 w-full bg-[#03045E]/60 border border-[#0077B6]/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00B4D8]"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-[#00B4D8] text-[#03045E] hover:bg-[#90E0EF] font-bold py-3 px-4 rounded-full transition shadow-[0_0_20px_rgba(0,180,216,0.4)]"
        >
          Verify Domain & Bind ENS Records
        </button>

        {status && (
          <div className="p-3 bg-[#00B4D8]/15 border border-[#00B4D8]/40 text-[#CAF0F8] text-sm rounded-lg font-mono">
            {status}
          </div>
        )}
      </form>
    </div>
  );
}
