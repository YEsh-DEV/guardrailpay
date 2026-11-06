'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'How it works', href: '#features' },
  { label: 'The card', href: '#card' },
  { label: 'Demo', href: '#demo' },
  { label: 'Dashboard', href: '/merchant' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 50) {
        setScrolled(false);
        setHidden(false);
      } else {
        setScrolled(true);
        if (currentY > lastScrollY.current + 10) {
          setHidden(true);
          setMobileOpen(false);
        } else if (currentY < lastScrollY.current - 5) {
          setHidden(false);
        }
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{
        y: hidden ? -100 : 0,
        opacity: hidden ? 0 : 1,
      }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-4 pt-4"
    >
      <nav
        className={`
          relative flex items-center justify-between gap-8 w-full max-w-6xl px-6 py-3 rounded-full
          transition-all duration-500
          ${scrolled
            ? 'bg-[rgba(8,16,20,0.80)] backdrop-blur-[20px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
            : 'bg-transparent border border-white/0'
          }
        `}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF59] to-[#00C94C] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,89,0.5)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5">
              <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#081014"/>
              <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-display text-lg font-normal tracking-tight text-white group-hover:text-[#00FF59] transition-colors">
            QuoteSeal
          </span>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.slice(0, 3).map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[#9BA9B2] hover:text-white transition-colors duration-200 font-medium"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="/merchant"
            className="hidden md:block text-sm text-[#9BA9B2] hover:text-white transition-colors font-medium"
          >
            Dashboard
          </a>
          <a
            href="#demo"
            className="
              inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold
              bg-[#00FF59] text-[#081014] hover:bg-[#9AEA62]
              shadow-[0_0_20px_rgba(0,255,89,0.35)]
              hover:shadow-[0_0_30px_rgba(0,255,89,0.6)]
              transition-all duration-300 ease-out
              active:scale-[0.97]
            "
          >
            <span>Launch demo</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-full border border-white/15 hover:border-white/30 transition-colors"
            aria-label="Toggle menu"
          >
            <span className={`block w-4 h-0.5 bg-white transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-4 h-0.5 bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-4 h-0.5 bg-white transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-4 right-4 mt-2 p-4 rounded-2xl bg-[rgba(14,23,29,0.95)] backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center py-3 px-2 text-base text-white/80 hover:text-white border-b border-white/5 last:border-0 transition-colors"
              >
                {link.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

