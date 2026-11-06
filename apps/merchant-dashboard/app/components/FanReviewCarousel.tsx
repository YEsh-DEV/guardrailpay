'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const attackReviews = [
  {
    id: 1,
    title: 'PayTo Tamper Exploit',
    target: '402 Header Hijacking',
    verdict: 'BLOCKED',
    quote: 'RPC MITM tried swapping payment address to an attacker wallet. QuoteSeal compared against ENS records and rejected it with 0 gas spent.',
    highlight: 'rejected it with 0 gas spent',
    bg: '#E3F2FD', // Icy Alabaster Frost
    textColor: '#0A192F',
    badgeBg: '#2196F3',
    badgeText: '#FFFFFF',
  },
  {
    id: 2,
    title: 'Lookalike Origin Spoofing',
    target: 'Domain Impersonation',
    verdict: 'BLOCKED',
    quote: 'Attacker hosted researchpr0.eth with Unicode homoglyphs. Guard flagged origin mismatch before signature prompt.',
    highlight: 'flagged origin mismatch',
    bg: '#D0E6FA', // Soft Sky
    textColor: '#0A192F',
    badgeBg: '#FF3B30',
    badgeText: '#FFFFFF',
  },
  {
    id: 3,
    title: 'Unannounced Rotation',
    target: 'Zero Delay Bypass',
    verdict: 'HELD 48H',
    quote: 'A compromised key attempted immediate payout reroute. Time-lock delay triggered emergency alert while agent payments stayed safe.',
    highlight: 'Time-lock delay triggered',
    bg: '#C7E2FE', // Ice Cerulean
    textColor: '#0A192F',
    badgeBg: '#0D47A1',
    badgeText: '#FFFFFF',
  },
  {
    id: 4,
    title: 'Amount Inflation Drift',
    target: 'Max Ticket Limit',
    verdict: 'BLOCKED',
    quote: 'Agent asked for 5 USDC, but 402 server billed 500 USDC. Guard caught the policy ceiling violation and halted execution.',
    highlight: 'halted execution',
    bg: '#EBF5FE', // Pale Frost
    textColor: '#0A192F',
    badgeBg: '#FF3B30',
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
    <section className="relative w-full bg-[#E3F2FD] py-32 px-6 lg:px-20 overflow-hidden text-[#0A192F]">
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-20">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#2196F3]/15 text-[#0D47A1] text-[12px] font-mono uppercase tracking-[0.08em] font-semibold mb-4 border border-[#2196F3]/25">
          Battle Tested Security
        </span>
        <h2 className="font-title-sans text-[clamp(36px,4.5vw,56px)] leading-[1.05] tracking-[-0.03em] font-bold text-[#0A192F] mb-4">
          Real attacks. Zero loss.
        </h2>
        <p className="text-[18px] lg:text-[20px] text-[#3B5A80] max-w-xl mx-auto">
          How QuoteSeal defends autonomous agents against hostile 402 endpoints and payment manipulation in the wild.
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
          let opacity = Math.abs(offset) > 2 ? 0 : isCenter ? 1 : 0.55;
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
              style={{
                backgroundColor: item.bg,
                color: item.textColor,
              }}
              className="absolute w-[320px] sm:w-[380px] h-[340px] rounded-[32px] p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] cursor-pointer flex flex-col justify-between select-none border border-black/5"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[12px] font-mono uppercase tracking-wider font-semibold opacity-60">
                    {item.target}
                  </span>
                  <span
                    style={{ backgroundColor: item.badgeBg, color: item.badgeText }}
                    className="text-[11px] font-mono px-3 py-1 rounded-full font-bold shadow-sm"
                  >
                    {item.verdict}
                  </span>
                </div>
                <h3 className="font-title-sans text-[22px] font-bold tracking-tight mb-4">
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed opacity-80">
                  {item.quote.split(item.highlight)[0]}
                  <mark className="bg-black/10 px-1 py-0.5 rounded font-semibold text-black">
                    {item.highlight}
                  </mark>
                  {item.quote.split(item.highlight)[1]}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/10 text-[12px] font-mono opacity-60">
                <span>Scenario #{idx + 1}</span>
                <span>QuoteSeal Guard Engine</span>
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
              activeIndex === idx ? 'bg-black w-8' : 'bg-black/20 hover:bg-black/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
}

