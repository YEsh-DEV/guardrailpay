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
      <h1 className="font-title-sans text-[clamp(32px,5.5vw,68px)] leading-[1.08] text-white mb-4">
        {headlines[0].text}{' '}
        <em className="font-serif-accent not-italic text-[#2196F3]">{headlines[0].italic}</em>
      </h1>
    );
  }

  return (
    <div className="relative overflow-hidden h-[clamp(90px,12vw,160px)] mb-4">
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
          className="absolute inset-0 font-title-sans text-[clamp(32px,5.5vw,68px)] leading-[1.08] text-white"
        >
          <span className="block">{headline.text}</span>
          <em
            className={`font-serif-accent not-italic block ${
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

function FloatingCard3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const rotX = useRef(0);
  const rotY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const time = useRef(0);
  const isInsideCircle = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || prefersReduced) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

      if (dist <= radius) {
        isInsideCircle.current = true;
        const dx = (e.clientX - cx) / radius;
        const dy = (e.clientY - cy) / radius;
        targetX.current = dy * -22;
        targetY.current = dx * 22;
      } else {
        isInsideCircle.current = false;
        targetX.current = 0;
        targetY.current = 0;
      }
    };

    const handleMouseLeave = () => {
      isInsideCircle.current = false;
      targetX.current = 0;
      targetY.current = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    const animate = (t: number) => {
      time.current = t * 0.001;
      const ambientX = Math.sin(time.current * 0.9) * 3;
      const ambientY = Math.cos(time.current * 0.7) * 3;

      if (!prefersReduced) {
        const easing = isInsideCircle.current ? 0.08 : 0.04;
        rotX.current += (targetX.current + ambientX - rotX.current) * easing;
        rotY.current += (targetY.current + ambientY - rotY.current) * easing;
      }

      if (cardRef.current) {
        cardRef.current.style.transform = `
          perspective(900px)
          rotateX(${rotX.current}deg)
          rotateY(${rotY.current}deg)
          translateZ(0)
        `;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[360px] lg:min-h-[420px]">
      {/* Interactive circular zone surrounding the card */}
      <div
        ref={containerRef}
        data-cursor-card="true"
        className="relative flex items-center justify-center w-[360px] sm:w-[420px] h-[360px] sm:h-[420px] rounded-full cursor-pointer select-none group"
      >
        {/* Ambient background glow rings surrounding the card */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Small inner circle directly surrounding the card */}
          <div className="w-[280px] sm:w-[320px] h-[280px] sm:h-[320px] rounded-full border border-[#00FF59]/20 group-hover:border-[#00FF59]/50 group-hover:shadow-[0_0_35px_rgba(0,255,89,0.22)] transition-all duration-500 animate-pulse-slow" />
          {/* Middle ring */}
          <div className="absolute w-[360px] sm:w-[420px] h-[360px] sm:h-[420px] rounded-full border border-[#00FF59]/10 group-hover:border-[#00FF59]/30 transition-all duration-500 animate-pulse-slow" style={{ animationDelay: '1s' }} />
          {/* Outer ring */}
          <div className="absolute w-[440px] sm:w-[500px] h-[440px] sm:h-[500px] rounded-full border border-white/[0.04] group-hover:border-white/[0.08] transition-all duration-500" />
        </div>

        {/* The 3D Card with pure white & holographic sheen */}
        <div
          ref={cardRef}
          className="relative z-10 w-[300px] sm:w-[330px] h-[195px] sm:h-[210px] select-none"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
        <div className="absolute inset-0 rounded-[24px] overflow-hidden shadow-[0_35px_70px_-15px_rgba(2,6,23,0.9),0_0_0_1px_rgba(144,202,249,0.2)] bg-gradient-to-br from-[#0D47A1] via-[#092B66] to-[#060E1A]">
          {/* Holographic sheen overlay */}
          <div className="holo-sheen absolute inset-0 opacity-60" />

          {/* Card Content */}
          <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col justify-between">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[9.5px] text-[#90CAF9] uppercase tracking-widest mb-0.5 font-semibold">QuoteSeal Protected</p>
                <p className="font-title-sans text-lg sm:text-xl text-white">researchpro.eth</p>
                <p className="font-mono text-[10px] text-white/50">Sepolia ENSv2</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#90CAF9]/30 flex items-center justify-center shadow-inner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" fill="none" stroke="#2196F3" strokeWidth="2"/>
                  <path d="M9 12L11 14L15 10" stroke="#90CAF9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Middle row */}
            <div>
              <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1">Active Payout payTo</p>
              <p className="font-mono text-xs text-[#90CAF9] font-semibold truncate">0x71Cf3D14...8f4B</p>
            </div>

            {/* Bottom row */}
            <div className="flex items-end justify-between pt-2 border-t border-white/10">
              <div>
                <p className="font-mono text-[10px] text-white/40 uppercase">Network</p>
                <p className="font-mono text-xs text-white font-medium">Hedera:296</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-white/40 uppercase">Max Cap</p>
                <p className="font-mono text-xs text-[#90CAF9] font-bold">$50.00 USDC</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2196F3]/25 border border-[#2196F3]/45 text-white font-mono text-[10px] font-bold shadow-[0_0_12px_rgba(33,150,243,0.35)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2196F3] animate-pulse" />
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  // Scroll animations for glassmorphism layer depth
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const cardScale = useTransform(scrollYProgress, [0, 1], [1, 0.88]);

  return (
    <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden bg-[#000000] text-white">
      {/* Background Lighting with Cerulean & Sapphire Glass Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            rotate: [0, 45, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-10%] left-[15%] w-[750px] h-[750px] rounded-full opacity-35"
          style={{
            background: 'radial-gradient(circle, rgba(33,150,243,0.38) 0%, rgba(13,71,161,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -40, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-15%] right-[5%] w-[650px] h-[650px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,202,249,0.32) 0%, rgba(33,150,243,0.15) 60%, transparent 70%)',
            filter: 'blur(110px)',
          }}
        />
      </div>

      {/* Main Content with Scroll Transform */}
      <motion.div
        style={{ y: prefersReduced ? 0 : heroY, opacity: prefersReduced ? 1 : heroOpacity }}
        className="relative z-10 flex-1 flex items-center pt-28 pb-16 px-6 md:px-12 max-w-7xl mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
          {/* Left: Text */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <RotatingHeadline />

            <motion.p
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-[#9BA9B2] text-lg md:text-xl leading-relaxed max-w-[500px] mb-10"
            >
              QuoteSeal intercepts every x402 micropayment your agent builds — verifying the payee against
              the merchant's ENSv2 identity on Sepolia before the wallet ever signs.
            </motion.p>

            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="flex flex-wrap items-center gap-4 mb-12"
            >
              <a
                href="#demo"
                className="
                  inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-bold
                  bg-[#2196F3] text-white
                  shadow-[0_0_35px_rgba(33,150,243,0.55)]
                  hover:bg-[#1E88E5] hover:shadow-[0_0_55px_rgba(33,150,243,0.75)]
                  transition-all duration-300 active:scale-[0.98]
                "
              >
                Launch Live Demo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a
                href="#features"
                className="
                  inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold
                  text-white glass-pill-dark
                  hover:border-[#90CAF9]/50 hover:bg-[#90CAF9]/10
                  transition-all duration-300
                "
              >
                Explore ENS Rail
              </a>
            </motion.div>

            {/* Trust Badges in Glass Pills */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7 }}
            >
              <p className="font-mono text-xs text-[#586974] uppercase tracking-widest mb-3">
                Protocol Foundations
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                {partners.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center px-4 py-1.5 rounded-full glass-pill-dark font-mono text-xs text-white/80 hover:border-[#00FF59]/40 transition-colors"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right: 3D Sealed Quote with Glassmorphism Scale */}
          <motion.div
            style={{ scale: prefersReduced ? 1 : cardScale }}
            initial={prefersReduced ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="relative lg:flex lg:items-center lg:justify-center"
          >
            <FloatingCard3D />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
