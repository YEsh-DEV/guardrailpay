'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Agent requests payment',
    body: 'An AI agent encounters an HTTP 402 response from the merchant endpoint. It reads the x402 Payment-Required header and builds a payment proposal to send USDC on Hedera.',
  },
  {
    num: '02',
    title: 'ENS identity resolved',
    body: "QuoteSeal resolves the merchant's ENSv2 name in real-time, reading the x402.payTo text record from the on-chain resolver — the single source of truth for the payment address.",
  },
  {
    num: '03',
    title: 'Guard runs. Verdict is instant.',
    body: "The guard compares the 402 response's payTo field against the ENS-verified address. Any deviation — by one character — triggers an immediate BLOCK before the wallet signs.",
  },
];

export default function FeatureSectionA() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = React.useState(1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 80%', 'end 20%'],
  });

  const stepProgress = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 2]);

  React.useEffect(() => {
    const unsubscribe = stepProgress.on('change', (v) => {
      setActiveStep(Math.round(v));
    });
    return unsubscribe;
  }, [stepProgress]);

  return (
    <section
      id="features"
      ref={containerRef}
      className="relative py-28 md:py-36 bg-[#FFFFFF] text-[#0F172A] overflow-hidden"
    >
      {/* Soft background blue ambient mesh */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-[#1A6CFF]/5 blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        {/* Editorial Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-[#1A6CFF]/20">
            Verification Protocol
          </span>
          <h2 className="font-title-sans text-[clamp(32px,5vw,60px)] font-bold tracking-tight leading-[1.08] text-[#0F172A] mb-4">
            Get The Most Powerful and{' '}
            <em className="font-serif-accent not-italic text-[#1A6CFF]">Secure Payment Rail.</em>
          </h2>
          <p className="text-[#64748B] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Autonomous agents shouldn't blind-sign. QuoteSeal sits directly between the HTTP 402 response and the wallet signer.
          </p>
        </motion.div>

        {/* Steps Container in full-width Gabrun Card style */}
        <div className="space-y-4 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              animate={{
                opacity: activeStep === i ? 1 : 0.65,
                scale: activeStep === i ? 1 : 0.99,
              }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className={`p-6 sm:p-7 rounded-2xl sm:rounded-3xl transition-all duration-300 cursor-pointer ${
                activeStep === i
                  ? 'bg-white border-2 border-[#1A6CFF] shadow-[0_20px_45px_-10px_rgba(26,108,255,0.18)]'
                  : 'bg-[#F8FAFC] border border-slate-200/80 hover:bg-white hover:border-slate-300'
              }`}
              onClick={() => setActiveStep(i)}
            >
              <div className="flex gap-5 items-start">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                  activeStep === i
                    ? 'bg-[#1A6CFF] text-white shadow-[0_0_20px_rgba(26,108,255,0.45)]'
                    : 'bg-slate-200 text-[#64748B]'
                }`}>
                  {step.num}
                </div>
                <div className="flex-1">
                  <h3 className={`font-title-sans text-lg sm:text-xl font-bold mb-1.5 transition-colors ${
                    activeStep === i ? 'text-[#0F172A]' : 'text-[#64748B]'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm sm:text-base leading-relaxed transition-colors ${
                    activeStep === i ? 'text-[#475569]' : 'text-[#94A3B8]'
                  }`}>
                    {step.body}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
