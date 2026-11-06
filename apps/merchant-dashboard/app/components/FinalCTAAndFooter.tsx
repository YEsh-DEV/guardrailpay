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
        inline-flex items-center gap-3 px-10 py-5 rounded-full text-lg font-semibold
        bg-[#00FF59] text-[#081014]
        shadow-[0_0_60px_rgba(0,255,89,0.6),0_0_120px_rgba(0,255,89,0.2)]
        hover:bg-[#9AEA62]
        hover:shadow-[0_0_80px_rgba(0,255,89,0.8),0_0_160px_rgba(0,255,89,0.3)]
        transition-colors duration-300 active:scale-[0.97]
      "
    >
      Get started — it's free
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
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
    <footer className="relative border-t border-white/8 bg-[#05090C]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF59] to-[#00C94C] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,89,0.4)]">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#081014"/>
                  <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="font-display text-lg text-white">QuoteSeal</span>
            </div>
            <p className="text-sm text-[#586974] leading-relaxed max-w-[260px]">
              Payment identity guard for autonomous AI agents. Built on Hedera x402 and ENSv2.
            </p>
            <div className="flex gap-3 mt-6">
              {['GitHub', 'Twitter', 'Discord'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="font-mono text-[11px] text-[#586974] hover:text-white transition-colors px-3 py-1.5 rounded-full border border-white/8 hover:border-white/20"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-4">{heading}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-[#586974] hover:text-white transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="font-mono text-[11px] text-[#586974] pb-8 leading-relaxed max-w-3xl">
          ⚠ Hackathon demo. All transaction data is synthetic test data. World ID proofs are mocked.
          Hedera payments run on testnet (chain ID 296). Do not use in production without an independent security audit.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 gap-4">
          <p className="font-mono text-[11px] text-[#586974]">
            © 2026 QuoteSeal. MIT License. ETHGlobal Mumbai 2026.
          </p>
          <p className="font-mono text-[11px] text-[#586974]">
            Built with Hedera x402 · ENSv2 · World ID
          </p>
        </div>
      </div>
    </footer>
  );
}

