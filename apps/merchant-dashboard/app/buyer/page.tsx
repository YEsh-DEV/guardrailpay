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
          status: attackVector === 'AMOUNT_DRIFT' ? 'HOLD' : 'BLOCK',
          reason:
            attackVector === 'AMOUNT_DRIFT'
              ? 'Amount drift: $500.00 exceeds configured maximum limit of $50.00.'
              : 'Recipient mismatch: 402 payTo diverges from researchpro.eth ENS record. Signer NEVER called (count = 0).',
          signerCalled: false,
          latencyMs: Math.floor(Math.random() * 4) + 6,
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
    <div className="min-h-screen bg-[#081014] text-white">
      {/* Top Bar */}
      <header className="border-b border-white/8 bg-[#060D10]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF59] to-[#00C94C] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,89,0.4)]">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#081014"/>
                  <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="font-display text-lg text-white group-hover:text-[#00FF59] transition-colors">
                QuoteSeal
              </span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="font-mono text-xs text-[#9BA9B2] uppercase tracking-wider">Buyer Agent Console</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/merchant"
              className="text-xs font-mono text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
            >
              ← Merchant Dashboard
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="font-mono text-xs text-white/60">Protected Agent:</span>
              <span className="font-mono text-xs text-[#00F5D4]">claude-agent/2.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Top Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulation Trigger Panel */}
          <div className="lg:col-span-5 p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl space-y-6">
            <div>
              <span className="font-mono text-[10px] text-[#00FF59] uppercase tracking-widest block mb-1">
                Execution Controller
              </span>
              <h2 className="font-display text-2xl text-white">Trigger Agent Payment</h2>
              <p className="text-xs text-[#9BA9B2] mt-1">
                Simulates an AI agent requesting paid research from <code>researchpro.eth</code>.
              </p>
            </div>

            {/* Attack proxy toggle */}
            <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-semibold text-white block">Attack Proxy Middleware</span>
                  <span className="font-mono text-[10px] text-white/40 block">
                    {isAttackMode ? '⚠ Intercepting 402 responses' : 'Direct connection to merchant'}
                  </span>
                </div>
                <button
                  onClick={() => setIsAttackMode(!isAttackMode)}
                  className={`px-4 py-1.5 rounded-full font-mono text-xs font-semibold transition-all ${
                    isAttackMode
                      ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(255,59,48,0.3)]'
                      : 'bg-white/10 border border-white/20 text-white/60'
                  }`}
                >
                  {isAttackMode ? 'ATTACK: ON' : 'ATTACK: OFF'}
                </button>
              </div>

              {isAttackMode && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <label className="font-mono text-[10px] text-white/40 uppercase block">Simulated Attack Vector</label>
                  <select
                    value={attackVector}
                    onChange={(e) => setAttackVector(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#081014] border border-rose-500/30 text-rose-300 font-mono text-xs focus:outline-none"
                  >
                    <option value="PAYTO_SUB">payTo Substitution (Rogue recipient)</option>
                    <option value="LOOKALIKE">Off-by-one subtle typo</option>
                    <option value="AMOUNT_DRIFT">Amount Drift ($500 vs $50 cap)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={handleRunAgent}
              disabled={isRunning}
              className={`w-full py-4 rounded-full font-sans font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                isAttackMode
                  ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_25px_rgba(255,59,48,0.4)]'
                  : 'bg-[#00FF59] text-[#081014] hover:bg-[#9AEA62] shadow-[0_0_25px_rgba(0,255,89,0.4)]'
              } disabled:opacity-50`}
            >
              {isRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Running QuoteSeal Guard...
                </>
              ) : isAttackMode ? (
                'Execute Attack Payment (Simulate Trap)'
              ) : (
                'Execute Normal Payment (PASS Expected)'
              )}
            </button>
          </div>

          {/* Live Stream Terminal */}
          <div className="lg:col-span-7 rounded-[28px] border border-white/10 bg-[#060D10] overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#091217]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="font-mono text-xs text-white/40 ml-2">guard-eval-stream.log</span>
              </div>
              <span className="font-mono text-[10px] text-[#00FF59]">● LISTENING</span>
            </div>
            <div className="p-5 font-mono text-xs space-y-2 flex-1 min-h-[220px] max-h-[280px] overflow-y-auto">
              {consoleOutput.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/20">
                  Ready. Click "Execute" to trigger agent payment lifecycle.
                </div>
              ) : (
                consoleOutput.map((line, idx) => (
                  <p
                    key={idx}
                    className={
                      line.includes('BLOCK') || line.includes('ALERT') || line.includes('Tampered')
                        ? 'text-rose-400 font-semibold'
                        : line.includes('PASS') || line.includes('Settled')
                        ? 'text-[#00FF59] font-semibold'
                        : 'text-white/70'
                    }
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Verdict Timeline Feed */}
        <div className="p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl text-white">Live Verdict Audit Trail</h3>
              <p className="text-xs text-[#9BA9B2] mt-0.5">
                Every transaction proposal inspected by QuoteSeal Guard. Zero bypassed checks.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/8">
              {['ALL', 'PASS', 'BLOCK', 'HOLD'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full font-mono text-[11px] font-medium transition-all ${
                    filter === f
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table / Cards */}
          <div className="space-y-3">
            <AnimatePresence>
              {filteredLogs.map((log) => {
                const isPass = log.status === 'PASS';
                const isBlock = log.status === 'BLOCK';
                const isHold = log.status === 'HOLD';

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`p-5 rounded-2xl border transition-all ${
                      isPass
                        ? 'border-emerald-500/20 bg-emerald-950/[0.15] hover:border-emerald-500/40'
                        : isBlock
                        ? 'border-rose-500/30 bg-rose-950/[0.2] hover:border-rose-500/50'
                        : 'border-amber-500/20 bg-amber-950/[0.15] hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Status + Core Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full font-mono text-xs font-semibold border ${
                              isPass
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : isBlock
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                            }`}
                          >
                            {log.status === 'PASS' ? '✓ PASS' : log.status === 'BLOCK' ? '✗ BLOCK' : '⚠ HOLD'}
                          </span>
                          <span className="font-mono text-xs text-white/50">{log.timestamp}</span>
                          <span className="font-mono text-xs text-white/30">|</span>
                          <span className="font-mono text-xs text-[#00F5D4]">{log.agent}</span>
                          <span className="font-mono text-xs text-white/30">|</span>
                          <span className="font-mono text-xs text-white/60">{log.amount}</span>
                        </div>
                        <p className="text-xs text-[#9BA9B2] leading-relaxed">{log.reason}</p>
                      </div>

                      {/* Right: Technical diagnostics */}
                      <div className="flex flex-col md:items-end gap-1.5 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-white/40">Signer Called:</span>
                          <span className={log.signerCalled ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {log.signerCalled ? 'YES (count = 1)' : 'NO (count = 0)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40">Latency:</span>
                          <span className="text-[#00FF59]">{log.latencyMs}ms</span>
                        </div>
                        {log.hashScanUrl && (
                          <a
                            href={log.hashScanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[#00FF59] hover:underline mt-1"
                          >
                            <span>View on HashScan</span>
                            <span>↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

