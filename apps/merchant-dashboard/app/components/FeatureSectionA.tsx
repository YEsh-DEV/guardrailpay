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
    body: "GuardRail Pay resolves the merchant's ENSv2 name in real-time, reading the x402.payTo text record from the on-chain resolver — the single source of truth for the payment address.",
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
      className="relative pt-12 pb-20 md:pt-16 md:pb-28 bg-[#0E0E0E] text-[#E2E8F0] overflow-hidden border-t border-[#262626]"
    >
      {/* Background violet glow ambient */}
      <div className="absolute top-1/4 left-1/4 w-[700px] h-[450px] rounded-full bg-[#D152F5]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-6 sm:px-8 md:px-12 lg:px-16 relative z-10">
        {/* Left-Aligned Header Block spanning length-wise */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-left mb-10 sm:mb-14"
        >
          {/* Protocol Tags */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-5">
            {protocols.map((proto) => (
              <span
                key={proto}
                className="px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#262626] font-mono text-xs font-bold text-[#E2E8F0] shadow-sm hover:border-[#D152F5]/40 transition-colors"
              >
                {proto}
              </span>
            ))}
          </div>

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#D152F5]/10 text-[#DD60F7] font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-[#D152F5]/25">
            Verification Protocol
          </span>

          <h2 className="font-title-sans text-[clamp(28px,3.4vw,52px)] font-bold tracking-tight leading-[1.12] text-[#FFFFFF] mb-4 xl:whitespace-nowrap">
            Get The Most Powerful and{' '}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
              Secure Payment Rail.
            </span>
          </h2>

          <p className="text-[#94A3B8] text-base sm:text-lg leading-relaxed max-w-4xl">
            Autonomous agents shouldn't blind-sign. GuardRail Pay sits directly between the HTTP 402 response and the wallet signer.
          </p>
        </motion.div>

        {/* Full-width Stacked Option Cards Below */}
        <div className="space-y-4">
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
                  ? 'bg-[#141414] border-2 border-[#D152F5] shadow-[0_16px_36px_-10px_rgba(209,82,245,0.2)]'
                  : 'bg-[#0E0E0E] border border-[#262626] hover:bg-[#141414] hover:border-[#64748B]'
              }`}
              onClick={() => setActiveStep(i)}
            >
              <div className="flex gap-4 sm:gap-6 items-start">
                <div
                  className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-mono text-xs sm:text-sm font-bold transition-all ${
                    activeStep === i
                      ? 'bg-gradient-to-br from-[#7F359B] to-[#D152F5] text-white shadow-[0_0_18px_rgba(209,82,245,0.45)]'
                      : 'bg-[#1F1F1F] text-[#94A3B8]'
                  }`}
                >
                  {step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-title-sans text-base sm:text-lg font-bold mb-1.5 transition-colors ${
                      activeStep === i ? 'text-[#FFFFFF]' : 'text-[#94A3B8]'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={`text-sm sm:text-[15px] leading-relaxed transition-colors ${
                      activeStep === i ? 'text-[#E2E8F0]' : 'text-[#64748B]'
                    }`}
                  >
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
