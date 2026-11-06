'use client';

import React from 'react';
import Link from 'next/link';

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] px-8 py-16 max-w-6xl mx-auto space-y-16">
      <div>
        <h1 className="text-4xl font-bold text-silver-gradient mb-2">GuardRail Pay Finovate Tokens & Components</h1>
        <p className="text-silver-400">Three-layer palette: Deep Black base, Violet accent, and Cool Silver #E2E8F0.</p>
      </div>

      {/* Layer 1: Black Base */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-silver-200">Layer 1: Black Base (~60%)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 font-mono text-xs">
          <div className="p-5 rounded-card bg-[#050505] border border-finovate-700">#050505 black-950</div>
          <div className="p-5 rounded-card bg-[#0E0E0E] border border-finovate-700">#0E0E0E black-900</div>
          <div className="p-5 rounded-card bg-[#141414] border border-finovate-700">#141414 black-850</div>
          <div className="p-5 rounded-card bg-[#262626] text-white">#262626 black-700</div>
          <div className="p-5 rounded-card bg-[#656663] text-white">#656663 grey-500</div>
        </div>
      </section>

      {/* Layer 2: Violet Accent */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-silver-200">Layer 2: Violet Accent (~30%)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-5 rounded-card bg-[#D152F5] text-black font-bold">#D152F5 violet-500</div>
          <div className="p-5 rounded-card bg-[#DD60F7] text-black font-bold">#DD60F7 violet-400</div>
          <div className="p-5 rounded-card bg-[#7F359B] text-white">#7F359B violet-700</div>
          <div className="p-5 rounded-card bg-[#2B0A3D] text-white">#2B0A3D violet-glow</div>
        </div>
      </section>

      {/* Layer 3: Cool Silver */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-silver-200">Layer 3: Cool Silver #E2E8F0 (~10%)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-5 rounded-card bg-[#F1F5F9] text-black">#F1F5F9 silver-100</div>
          <div className="p-5 rounded-card bg-[#E2E8F0] text-black font-bold">#E2E8F0 silver-200</div>
          <div className="p-5 rounded-card bg-[#94A3B8] text-black">#94A3B8 silver-400</div>
          <div className="p-5 rounded-card bg-[#64748B] text-white">#64748B silver-600</div>
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-silver-200">Buttons & Contrast Verification</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button className="px-6 py-3 rounded-btn bg-[#D152F5] text-[#050505] font-semibold text-sm hover:bg-[#DD60F7] shadow-violet-btn transition-all">
            Primary Violet (Dark Text for 16:1 Contrast)
          </button>
          <button className="px-6 py-3 rounded-btn glass-silver-pill text-silver-200 font-semibold text-sm hover:bg-white/10 transition-all">
            Secondary Silver Outline
          </button>
          <Link href="/" className="px-6 py-3 rounded-btn bg-white/5 border border-silver-600/30 text-silver-400 text-sm hover:text-white">
            ← Return to App
          </Link>
        </div>
      </section>
    </div>
  );
}

