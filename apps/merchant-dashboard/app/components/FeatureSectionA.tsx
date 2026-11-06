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

const protocols = ['Hedera x402', 'ENSv2', 'World ID', 'Sepolia'];

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
      className="relative pt-6 pb-12 md:pt-10 md:pb-16 bg-[#FFFFFF] text-[#0F172A] overflow-hidden"
    >
      {/* Soft background blue ambient mesh */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[400px] rounded-full bg-[#1A6CFF]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Left Column: Protocol tags, badge, editorial headline and description */}
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="lg:col-span-5 text-left"
          >
            {/* Protocol Tags Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {protocols.map((proto) => (
                <span
                  key={proto}
                  className="px-3.5 py-1 rounded-full bg-slate-50 border border-slate-200 font-mono text-[11px] font-bold text-[#0F172A] shadow-sm"
                >
                  {proto}
                </span>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-[#1A6CFF]/20">
              Verification Protocol
            </span>

            <h2 className="font-title-sans text-[clamp(28px,3.8vw,48px)] font-bold tracking-tight leading-[1.1] text-[#0F172A] mb-4">
              Get The Most Powerful and{' '}
              <span className="font-medium text-[#1A6CFF]">Secure Payment Rail.</span>
            </h2>

            <p className="text-[#64748B] text-sm sm:text-base leading-relaxed max-w-lg">
              Autonomous agents shouldn't blind-sign. QuoteSeal sits directly between the HTTP 402 response and the wallet signer.
            </p>
          </motion.div>

          {/* Right Column: Step Option Cards (Split Screen) */}
          <motion.div
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="lg:col-span-7 space-y-3.5"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                animate={{
                  opacity: activeStep === i ? 1 : 0.7,
                  scale: activeStep === i ? 1 : 0.99,
                }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className={`p-4 sm:p-5 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeStep === i
                    ? 'bg-white border-2 border-[#1A6CFF] shadow-[0_12px_30px_-8px_rgba(26,108,255,0.18)]'
                    : 'bg-[#F8FAFC] border border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
                onClick={() => setActiveStep(i)}
              >
                <div className="flex gap-4 items-start">
                  <div
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      activeStep === i
                        ? 'bg-[#1A6CFF] text-white shadow-[0_0_15px_rgba(26,108,255,0.45)]'
                        : 'bg-slate-200 text-[#64748B]'
                    }`}
                  >
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-title-sans text-base font-bold mb-1 transition-colors ${
                        activeStep === i ? 'text-[#0F172A]' : 'text-[#64748B]'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`text-xs sm:text-sm leading-relaxed transition-colors ${
                        activeStep === i ? 'text-[#475569]' : 'text-[#94A3B8]'
                      }`}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
