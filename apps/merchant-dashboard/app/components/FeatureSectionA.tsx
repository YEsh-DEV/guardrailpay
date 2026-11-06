'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Agent requests payment',
    body: 'An AI agent encounters an HTTP 402 response from the merchant endpoint. It reads the x402 Payment-Required header and builds a payment proposal to send USDC on Hedera.',
    screen: 'request',
  },
  {
    num: '02',
    title: 'ENS identity resolved',
    body: "QuoteSeal resolves the merchant's ENSv2 name in real-time, reading the x402.payTo text record from the on-chain resolver — the single source of truth for the payment address.",
    screen: 'resolve',
  },
  {
    num: '03',
    title: 'Guard runs. Verdict is instant.',
    body: "The guard compares the 402 response's payTo field against the ENS-verified address. Any deviation — by one character — triggers an immediate BLOCK before the wallet signs.",
    screen: 'verdict',
  },
];

function PhoneMockup({ activeStep }: { activeStep: number }) {
  return (
    <div className="relative w-[300px] lg:w-[340px] select-none">
      {/* Phone outer shell */}
      <div className="relative rounded-[44px] bg-gradient-to-b from-[#1A2730] to-[#0E1920] p-[2.5px] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="rounded-[42px] bg-[#060A0D] overflow-hidden">
          {/* Dynamic Island */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-[100px] h-[30px] bg-black rounded-full" />
          </div>

          {/* Screen content */}
          <div className="px-4 pb-8 pt-2 min-h-[460px] font-mono">
            {activeStep === 0 && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <p className="text-[10px] text-[#586974] uppercase tracking-widest">x402 Request</p>
                <div className="bg-[#0E1920] rounded-xl p-3 border border-white/8 text-[11px] space-y-1">
                  <p><span className="text-[#9AEA62]">GET</span> <span className="text-white/60">/api/research/paid</span></p>
                  <p className="text-white/40">Host: researchpro.eth</p>
                  <p className="text-white/40">Agent: claude-agent/2.0</p>
                </div>
                <div className="bg-[#0E1920] rounded-xl p-3 border border-white/8 text-[11px] space-y-1 mt-2">
                  <p className="text-[#586974]">402 Payment Required</p>
                  <p className="text-white/40">payTo: <span className="text-[#00F5D4]">0x71C...8f4B</span></p>
                  <p className="text-white/40">amount: <span className="text-white">5 USDC</span></p>
                  <p className="text-white/40">network: <span className="text-white">hedera:296</span></p>
                </div>
              </motion.div>
            )}

            {activeStep === 1 && (
              <motion.div
                key="resolve"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <p className="text-[10px] text-[#586974] uppercase tracking-widest">ENSv2 Resolution</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    <span className="text-[#00FF59]">✓</span> researchpro.eth found
                  </div>
                  <div className="bg-[#0E1920] rounded-xl p-3 border border-[#00FF59]/20 text-[11px] space-y-1.5">
                    <p className="text-[#9AEA62]">Text Records</p>
                    <p className="text-white/40">x402.payTo: <span className="text-[#00F5D4]">0x71C...8f4B</span></p>
                    <p className="text-white/40">x402.network: <span className="text-white">hedera:296</span></p>
                    <p className="text-white/40">x402.maxAmount: <span className="text-white">50 USDC</span></p>
                    <p className="text-white/40">x402.version: <span className="text-white">v2.4</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#00FF59]/30 to-transparent" />
                    <span className="font-mono text-[9px] text-[#00FF59]/60">Sepolia ENS Verified</span>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#00FF59]/30 to-transparent" />
                  </div>
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="verdict"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <p className="text-[10px] text-[#586974] uppercase tracking-widest">Verdict</p>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between bg-[#0E1920] p-2.5 rounded-lg border border-white/8">
                    <span className="text-white/50">402 payTo</span>
                    <span className="text-[#00F5D4]">0x71C...8f4B</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="text-[#00FF59]/60 text-xs">≡ matches</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#0E1920] p-2.5 rounded-lg border border-[#00FF59]/20">
                    <span className="text-white/50">ENS payTo</span>
                    <span className="text-[#00F5D4]">0x71C...8f4B</span>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
                  className="mt-4 py-4 rounded-2xl bg-[#00FF59]/10 border border-[#00FF59]/30 text-center shadow-[0_0_30px_rgba(0,255,89,0.2)]"
                >
                  <p className="text-[#00FF59] font-mono text-2xl font-semibold mb-1">✓ PASS</p>
                  <p className="text-[#9AEA62] text-[10px] uppercase tracking-wider">Payment authorized</p>
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Home bar */}
          <div className="flex justify-center pb-4">
            <div className="w-28 h-1 bg-white/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeatureSectionA() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = React.useState(0);
  const inView = useInView(containerRef, { amount: 0.2 });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const stepProgress = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 0, 1, 2]);

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
      className="relative"
      style={{ height: `${steps.length * 100}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — steps text */}
          <div className="space-y-10 lg:space-y-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
                How it works
              </span>
              <h2 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.1] tracking-tight text-white mb-4">
                Every payment checked against the merchant's{' '}
                <em className="not-italic text-[#00FF59]">ENS identity.</em>
              </h2>
            </motion.div>

            <div className="space-y-6">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  animate={{
                    opacity: activeStep === i ? 1 : 0.35,
                    x: activeStep === i ? 0 : -8,
                  }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  className="flex gap-5 cursor-pointer"
                  onClick={() => setActiveStep(i)}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 ${
                    activeStep === i
                      ? 'border-[#00FF59] bg-[#00FF59]/15 shadow-[0_0_15px_rgba(0,255,89,0.3)]'
                      : 'border-white/20 bg-white/5'
                  }`}>
                    <span className={`font-mono text-[11px] font-semibold ${activeStep === i ? 'text-[#00FF59]' : 'text-white/40'}`}>
                      {step.num}
                    </span>
                  </div>
                  <div>
                    <h3 className={`font-semibold text-base mb-1 transition-colors ${activeStep === i ? 'text-white' : 'text-white/50'}`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm leading-relaxed transition-colors ${activeStep === i ? 'text-[#9BA9B2]' : 'text-white/25'}`}>
                      {step.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — sticky phone */}
          <div className="hidden lg:flex items-center justify-center">
            <PhoneMockup activeStep={activeStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

