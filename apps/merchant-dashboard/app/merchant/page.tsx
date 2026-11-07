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
                GuardRail Pay
              </span>
            </Link>
            <span className="text-[#262626]">/</span>
            <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Merchant Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/arkiv"
              className="text-xs font-mono text-[#E2E8F0] hover:text-[#DD60F7] px-3.5 py-1.5 rounded-lg border border-[#262626] hover:border-[#D152F5]/50 transition-all bg-[#141414]"
            >
              Arkiv Risk State
            </Link>
            <Link
              href="/buyer"
              className="text-xs font-mono text-[#E2E8F0] hover:text-[#DD60F7] px-3.5 py-1.5 rounded-lg border border-[#262626] hover:border-[#D152F5]/50 transition-all bg-[#141414]"
            >
              Open Buyer Console →
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D152F5]/10 border border-[#D152F5]/25">
              <span className="w-2 h-2 rounded-full bg-[#D152F5] animate-pulse" />
              <span className="font-mono text-xs text-[#DD60F7] font-bold">{profile.ensName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#262626] pb-4">
          {[
            { id: 'profile', label: '1. ENS Profile & Records' },
            { id: 'rotation', label: '2. Payout Rotation Timelock' },
            { id: 'roles', label: '3. EAC Roles & Permissions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-[10px] font-mono text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-[#D152F5] text-[#050505] font-bold shadow-[0_4px_16px_rgba(209,82,245,0.35)]'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#141414] border border-transparent hover:border-[#262626]'
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
            <div className="lg:col-span-1 p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Active Identity</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 font-mono text-[11px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  Verified ENSv2
                </span>
              </div>

              <div className="space-y-1">
                <p className="font-title-sans text-3xl font-bold text-[#FFFFFF]">{profile.ensName}</p>
                <p className="font-mono text-xs text-[#94A3B8]">Domain: {profile.domain}</p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#262626] space-y-1">
                  <span className="font-mono text-[11px] text-[#94A3B8] uppercase tracking-wider">Active Payout payTo</span>
                  <p className="font-mono text-sm text-[#D152F5] font-bold break-all">{profile.activePayTo}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#0E0E0E] border border-[#262626]">
                    <span className="font-mono text-[10px] text-[#94A3B8] uppercase">Target Network</span>
                    <p className="font-mono text-xs text-[#FFFFFF] font-semibold mt-0.5">{profile.network}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0E0E0E] border border-[#262626]">
                    <span className="font-mono text-[10px] text-[#94A3B8] uppercase">Max Ticket Cap</span>
                    <p className="font-mono text-xs text-[#34D399] font-semibold mt-0.5">${profile.maxAmountUsdc.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#262626] space-y-2 text-xs font-mono text-[#94A3B8]">
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="text-[#E2E8F0] font-medium">{profile.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chain ID</span>
                  <span className="text-[#E2E8F0] font-medium">{profile.chainId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Resolver</span>
                  <span className="text-[#E2E8F0] font-medium truncate max-w-[150px]">{profile.resolverAddress}</span>
                </div>
              </div>
            </div>

            {/* Live On-Chain Records */}
            <div className="lg:col-span-2 p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">On-Chain x402 ENS Records</span>
                <span className="font-mono text-xs text-[#64748B]">Sepolia Contract: 0x9841...82</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {recordsList.map((r) => (
                  <div
                    key={r.key}
                    className="p-3.5 rounded-2xl border border-[#262626] bg-[#0E0E0E] flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#D152F5]/40 transition-colors"
                  >
                    <span className="text-[#94A3B8] font-semibold">{r.key}</span>
                    <span className="text-[#E2E8F0] font-medium break-all">{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl border border-[#D152F5]/25 bg-[#D152F5]/10 flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-xs text-[#E2E8F0] leading-relaxed">
                  These text records are read directly by GuardRail Pay PayeeGuard during pre-flight checks. AI agents will immediately block payments if a merchant's 402 header deviates from these verified on-chain entries.
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
              <div className="p-7 rounded-[28px] border border-[#D152F5]/30 bg-gradient-to-br from-[#1B0B1C] via-[#141414] to-[#0E0E0E] shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D152F5] animate-ping" />
                    <span className="font-mono text-xs text-[#DD60F7] font-bold uppercase tracking-wider">
                      Active Rotation In Progress ({rotation.status})
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#94A3B8]">Proposal ID: {rotation.id}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#262626]">
                    <p className="font-mono text-xs text-[#94A3B8] mb-1">Current Payout Address</p>
                    <p className="font-mono text-xs text-[#E2E8F0] break-all font-semibold">{profile.activePayTo}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#262626]">
                    <p className="font-mono text-xs text-[#94A3B8] mb-1">Proposed New Address</p>
                    <p className="font-mono text-xs text-[#34D399] break-all font-bold">{rotation.proposedPayTo}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#D152F5]/30">
                    <p className="font-mono text-xs text-[#DD60F7] mb-1 font-bold">Timelock Window Remaining</p>
                    <p className="font-mono text-xl text-[#DD60F7] font-bold">
                      {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] pt-2 border-t border-[#262626]">
                  <span>Proposer: {rotation.proposer}</span>
                  <span className="text-[#34D399] font-bold">World ID Verified: {rotation.worldIdVerified ? 'YES ✓' : 'NO'}</span>
                  <span>Nullifier: {rotation.nullifierHash}</span>
                </div>
              </div>
            )}

            {/* Form to Propose New Rotation */}
            <div className="p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-6">
              <div>
                <h3 className="font-title-sans text-2xl font-bold text-[#FFFFFF] mb-2">Propose Safe Payout Address Change</h3>
                <p className="text-sm text-[#94A3B8]">
                  Address rotations require a mandatory 48-hour delay timelock and biometric proof of personhood via World ID Agent Pass to prevent compromised keys from hijacking agent payouts.
                </p>
              </div>

              {formSuccess && (
                <div className="p-4 rounded-2xl border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] font-mono text-xs">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handlePropose} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-[#E2E8F0] font-bold mb-2">
                    New payTo Address (EVM / Hedera Hex)
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newPayTo}
                    onChange={(e) => setNewPayTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#0E0E0E] border border-[#262626] text-[#E2E8F0] placeholder-[#64748B] font-mono text-xs focus:outline-none focus:border-[#D152F5] transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#E2E8F0] font-bold mb-2">
                    Rotation Reason / Governance Memo
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Migration to cold multisig vault"
                    value={proposedReason}
                    onChange={(e) => setProposedReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#0E0E0E] border border-[#262626] text-[#E2E8F0] placeholder-[#64748B] font-mono text-xs focus:outline-none focus:border-[#D152F5] transition-colors"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-[#262626] bg-[#0E0E0E] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#1F1F1F] flex items-center justify-center font-bold text-sm">
                      🆔
                    </span>
                    <div>
                      <p className="font-mono text-xs text-[#FFFFFF] font-bold">World ID Agent Pass</p>
                      <p className="font-mono text-[11px] text-[#94A3B8]">Biometric Proof of Unique Human Operator</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={worldIdChecked}
                      onChange={(e) => setWorldIdChecked(e.target.checked)}
                      className="w-4 h-4 accent-[#D152F5]"
                    />
                    <span className="font-mono text-xs text-[#E2E8F0] font-medium">Verify Proposer Proof</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-[10px] font-sans font-bold text-sm bg-[#D152F5] text-[#050505] hover:bg-[#DD60F7] shadow-[0_4px_16px_rgba(209,82,245,0.35)] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Broadcasting Proposal...' : 'Submit Proposal (World ID)'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: EAC Roles & Permissions */}
        {activeTab === 'roles' && (
          <div className="p-7 rounded-[28px] border border-[#262626] bg-[#141414] shadow-xl space-y-6">
            <div>
              <h3 className="font-title-sans text-2xl font-bold text-[#FFFFFF] mb-2">EAC Contract Roles & Access Controls</h3>
              <p className="text-sm text-[#94A3B8]">
                Enhanced Access Control (EAC) rules ensure that only verified cryptographic keys and human operators can touch payment configurations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r) => (
                <div
                  key={r.role}
                  className="p-5 rounded-2xl border border-[#262626] bg-[#0E0E0E] hover:border-[#D152F5]/50 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#D152F5]/10 border border-[#D152F5]/25 text-[#DD60F7] font-mono text-[11px] font-bold">
                      {r.role}
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">Assigned {r.assignedAt}</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-[#94A3B8] mb-1">Assigned Address</p>
                    <p className="font-mono text-xs text-[#E2E8F0] break-all font-semibold">{r.address}</p>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
