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
  },
  {
    title: 'Look-alike Origin',
    desc: 'Request appears to originate from researchpr0.eth (digit zero substitution).',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '11ms',
  },
  {
    title: 'Amount Drift',
    desc: 'Merchant invoices 5 USDC but 402 response requests 500 USDC.',
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
    title: 'Stale Offer Replay',
    desc: '402 challenge nonce is > 90 seconds old. Replay or skew attack.',
    verdict: 'HOLD' as VerdictBadgeColor,
    detectedIn: '3ms',
  },
  {
    title: 'RPC Sybil Attack',
    desc: 'ENS resolution returns divergent values across untrusted RPC nodes.',
    verdict: 'UNVERIFIABLE' as VerdictBadgeColor,
    detectedIn: '—',
  },
  {
    title: 'Network Rewiring',
    desc: 'payTo valid, but network field diverted from hedera:296 to eth:1.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '7ms',
  },
  {
    title: 'Version Downgrade',
    desc: 'Attacker downgrades x402 header to strip ENS signature verification.',
    verdict: 'BLOCK' as VerdictBadgeColor,
    detectedIn: '5ms',
  },
];

const badgeColors = {
  BLOCK: {
    bg: '#F43F5E',
    text: '#FFFFFF',
    tag: 'DEFENDED · BLOCK',
    icon: '⛔',
  },
  HOLD: {
    bg: '#FBBF24',
    text: '#050505',
    tag: 'TIMELOCK · HOLD',
    icon: '⏳',
  },
  UNVERIFIABLE: {
    bg: '#64748B',
    text: '#FFFFFF',
    tag: 'UNKNOWN · UNVERIFIABLE',
    icon: '❓',
  },
};

function AttackCard({ card }: { card: typeof attackCards[0] }) {
  const badge = badgeColors[card.verdict];

  return (
    <div
      className="shrink-0 w-[300px] p-6 rounded-[24px] bg-[#141414] border border-[#262626] text-[#E2E8F0] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.85)] hover:border-[#D152F5]/50 hover:scale-[1.02] transition-all duration-300 cursor-default select-none"
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-wider shadow-sm"
          style={{
            backgroundColor: badge.bg,
            color: badge.text,
          }}
        >
          <span>{badge.icon}</span>
          {badge.tag}
        </span>
        <span className="font-mono text-[11px] text-[#94A3B8]">
          {card.detectedIn !== '—' ? `${card.detectedIn} lat.` : 'Fail-safe'}
        </span>
      </div>

      <h3 className="font-title-sans text-base font-bold mb-2 text-[#FFFFFF]">
        {card.title}
      </h3>
      <p className="text-xs leading-relaxed text-[#94A3B8]">
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
    <section className="relative py-12 md:py-24 overflow-hidden bg-[#050505] text-[#E2E8F0] border-t border-[#262626]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10 mb-8 sm:mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D152F5]/10 text-[#DD60F7] font-mono text-xs font-bold uppercase tracking-wider mb-3 border border-[#D152F5]/25">
            Threat Landscape
          </span>
          <h2 className="font-title-sans text-[clamp(28px,4.5vw,52px)] leading-[1.1] font-bold text-[#FFFFFF] mb-3">
            Every known vector.{' '}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
              Every one blocked.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-lg mx-auto">
            Real threat scenarios documented from live autonomous agent payment traffic.
          </p>
        </motion.div>
      </div>

      {/* Dual-tone Marquee Rows */}
      <div className="relative space-y-6">
        <div className="absolute left-0 top-0 bottom-0 w-28 z-10 pointer-events-none bg-gradient-to-r from-[#050505] to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-28 z-10 pointer-events-none bg-gradient-to-l from-[#050505] to-transparent" />

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
