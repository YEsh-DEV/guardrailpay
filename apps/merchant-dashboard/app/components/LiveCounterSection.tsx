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
    <section className="relative py-32 md:py-44 overflow-hidden bg-[#03045E] text-[#CAF0F8]">
      {/* Background radial glow */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] opacity-25"
          style={{
            background: 'radial-gradient(ellipse, rgba(0,180,216,0.4) 0%, rgba(0,119,182,0.2) 50%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      <div ref={sectionRef} className="max-w-5xl mx-auto px-6 md:px-12 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="mb-8"
        >
          <span className="font-mono text-[11px] text-[#00B4D8] uppercase tracking-widest mb-4 block">
            Live — since you opened this page
          </span>
          <p className="text-[#90E0EF] text-lg mb-12">Payments verified by QuoteSeal Guard</p>
        </motion.div>

        {/* Big counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-flex flex-wrap items-center justify-center font-mono font-semibold text-[clamp(44px,8vw,96px)] text-[#00B4D8] leading-none mb-4 tracking-tight"
          style={{ textShadow: '0 0 60px rgba(0,180,216,0.6), 0 0 20px rgba(0,180,216,0.35)' }}
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
          className="font-mono text-[11px] text-[#90E0EF]/60 uppercase tracking-widest mt-6"
        >
          USDC value · Hedera Testnet · Mock data
        </motion.p>

        {/* Sub stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16"
        >
          {[
            { value: '0', label: 'Missed attacks', color: '#00B4D8' },
            { value: '100%', label: 'Guard coverage', color: '#00B4D8' },
            { value: '<12ms', label: 'Avg verdict time', color: '#90E0EF' },
          ].map((s) => (
            <div key={s.label} className="p-5 rounded-2xl border border-[#0077B6]/30 bg-[#02033B]/60 shadow-[0_10px_25px_rgba(2,3,59,0.5)]">
              <p className="font-mono text-3xl font-semibold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="font-mono text-[11px] text-[#CAF0F8]/80 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

