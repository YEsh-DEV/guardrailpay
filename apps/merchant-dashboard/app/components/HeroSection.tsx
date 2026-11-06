'use client';

import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function HeroSection() {
  const prefersReduced = useReducedMotion();
  const phoneRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || !phoneRef.current) return;
    const rect = phoneRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotate({ x: -y * 12, y: x * 12 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <section className="relative min-h-[92vh] flex items-center pt-32 pb-20 px-6 sm:px-12 bg-[#050505] overflow-hidden">
      {/* Background Soft Violet Radial Glow Behind Device (Layer 2) */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-60">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(209, 82, 245, 0.22) 0%, rgba(43, 10, 61, 0.45) 45%, transparent 75%)',
            filter: 'blur(90px)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
        {/* Left Column: Eyebrow + 3-line Silver Gradient H1 + Paragraph + Violet CTA + Avatar/Partner strip */}
        <div className="lg:col-span-7 space-y-7 text-left">
          {/* Eyebrow */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[12px] uppercase font-mono tracking-[0.12em] text-silver-400 font-semibold"
          >
            SMART, SECURE & SIMPLE.
          </motion.div>

          {/* 3-Line Silver Gradient Headline */}
          <motion.h1
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-silver-gradient font-sans text-[clamp(42px,5.4vw,74px)] font-bold tracking-[-0.03em] leading-[1.05]"
          >
            Your Agent&apos;s<br />
            Gateway to Safer<br />
            Payments.
          </motion.h1>

          {/* Paragraph */}
          <motion.p
            initial={prefersReduced ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="text-silver-400 text-base sm:text-lg max-w-[46ch] leading-relaxed font-normal"
          >
            Join autonomous networks already protecting their transactions with QuoteSeal — verifying the payee against the merchant&apos;s ENSv2 identity before the wallet ever signs.
          </motion.p>

          {/* Violet Primary CTA Button */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.3 }}
            className="flex items-center gap-4 pt-2"
          >
            <a
              href="#demo"
              className="px-8 py-3.5 rounded-btn bg-[#D152F5] hover:bg-[#DD60F7] text-[#050505] font-semibold text-sm shadow-violet-btn hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Get Started
            </a>
            <a
              href="#verification"
              className="px-6 py-3.5 rounded-btn glass-silver-pill text-silver-200 hover:text-white font-medium text-sm transition-all"
            >
              Explore Rail
            </a>
          </motion.div>

          {/* Lower-left Avatar Stack & Stats */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex items-center gap-3.5 pt-4"
          >
            <div className="flex -space-x-2.5">
              {[
                { bg: '#3B82F6', label: 'H' },
                { bg: '#8B5CF6', label: 'E' },
                { bg: '#EC4899', label: 'W' },
                { bg: '#10B981', label: 'S' },
              ].map((av, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#050505] flex items-center justify-center font-mono text-[11px] font-bold text-white shadow-md"
                  style={{ backgroundColor: av.bg }}
                >
                  {av.label}
                </div>
              ))}
            </div>
            <div>
              <p className="font-sans text-xs font-bold text-silver-200 tracking-tight">50K+ Active Investors</p>
              <p className="font-mono text-[10px] text-silver-400">Hedera · ENSv2 · World ID Verified</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Floating 3D Phone with Violet Wave Screen */}
        <div
          ref={phoneRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="lg:col-span-5 flex items-center justify-center relative perspective-[1200px]"
        >
          <motion.div
            animate={
              prefersReduced
                ? {}
                : {
                    rotateX: rotate.x,
                    rotateY: rotate.y,
                    y: [0, -8, 0],
                  }
            }
            transition={{
              y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
              rotateX: { type: 'spring', stiffness: 200, damping: 20 },
              rotateY: { type: 'spring', stiffness: 200, damping: 20 },
            }}
            className="w-[300px] sm:w-[330px] rounded-phone p-[3px] bg-gradient-to-b from-[#262626] via-[#141414] to-[#262626] shadow-[0_30px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(209,82,245,0.25)] select-none"
          >
            {/* Phone Outer Shell Bezel */}
            <div className="w-full rounded-[41px] bg-[#0A0A0A] overflow-hidden border border-white/10 text-white">
              {/* Dynamic Island / Speaker Notch */}
              <div className="flex justify-center pt-3 pb-1 bg-[#7F359B]">
                <div className="w-20 h-4 bg-black/60 rounded-full" />
              </div>

              {/* Top Violet Wave Card Area (Finovate Reference Signature) */}
              <div className="relative pt-3 pb-8 px-5 bg-gradient-to-b from-[#7F359B] to-[#D152F5] text-white">
                <div className="flex items-center justify-between text-xs font-mono opacity-90 mb-3">
                  <span>Hi, James!</span>
                  <span>🔔</span>
                </div>

                <div className="mb-4">
                  <span className="text-xs opacity-75 font-mono">$</span>
                  <span className="text-3xl font-bold font-sans tracking-tight ml-1">3,970</span>
                  <span className="text-sm opacity-75 font-mono">.23</span>
                </div>

                {/* Curved wave mask slicing into the violet header */}
                <div className="absolute -bottom-1 left-0 right-0 h-6 overflow-hidden">
                  <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-[#141414]">
                    <path d="M0.00,49.98 C150.00,150.00 349.20,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
                  </svg>
                </div>
              </div>

              {/* Phone Inner Dashboard Body (#141414) */}
              <div className="p-4 bg-[#141414] space-y-3.5 text-xs">
                {/* Other Accounts Chips */}
                <div>
                  <span className="text-[10px] uppercase font-mono text-silver-600 tracking-wider">Other Accounts</span>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-finovate-700/60 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-silver-400">USDC</span>
                      <span className="font-mono font-bold text-silver-200">869</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-finovate-700/60 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-silver-400">HBAR</span>
                      <span className="font-mono font-bold text-silver-200">231</span>
                    </div>
                  </div>
                </div>

                {/* My Balance Mini Bar */}
                <div className="p-3 rounded-xl bg-[#0E0E0E] border border-finovate-700/60 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-silver-600 tracking-wider">My Balance</span>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-silver-400">$5,500</span>
                    <span className="text-emerald-400 font-bold">PASS ✓</span>
                    <span className="text-silver-200">$3,970</span>
                  </div>
                </div>

                {/* Pending of Payment List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono text-silver-600 tracking-wider">Pending Payment</span>
                  <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-finovate-700/60 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-silver-200 text-[11px]">researchpro.eth</p>
                      <p className="font-mono text-[9px] text-silver-600">Hedera:296 · Verified</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#D152F5]/20 text-[#D152F5] font-mono text-[10px] font-bold">
                      Pay now
                    </span>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="flex justify-center pt-2 pb-1">
                  <div className="w-24 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
