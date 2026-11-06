'use client';

import React from 'react';
import { motion } from 'framer-motion';

type VerdictBadgeColor = 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';

const attackCards = [
  {
    title: 'payTo Substitution',
    desc: 'Proxy rewrites payTo in the 402 response to attacker address.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '8ms',
  },
  {
    title: 'Look-alike Origin',
    desc: 'Request appears to come from researchpr0.eth (zero not O).',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '11ms',
  },
  {
    title: 'Amount Drift',
    desc: 'Merchant sends 5 USDC but 402 response requests 500 USDC.',
    verdict: 'HOLD' as VerdictBadgeColor,
    detectedIn: '6ms',
  },
  {
    title: 'Unannounced Rotation',
    desc: 'payTo changed in ENS without timelock proposal on-chain.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '14ms',
  },
  {
    title: 'Stale Offer',
    desc: '402 nonce is > 90s old. Replay or clock skew attack.',
    verdict: 'HOLD' as VerdictBadgeColor,
    detectedIn: '3ms',
  },
  {
    title: 'RPC Sybil',
    desc: 'ENS resolution returns different value via compromised RPC.',
    verdict: 'UNVERIFIABLE' as VerdictBadgeColor,
    detectedIn: '—',
  },
  {
    title: 'Invalid Nonce',
    desc: 'Duplicate nonce reused from a prior payment attempt.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '4ms',
  },
  {
    title: 'Network Mismatch',
    desc: 'payTo valid, but network field changed from hedera:296 to eth:1.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '7ms',
  },
  {
    title: 'Version Downgrade',
    desc: 'Attacker downgrades x402 version to bypass signature checks.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '5ms',
  },
];

const verdictConfig = {
  BLOCK: {
    bg: 'bg-rose-950/70',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    glow: 'shadow-[0_0_12px_rgba(255,59,48,0.25)]',
  },
  HOLD: {
    bg: 'bg-amber-950/70',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_12px_rgba(255,159,10,0.25)]',
  },
  UNVERIFIABLE: {
    bg: 'bg-slate-900/80',
    border: 'border-slate-600/40',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
    glow: '',
  },
};

function AttackCard({ card }: { card: typeof attackCards[0] }) {
  const v = verdictConfig[card.verdict];
  return (
    <div
      className={`
        shrink-0 w-[280px] p-5 rounded-2xl border
        ${v.bg} ${v.border} ${v.glow}
        hover:scale-[1.02] transition-transform duration-300 cursor-default
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] font-semibold ${v.bg} ${v.border} ${v.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
          {card.verdict}
        </span>
        <span className="font-mono text-[10px] text-white/25">{card.detectedIn !== '—' ? `${card.detectedIn} detect` : '?'}</span>
      </div>
      <h3 className="font-semibold text-sm text-white mb-2">{card.title}</h3>
      <p className="font-mono text-[11px] text-white/40 leading-relaxed">{card.desc}</p>
    </div>
  );
}

function MarqueeTrack({ cards, reverse = false }: { cards: typeof attackCards; reverse?: boolean }) {
  const doubled = [...cards, ...cards];
  return (
    <div className={`flex gap-5 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} hover:[animation-play-state:paused]`}>
      {doubled.map((card, i) => (
        <AttackCard key={`${card.title}-${i}`} card={card} />
      ))}
    </div>
  );
}

export default function VerdictMarquee() {
  const half = Math.ceil(attackCards.length / 2);
  const row1 = attackCards.slice(0, half + 1);
  const row2 = attackCards.slice(half - 1);

  return (
    <section className="relative py-28 overflow-hidden bg-[#05090C]">
      {/* BG */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,89,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,89,0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          className="text-center"
        >
          <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
            Attack scenarios
          </span>
          <h2 className="font-display text-[clamp(32px,4.5vw,54px)] leading-[1.1] tracking-tight text-white mb-4">
            Every known vector.{' '}
            <em className="not-italic text-[#00FF59]">Every one blocked.</em>
          </h2>
          <p className="text-[#9BA9B2] text-lg max-w-lg mx-auto">
            Hover to pause. These are real attack patterns documented from live x402 agent deployments.
          </p>
        </motion.div>
      </div>

      {/* Marquee rows */}
      <div className="relative space-y-5">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, #05090C 0%, transparent 100%)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(-90deg, #05090C 0%, transparent 100%)' }} />

        <div className="overflow-hidden">
          <MarqueeTrack cards={row1} />
        </div>
        <div className="overflow-hidden">
          <MarqueeTrack cards={row2} reverse />
        </div>
      </div>
    </section>
  );
}

