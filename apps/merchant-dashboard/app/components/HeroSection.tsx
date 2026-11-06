'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'framer-motion';

const headlines = [
  { text: "Your agent's", italic: 'payment guard.', accent: false },
  { text: 'Verified before', italic: 'it signs.', accent: false },
  { text: 'Autonomous,', italic: 'but never blind.', accent: true },
];

const partners = ['Hedera x402', 'ENSv2', 'World ID', 'Sepolia'];

function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % headlines.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const headline = headlines[index];

  if (prefersReduced) {
    return (
      <h1 className="font-title-sans text-[clamp(44px,7.5vw,96px)] font-bold tracking-tight leading-[1.04] text-white mb-6">
        {headlines[0].text}{' '}
        <em className="font-serif-accent not-italic text-[#2196F3]">{headlines[0].italic}</em>
      </h1>
    );
  }

  return (
    <div className="relative overflow-hidden h-[clamp(120px,16vw,220px)] mb-6 w-full flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{
            duration: 0.65,
            ease: [0.65, 0, 0.35, 1],
          }}
          className="absolute inset-0 font-title-sans text-[clamp(44px,7.5vw,96px)] font-bold tracking-tight leading-[1.04] text-white flex flex-col items-center justify-center text-center"
        >
          <span className="block drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">{headline.text}</span>
          <em
            className={`font-serif-accent not-italic block drop-shadow-[0_4px_30px_rgba(33,150,243,0.35)] ${
              headline.accent ? 'text-[#2196F3]' : 'text-[#90CAF9]'
            }`}
          >
            {headline.italic}
          </em>
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  // Scroll animations for subtle parallax on scroll
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.15]);

  return (
    <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#060E1A] text-white">
      {/* Background Lighting with Sapphire/Electric Azure Glass Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            rotate: [0, 35, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-10%] left-[15%] w-[800px] h-[800px] rounded-full opacity-35"
          style={{
            background: 'radial-gradient(circle, rgba(13,71,161,0.55) 0%, rgba(33,150,243,0.25) 45%, transparent 70%)',
            filter: 'blur(120px)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            rotate: [0, -35, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-15%] right-[10%] w-[750px] h-[750px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(33,150,243,0.45) 0%, rgba(144,202,249,0.18) 55%, transparent 75%)',
            filter: 'blur(130px)',
          }}
        />
      </div>

      {/* Main Content: Full-Width Spread & Centered */}
      <motion.div
        style={{ y: prefersReduced ? 0 : heroY, opacity: prefersReduced ? 1 : heroOpacity }}
        className="relative z-10 flex-1 flex flex-col items-center justify-center pt-36 pb-28 px-6 sm:px-8 md:px-12 max-w-6xl mx-auto w-full text-center"
      >
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="flex flex-col items-center w-full"
        >
          {/* Rotating Headline */}
          <RotatingHeadline />

          {/* Subtitle Paragraph */}
          <motion.p
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-[#90CAF9] text-xl sm:text-2xl md:text-[26px] leading-relaxed max-w-3xl mx-auto mb-12 font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          >
            QuoteSeal intercepts every x402 micropayment your agent builds — verifying the payee against
            the merchant&apos;s ENSv2 identity on Sepolia before the wallet ever signs.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 mb-16"
          >
            <a
              href="#demo"
              className="
                inline-flex items-center gap-2.5 px-10 py-4.5 rounded-full text-base sm:text-lg font-bold
                bg-[#2196F3] text-white
                shadow-[0_0_35px_rgba(33,150,243,0.55)]
                hover:bg-[#1E88E5] hover:shadow-[0_0_55px_rgba(33,150,243,0.85)]
                hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-300
              "
            >
              Launch Live Demo
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a
              href="#features"
              className="
                inline-flex items-center gap-2.5 px-10 py-4.5 rounded-full text-base sm:text-lg font-semibold
                text-[#E3F2FD] glass-pill-dark
                border border-[#2196F3]/30 hover:border-[#90CAF9]/60 hover:bg-[#2196F3]/15
                hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-300
              "
            >
              Explore ENS Rail
            </a>
          </motion.div>

          {/* Protocol Foundations Trust Badges */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex flex-col items-center"
          >
            <p className="font-mono text-xs sm:text-[13px] text-[#90CAF9]/75 uppercase tracking-[0.2em] mb-4">
              Protocol Foundations
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              {partners.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-5 py-2 rounded-full glass-pill-dark font-mono text-xs sm:text-sm text-[#E3F2FD] border border-[#2196F3]/25 hover:border-[#2196F3]/60 hover:text-white transition-all duration-200"
                >
                  {p}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
