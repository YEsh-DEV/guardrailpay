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
    <section className="relative w-full bg-[#0077B6] py-20 px-6 lg:px-20 overflow-hidden flex flex-col items-center justify-center select-none text-[#CAF0F8]">
      {/* Background radial gradient glow for subtle depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,180,216,0.35)_0%,_transparent_75%)] pointer-events-none" />

      {/* Heading */}
      <div className="relative z-10 text-center max-w-2xl mx-auto mb-12">
        <span className="inline-block px-3.5 py-1 rounded-full bg-[#03045E]/30 text-[#CAF0F8] text-[11px] font-mono uppercase tracking-[0.08em] font-semibold mb-3 border border-[#00B4D8]/30">
          The Merchant Identity Card
        </span>
        <h2 className="font-title-sans text-[clamp(30px,3.8vw,48px)] leading-[1.05] tracking-[-0.03em] font-bold text-white mb-3">
          The almighty ENS profile.
        </h2>
        <p className="text-[16px] lg:text-[18px] text-[#CAF0F8]/85 max-w-xl mx-auto leading-relaxed">
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
          className="relative w-[320px] sm:w-[380px] h-[215px] sm:h-[240px] rounded-[24px] p-5 sm:p-6 bg-gradient-to-br from-[#03045E] via-[#02033B] to-[#01021F] border border-[#00B4D8]/35 shadow-[0_35px_80px_rgba(2,3,59,0.7),0_0_0_1px_rgba(144,224,239,0.18)] flex flex-col justify-between text-[#CAF0F8] overflow-hidden"
        >
          {/* Card Holographic Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-[#00B4D8]/[0.15] to-white/0 pointer-events-none" />

          {!isFlipped ? (
            /* FRONT OF CARD */
            <div className="relative h-full flex flex-col justify-between" style={{ backfaceVisibility: 'hidden' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#00B4D8] flex items-center justify-center font-bold text-[#03045E] text-sm shadow-[0_0_15px_#00B4D8]">
                    Q
                  </div>
                  <span className="font-title-sans font-bold text-[17px] tracking-tight text-white">QuoteSeal</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0077B6]/30 backdrop-blur-md border border-[#00B4D8]/30 text-[11px] font-mono text-[#00B4D8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00B4D8] animate-pulse" />
                  <span>x402 Verified</span>
                </div>
              </div>

              <div className="my-auto space-y-1">
                <span className="text-[11px] font-mono text-[#90E0EF]/60 uppercase tracking-widest block">Merchant ENS Name</span>
                <p className="font-title-sans text-[22px] sm:text-[24px] font-bold text-white tracking-tight">
                  researchpro.eth
                </p>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-[#0077B6]/40 font-mono text-[11px]">
                <div>
                  <span className="text-[#90E0EF]/60 block text-[9.5px]">PAYTO ADDRESS</span>
                  <span className="text-[#00B4D8] font-medium tracking-wide">0x71Cf...8f4B</span>
                </div>
                <div>
                  <span className="text-[#90E0EF]/60 block text-[9.5px] text-right">NETWORK</span>
                  <span className="text-[#CAF0F8]">hedera:296</span>
                </div>
                <div>
                  <span className="text-[#90E0EF]/60 block text-[9.5px] text-right">MAX TICKET</span>
                  <span className="text-[#00B4D8] font-semibold">$50.00</span>
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
                <span className="text-[11px] font-mono text-[#90E0EF]/70 uppercase tracking-wider">ENS Text Records v2.4</span>
                <span className="text-[10px] text-[#00B4D8] font-mono bg-[#00B4D8]/15 px-2.5 py-0.5 rounded-full border border-[#00B4D8]/30">
                  Signed & Active
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono bg-[#02033B]/70 p-3 rounded-xl border border-[#0077B6]/30">
                <div className="flex justify-between">
                  <span className="text-[#90E0EF]/60">x402.version:</span>
                  <span className="text-white">2.4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#90E0EF]/60">x402.policy:</span>
                  <span className="text-white">time_lock_48h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#90E0EF]/60">operator.human:</span>
                  <span className="text-[#00B4D8]">World ID Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#90E0EF]/60">contract:</span>
                  <span className="text-[#90E0EF]">0xAuthController.eth</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-[#90E0EF]/60 font-mono">
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
          className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#03045E] text-[#CAF0F8] hover:bg-[#02033B] text-[15px] font-bold transition-all shadow-[0_12px_32px_rgba(2,3,59,0.5)] border border-[#00B4D8]/40 hover:scale-105 active:scale-95"
        >
          <span>Meet QuoteSeal Card</span>
          <span className="text-[#00B4D8]">→</span>
        </a>
      </div>
    </section>
  );
}

