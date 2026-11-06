'use client';

import React from 'react';
import { motion } from 'framer-motion';

type VerdictBadgeColor = 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';

const attackCards = [
  {
    title: 'payTo Substitution',
    desc: 'Proxy rewrites payTo in the 402 challenge to attacker address.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '8ms',
    theme: 'light' as const, // Alabaster card
  },
  {
    title: 'Look-alike Origin',
    desc: 'Request appears to originate from researchpr0.eth (digit zero substitution).',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '11ms',
    theme: 'dark' as const,
  },
  {
    title: 'Amount Drift',
    desc: 'Merchant invoices 5 USDC but 402 response requests 500 USDC.',
    verdict: 'HOLD' as VerdictBadgeColor,
    detectedIn: '6ms',
    theme: 'light' as const,
  },
  {
    title: 'Unannounced Rotation',
    desc: 'payTo changed in ENS without timelock proposal on-chain.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '14ms',
    theme: 'dark' as const,
  },
  {
    title: 'Stale Offer Replay',
    desc: '402 challenge nonce is > 90 seconds old. Replay or skew attack.',
    verdict: 'HOLD' as VerdictBadgeColor,
    detectedIn: '3ms',
    theme: 'light' as const,
  },
  {
    title: 'RPC Sybil Attack',
    desc: 'ENS resolution returns divergent values across untrusted RPC nodes.',
    verdict: 'UNVERIFIABLE' as VerdictBadgeColor,
    detectedIn: '—',
    theme: 'dark' as const,
  },
  {
    title: 'Network Rewiring',
    desc: 'payTo valid, but network field diverted from hedera:296 to eth:1.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '7ms',
    theme: 'light' as const,
  },
  {
    title: 'Version Downgrade',
    desc: 'Attacker downgrades x402 header to strip ENS signature verification.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '5ms',
    theme: 'dark' as const,
  },
];

const badgeColors = {
  BLOCK: {
    bg: '#FF3B30',
    text: '#FFFFFF',
    tag: 'DEFENDED · BLOCK',
  },
  HOLD: {
    bg: '#FF9F0A',
    text: '#081014',
    tag: 'TIMELOCK · HOLD',
  },
  UNVERIFIABLE: {
    bg: '#586974',
    text: '#FFFFFF',
    tag: 'UNKNOWN · UNVERIFIABLE',
  },
};

function AttackCard({ card }: { card: typeof attackCards[0] }) {
  const isLight = card.theme === 'light';
  const badge = badgeColors[card.verdict];

  return (
    <div
      className={`
        shrink-0 w-[295px] p-6 rounded-[24px] transition-transform duration-300 cursor-default select-none
        ${isLight
          ? 'bg-[#CAF0F8] text-[#03045E] shadow-[0_15px_35px_-10px_rgba(2,3,59,0.3)] border border-[#90E0EF]'
          : 'bg-[#02033B]/90 text-[#CAF0F8] shadow-[0_20px_40px_-15px_rgba(2,3,59,0.8)] border border-[#0077B6]/40'
        }
        hover:scale-[1.02]
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="inline-flex items-center px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-wider"
          style={{
            backgroundColor: badge.bg,
            color: badge.text,
          }}
        >
          {badge.tag}
        </span>
        <span className={`font-mono text-[11px] ${isLight ? 'text-[#0077B6]' : 'text-[#90E0EF]/60'}`}>
          {card.detectedIn !== '—' ? `${card.detectedIn} lat.` : 'Fail-safe'}
        </span>
      </div>

      <h3 className={`font-title-sans text-base mb-2 ${isLight ? 'text-[#03045E]' : 'text-[#CAF0F8]'}`}>
        {card.title}
      </h3>
      <p className={`text-xs leading-relaxed ${isLight ? 'text-[#0077B6]' : 'text-[#90E0EF]/80'}`}>
        {card.desc}
      </p>
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
    <section className="relative py-32 overflow-hidden bg-[#F8FAFC] text-[#0F172A] border-y border-slate-200/80">
      {/* Background ambient glow */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 mb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-[#1A6CFF]/20">
            Threat Landscape
          </span>
          <h2 className="font-title-sans text-[clamp(32px,4.5vw,56px)] leading-[1.1] font-bold text-[#0F172A] mb-4">
            Every known vector.{' '}
            <em className="font-serif-accent not-italic text-[#1A6CFF]">Every one blocked.</em>
          </h2>
          <p className="text-[#64748B] text-lg max-w-lg mx-auto">
            Alternating threat scenario cards documented from real autonomous agent payment traffic.
          </p>
        </motion.div>
      </div>

      {/* Dual-tone Marquee Rows */}
      <div className="relative space-y-6">
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-[#F8FAFC] to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-[#F8FAFC] to-transparent" />

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
