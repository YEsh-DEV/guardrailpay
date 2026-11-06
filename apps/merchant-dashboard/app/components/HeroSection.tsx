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
      <h1 className="font-display text-[clamp(52px,8vw,104px)] leading-[1.0] tracking-[-0.03em] text-white mb-6">
        {headlines[0].text}{' '}
        <em className="not-italic text-[#00FF59]">{headlines[0].italic}</em>
      </h1>
    );
  }

  return (
    <div className="relative overflow-hidden h-[clamp(130px,20vw,255px)] mb-6">
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
          className="absolute inset-0 font-display text-[clamp(52px,8vw,104px)] leading-[1.0] tracking-[-0.03em] text-white"
        >
          <span className="block">{headline.text}</span>
          <em
            className={`not-italic block ${headline.accent ? 'text-[#00FF59]' : 'text-white/90'}`}
          >
            {headline.italic}
          </em>
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

function FloatingCard3D() {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const rotX = useRef(0);
  const rotY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const time = useRef(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current || prefersReduced) return;
      const rect = cardRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      targetX.current = dy * -18;
      targetY.current = dx * 18;
    };

    const handleMouseLeave = () => {
      targetX.current = 0;
      targetY.current = 0;
    };

    const card = cardRef.current;
    if (card) {
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
    }
    document.addEventListener('mousemove', handleMouseMove);

    const animate = (t: number) => {
      time.current = t * 0.001;
      const ambientX = Math.sin(time.current * 0.9) * 4;
      const ambientY = Math.cos(time.current * 0.7) * 4;

      if (!prefersReduced) {
        rotX.current += (targetX.current + ambientX - rotX.current) * 0.06;
        rotY.current += (targetY.current + ambientY - rotY.current) * 0.06;
      }

      if (cardRef.current) {
        cardRef.current.style.transform = `
          perspective(900px)
          rotateX(${rotX.current}deg)
          rotateY(${rotY.current}deg)
          translateZ(0)
        `;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (card) {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
      }
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[400px]">
      {/* Ambient glow rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[340px] h-[340px] rounded-full border border-[#00FF59]/8 animate-pulse-slow" />
        <div className="absolute w-[480px] h-[480px] rounded-full border border-[#00FF59]/4 animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-white/[0.03]" />
      </div>

      {/* The 3D Card */}
      <div
        ref={cardRef}
        className="relative w-[320px] h-[200px] cursor-pointer select-none"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        {/* Card Face */}
        <div className="absolute inset-0 rounded-[24px] overflow-hidden shadow-[0_42px_80px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12)]">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0E2A1A] via-[#0A1F14] to-[#081014]" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,255,89,0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,255,89,0.15) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />

          {/* Holographic sheen */}
          <div className="holo-sheen absolute inset-0 opacity-60" />

          {/* Content */}
          <div className="relative z-10 p-6 h-full flex flex-col justify-between">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] text-[#00FF59]/70 uppercase tracking-widest mb-1">QuoteSeal Guard</p>
                <p className="font-display text-lg text-white leading-tight">researchpro.eth</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#00FF59]/15 border border-[#00FF59]/30 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="none" stroke="#00FF59" strokeWidth="1.5"/>
                  <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Middle — payTo */}
            <div>
              <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1">payTo</p>
              <p className="font-mono text-xs text-[#00F5D4] truncate">0x71Cf3D14...8f4B</p>
            </div>

            {/* Bottom row */}
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1">Network</p>
                <p className="font-mono text-sm text-white">Hedera 296</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1">Max</p>
                <p className="font-mono text-sm text-white">$50 USDC</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00FF59]/15 border border-[#00FF59]/30 text-[#00FF59] font-mono text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF59] animate-pulse" />
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#081014]" />
        {/* Gradient blob */}
        <div
          className="absolute top-[-20%] left-[10%] w-[700px] h-[700px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,89,0.25) 0%, rgba(0,245,212,0.08) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(0,245,212,0.3) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'repeat',
            backgroundSize: '128px',
          }}
        />
      </div>

      {/* Main content grid */}
      <div className="relative z-10 flex-1 flex items-center pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left — text */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <RotatingHeadline />

            <motion.p
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="text-[#9BA9B2] text-lg md:text-xl leading-relaxed max-w-[480px] mb-10"
            >
              QuoteSeal guards every x402 micropayment your AI agent sends — checking the merchant's
              ENS identity before the wallet ever signs. If the payee doesn't match,{' '}
              <span className="text-white font-medium">the payment never leaves.</span>
            </motion.p>

            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65 }}
              className="flex flex-wrap items-center gap-4 mb-12"
            >
              <a
                href="#demo"
                className="
                  inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-base font-semibold
                  bg-[#00FF59] text-[#081014]
                  shadow-[0_0_30px_rgba(0,255,89,0.5),0_4px_15px_rgba(0,0,0,0.4)]
                  hover:bg-[#9AEA62] hover:shadow-[0_0_50px_rgba(0,255,89,0.7)]
                  transition-all duration-300 active:scale-[0.97]
                "
              >
                Try the live demo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a
                href="#features"
                className="
                  inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-base font-medium
                  text-white/80 border border-white/15
                  hover:border-white/35 hover:text-white hover:bg-white/5
                  transition-all duration-300
                "
              >
                See how it works
              </a>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.8 }}
            >
              <p className="font-mono text-[11px] text-[#586974] uppercase tracking-widest mb-3">
                Verified with
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {partners.map((p, i) => (
                  <span
                    key={p}
                    className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] font-mono text-[11px] text-white/50 tracking-wide"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right — 3D card */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative lg:flex lg:items-center lg:justify-center"
          >
            <FloatingCard3D />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="relative z-10 flex flex-col items-center pb-10 gap-2"
      >
        <span className="font-mono text-[10px] text-[#586974] uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="w-[1px] h-10 bg-gradient-to-b from-white/20 to-transparent"
        />
      </motion.div>
    </section>
  );
}

