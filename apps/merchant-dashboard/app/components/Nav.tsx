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
            ? 'bg-white/85 backdrop-blur-[20px] border border-slate-200/80 shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
            : 'bg-white/95 backdrop-blur-[12px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.05)]'
          }
        `}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A6CFF] to-[#0052E0] flex items-center justify-center shadow-[0_0_18px_rgba(26,108,255,0.4)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5">
              <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#FFFFFF"/>
              <path d="M9 12L11 14L15 10" stroke="#1A6CFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-[#0F172A] group-hover:text-[#1A6CFF] transition-colors">
            QuoteSeal
          </span>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.slice(0, 3).map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors duration-200 font-semibold"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="/merchant"
            className="hidden md:block text-sm text-[#64748B] hover:text-[#0F172A] transition-colors font-semibold"
          >
            Dashboard
          </a>
          <a
            href="#demo"
            className="
              inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold
              bg-[#1A6CFF] text-white hover:bg-[#0052E0]
              shadow-[0_4px_18px_rgba(26,108,255,0.35)]
              hover:shadow-[0_6px_25px_rgba(26,108,255,0.5)]
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
            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-full border border-slate-200 hover:border-slate-400 transition-colors"
            aria-label="Toggle menu"
          >
            <span className={`block w-4 h-0.5 bg-[#0F172A] transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-4 h-0.5 bg-[#0F172A] transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-4 h-0.5 bg-[#0F172A] transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
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
            className="absolute top-full left-4 right-4 mt-2 p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center py-3 px-2 text-base text-[#0F172A] hover:text-[#1A6CFF] border-b border-slate-100 last:border-0 transition-colors font-medium"
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

