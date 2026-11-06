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
        status: 'IN_DELAY',
        proposedPayTo: newPayTo,
        proposer: '0x89201C3...2a1b',
        proposedTimestamp: Date.now(),
        unlockTimestamp: Date.now() + 48 * 3600 * 1000,
        worldIdVerified: true,
        nullifierHash: '0x' + Math.random().toString(16).slice(2, 10),
      });
      setTimeLeft({ hours: 48, minutes: 0, seconds: 0 });
      setFormSuccess('Rotation proposal created and broadcast on-chain! 48h timelock initiated.');
      setNewPayTo('');
      setProposedReason('');
      setWorldIdChecked(false);
    }, 1200);
  };

  const recordsList = [
    { key: 'x402.payTo', value: profile.activePayTo },
    { key: 'x402.network', value: profile.network },
    { key: 'x402.maxAmount', value: `$${profile.maxAmountUsdc.toFixed(2)} USDC` },
    { key: 'x402.asset', value: profile.allowedAsset },
    { key: 'x402.version', value: profile.version },
    { key: 'x402.resolver', value: profile.resolverAddress },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A]">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A6CFF] to-[#0052E0] flex items-center justify-center shadow-[0_0_15px_rgba(26,108,255,0.4)]">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#FFFFFF"/>
                  <path d="M9 12L11 14L15 10" stroke="#1A6CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="font-display text-lg font-bold text-[#0F172A] group-hover:text-[#1A6CFF] transition-colors">
                QuoteSeal
              </span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-xs text-[#64748B] uppercase tracking-wider font-semibold">Merchant Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/buyer"
              className="text-xs font-mono text-[#1A6CFF] hover:text-[#0052E0] px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#1A6CFF] transition-all bg-[#F8FAFC]"
            >
              Open Buyer Console →
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8F1FF] border border-[#1A6CFF]/20">
              <span className="w-2 h-2 rounded-full bg-[#1A6CFF] animate-pulse" />
              <span className="font-mono text-xs text-[#1A6CFF] font-bold">{profile.ensName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
          {[
            { id: 'profile', label: '1. ENS Profile & Records' },
            { id: 'rotation', label: '2. Payout Rotation Timelock' },
            { id: 'roles', label: '3. EAC Roles & Permissions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-full font-mono text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-[#1A6CFF] text-white font-bold shadow-[0_4px_16px_rgba(26,108,255,0.35)]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile View */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Identity Card */}
            <div className="lg:col-span-1 p-7 rounded-[28px] border border-slate-200 bg-white shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="font-mono text-xs text-[#64748B] uppercase tracking-wider font-semibold">Active Identity</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-mono text-[11px] font-bold">
                  ● Verified ENSv2
                </span>
              </div>

              <div className="space-y-1">
                <p className="font-title-sans text-3xl font-bold text-[#0F172A]">{profile.ensName}</p>
                <p className="font-mono text-xs text-[#64748B]">Domain: {profile.domain}</p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 space-y-1">
                  <span className="font-mono text-[11px] text-[#64748B] uppercase tracking-wider">Active Payout payTo</span>
                  <p className="font-mono text-sm text-[#1A6CFF] font-bold break-all">{profile.activePayTo}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
                    <span className="font-mono text-[10px] text-[#64748B] uppercase">Target Network</span>
                    <p className="font-mono text-xs text-[#0F172A] font-semibold mt-0.5">{profile.network}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
                    <span className="font-mono text-[10px] text-[#64748B] uppercase">Max Ticket Cap</span>
                    <p className="font-mono text-xs text-emerald-600 font-semibold mt-0.5">${profile.maxAmountUsdc.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs font-mono text-[#64748B]">
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="text-[#0F172A] font-medium">{profile.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chain ID</span>
                  <span className="text-[#0F172A] font-medium">{profile.chainId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Resolver</span>
                  <span className="text-[#0F172A] font-medium truncate max-w-[150px]">{profile.resolverAddress}</span>
                </div>
              </div>
            </div>

            {/* Live On-Chain Records */}
            <div className="lg:col-span-2 p-7 rounded-[28px] border border-slate-200 bg-white shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="font-mono text-xs text-[#64748B] uppercase tracking-wider font-semibold">On-Chain x402 ENS Records</span>
                <span className="font-mono text-xs text-[#64748B]">Sepolia Contract: 0x9841...82</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {recordsList.map((r) => (
                  <div
                    key={r.key}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#1A6CFF]/40 transition-colors"
                  >
                    <span className="text-[#64748B] font-semibold">{r.key}</span>
                    <span className="text-[#0F172A] font-medium break-all">{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl border border-blue-200 bg-[#E8F1FF]/60 flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-xs text-[#0F172A] leading-relaxed">
                  These text records are read directly by QuoteSeal PayeeGuard during pre-flight checks. AI agents will immediately block payments if a merchant's 402 header deviates from these verified on-chain entries.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Payout Rotation Timelock */}
        {activeTab === 'rotation' && (
          <div className="space-y-8">
            {/* Active Rotation Notice */}
            {rotation && (
              <div className="p-7 rounded-[28px] border border-blue-200 bg-[#F0F5FF] shadow-lg space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1A6CFF] animate-ping" />
                    <span className="font-mono text-xs text-[#1A6CFF] font-bold uppercase tracking-wider">
                      Active Rotation In Progress ({rotation.status})
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#64748B]">Proposal ID: {rotation.id}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                    <p className="font-mono text-xs text-[#64748B] mb-1">Current Payout Address</p>
                    <p className="font-mono text-xs text-[#0F172A] break-all font-semibold">{profile.activePayTo}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                    <p className="font-mono text-xs text-[#64748B] mb-1">Proposed New Address</p>
                    <p className="font-mono text-xs text-emerald-600 break-all font-bold">{rotation.proposedPayTo}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-blue-200">
                    <p className="font-mono text-xs text-[#1A6CFF] mb-1 font-bold">Timelock Window Remaining</p>
                    <p className="font-mono text-xl text-[#1A6CFF] font-bold">
                      {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[#64748B] pt-2 border-t border-slate-200">
                  <span>Proposer: {rotation.proposer}</span>
                  <span className="text-emerald-600 font-bold">World ID Verified: {rotation.worldIdVerified ? 'YES ✓' : 'NO'}</span>
                  <span>Nullifier: {rotation.nullifierHash}</span>
                </div>
              </div>
            )}

            {/* Form to Propose New Rotation */}
            <div className="p-7 rounded-[28px] border border-slate-200 bg-white shadow-xl space-y-6">
              <div>
                <h3 className="font-title-sans text-2xl font-bold text-[#0F172A] mb-2">Propose Safe Payout Address Change</h3>
                <p className="text-sm text-[#64748B]">
                  Address rotations require a mandatory 48-hour delay timelock and biometric proof of personhood via World ID Agent Pass to prevent compromised keys from hijacking agent payouts.
                </p>
              </div>

              {formSuccess && (
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-mono text-xs">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handlePropose} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-[#0F172A] font-bold mb-2">
                    New payTo Address (EVM / Hedera Hex)
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newPayTo}
                    onChange={(e) => setNewPayTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 font-mono text-xs focus:outline-none focus:border-[#1A6CFF] transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#0F172A] font-bold mb-2">
                    Rotation Reason / Governance Memo
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Migration to cold multisig vault"
                    value={proposedReason}
                    onChange={(e) => setProposedReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 font-mono text-xs focus:outline-none focus:border-[#1A6CFF] transition-colors"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm">
                      🆔
                    </span>
                    <div>
                      <p className="font-mono text-xs text-[#0F172A] font-bold">World ID Agent Pass</p>
                      <p className="font-mono text-[11px] text-[#64748B]">Biometric Proof of Unique Human Operator</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={worldIdChecked}
                      onChange={(e) => setWorldIdChecked(e.target.checked)}
                      className="w-4 h-4 accent-[#1A6CFF]"
                    />
                    <span className="font-mono text-xs text-[#0F172A] font-medium">Verify Proposer Proof</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full font-sans font-bold text-sm bg-[#1A6CFF] text-white hover:bg-[#0052E0] shadow-[0_4px_16px_rgba(26,108,255,0.35)] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Broadcasting Proposal...' : 'Submit Proposal (World ID)'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: EAC Roles & Permissions */}
        {activeTab === 'roles' && (
          <div className="p-7 rounded-[28px] border border-slate-200 bg-white shadow-xl space-y-6">
            <div>
              <h3 className="font-title-sans text-2xl font-bold text-[#0F172A] mb-2">EAC Contract Roles & Access Controls</h3>
              <p className="text-sm text-[#64748B]">
                Enhanced Access Control (EAC) rules ensure that only verified cryptographic keys and human operators can touch payment configurations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r) => (
                <div
                  key={r.role}
                  className="p-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] hover:border-[#1A6CFF]/50 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#E8F1FF] border border-[#1A6CFF]/20 text-[#1A6CFF] font-mono text-[11px] font-bold">
                      {r.role}
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">Assigned {r.assignedAt}</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-[#64748B] mb-1">Assigned Address</p>
                    <p className="font-mono text-xs text-[#1A6CFF] break-all font-semibold">{r.address}</p>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
