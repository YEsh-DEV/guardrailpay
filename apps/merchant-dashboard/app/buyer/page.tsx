'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { initialVerdictLogs, VerdictLog, VerdictStatus } from '../lib/api';

export default function BuyerConsole() {
  const [logs, setLogs] = useState<VerdictLog[]>(initialVerdictLogs);
  const [isAttackMode, setIsAttackMode] = useState(false);
  const [attackVector, setAttackVector] = useState<'PAYTO_SUB' | 'LOOKALIKE' | 'AMOUNT_DRIFT' | 'UNANNOUNCED_ROTATION'>('PAYTO_SUB');
  const [filter, setFilter] = useState<string>('ALL');
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const handleRunAgent = () => {
    setIsRunning(true);
    setConsoleOutput([
      `[${new Date().toLocaleTimeString()}] AI Agent invoking GET /api/research/paid...`,
      `[${new Date().toLocaleTimeString()}] Host: researchpro.eth | Target network: hedera:296`,
      `[${new Date().toLocaleTimeString()}] Received HTTP 402 Payment Required`,
    ]);

    setTimeout(() => {
      if (!isAttackMode) {
        // Normal PASS run
        const newLog: VerdictLog = {
          id: `tx_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agent: 'claude-research-agent/2.0',
          endpoint: '/api/research/paid',
          payToReceived: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
          payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
          amount: '5.00 USDC',
          network: 'hedera:296',
          status: 'PASS',
          reason: 'Payee exactly matches ENS text record for researchpro.eth. Signer invoked.',
          signerCalled: true,
          latencyMs: Math.floor(Math.random() * 5) + 7,
          txId: `0.0.${Math.floor(Math.random() * 1000000)}@${Math.floor(Date.now() / 1000)}`,
          hashScanUrl: 'https://hashscan.io/testnet/transaction/0.0.9841288@1730911882',
        };

        setConsoleOutput((prev) => [
          ...prev,
          `[QuoteSeal Guard] Resolving ENSv2 records for researchpro.eth...`,
          `[QuoteSeal Guard] Matched expected payTo: 0x71Cf3D14...8f4B ✓`,
          `[QuoteSeal Guard] Verdict: PASS (latency: ${newLog.latencyMs}ms)`,
          `[Hedera Settlement] Signer invoked (callCount = 1). Transaction submitted!`,
          `[Hedera Settlement] Settled on Hedera Testnet! TxId: ${newLog.txId}`,
        ]);

        setLogs((prev) => [newLog, ...prev]);
        setIsRunning(false);
      } else {
        // Attack Blocked
        const tamperedAddress =
          attackVector === 'PAYTO_SUB'
            ? '0x9994F8c72aD5519a3929BC00dead1337caFE0000'
            : '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4C'; // Off-by-one char

        const newLog: VerdictLog = {
          id: `tx_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agent: 'claude-research-agent/2.0',
          endpoint: '/api/research/paid',
          payToReceived: tamperedAddress,
          payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
          amount: attackVector === 'AMOUNT_DRIFT' ? '500.00 USDC' : '5.00 USDC',
          network: 'hedera:296',
          status: 'BLOCK',
          reason:
            attackVector === 'PAYTO_SUB'
              ? `Proxy tampered payTo to unauthorized address (${tamperedAddress}). Guard aborted signature.`
              : `Security policy breach detected (${attackVector}). Signer execution prevented.`,
          signerCalled: false,
          latencyMs: 8,
        };

        setConsoleOutput((prev) => [
          ...prev,
          `[Attack Proxy] Injected payload modification (${attackVector})!`,
          `[Attack Proxy] Tampered payTo: ${tamperedAddress}`,
          `[QuoteSeal Guard] Resolving ENSv2 records for researchpro.eth...`,
          `[QuoteSeal Guard] Expected: 0x71Cf3D14...8f4B | Received: ${tamperedAddress.slice(0, 14)}...`,
          `[QuoteSeal Guard] ALERT: Recipient mismatch detected!`,
          `[QuoteSeal Guard] Verdict: ${newLog.status} (latency: ${newLog.latencyMs}ms)`,
          `[CRITICAL PROTECTION] Signer was NOT called. Wallet balance safe.`,
        ]);

        setLogs((prev) => [newLog, ...prev]);
        setIsRunning(false);
      }
    }, 800);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.status === filter;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] selection:bg-[#D152F5] selection:text-[#050505]">
      {/* Top Bar */}
      <header className="border-b border-[#262626] bg-[#0E0E0E]/90 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7F359B] to-[#D152F5] flex items-center justify-center shadow-[0_0_15px_rgba(209,82,245,0.4)]">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#FFFFFF"/>
                  <path d="M9 12L11 14L15 10" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="font-title-sans text-lg font-bold text-[#FFFFFF] group-hover:text-[#DD60F7] transition-colors">
                QuoteSeal
              </span>
            </Link>
            <span className="text-[#262626]">/</span>
            <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Buyer Agent Console</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/merchant"
              className="text-xs font-mono text-[#E2E8F0] hover:text-[#DD60F7] px-3.5 py-1.5 rounded-lg border border-[#262626] hover:border-[#D152F5]/50 transition-all bg-[#141414]"
            >
              ← Merchant Dashboard
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D152F5]/10 border border-[#D152F5]/25">
              <span className="font-mono text-xs text-[#94A3B8]">Protected Agent:</span>
              <span className="font-mono text-xs text-[#DD60F7] font-bold">claude-agent/2.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Top Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agent Trigger Card */}
          <div className="lg:col-span-1 p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Autonomous Agent Loop</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 font-mono text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                Live Interceptor
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-title-sans text-xl font-bold text-[#FFFFFF]">Simulate Payment Query</p>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Trigger an autonomous task where the buyer agent queries a protected 402 merchant endpoint.
              </p>
            </div>

            {/* Attack Toggle */}
            <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#E2E8F0] font-bold">MITM Proxy Attack</span>
                <button
                  onClick={() => setIsAttackMode(!isAttackMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    isAttackMode ? 'bg-rose-500' : 'bg-[#262626]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      isAttackMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isAttackMode && (
                <div className="pt-2 border-t border-[#262626] space-y-2">
                  <label className="font-mono text-[11px] text-[#94A3B8] block">Attack Vector</label>
                  <select
                    value={attackVector}
                    onChange={(e) => setAttackVector(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#141414] border border-[#262626] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#D152F5]"
                  >
                    <option value="PAYTO_SUB">PayTo Substitution (MITM)</option>
                    <option value="LOOKALIKE">Lookalike Homoglyph Spoof</option>
                    <option value="AMOUNT_DRIFT">Amount Ceiling Drift</option>
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleRunAgent}
              disabled={isRunning}
              className={`w-full py-3.5 rounded-[10px] font-sans font-bold text-sm transition-all shadow-md ${
                isAttackMode
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                  : 'bg-[#D152F5] hover:bg-[#DD60F7] text-[#050505] shadow-[0_4px_16px_rgba(209,82,245,0.35)]'
              } disabled:opacity-50`}
            >
              {isRunning
                ? 'Interceptor Evaluating...'
                : isAttackMode
                ? 'Run Attacked Agent Flow ⚡'
                : 'Run Normal Agent Query →'}
            </button>
          </div>

          {/* Real-time Agent Log Stream */}
          <div className="lg:col-span-2 p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Agent Interceptor Telemetry</span>
              <span className="font-mono text-xs text-[#64748B]">Port: 4020 (Protected Gateway)</span>
            </div>

            <div className="bg-[#050505] border border-[#262626] text-slate-100 rounded-2xl p-4 font-mono text-xs space-y-2 h-[210px] overflow-y-auto">
              {consoleOutput.length === 0 ? (
                <p className="text-[#64748B] italic">Ready. Click "Run Normal Agent Query" or "Run Attacked Agent Flow" to evaluate live traffic.</p>
              ) : (
                consoleOutput.map((line, idx) => (
                  <p
                    key={idx}
                    className={
                      line.includes('ALERT') || line.includes('Injected')
                        ? 'text-rose-400 font-bold'
                        : line.includes('PASS') || line.includes('Settled')
                        ? 'text-emerald-400 font-bold'
                        : line.includes('QuoteSeal')
                        ? 'text-[#DD60F7]'
                        : 'text-[#94A3B8]'
                    }
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Verdict History Table */}
        <div className="p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
            <div>
              <h3 className="font-title-sans text-xl font-bold text-[#FFFFFF]">Payment Guard Verdict History</h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">Cryptographic verification ledger of all outbound 402 proposals.</p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {['ALL', 'PASS', 'BLOCK'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 rounded-[8px] font-mono text-xs transition-all ${
                    filter === f
                      ? 'bg-[#D152F5] text-[#050505] font-bold shadow-sm'
                      : 'bg-[#0E0E0E] text-[#94A3B8] hover:text-[#FFFFFF] border border-[#262626]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#262626] text-[#94A3B8]">
                  <th className="pb-3 font-semibold">Timestamp</th>
                  <th className="pb-3 font-semibold">Agent</th>
                  <th className="pb-3 font-semibold">Endpoint</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Latency</th>
                  <th className="pb-3 font-semibold">Signer Executed</th>
                  <th className="pb-3 font-semibold">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0E0E0E]/80 transition-colors">
                    <td className="py-3 text-[#94A3B8]">{log.timestamp}</td>
                    <td className="py-3 text-[#FFFFFF] font-medium">{log.agent}</td>
                    <td className="py-3 text-[#DD60F7]">{log.endpoint}</td>
                    <td className="py-3 text-[#E2E8F0] font-semibold">{log.amount}</td>
                    <td className="py-3 text-[#94A3B8]">{log.latencyMs}ms</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          log.signerCalled
                            ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30'
                            : 'bg-rose-950/40 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        {log.signerCalled ? '✓ YES (1x)' : '✗ NO (0x)'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                          log.status === 'PASS'
                            ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40'
                            : 'bg-rose-950/40 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        <span>{log.status === 'PASS' ? '✓' : '⛔'}</span>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
