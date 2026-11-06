'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function GreenCardBand() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // 3D Tilt values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [18, -18]), {
    damping: 25,
    stiffness: 220,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-22, 22]), {
    damping: 25,
    stiffness: 220,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const xPct = (e.clientX - rect.left) / width - 0.5;
    const yPct = (e.clientY - rect.top) / height - 0.5;
    mouseX.set(xPct);
    mouseY.set(yPct);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section className="relative w-full bg-[#00FF59] py-20 px-6 lg:px-20 overflow-hidden flex flex-col items-center justify-center select-none text-black">
      {/* Background radial gradient glow for subtle depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.22)_0%,_transparent_75%)] pointer-events-none" />

      {/* Heading */}
      <div className="relative z-10 text-center max-w-2xl mx-auto mb-12">
        <span className="inline-block px-3.5 py-1 rounded-full bg-black/10 text-black text-[11px] font-mono uppercase tracking-[0.08em] font-semibold mb-3">
          The Merchant Identity Card
        </span>
        <h2 className="font-title-sans text-[clamp(30px,3.8vw,48px)] leading-[1.05] tracking-[-0.03em] font-bold text-black mb-3">
          The almighty ENS profile.
        </h2>
        <p className="text-[16px] lg:text-[18px] text-black/75 max-w-xl mx-auto leading-relaxed">
          Every autonomous agent verifies the cryptographic seal before sending a single penny. Tap to inspect the on-chain records.
        </p>
      </div>

      {/* Interactive 3D Card Area */}
      <div
        className="relative z-10 perspective-[1200px] cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          ref={cardRef}
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
          animate={{
            rotateY: isFlipped ? 180 : 0,
          }}
          transition={{
            duration: 0.75,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          className="relative w-[320px] sm:w-[380px] h-[215px] sm:h-[240px] rounded-[24px] p-5 sm:p-6 bg-gradient-to-br from-[#121417] via-[#080A0C] to-[#040608] border border-white/15 shadow-[0_35px_80px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col justify-between text-white overflow-hidden"
        >
          {/* Card Holographic Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.08] to-white/0 pointer-events-none" />

          {!isFlipped ? (
            /* FRONT OF CARD */
            <div className="relative h-full flex flex-col justify-between" style={{ backfaceVisibility: 'hidden' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#00FF59] flex items-center justify-center font-bold text-black text-sm shadow-[0_0_15px_#00FF59]">
                    Q
                  </div>
                  <span className="font-title-sans font-bold text-[17px] tracking-tight text-white">QuoteSeal</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-mono text-[#00FF59]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF59] animate-pulse" />
                  <span>x402 Verified</span>
                </div>
              </div>

              <div className="my-auto space-y-1">
                <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest block">Merchant ENS Name</span>
                <p className="font-title-sans text-[22px] sm:text-[24px] font-bold text-white tracking-tight">
                  researchpro.eth
                </p>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-white/10 font-mono text-[11px]">
                <div>
                  <span className="text-white/40 block text-[9.5px]">PAYTO ADDRESS</span>
                  <span className="text-[#00F5D4] font-medium tracking-wide">0x71Cf...8f4B</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9.5px] text-right">NETWORK</span>
                  <span className="text-[#9AEA62]">hedera:296</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9.5px] text-right">MAX TICKET</span>
                  <span className="text-white font-semibold">$50.00</span>
                </div>
              </div>
            </div>
          ) : (
            /* BACK OF CARD */
            <div
              className="relative h-full flex flex-col justify-between [transform:rotateY(180deg)]"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">ENS Text Records v2.4</span>
                <span className="text-[10px] text-[#00FF59] font-mono bg-[#00FF59]/10 px-2.5 py-0.5 rounded-full">
                  Signed & Active
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="flex justify-between">
                  <span className="text-white/40">x402.version:</span>
                  <span className="text-white">2.4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">x402.policy:</span>
                  <span className="text-white">time_lock_48h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">operator.human:</span>
                  <span className="text-[#00FF59]">World ID Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">contract:</span>
                  <span className="text-[#00F5D4]">0xAuthController.eth</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-white/40 font-mono">
                Click anywhere to flip front
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* CTA Button below card */}
      <div className="relative z-10 mt-12 text-center">
        <a
          href="/merchant"
          className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-black text-white hover:bg-black/85 text-[15px] font-medium transition-all shadow-[0_12px_32px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95"
        >
          <span>Meet QuoteSeal Card</span>
          <span className="text-white/60">→</span>
        </a>
      </div>
    </section>
  );
}

