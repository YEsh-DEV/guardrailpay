'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  mockMerchantProfile,
  mockActiveRotation,
  mockRoles,
  MerchantProfile,
  RotationProposal,
  RoleAssignment,
} from '../lib/api';

export default function MerchantDashboard() {
  const [profile, setProfile] = useState<MerchantProfile>(mockMerchantProfile);
  const [rotation, setRotation] = useState<RotationProposal>(mockActiveRotation);
  const [roles] = useState<RoleAssignment[]>(mockRoles);
  const [activeTab, setActiveTab] = useState<'profile' | 'rotation' | 'roles'>('profile');

  // Rotation Proposal Form State
  const [newPayTo, setNewPayTo] = useState('');
  const [proposedReason, setProposedReason] = useState('');
  const [worldIdChecked, setWorldIdChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Time remaining calculation for active rotation
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 12,
    minutes: 42,
    seconds: 15,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayTo.startsWith('0x') || newPayTo.length < 20) {
      alert('Please enter a valid Ethereum / Hedera EVM hex address');
      return;
    }
    if (!worldIdChecked) {
      alert('World ID Agent Pass verification is required to propose a rotation');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setRotation({
        id: `rot_${Date.now()}`,
        proposedPayTo: newPayTo,
        proposer: '0x89201C3...2a1b',
        proposedTimestamp: Date.now(),
        unlockTimestamp: Date.now() + 48 * 3600 * 1000,
        worldIdVerified: true,
        nullifierHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        status: 'IN_DELAY',
      });
      setTimeLeft({ hours: 48, minutes: 0, seconds: 0 });
      setFormSuccess('Rotation proposal created and broadcast on-chain! 48h timelock initiated.');
      setNewPayTo('');
      setProposedReason('');
      setWorldIdChecked(false);
    }, 1200);
  };

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
            <span className="font-mono text-xs text-[#9BA9B2] uppercase tracking-wider">Merchant Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/buyer"
              className="text-xs font-mono text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
            >
              Open Buyer Console →
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00FF59]/10 border border-[#00FF59]/30">
              <span className="w-2 h-2 rounded-full bg-[#00FF59] animate-pulse" />
              <span className="font-mono text-xs text-[#00FF59] font-medium">{profile.ensName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/8 pb-4">
          {[
            { id: 'profile', label: '1. ENS Profile & Records' },
            { id: 'rotation', label: '2. Payout Rotation Timelock' },
            { id: 'roles', label: '3. EAC Roles & Permissions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-full font-mono text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00FF59] text-[#081014] font-semibold shadow-[0_0_20px_rgba(0,255,89,0.3)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile View */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 3D Profile Summary Card */}
            <div className="lg:col-span-1 rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0E1F16] via-[#091610] to-[#060D0A] p-7 shadow-[0_30px_70px_rgba(0,0,0,0.7)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="font-mono text-[10px] text-[#00FF59]/70 uppercase tracking-widest block mb-1">
                      Verified Identity
                    </span>
                    <h2 className="font-display text-3xl text-white">{profile.ensName}</h2>
                    <p className="font-mono text-xs text-white/40 mt-1">{profile.domain}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#00FF59]/15 border border-[#00FF59]/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="#00FF59" strokeWidth="1.5"/>
                      <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                <div className="space-y-4 my-6">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1">Active Payout (payTo)</p>
                    <p className="font-mono text-xs text-[#00F5D4] break-all">{profile.activePayTo}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="font-mono text-[10px] text-white/40 uppercase mb-1">Network</p>
                      <p className="font-mono text-xs text-white">{profile.network}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="font-mono text-[10px] text-white/40 uppercase mb-1">Max Cap</p>
                      <p className="font-mono text-xs text-[#00FF59] font-semibold">${profile.maxAmountUsdc.toFixed(2)} USDC</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono text-[11px] text-white/40">ENS Version: {profile.version}</span>
                <span className="px-2.5 py-1 rounded-full bg-[#00FF59]/20 text-[#00FF59] font-mono text-[10px] font-semibold">
                  EAC v2.4 Live
                </span>
              </div>
            </div>

            {/* ENS On-Chain Records Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl">
                <h3 className="font-display text-xl text-white mb-2">On-Chain ENS Resolver Records</h3>
                <p className="text-sm text-[#9BA9B2] mb-6">
                  These records are resolved dynamically by QuoteSeal Guard before every payment proposal is signed.
                </p>

                <div className="space-y-3 font-mono text-xs">
                  {[
                    { key: 'x402.payTo', value: profile.activePayTo, highlight: true },
                    { key: 'x402.network', value: `eip155:${profile.chainId} (Hedera Testnet)`, highlight: false },
                    { key: 'x402.asset', value: profile.allowedAsset, highlight: false },
                    { key: 'x402.maxAmount', value: `${profile.maxAmountUsdc * 1000000} (50.00 USDC in 6 decimals)`, highlight: false },
                    { key: 'x402.version', value: profile.version, highlight: false },
                    { key: 'x402.resolver', value: profile.resolverAddress, highlight: false },
                  ].map((rec) => (
                    <div
                      key={rec.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all gap-2"
                    >
                      <span className="text-[#00FF59] font-medium">{rec.key}</span>
                      <span className={rec.highlight ? 'text-[#00F5D4] break-all' : 'text-white/70 break-all'}>
                        {rec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status and Diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-white/10 bg-[#0E171D]/60">
                  <p className="font-mono text-xs text-white/40 uppercase mb-2">RFC /.well-known Binding</p>
                  <p className="font-mono text-sm text-[#00FF59] flex items-center gap-2">
                    <span>✓</span> Verified (https://{profile.domain})
                  </p>
                  <p className="text-xs text-[#9BA9B2] mt-2">
                    Ensures DNS domain ownership cryptographically matches the ENS registrant.
                  </p>
                </div>
                <div className="p-5 rounded-2xl border border-white/10 bg-[#0E171D]/60">
                  <p className="font-mono text-xs text-white/40 uppercase mb-2">Active Payee Guard Health</p>
                  <p className="font-mono text-sm text-[#00FF59] flex items-center gap-2">
                    <span>✓</span> 100% Operational (P99 8.2ms)
                  </p>
                  <p className="text-xs text-[#9BA9B2] mt-2">
                    All agent payments strictly gated. Unannounced payee drift will be immediately blocked.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Payout Rotation */}
        {activeTab === 'rotation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Active Rotation Timeline */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="font-mono text-[10px] text-[#FF9F0A] uppercase tracking-widest block mb-1">
                      Status: In 48h Time-Lock
                    </span>
                    <h3 className="font-display text-2xl text-white">Active Rotation Proposal</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 text-[#FF9F0A] font-mono text-xs font-semibold">
                    Proposal {rotation.id}
                  </span>
                </div>

                <div className="my-6 p-6 rounded-2xl bg-white/[0.02] border border-white/8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Countdown display */}
                  <div className="text-center sm:text-left">
                    <p className="font-mono text-[11px] text-white/40 uppercase mb-1">Time until activation unlock</p>
                    <p className="font-mono text-3xl font-bold text-[#FF9F0A]">
                      {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                    </p>
                    <p className="font-mono text-xs text-white/30 mt-1">Autonomous agents still pay current payTo</p>
                  </div>

                  {/* World ID verification stamp */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#00FF59]/10 border border-[#00FF59]/20">
                    <div className="w-8 h-8 rounded-full bg-[#00FF59]/20 flex items-center justify-center text-[#00FF59]">
                      ✓
                    </div>
                    <div>
                      <p className="font-mono text-xs text-[#00FF59] font-semibold">World ID Verified</p>
                      <p className="font-mono text-[10px] text-white/40">Nullifier: {rotation.nullifierHash.slice(0, 12)}...</p>
                    </div>
                  </div>
                </div>

                {/* 4-Stage Step Tracker */}
                <div className="space-y-4 pt-2">
                  <p className="font-mono text-xs text-white/40 uppercase tracking-wider">Lifecycle Progress</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { num: '1', title: 'Proposed', done: true },
                      { num: '2', title: 'World ID', done: true },
                      { num: '3', title: '48h Delay', done: true, current: true },
                      { num: '4', title: 'Activate', done: false },
                    ].map((st) => (
                      <div
                        key={st.num}
                        className={`p-3 rounded-xl text-center border font-mono text-xs transition-all ${
                          st.current
                            ? 'bg-[#FF9F0A]/10 border-[#FF9F0A]/40 text-[#FF9F0A]'
                            : st.done
                            ? 'bg-[#00FF59]/10 border-[#00FF59]/30 text-[#00FF59]'
                            : 'bg-white/5 border-white/5 text-white/30'
                        }`}
                      >
                        <p className="font-bold">{st.num}. {st.title}</p>
                        <p className="text-[10px] mt-0.5 opacity-70">
                          {st.current ? 'Pending...' : st.done ? 'Complete' : 'Locked'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/8 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] text-white/40 uppercase">Proposed Address</p>
                    <p className="font-mono text-xs text-[#00F5D4] break-all">{rotation.proposedPayTo}</p>
                  </div>
                  <button
                    disabled
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 font-mono text-xs cursor-not-allowed"
                  >
                    Activate (Unlocks in 12h)
                  </button>
                </div>
              </div>
            </div>

            {/* Propose New Rotation Form */}
            <div className="lg:col-span-5">
              <div className="p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl">
                <h3 className="font-display text-xl text-white mb-2">Propose New Payout Address</h3>
                <p className="text-sm text-[#9BA9B2] mb-6">
                  Initiate a controlled migration. Requires World ID human proof and starts the mandatory 48-hour challenge delay.
                </p>

                {formSuccess && (
                  <div className="mb-6 p-4 rounded-xl bg-[#00FF59]/15 border border-[#00FF59]/40 text-[#00FF59] font-mono text-xs">
                    {formSuccess}
                  </div>
                )}

                <form onSubmit={handlePropose} className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="block text-white/60 mb-2 uppercase">New payTo Address (EVM / Hedera)</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={newPayTo}
                      onChange={(e) => setNewPayTo(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-[#081014] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#00FF59] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 mb-2 uppercase">Rotation Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Cold storage multisig transition"
                      value={proposedReason}
                      onChange={(e) => setProposedReason(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#081014] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#00FF59] transition-colors"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8 space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="worldId"
                        checked={worldIdChecked}
                        onChange={(e) => setWorldIdChecked(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-[#081014] text-[#00FF59] focus:ring-[#00FF59]"
                      />
                      <label htmlFor="worldId" className="text-white/80 cursor-pointer">
                        <span className="font-semibold text-white block">Simulate World ID Agent Pass</span>
                        <span className="text-[11px] text-[#9BA9B2] block">
                          Confirms proof of unique personhood for rotation operator role.
                        </span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-full font-sans font-semibold text-sm bg-[#00FF59] text-[#081014] hover:bg-[#9AEA62] shadow-[0_0_20px_rgba(0,255,89,0.3)] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Broadcasting Proposal...' : 'Submit Proposal (World ID)'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: EAC Roles & Permissions */}
        {activeTab === 'roles' && (
          <div className="p-7 rounded-[28px] border border-white/10 bg-[#0E171D]/60 backdrop-blur-xl space-y-6">
            <div>
              <h3 className="font-display text-2xl text-white mb-2">EAC Contract Roles & Access Controls</h3>
              <p className="text-sm text-[#9BA9B2]">
                Enhanced Access Control (EAC) rules ensure that only verified cryptographic keys and human operators can touch payment configurations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r) => (
                <div
                  key={r.role}
                  className="p-5 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-[#00FF59]/30 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#00FF59]/10 border border-[#00FF59]/30 text-[#00FF59] font-mono text-[11px] font-semibold">
                      {r.role}
                    </span>
                    <span className="font-mono text-[10px] text-white/30">Assigned {r.assignedAt}</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-white/40 mb-1">Assigned Address</p>
                    <p className="font-mono text-xs text-[#00F5D4] break-all">{r.address}</p>
                  </div>
                  <p className="text-xs text-[#9BA9B2] leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

