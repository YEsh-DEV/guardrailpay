'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const headlines = [
  { text: "Your agent's", italic: 'payment guard.', accent: false },
  { text: 'Verified before', italic: 'it signs.', accent: false },
  { text: 'Autonomous,', italic: 'but never blind.', accent: true },
];

const partners = ['Hedera x402', 'ENSv2', 'World ID', 'Sepolia'];

function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % headlines.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const headline = headlines[index];

  if (prefersReduced) {
    return (
      <h1 className="font-title-sans text-[clamp(40px,6.2vw,76px)] font-bold tracking-tight leading-[1.08] text-white mb-6">
        {headlines[0].text}{' '}
        <em className="font-serif-accent not-italic text-white underline decoration-[#CAF0F8]/40">{headlines[0].italic}</em>
      </h1>
    );
  }

  return (
    <div className="relative overflow-hidden h-[clamp(110px,14vw,190px)] mb-6 w-full flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{
            duration: 0.65,
            ease: [0.65, 0, 0.35, 1],
          }}
          className="absolute inset-0 font-title-sans text-[clamp(40px,6.2vw,76px)] font-bold tracking-tight leading-[1.08] text-white flex flex-col items-center justify-center text-center"
        >
          <span className="block drop-shadow-[0_2px_18px_rgba(0,30,100,0.4)]">{headline.text}</span>
          <em className="font-serif-accent not-italic block text-white drop-shadow-[0_2px_24px_rgba(0,30,100,0.5)]">
            {headline.italic}
          </em>
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative px-4 sm:px-6 pt-24 pb-16 bg-[#FFFFFF]">
      {/* Contained Curved Hero Canvas (Gabrun Blueprint) */}
      <div className="relative w-full max-w-[1340px] mx-auto rounded-[36px] sm:rounded-[44px] overflow-hidden bg-gradient-to-b from-[#1A6CFF] via-[#0055E6] to-[#0041B8] text-white shadow-[0_30px_90px_rgba(0,65,184,0.3)]">
        {/* Ambient Top Spotlight Rays & Mesh Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] opacity-40"
            style={{
              background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.7) 0%, rgba(26,108,255,0.1) 60%, transparent 75%)',
              filter: 'blur(70px)',
            }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-[600px] h-[400px] opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(144,224,239,0.5) 0%, transparent 70%)',
              filter: 'blur(90px)',
            }}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center pt-20 sm:pt-28 pb-20 sm:pb-24 px-6 sm:px-10 text-center max-w-4xl mx-auto">
          {/* Top Badge */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-medium tracking-wide mb-8 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>Autonomous x402 Payment Security</span>
          </motion.div>

          {/* Dynamic Headline */}
          <RotatingHeadline />

          {/* Subtitle */}
          <motion.p
            initial={prefersReduced ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="text-white/90 text-lg sm:text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto mb-10 font-normal drop-shadow-[0_1px_8px_rgba(0,30,100,0.3)]"
          >
            QuoteSeal intercepts every x402 micropayment your agent builds — verifying the payee against
            the merchant&apos;s ENSv2 identity on Sepolia before the wallet ever signs.
          </motion.p>

          {/* Input / Action Pill (Gabrun Style Input Container) */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="w-full max-w-md p-1.5 rounded-full bg-white/20 backdrop-blur-xl border border-white/35 flex items-center justify-between shadow-[0_15px_40px_rgba(0,40,140,0.25)] mb-14"
          >
            <span className="pl-5 text-sm font-mono text-white/85 truncate">
              researchpro.eth
            </span>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#1A6CFF] hover:bg-[#F0F5FF] text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
            >
              <span>Get Started</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </motion.div>

          {/* 3 Frosted Floating Mockup Cards (Exactly Like Gabrun Hero Mockups) */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.45 }}
            className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left select-none"
          >
            {/* Card 1: Agent Request */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/80 shadow-[0_20px_45px_rgba(0,30,120,0.18)] text-[#0F172A] transform sm:-translate-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase font-bold text-[#1A6CFF]">AI Agent Intercept</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="font-mono text-xs font-semibold truncate text-[#0F172A]">claude-agent/2.0</p>
              <p className="font-mono text-[11px] text-[#64748B] mt-1">402 challenge verified</p>
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">TICKET</span>
                <span className="font-bold text-[#1A6CFF]">$5.00 USDC</span>
              </div>
            </div>

            {/* Card 2: Center Highlight (ENS Match) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white text-[#0F172A] shadow-[0_25px_60px_rgba(0,30,120,0.3)] border-2 border-white transform sm:scale-105 z-20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  ✓ Verified Match
                </span>
                <span className="font-mono text-[11px] text-slate-400">&lt;9ms</span>
              </div>
              <p className="font-title-sans text-base font-bold text-[#0F172A]">researchpro.eth</p>
              <p className="font-mono text-[11px] text-[#1A6CFF] truncate font-medium">0x71Cf3D14...8f4B</p>
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">RESOLVER</span>
                <span className="font-bold text-[#0F172A]">Sepolia ENSv2</span>
              </div>
            </div>

            {/* Card 3: Hedera Settlement */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/80 shadow-[0_20px_45px_rgba(0,30,120,0.18)] text-[#0F172A] transform sm:-translate-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase font-bold text-[#1A6CFF]">Hedera Consensus</span>
                <span className="text-[10px] font-mono text-slate-400">296</span>
              </div>
              <p className="font-mono text-xs font-semibold text-[#0F172A]">Settlement Confirmed</p>
              <p className="font-mono text-[11px] text-emerald-600 font-semibold mt-1">Signer Invoked (1x)</p>
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">HASHSCAN</span>
                <span className="font-bold text-[#1A6CFF]">tx_9841...82 ↗</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trusted Logos Band Under Hero (Matching Gabrun) */}
      <div className="max-w-5xl mx-auto mt-14 px-4 text-center">
        <p className="font-title-sans text-sm font-semibold text-[#64748B] mb-6 tracking-wide">
          Trusted By More Than <span className="text-[#1A6CFF] font-bold">+10,000 AI Agent Transactions</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {partners.map((partner) => (
            <div
              key={partner}
              className="px-5 py-2 rounded-full bg-slate-50 border border-slate-200/80 font-mono text-xs font-bold text-[#0F172A] shadow-sm hover:border-[#1A6CFF]/50 transition-colors"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
