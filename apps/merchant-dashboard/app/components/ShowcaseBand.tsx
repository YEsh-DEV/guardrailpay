'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ShowcaseBand() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#F5D3FE] via-[#F1BDFF] to-[#EA9DFD] py-24 sm:py-32 px-6">
      {/* Giant Cropped Watermark Word "QuoteSeal" Behind Monitor (~28vw) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
        <span
          className="font-sans font-black text-[26vw] leading-none tracking-[-0.05em] text-[#EA9DFD]/70 whitespace-nowrap opacity-90"
          style={{ textShadow: '0 20px 60px rgba(127, 53, 155, 0.15)' }}
        >
          QuoteSeal
        </span>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col items-center">
        {/* Monitor Mockup on Ribbed Platform */}
        <div className="w-full max-w-4xl relative">
          {/* Monitor Frame */}
          <div className="rounded-[22px] bg-[#0E0E0E] p-3 sm:p-4 shadow-[0_45px_90px_rgba(43,10,61,0.4),0_0_0_1.5px_rgba(38,38,38,0.8)] border border-finovate-700">
            {/* Inner Monitor Display */}
            <div className="rounded-xl bg-[#050505] border border-finovate-700 overflow-hidden text-silver-200">
              {/* Top Chrome Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0E0E0E] border-b border-finovate-700">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <span className="font-mono text-xs text-silver-400 ml-3">quoteseal.guard // autonomous-node-01</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                  ● ACTIVE ARBITRATION
                </span>
              </div>

              {/* Monitor Screen Dashboard Content */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[#0E0E0E] border border-finovate-700">
                    <p className="font-mono text-xs text-silver-600 mb-1">Total Verified Value</p>
                    <p className="font-sans text-2xl font-bold text-silver-100">$1,842,910.00</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0E0E0E] border border-finovate-700">
                    <p className="font-mono text-xs text-silver-600 mb-1">Pre-flight Latency</p>
                    <p className="font-mono text-2xl font-bold text-[#D152F5]">&lt;12ms</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0E0E0E] border border-finovate-700">
                    <p className="font-mono text-xs text-silver-600 mb-1">Mitigated MITM Attacks</p>
                    <p className="font-sans text-2xl font-bold text-emerald-400">100%</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0E0E0E] border border-finovate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="font-sans text-sm font-semibold text-silver-200">Sepolia ENS Identity Resolver</p>
                    <p className="font-mono text-xs text-silver-400">x402.payTo cryptographically verified against researchpro.eth</p>
                  </div>
                  <button className="px-4 py-2 rounded-btn bg-[#D152F5] text-black font-semibold text-xs shadow-sm hover:bg-[#DD60F7] transition-all">
                    Verify Node
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Monitor Metal Neck & Stand */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-10 bg-gradient-to-b from-[#262626] to-[#141414] border-x border-[#383838]" />
            <div className="w-48 h-3.5 rounded-t-lg bg-[#262626] border border-silver-600/40 shadow-md" />
          </div>

          {/* Ribbed Grooved Platform Deck (Finovate Perspective Architecture) */}
          <div className="w-full mt-2 h-20 rounded-platform bg-[#050505] border border-finovate-700 shadow-2xl relative overflow-hidden flex flex-col justify-center">
            {/* Rib lines */}
            <div className="space-y-1.5 opacity-40 px-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-[1px] bg-gradient-to-r from-transparent via-silver-400 to-transparent" />
              ))}
            </div>
            {/* Subtle bottom warm underglow */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-80 h-12 bg-[#FF3D1F] opacity-20 blur-xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

