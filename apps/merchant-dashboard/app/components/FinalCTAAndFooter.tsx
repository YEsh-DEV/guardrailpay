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
    <>
      {/* Final CTA */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[#060D10]" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(0,255,89,0.35) 0%, rgba(0,245,212,0.08) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Animated border frame */}
        <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10 text-center">
          <div className="relative p-12 md:p-20 rounded-[48px] border border-white/8 overflow-hidden">
            {/* Animated gradient border */}
            <div
              className="absolute inset-0 rounded-[48px] opacity-30"
              style={{
                background: 'conic-gradient(from 180deg at 50% 50%, #00FF59 0deg, transparent 60deg, transparent 300deg, #00F5D4 360deg)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                padding: '1px',
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.8 }}
            >
              <p className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-6">
                Start building with QuoteSeal
              </p>
              <h2 className="font-title-sans text-[clamp(40px,6vw,76px)] leading-[1.0] text-white mb-6">
                Your agents deserve{' '}
                <em className="font-serif-accent not-italic text-[#00FF59]">better guards.</em>
              </h2>
              <p className="text-[#9BA9B2] text-xl max-w-xl mx-auto mb-12 leading-relaxed">
                Drop QuoteSeal into any x402 agent workflow. Zero infrastructure changes. Full ENS verification in one import.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <MagneticCTA />
                <a
                  href="https://github.com/quoteseal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-8 py-5 rounded-full text-lg font-medium text-white/80 border border-white/15 hover:border-white/40 hover:text-white hover:bg-white/5 transition-all duration-300"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </motion.div>
          </div>

          {/* Disclaimer */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="font-mono text-[11px] text-[#586974] mt-10 leading-relaxed max-w-2xl mx-auto"
          >
            ⚠ Hackathon demo. All transaction data is synthetic test data. World ID proofs are mocked.
            Hedera payments run on testnet (chain ID 296). Do not use in production without an independent security audit.
          </motion.p>
        </div>
      </section>

      {/* Footer */}
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
    </>
  );
}

