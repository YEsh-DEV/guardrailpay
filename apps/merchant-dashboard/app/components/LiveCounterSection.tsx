'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function OdometerDigit({ digit }: { digit: string }) {
  const isNumeric = /\d/.test(digit);
  if (!isNumeric) {
    return <span className="font-mono text-[#90E0EF]">{digit}</span>;
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
    <section className="relative py-10 md:py-14 overflow-hidden bg-[#FFFFFF] text-[#0F172A] border-t border-slate-200/80">
      {/* Background radial glow */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] opacity-10"
          style={{
            background: 'radial-gradient(ellipse, rgba(26,108,255,0.2) 0%, transparent 70%)',
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
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#1A6CFF]/20">
            Live — since you opened this page
          </span>
          <p className="text-[#64748B] text-xs sm:text-sm mb-4">Payments verified by QuoteSeal Guard</p>
        </motion.div>

        {/* Big counter - Made smaller and sleeker */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-flex flex-wrap items-center justify-center font-mono font-semibold text-[clamp(28px,4.5vw,52px)] text-[#1A6CFF] leading-none mb-2 tracking-tight"
          style={{ textShadow: '0 8px 24px rgba(26,108,255,0.2)' }}
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
          className="font-mono text-[9px] sm:text-[10px] text-[#94A3B8] uppercase tracking-widest mt-2"
        >
          USDC value · Hedera Testnet · Mock data
        </motion.p>

        {/* Sub stats - Made compact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8 max-w-2xl mx-auto"
        >
          {[
            { value: '0', label: 'Missed attacks', color: '#1A6CFF' },
            { value: '100%', label: 'Guard coverage', color: '#1A6CFF' },
            { value: '<12ms', label: 'Avg verdict time', color: '#0052E0' },
          ].map((s) => (
            <div key={s.label} className="p-3 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <p className="font-mono text-lg sm:text-xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
              <p className="font-mono text-[9px] sm:text-[10px] text-[#64748B] uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

