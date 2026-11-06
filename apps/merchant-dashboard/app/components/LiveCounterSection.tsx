'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function OdometerDigit({ digit }: { digit: string }) {
  const isNumeric = /\d/.test(digit);
  if (!isNumeric) {
    return <span className="font-mono text-[#D152F5]">{digit}</span>;
  }
  return (
    <span className="inline-block overflow-hidden h-[1.1em] leading-[1.1em] align-bottom">
      <motion.span
        key={digit}
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.25, ease: [0.65, 0, 0.35, 1] }}
        className="inline-block"
      >
        {digit}
      </motion.span>
    </span>
  );
}

function formatWithCommas(n: number): string {
  const [whole, dec] = n.toFixed(5).split('.');
  const withCommas = parseInt(whole).toLocaleString('en-US');
  return `$${withCommas}.${dec}`;
}

export default function LiveCounterSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: false, amount: 0.4 });
  const [count, setCount] = useState(1_842_910.00000);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;

    // Count up: ~$0.000003 per millisecond = $0.18/min (demo rate)
    const ratePerMs = 0.0000031;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      setCount(1_842_910 + elapsed * ratePerMs);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [inView]);

  const formatted = formatWithCommas(count);
  const digits = formatted.split('');

  return (
    <section className="relative py-12 md:py-20 overflow-hidden bg-[#0E0E0E] text-[#E2E8F0] border-t border-[#262626]">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] opacity-15"
          style={{
            background: 'radial-gradient(ellipse, rgba(209,82,245,0.25) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      <div ref={sectionRef} className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="mb-4"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#D152F5]/10 text-[#DD60F7] font-mono text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#D152F5]/25">
            Live — since you opened this page
          </span>
          <p className="text-[#94A3B8] text-xs sm:text-sm mb-4">Payments verified by GuardRail Pay Guard</p>
        </motion.div>

        {/* Big counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-flex flex-wrap items-center justify-center font-mono font-semibold text-[clamp(28px,4.5vw,52px)] text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#E2E8F0] to-[#DD60F7] leading-none mb-2 tracking-tight"
          style={{ textShadow: '0 8px 30px rgba(209,82,245,0.25)' }}
        >
          {digits.map((d, i) => (
            <OdometerDigit key={`${i}`} digit={d} />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="font-mono text-[9px] sm:text-[10px] text-[#64748B] uppercase tracking-widest mt-2"
        >
          USDC value · Hedera Testnet · Mock data
        </motion.p>

        {/* Sub stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8 max-w-2xl mx-auto"
        >
          {[
            { value: '0', label: 'Missed attacks', color: '#34D399' },
            { value: '100%', label: 'Guard coverage', color: '#D152F5' },
            { value: '<12ms', label: 'Avg verdict time', color: '#E2E8F0' },
          ].map((s) => (
            <div key={s.label} className="p-3 sm:p-4 rounded-xl border border-[#262626] bg-[#141414] shadow-sm">
              <p className="font-mono text-lg sm:text-xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
              <p className="font-mono text-[9px] sm:text-[10px] text-[#94A3B8] uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
