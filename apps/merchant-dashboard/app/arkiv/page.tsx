'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  AlertTriangle,
  Search,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Database,
  Lock,
  Layers,
  Activity,
  ArrowUpRight,
  Info,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import type {
  ArkivOverviewMetrics,
  WalletRiskDetail,
  RiskSignalItem,
  PaymentDecisionResult,
} from '../lib/arkiv-dashboard-service';

export default function ArkivDashboardPage() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'signals' | 'decisions' | 'security'>('explorer');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [overview, setOverview] = useState<ArkivOverviewMetrics | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Search state
  const [searchInput, setSearchInput] = useState('0.0.90001');
  const [activeWalletQuery, setActiveWalletQuery] = useState('0.0.90001');
  const [walletRisk, setWalletRisk] = useState<WalletRiskDetail | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Signals state
  const [signals, setSignals] = useState<RiskSignalItem[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsSource, setSignalsSource] = useState<'live' | 'fixture' | 'unavailable'>('unavailable');

  // Decisions state
  const [decisionsResult, setDecisionsResult] = useState<PaymentDecisionResult | null>(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // Copied toast state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch overview metrics
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/arkiv/overview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ArkivOverviewMetrics = await res.json();
      setOverview(data);
      setOverviewError(null);
    } catch (err: any) {
      setOverviewError(err.message);
    }
  }, []);

  // Search wallet risk
  const doSearchWallet = useCallback(async (walletKey: string) => {
    if (!walletKey.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/arkiv/wallet?walletKey=${encodeURIComponent(walletKey.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setSearchError(data.error || `HTTP ${res.status}`);
        setWalletRisk(null);
      } else {
        setWalletRisk(data);
        setActiveWalletQuery(walletKey.trim());
      }
    } catch (err: any) {
      setSearchError(err.message);
      setWalletRisk(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Fetch risk signals
  const fetchSignals = useCallback(async () => {
    setSignalsLoading(true);
    try {
      const res = await fetch('/api/arkiv/signals?limit=30');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignals(data.signals || []);
      setSignalsSource(data.source || 'live');
    } catch {
      setSignals([]);
      setSignalsSource('unavailable');
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const res = await fetch('/api/arkiv/decisions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PaymentDecisionResult = await res.json();
      setDecisionsResult(data);
    } catch {
      setDecisionsResult({
        decisions: [],
        status: 'unsupported',
        message: 'Could not connect to payment decisions API',
      });
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([
        fetchOverview(),
        doSearchWallet('0.0.90001'),
        fetchSignals(),
        fetchDecisions(),
      ]);
      setIsLoading(false);
    }
    init();
  }, [fetchOverview, doSearchWallet, fetchSignals, fetchDecisions]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchOverview(),
      doSearchWallet(activeWalletQuery),
      fetchSignals(),
      fetchDecisions(),
    ]);
    setIsRefreshing(false);
  };

  const handleQuickWalletClick = (wallet: string) => {
    setSearchInput(wallet);
    doSearchWallet(wallet);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearchWallet(searchInput);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] selection:bg-[#DD60F7]/30 selection:text-white pb-24">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#050505]/85 backdrop-blur-xl border-b border-[#262626] px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D152F5] to-[#7F359B] flex items-center justify-center shadow-[0_0_15px_rgba(209,82,245,0.4)]">
                <ShieldAlert className="w-4 h-4 text-black" />
              </span>
              <span className="font-sans font-bold text-lg text-white tracking-tight">
                GuardRail Pay
              </span>
            </Link>
            <span className="text-[#333333]">/</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#DD60F7]/15 text-[#DD60F7] border border-[#DD60F7]/30">
                Arkiv Rabdi Testnet
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Read-Only Node
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-mono text-[#94A3B8] hover:text-white transition-all disabled:opacity-50"
              title="Refresh on-chain state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#DD60F7]' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Sync Rabdi'}
            </button>
            <Link
              href="/demo"
              className="px-3.5 py-1.5 rounded-lg border border-[#DD60F7]/40 bg-[#DD60F7]/10 hover:bg-[#DD60F7]/20 text-xs font-mono text-[#DD60F7] hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(221,96,247,0.2)]"
            >
              <span>Demo Center</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            <Link
              href="/merchant"
              className="px-3.5 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
            >
              Merchant Dashboard
            </Link>
            <Link
              href="/buyer"
              className="px-3.5 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
            >
              Buyer Simulator
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 space-y-8">
        {/* Network & Freshness Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#0D0D0D] border border-[#262626]">
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">NETWORK:</span>
              <span className="text-white font-semibold">Arkiv Rabdi</span>
              <span className="text-[#64748B]">(Chain ID: {overview?.chainId || 7794095})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">GAS TOKEN:</span>
              <span className="text-white font-semibold">{overview?.gasToken || 'tGLM'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">BLOCK HEIGHT:</span>
              <span className="text-[#DD60F7] font-semibold">
                #{overview?.currentBlock || '---'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">STATUS:</span>
              {overview?.rpcStatus === 'online' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  RPC Connected
                </span>
              ) : overview?.rpcStatus === 'degraded' ? (
                <span className="inline-flex items-center gap-1.5 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Degraded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#64748B]">
              Updated: {overview?.lastQueryTime ? new Date(overview.lastQueryTime).toLocaleTimeString() : '---'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
                overview?.source === 'live'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : overview?.source === 'unavailable'
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              }`}
            >
              {overview?.source === 'live'
                ? '● Live Rabdi Data'
                : overview?.source === 'unavailable'
                ? '■ Live Arkiv Unavailable'
                : '▲ Demo Fixture Mode'}
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">
                Decentralized Threat Intelligence
              </p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Arkiv Security Monitoring
              </h1>
              <p className="mt-2 text-sm text-[#94A3B8] max-w-2xl">
                Independent, read-only verification of shared merchant risk states on Arkiv Rabdi testnet.
                PayeeGuard queries these immutable records before authorizing x402 payment signing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://docs.arkiv.network/networks/rabdi/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#DD60F7] hover:text-[#E482F9] underline underline-offset-4"
              >
                Arkiv Rabdi Docs <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Metric Cards Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Blocked Wallets */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-rose-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Blocked Wallets</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400 font-mono">
                {isLoading ? '...' : overview?.blockedWallets ?? 0}
              </span>
              <span className="text-xs text-[#94A3B8]">active</span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Immediate pre-signing veto</p>
          </div>

          {/* Card 2: Wallets Under Review */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Under Review</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400 font-mono">
                {isLoading ? '...' : overview?.reviewWallets ?? 0}
              </span>
              <span className="text-xs text-[#94A3B8]">wallets</span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Requires manual operator review</p>
          </div>

          {/* Card 3: Verified Clean Wallets */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Clean Wallets</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                {isLoading ? '...' : overview?.allowedWallets ?? 0}
              </span>
              <span className="text-xs text-[#94A3B8]">authorized</span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Permitted to proceed to signing</p>
          </div>

          {/* Card 4: Total Risk Signals */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-[#DD60F7]/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Risk Signals</span>
              <Activity className="w-4 h-4 text-[#DD60F7]" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#DD60F7] font-mono">
                {isLoading ? '...' : overview?.totalSignals ?? 0}
              </span>
              <span className="text-xs text-[#94A3B8]">recorded</span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Cross-merchant threat signals</p>
          </div>

          {/* Card 5: Payment Decisions */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-blue-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Decisions On-Chain</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">
                {isLoading ? '...' : typeof overview?.paymentDecisions === 'number' ? overview.paymentDecisions : '0'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]" title="Decisions are evaluated locally in pre-signing memory">
              Evaluated in memory (B06 pending)
            </p>
          </div>
        </div>

        {/* Trusted Reporter Banner */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-[#94A3B8]">AUTHORITATIVE TRUSTED REPORTER</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-white">
                  {overview?.trustedReporters?.[0] || '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C'}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      overview?.trustedReporters?.[0] || '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
                      'reporter'
                    )
                  }
                  className="text-[#64748B] hover:text-white transition-colors"
                  title="Copy address"
                >
                  {copiedKey === 'reporter' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="text-xs text-[#64748B] sm:text-right">
            <span>Filter policy: </span>
            <span className="font-mono text-emerald-400">Strict Owner Match</span>
            <span className="block text-[11px] text-[#64748B]">
              Only records signed by this address are accepted as authoritative.
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#262626] gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'explorer'
                ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
            }`}
          >
            <Search className="w-4 h-4" />
            Wallet Risk Explorer
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'signals'
                ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
            }`}
          >
            <Activity className="w-4 h-4" />
            Risk Signal History ({signals.length})
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'decisions'
                ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
            }`}
          >
            <Database className="w-4 h-4" />
            Payment Decisions
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Security & Trust Policy
          </button>
        </div>

        {/* TAB 1: Wallet Risk Explorer */}
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            {/* Search Bar & Quick Buttons */}
            <div className="p-6 rounded-3xl bg-[#141414] border border-[#262626] space-y-4">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Enter Hedera Account ID (e.g. 0.0.90001) or EVM Address (0x...)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#090909] border border-[#262626] text-white font-mono text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#DD60F7] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 py-3 rounded-xl bg-[#DD60F7] hover:bg-[#D152F5] text-black font-semibold text-sm tracking-wide shadow-[0_0_20px_rgba(221,96,247,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isSearching ? 'Querying...' : 'Query Arkiv'}
                </button>
              </form>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1C1C1C]">
                <span className="text-xs font-mono text-[#64748B]">Quick Tests:</span>
                <button
                  type="button"
                  onClick={() => handleQuickWalletClick('0.0.90001')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  0.0.90001 (Flagged Fraudster - BLOCK)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickWalletClick('0.0.12345')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  0.0.12345 (Clean Baseline - ALLOW)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickWalletClick('0.0.77777')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-slate-500/10 text-slate-300 border border-slate-500/20 hover:bg-slate-500/20 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  0.0.77777 (Unrecorded Wallet - UNKNOWN)
                </button>
              </div>

              {searchError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* Wallet Risk State Card */}
            {walletRisk && (
              <div className="rounded-3xl bg-[#141414] border border-[#262626] overflow-hidden">
                {/* Header Banner */}
                <div className="p-6 border-b border-[#262626] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D0D0D]">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        walletRisk.verdict === 'BLOCK'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : walletRisk.verdict === 'ALLOW'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : walletRisk.verdict === 'REVIEW'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}
                    >
                      {walletRisk.verdict === 'BLOCK' ? (
                        <ShieldAlert className="w-6 h-6" />
                      ) : walletRisk.verdict === 'ALLOW' ? (
                        <ShieldCheck className="w-6 h-6" />
                      ) : walletRisk.verdict === 'REVIEW' ? (
                        <AlertTriangle className="w-6 h-6" />
                      ) : (
                        <ShieldQuestion className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase text-[#64748B]">Queried Wallet</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                            walletRisk.source === 'live'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : walletRisk.source === 'unavailable'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {walletRisk.source === 'live'
                            ? 'Live Verified Rabdi'
                            : walletRisk.source === 'unavailable'
                            ? 'Live Arkiv Unavailable'
                            : 'Fixture'}
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold font-mono text-white mt-0.5">{walletRisk.walletKey}</h2>
                    </div>
                  </div>

                  {/* Verdict Badge */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-mono text-[#64748B] block">PAYEEGUARD VERDICT</span>
                      <span
                        className={`inline-block px-4 py-1.5 rounded-xl font-mono text-sm font-extrabold tracking-wider mt-1 ${
                          walletRisk.verdict === 'BLOCK'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                            : walletRisk.verdict === 'ALLOW'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : walletRisk.verdict === 'REVIEW'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                        }`}
                      >
                        {walletRisk.verdict}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Item: Risk Score */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#64748B]">RISK SCORE</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xl font-bold text-white">{walletRisk.score}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#1F1F1F] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            Number(walletRisk.score) > 0.5
                              ? 'bg-rose-500'
                              : Number(walletRisk.score) > 0.2
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(Math.max(Number(walletRisk.score) * 100, 5), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Item: Reason Code */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#64748B]">REASON CODE</span>
                    <p className="font-mono text-sm font-semibold text-white">{walletRisk.reasonCode}</p>
                  </div>

                  {/* Item: Policy Version */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#64748B]">POLICY VERSION</span>
                    <p className="font-mono text-sm text-[#94A3B8]">{walletRisk.policyVersion}</p>
                  </div>

                  {/* Item: Trusted Reporter */}
                  <div className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-mono text-[#64748B]">TRUSTED REPORTER</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#E2E8F0] break-all">{walletRisk.reporter}</span>
                      <button
                        onClick={() => copyToClipboard(walletRisk.reporter, 'detail-reporter')}
                        className="text-[#64748B] hover:text-white"
                        title="Copy reporter address"
                      >
                        {copiedKey === 'detail-reporter' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Item: Signals Aggregated */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#64748B]">SIGNALS AGGREGATED</span>
                    <p className="font-mono text-sm font-semibold text-[#DD60F7]">{walletRisk.signalCount} signals</p>
                  </div>

                  {/* Item: Arkiv Entity Key */}
                  <div className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-mono text-[#64748B]">ARKIV ENTITY KEY (HEX)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#94A3B8] break-all">{walletRisk.entityKey}</span>
                      {walletRisk.entityKey !== 'none' && (
                        <button
                          onClick={() => copyToClipboard(walletRisk.entityKey, 'entity-key')}
                          className="text-[#64748B] hover:text-white"
                          title="Copy entity key"
                        >
                          {copiedKey === 'entity-key' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item: Expiration Block */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#64748B]">EXPIRATION BLOCK</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-white">
                        #{walletRisk.expiresAtBlock}
                      </span>
                      {walletRisk.isExpired ? (
                        <span className="text-[11px] font-mono text-rose-400">(EXPIRED)</span>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-400">
                          (Valid ~{Number(walletRisk.expiresAtBlock) - Number(walletRisk.currentBlock || '0')} blks)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer with Explorer Link */}
                <div className="px-6 py-4 bg-[#0D0D0D] border-t border-[#262626] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#64748B]">
                  <span>Query timestamp: {new Date(walletRisk.queryTimestamp).toLocaleString()}</span>
                  {walletRisk.entityKey !== 'none' && (
                    <a
                      href={walletRisk.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#DD60F7] hover:text-[#E482F9] font-semibold"
                    >
                      View Entity on Rabdi Explorer <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Risk Signal History */}
        {activeTab === 'signals' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#141414] border border-[#262626]">
              <div>
                <h3 className="text-sm font-semibold text-white">Cross-Merchant Risk Signals</h3>
                <p className="text-xs text-[#94A3B8]">
                  Individual fraud indicators published by authorized merchant detectors on Rabdi testnet.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
                    signalsSource === 'live'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : signalsSource === 'unavailable'
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {signalsSource === 'live'
                    ? '● Live Signals'
                    : signalsSource === 'unavailable'
                    ? '■ Live Arkiv Unavailable'
                    : '▲ Demo Fixtures'}
                </span>
                <button
                  onClick={fetchSignals}
                  disabled={signalsLoading}
                  className="px-3 py-1.5 rounded-lg border border-[#262626] bg-[#0A0A0A] text-xs font-mono text-[#94A3B8] hover:text-white"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-[#262626] bg-[#141414] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0D0D0D] text-[#94A3B8] uppercase border-b border-[#262626]">
                    <tr>
                      <th className="px-5 py-3">Subject Wallet</th>
                      <th className="px-5 py-3">Signal Code</th>
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">Source App</th>
                      <th className="px-5 py-3">Entity Key</th>
                      <th className="px-5 py-3">Expires Block</th>
                      <th className="px-5 py-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {signalsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-[#94A3B8]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#DD60F7]" />
                          Loading signals from Rabdi...
                        </td>
                      </tr>
                    ) : signals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-[#64748B]">
                          No RiskSignal records found on Rabdi testnet.
                        </td>
                      </tr>
                    ) : (
                      signals.map((sig, idx) => (
                        <tr key={sig.entityKey || idx} className="hover:bg-[#1A1A1A] transition-colors">
                          <td className="px-5 py-3.5 font-bold text-white">{sig.walletKey}</td>
                          <td className="px-5 py-3.5 text-[#DD60F7]">{sig.signalCode}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sig.severity === 'CRITICAL'
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : sig.severity === 'HIGH'
                                  ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                                  : sig.severity === 'MEDIUM'
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {sig.severity}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#94A3B8]">{sig.sourceApp}</td>
                          <td className="px-5 py-3.5 text-[#64748B]">
                            {sig.entityKey.slice(0, 10)}...{sig.entityKey.slice(-6)}
                          </td>
                          <td className="px-5 py-3.5 text-[#94A3B8]">#{sig.expiresAtBlock}</td>
                          <td className="px-5 py-3.5 text-right">
                            <a
                              href={sig.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#DD60F7] hover:text-[#E482F9] inline-flex items-center gap-1"
                            >
                              View <ArrowUpRight className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Payment Decisions */}
        {activeTab === 'decisions' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#141414] border border-[#262626]">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">PaymentDecision Entity Explorer</h3>
                  <p className="mt-1 text-xs text-[#94A3B8] max-w-2xl">
                    Arkiv Rabdi supports an on-chain schema for recorded settlement decisions.
                    In our current MVP architecture, payment authorization decisions are executed locally
                    in PayeeGuard pre-signing memory to guarantee ultra-low latency before the Hedera transaction.
                  </p>
                </div>
              </div>
            </div>

            {/* Honest Empty State Banner */}
            <div className="p-8 rounded-3xl border border-[#262626] bg-[#0A0A0A] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-[#262626] mx-auto flex items-center justify-center text-[#64748B]">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">No On-Chain Payment Decisions Logged</h4>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                {decisionsResult?.message ||
                  'No PaymentDecision entities have been written to Arkiv Rabdi yet. Local PayeeGuard evaluates authorization immediately in memory prior to signing.'}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  <Info className="w-3.5 h-3.5" />
                  Planned Architecture: Phase 4 Settlement Integration
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Security & Trust Policy */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#141414] border border-[#262626] space-y-2">
              <h3 className="text-lg font-bold text-white">Arkiv Security & Trust Guarantees</h3>
              <p className="text-xs text-[#94A3B8]">
                How GuardRail Pay verifies on-chain threat intelligence without trusting unverified actors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Guarantee 1: Named Schema Enforcement */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="text-sm font-semibold text-white">1. Strict Named Schema Enforcement</h4>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Queries strictly require named schemas (<code className="text-[#DD60F7]">WalletRiskState</code>,{' '}
                  <code className="text-[#DD60F7]">RiskSignal</code>). Unstructured or mismatched payload entities
                  are rejected with <code className="text-amber-400">onMismatch: &apos;throw&apos;</code>.
                </p>
              </div>

              {/* Guarantee 2: Trusted Owner Verification */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="text-sm font-semibold text-white">2. Authoritative Reporter Filtering</h4>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Every entity returned by Arkiv is verified against the configured{' '}
                  <code className="text-[#DD60F7]">ARKIV_TRUSTED_OWNER</code> address. Any entity published by
                  unauthorized third parties is ignored.
                </p>
              </div>

              {/* Guarantee 3: Expiration Guard */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="text-sm font-semibold text-white">3. On-Chain Expiration Invariant</h4>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Stale records are strictly evicted. If <code className="text-[#DD60F7]">$expiresAt &lt;= currentBlock</code>,
                  the record is treated as expired (<code className="text-amber-400">RECORD_EXPIRED</code>), preventing
                  outdated blocks from indefinitely penalizing remediated payees.
                </p>
              </div>

              {/* Guarantee 4: Fail-Safe Invariant */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="text-sm font-semibold text-white">4. Fail-Safe Pre-Signing Boundary</h4>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Only <code className="text-emerald-400">PASS</code> allows payment signing to reach{' '}
                  <code className="text-[#DD60F7]">rawSigner</code>. <code className="text-rose-400">BLOCK</code> stops signing.
                  Network errors or unverified states fail-closed to <code className="text-amber-400">HOLD</code> /{' '}
                  <code className="text-amber-400">UNVERIFIABLE</code>.
                </p>
              </div>
            </div>

            {/* Architecture Invariant Callout */}
            <div className="p-5 rounded-2xl bg-[#0A0A0A] border border-[#262626] text-xs font-mono text-[#94A3B8] space-y-2">
              <span className="text-white font-bold block">SECURITY BOUNDARY INVARIANT:</span>
              <p>
                The Arkiv monitoring dashboard is strictly read-only. Arkiv publisher private keys remain securely
                isolated in server-side microservices and are never delivered to the browser bundle or exposed via public APIs.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
