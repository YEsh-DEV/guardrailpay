'use client';

import React from 'react';
import Link from 'next/link';

export default function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 py-5 bg-[#050505]/75 backdrop-blur-xl border-b border-finovate-700/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo Left */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#D152F5] to-[#7F359B] flex items-center justify-center shadow-[0_0_15px_rgba(209,82,245,0.4)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="#050505"/>
              <path d="M9 12L11 14L15 10" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-sans font-bold text-lg text-white tracking-tight group-hover:text-silver-200 transition-colors">
            QuoteSeal
          </span>
        </Link>

        {/* Violet Right CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/merchant"
            className="hidden sm:inline-block px-4 py-2 rounded-btn text-xs font-semibold text-silver-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <a
            href="#demo"
            className="px-5 py-2.5 rounded-btn bg-[#D152F5] hover:bg-[#DD60F7] text-[#050505] font-semibold text-xs tracking-wide shadow-violet-btn hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Explore Now
          </a>
        </div>
      </div>
    </header>
  );
}
