'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ensRecords = [
  { key: 'x402.payTo', value: '0x71Cf3D14...8f4B', color: '#00F5D4' },
  { key: 'x402.network', value: 'hedera:296', color: '#9AEA62' },
  { key: 'x402.maxAmount', value: '50000000 (USDC)', color: '#00FF59' },
  { key: 'x402.asset', value: '0.0.456858 (HBAR)', color: '#9AEA62' },
  { key: 'x402.version', value: 'v2.4', color: '#00F5D4' },
  { key: 'x402.signerCall', value: 'confirmPayTo(bytes32)', color: '#9AEA62' },
  { key: 'email', value: 'admin@researchpro.eth', color: 'rgba(255,255,255,0.4)' },
];

function MerchantCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const rotX = useRef(0);
  const rotY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const sheenX = useRef(50);
  const sheenY = useRef(50);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current || prefersReduced || flipped) return;
      const rect = cardRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      targetX.current = dy * -18;
      targetY.current = dx * 18;
      sheenX.current = 50 + dx * 30;
      sheenY.current = 50 + dy * 30;
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

    const animate = () => {
      if (!prefersReduced && !flipped) {
        rotX.current += (targetX.current - rotX.current) * 0.07;
        rotY.current += (targetY.current - rotY.current) * 0.07;
        if (cardRef.current) {
          cardRef.current.style.transform = `perspective(1000px) rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`;
        }
        if (sheenRef.current) {
          sheenRef.current.style.background = `radial-gradient(circle at ${sheenX.current}% ${sheenY.current}%, rgba(0,245,212,0.18), rgba(0,255,89,0.1) 40%, transparent 70%)`;
        }
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
    };
  }, [flipped]);

  return (
    <div
      data-cursor-card="true"
      className="relative w-[380px] h-[240px] cursor-pointer"
      style={{ perspective: '1200px' }}
      onClick={() => setFlipped((f) => !f)}
    >
      <motion.div
        ref={cardRef}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        className="w-full h-full relative"
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-[28px] overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0D2318] via-[#091C12] to-[#060F09]" />
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,255,89,0.5) 0%, transparent 70%),
                linear-gradient(rgba(0,255,89,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,255,89,0.08) 1px, transparent 1px)`,
              backgroundSize: 'auto, 28px 28px, 28px 28px',
            }}
          />
          <div
            ref={sheenRef}
            className="absolute inset-0 mix-blend-overlay pointer-events-none"
            style={{ transition: 'background 0.1s' }}
          />
          {/* Border */}
          <div className="absolute inset-0 rounded-[28px] border border-white/10 shadow-[0_0_0_1px_rgba(0,255,89,0.15),0_42px_80px_rgba(0,0,0,0.9)]" />

          {/* Content */}
          <div className="relative z-10 p-7 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] text-[#00FF59]/60 uppercase tracking-[0.2em] mb-1">Payment Profile</p>
                <p className="font-display text-2xl text-white leading-tight">researchpro.eth</p>
                <p className="font-mono text-xs text-white/35 mt-0.5">ENSv2 · Sepolia</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#00FF59]/10 border border-[#00FF59]/25 shadow-[0_0_20px_rgba(0,255,89,0.2)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="#00FF59" strokeWidth="1.5" fill="none"/>
                  <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-white/35">payTo</span>
                <span className="text-[#00F5D4]">0x71Cf3D14...8f4B</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-white/35">network</span>
                <span className="text-white">Hedera 296</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] text-white/35 mb-0.5">Max Amount</p>
                <p className="font-mono text-sm text-white font-medium">$50.00 USDC</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-white/35 mb-0.5">Version</p>
                <p className="font-mono text-sm text-white">v2.4</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00FF59]/10 border border-[#00FF59]/25">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF59] animate-pulse" />
                <span className="font-mono text-[10px] text-[#00FF59] font-semibold">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back — ENS Records */}
        <div
          className="absolute inset-0 rounded-[28px] overflow-hidden bg-[#060F09]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute inset-0 border border-[#00FF59]/20 rounded-[28px]" />
          <div className="relative z-10 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] text-[#00FF59]/60 uppercase tracking-[0.2em]">ENS Text Records</p>
              <span className="font-mono text-[9px] text-white/30">researchpro.eth</span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {ensRecords.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                  <span className="text-white/40 shrink-0">{r.key}</span>
                  <span className="truncate" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
            <p className="font-mono text-[9px] text-white/20 mt-4 text-center">Click to flip back</p>
          </div>
        </div>
      </motion.div>

      {/* Flip hint */}
      {!flipped && (
        <div className="absolute -bottom-8 left-0 right-0 flex justify-center">
          <p className="font-mono text-[10px] text-white/25 text-center">Click to reveal ENS records</p>
        </div>
      )}
    </div>
  );
}

export default function FeatureSectionB() {
  return (
    <section id="card" className="relative py-32 md:py-40 overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,89,0.2) 0%, rgba(0,245,212,0.08) 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left — Card 3D */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex items-center justify-center py-12"
          >
            <MerchantCard />
          </motion.div>

          {/* Right — text */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
          >
            <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
              The payment profile
            </span>
            <h2 className="font-title-sans text-[clamp(36px,5vw,56px)] leading-[1.1] text-white mb-6">
              The almighty{' '}
              <em className="font-serif-accent not-italic text-[#00FF59]">merchant card.</em>
            </h2>
            <p className="text-[#9BA9B2] text-lg leading-relaxed mb-8">
              Every merchant's ENSv2 name contains a cryptographically signed payment profile. QuoteSeal
              resolves it on every transaction — network, address, asset, limit, version. Flip the card
              to see the full on-chain record set.
            </p>

            <div className="space-y-4">
              {[
                { icon: '🔐', title: 'Single source of truth', desc: 'payTo lives only in the ENS resolver — not in your code, not in a database.' },
                { icon: '⚡', title: 'Sub-second resolution', desc: 'Cached with TTL-aware invalidation. No latency penalty on the happy path.' },
                { icon: '🔄', title: 'Protected rotation', desc: '48-hour timelock + World ID Agent Pass before any address change activates.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.03] hover:border-[#00FF59]/20 hover:bg-[#00FF59]/[0.03] transition-all duration-300 group">
                  <span className="text-xl mt-0.5">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-white mb-1 group-hover:text-[#9AEA62] transition-colors">{item.title}</p>
                    <p className="text-sm text-[#9BA9B2]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

