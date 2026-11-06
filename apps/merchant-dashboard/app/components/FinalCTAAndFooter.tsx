'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

function MagneticCTA() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPos({ x: (e.clientX - cx) * 0.3, y: (e.clientY - cy) * 0.3 });
  };

  return (
    <motion.a
      ref={ref}
      href="#demo"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={pos.x === 0 ? { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } : { duration: 0.08 }}
      className="
        inline-flex items-center gap-3 px-9 py-4 rounded-[10px] text-base font-semibold
        bg-[#D152F5] text-[#050505]
        shadow-[0_0_40px_rgba(209,82,245,0.45)]
        hover:bg-[#DD60F7]
        hover:shadow-[0_0_60px_rgba(209,82,245,0.65)]
        transition-all duration-300 active:scale-[0.98]
      "
    >
      Get started — it's free
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </motion.a>
  );
}

const footerLinks = {
  Product: ['How it works', 'The card', 'Demo', 'Merchant dashboard'],
  Developers: ['Documentation', 'GitHub', 'x402 spec', 'ENSv2 guide'],
  Legal: ['Disclaimer', 'Privacy', 'Terms'],
};

export default function FinalCTAAndFooter() {
  return (
    <footer className="relative border-t border-[#262626] bg-[#050505] text-[#E2E8F0]">
      {/* Final CTA Banner */}
      <div className="max-w-5xl mx-auto px-6 py-20 text-center relative z-10">
        <h2 className="font-title-sans text-[clamp(32px,5vw,56px)] font-bold text-[#FFFFFF] tracking-tight leading-[1.08] mb-4">
          Ready to secure your{' '}
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
            autonomous agent rail?
          </span>
        </h2>
        <p className="text-[#94A3B8] text-base sm:text-lg max-w-xl mx-auto mb-8">
          Join thousands already optimizing their agent payments with our trusted, real-time verification protocol.
        </p>
        <MagneticCTA />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 border-t border-[#262626]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7F359B] to-[#D152F5] flex items-center justify-center shadow-[0_0_15px_rgba(209,82,245,0.4)]">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#FFFFFF"/>
                  <path d="M9 12L11 14L15 10" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="font-title-sans text-lg font-bold text-[#FFFFFF]">QuoteSeal</span>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-[260px]">
              Payment identity guard for autonomous AI agents. Built on Hedera x402 and ENSv2.
            </p>
            <div className="flex gap-3 mt-6">
              {['GitHub', 'Twitter', 'Discord'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="font-mono text-[11px] text-[#94A3B8] hover:text-[#FFFFFF] transition-colors px-3 py-1.5 rounded-full border border-[#262626] bg-[#141414] hover:border-[#D152F5]"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <p className="font-mono text-[11px] text-[#DD60F7] uppercase tracking-widest mb-4 font-bold">{heading}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-[#94A3B8] hover:text-[#FFFFFF] transition-colors font-medium">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="font-mono text-[11px] text-[#64748B] pb-8 leading-relaxed max-w-3xl">
          ⚠ Hackathon demo. All transaction data is synthetic test data. World ID proofs are mocked.
          Hedera payments run on testnet (chain ID 296). Do not use in production without an independent security audit.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#262626] gap-4">
          <p className="font-mono text-[11px] text-[#64748B]">
            © 2026 QuoteSeal. MIT License. ETHGlobal Mumbai 2026.
          </p>
          <p className="font-mono text-[11px] text-[#64748B]">
            Built with Hedera x402 · ENSv2 · World ID
          </p>
        </div>
      </div>
    </footer>
  );
}
