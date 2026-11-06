'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const attackReviews = [
  {
    id: 1,
    title: 'PayTo Tamper Exploit',
    target: '402 Header Hijacking',
    verdict: 'BLOCKED',
    quote: 'RPC MITM tried swapping payment address to an attacker wallet. GuardRail Pay compared against ENS records and rejected it with 0 gas spent.',
    highlight: 'rejected it with 0 gas spent',
    badgeBg: '#F43F5E',
    badgeText: '#FFFFFF',
  },
  {
    id: 2,
    title: 'Lookalike Origin Spoofing',
    target: 'Domain Impersonation',
    verdict: 'BLOCKED',
    quote: 'Attacker hosted researchpr0.eth with Unicode homoglyphs. Guard flagged origin mismatch before signature prompt.',
    highlight: 'flagged origin mismatch',
    badgeBg: '#F43F5E',
    badgeText: '#FFFFFF',
  },
  {
    id: 3,
    title: 'Unannounced Rotation',
    target: 'Zero Delay Bypass',
    verdict: 'HELD 48H',
    quote: 'A compromised key attempted immediate payout reroute. Time-lock delay triggered emergency alert while agent payments stayed safe.',
    highlight: 'Time-lock delay triggered',
    badgeBg: '#FBBF24',
    badgeText: '#050505',
  },
  {
    id: 4,
    title: 'Amount Inflation Drift',
    target: 'Max Ticket Limit',
    verdict: 'BLOCKED',
    quote: 'Agent asked for 5 USDC, but 402 server billed 500 USDC. Guard caught the policy ceiling violation and halted execution.',
    highlight: 'halted execution',
    badgeBg: '#F43F5E',
    badgeText: '#FFFFFF',
  },
];

export default function FanReviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % attackReviews.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full bg-[#0E0E0E] py-14 md:py-24 px-4 sm:px-6 lg:px-20 overflow-hidden text-[#E2E8F0] border-t border-[#262626]">
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D152F5]/10 border border-[#D152F5]/25 text-[#DD60F7] text-[11px] sm:text-[12px] font-mono uppercase tracking-[0.08em] font-bold mb-3">
          Battle Tested Security
        </span>
        <h2 className="font-title-sans text-[clamp(28px,4.5vw,52px)] leading-[1.05] tracking-[-0.03em] font-bold text-[#FFFFFF] mb-3">
          Real attacks.{' '}
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
            Zero loss.
          </span>
        </h2>
        <p className="text-sm sm:text-base lg:text-lg text-[#94A3B8] max-w-xl mx-auto">
          How GuardRail Pay defends autonomous agents against hostile 402 endpoints and payment manipulation in the wild.
        </p>
      </div>

      {/* Fan Cards Container */}
      <div className="relative max-w-4xl mx-auto h-[440px] flex items-center justify-center">
        {attackReviews.map((item, idx) => {
          const offset = idx - activeIndex;
          const isCenter = offset === 0;

          // Rotation & positioning math for realistic fan
          let rotate = offset * 6;
          let translateX = offset * 140;
          let scale = isCenter ? 1 : 0.88;
          let zIndex = 10 - Math.abs(offset);
          let opacity = Math.abs(offset) > 2 ? 0 : isCenter ? 1 : 0.45;
          let blur = isCenter ? 0 : 3;

          return (
            <motion.div
              key={item.id}
              onClick={() => setActiveIndex(idx)}
              animate={{
                x: translateX,
                rotateZ: rotate,
                scale,
                opacity,
                filter: `blur(${blur}px)`,
                zIndex,
              }}
              transition={{
                duration: 0.65,
                ease: [0.2, 0.8, 0.2, 1],
              }}
              className={`absolute w-[320px] sm:w-[380px] h-[340px] rounded-[32px] p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] cursor-pointer flex flex-col justify-between select-none ${
                isCenter
                  ? 'bg-[#141414] border-2 border-[#D152F5]'
                  : 'bg-[#0E0E0E] border border-[#262626]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[12px] font-mono uppercase tracking-wider font-semibold text-[#94A3B8]">
                    {item.target}
                  </span>
                  <span
                    style={{ backgroundColor: item.badgeBg, color: item.badgeText }}
                    className="text-[11px] font-mono px-3 py-1 rounded-full font-bold shadow-sm"
                  >
                    {item.verdict}
                  </span>
                </div>
                <h3 className="font-title-sans text-[22px] font-bold tracking-tight mb-4 text-[#FFFFFF]">
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-[#94A3B8]">
                  {item.quote.split(item.highlight)[0]}
                  <mark className="bg-[#D152F5]/20 text-[#DD60F7] px-1 py-0.5 rounded font-semibold">
                    {item.highlight}
                  </mark>
                  {item.quote.split(item.highlight)[1]}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#262626] text-[12px] font-mono text-[#64748B]">
                <span>Scenario #{idx + 1}</span>
                <span className="text-[#E2E8F0]">GuardRail Pay Guard Engine</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination indicators */}
      <div className="flex justify-center items-center gap-2 mt-8">
        {attackReviews.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              activeIndex === idx ? 'bg-[#D152F5] w-8' : 'bg-[#262626] hover:bg-[#64748B]'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
