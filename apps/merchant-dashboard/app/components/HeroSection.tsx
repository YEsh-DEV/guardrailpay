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
        <span className="font-medium text-white/95">{headlines[0].italic}</span>
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
          <span className="block font-medium text-white/95 drop-shadow-[0_2px_24px_rgba(0,30,100,0.5)]">
            {headline.italic}
          </span>
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative px-3 sm:px-6 pt-20 sm:pt-24 pb-4 sm:pb-6 bg-[#FFFFFF]">
      {/* Contained Curved Hero Canvas (Gabrun Blueprint) */}
      <div className="relative w-full max-w-[1340px] mx-auto rounded-[28px] sm:rounded-[40px] overflow-hidden bg-gradient-to-b from-[#1A6CFF] via-[#0055E6] to-[#0041B8] text-white shadow-[0_20px_60px_rgba(0,65,184,0.25)]">
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
        <div className="relative z-10 flex flex-col items-center justify-center pt-12 sm:pt-20 pb-12 sm:pb-14 px-4 sm:px-8 text-center max-w-4xl mx-auto">
          {/* Top Badge */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-[11px] sm:text-xs font-medium tracking-wide mb-5 shadow-sm"
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
            className="text-white/85 text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-5 sm:mb-6 font-normal drop-shadow-[0_1px_6px_rgba(0,30,100,0.3)]"
          >
            QuoteSeal intercepts every x402 micropayment your agent builds — verifying the payee against
            the merchant&apos;s ENSv2 identity on Sepolia before the wallet ever signs.
          </motion.p>

          {/* Input / Action Pill (Gabrun Style Input Container - Compact & Sleek) */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="w-full max-w-sm p-1 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-between shadow-[0_10px_25px_rgba(0,40,140,0.2)]"
          >
            <span className="pl-4 text-xs font-mono text-white/90 truncate">
              researchpro.eth
            </span>
            <a
              href="#demo"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#1A6CFF] hover:bg-[#F0F5FF] text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0"
            >
              <span>Get Started</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </motion.div>
        </div>
      </div>

      {/* Trusted Logos Band Under Hero (Matching Gabrun) */}
      <div className="max-w-5xl mx-auto mt-6 sm:mt-8 px-4 text-center">
        <p className="font-title-sans text-xs sm:text-sm font-semibold text-[#64748B] mb-3 tracking-wide">
          Trusted By More Than <span className="text-[#1A6CFF] font-bold">+10,000 AI Agent Transactions</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {partners.map((partner) => (
            <div
              key={partner}
              className="px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 font-mono text-[11px] sm:text-xs font-bold text-[#0F172A] shadow-sm hover:border-[#1A6CFF]/50 transition-colors"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
