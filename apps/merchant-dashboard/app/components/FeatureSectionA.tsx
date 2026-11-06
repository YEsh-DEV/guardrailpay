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
    <div className="relative w-[280px] lg:w-[320px] select-none">
      {/* Phone outer shell with high-contrast shadow */}
      <div className="relative rounded-[42px] bg-gradient-to-b from-[#1C262C] to-[#0A1115] p-[2.5px] shadow-[0_30px_70px_-15px_rgba(20,30,35,0.4),0_0_0_1px_rgba(0,0,0,0.1)]">
        <div className="rounded-[40px] bg-[#081014] overflow-hidden">
          {/* Dynamic Island */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-[90px] h-[22px] bg-black rounded-full" />
          </div>

          {/* Screen content */}
          <div className="px-4 pb-6 pt-1 min-h-[390px] font-mono text-white">
            {activeStep === 0 && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#00FF59] font-mono uppercase tracking-widest">Incoming 402</span>
                  <span className="text-[10px] text-white/40">hedera:296</span>
                </div>
                <div className="bg-[#0E1920] rounded-2xl p-3.5 border border-white/10 text-[11px] space-y-1.5 shadow-sm">
                  <p><span className="text-[#9AEA62] font-semibold">GET</span> <span className="text-white">/api/research/paid</span></p>
                  <p className="text-white/50">Host: <span className="text-white font-medium">researchpro.eth</span></p>
                  <p className="text-white/50">Agent: <span className="text-[#00F5D4]">claude-agent/2.0</span></p>
                </div>
                <div className="bg-[#0E1920] rounded-2xl p-3.5 border border-white/10 text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-[#FF9F0A]">
                    <span className="font-semibold">HTTP 402 Required</span>
                    <span>$5.00</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 space-y-1 text-white/50">
                    <p>payTo: <span className="text-[#00F5D4] break-all">0x71Cf3D14...8f4B</span></p>
                    <p>asset: <span className="text-white">USDC (0.0.456858)</span></p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-center text-[10px] text-white/40">
                  Passing to QuoteSeal Guard...
                </div>
              </motion.div>
            )}

            {activeStep === 1 && (
              <motion.div
                key="resolve"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#00FF59] font-mono uppercase tracking-widest">ENSv2 Resolution</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Sepolia 11155111</span>
                </div>
                <div className="bg-[#0E1920] rounded-2xl p-4 border border-[#00FF59]/25 text-[11px] space-y-2 shadow-[0_0_20px_rgba(0,255,89,0.1)]">
                  <div className="flex items-center gap-2 text-white font-medium pb-2 border-b border-white/5">
                    <span className="text-[#00FF59]">✓</span>
                    <span>researchpro.eth</span>
                  </div>
                  <div className="space-y-1 text-white/50 text-[10.5px]">
                    <p>x402.payTo: <span className="text-[#00F5D4] font-medium">0x71Cf3D...8f4B</span></p>
                    <p>x402.network: <span className="text-white">hedera:296</span></p>
                    <p>x402.maxAmount: <span className="text-[#9AEA62]">$50.00 USDC</span></p>
                    <p>x402.version: <span className="text-white">v2.4</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#00FF59]/10 border border-[#00FF59]/20 text-[10px] text-[#00FF59]">
                  <span>🔒</span> Cryptographically Bound via RFC /.well-known
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="verdict"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#00FF59] font-mono uppercase tracking-widest">Payee Verification</span>
                  <span className="text-[10px] text-[#00FF59] font-semibold">&lt;9ms latency</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between bg-[#0E1920] p-3 rounded-xl border border-white/10">
                    <span className="text-white/40">402 payTo</span>
                    <span className="text-[#00F5D4] font-medium">0x71Cf...8f4B</span>
                  </div>
                  <div className="flex items-center justify-center py-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#00FF59]/20 text-[#00FF59] text-[10px] font-semibold">
                      ≡ EXACT MATCH
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-[#0E1920] p-3 rounded-xl border border-[#00FF59]/25">
                    <span className="text-white/40">ENS Record</span>
                    <span className="text-[#00F5D4] font-medium">0x71Cf...8f4B</span>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 20 }}
                  className="py-4 rounded-2xl bg-gradient-to-br from-[#00FF59]/20 to-[#00C94C]/10 border border-[#00FF59]/40 text-center shadow-[0_0_35px_rgba(0,255,89,0.25)]"
                >
                  <p className="text-[#00FF59] font-mono text-2xl font-bold mb-0.5">✓ PASS</p>
                  <p className="text-white text-xs font-medium">Signer Invoked · Settle on Hedera</p>
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-3">
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

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const stepProgress = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 0, 1, 2]);

  // Smooth scroll translation & blur transition for phone and text
  const phoneY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1.02, 0.98]);

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
      className="relative bg-[#FAF9F6] text-[#141414] transition-colors duration-500"
      style={{ height: `${steps.length * 100}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* Soft background glow circles & glass mesh */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-100/40 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

          {/* Left — Editorial Steps Text with Glass Focus Cards */}
          <div className="space-y-6 lg:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <span className="font-mono text-xs font-semibold text-[#00C94C] uppercase tracking-widest mb-2 block">
                Verification Protocol
              </span>
              <h2 className="font-title-sans text-[clamp(28px,3.8vw,46px)] leading-[1.1] text-[#141414] mb-2.5">
                Every payment checked against the merchant's{' '}
                <em className="font-serif-accent not-italic text-[#00A33B]">ENS identity.</em>
              </h2>
              <p className="text-[#586974] text-base leading-relaxed max-w-lg">
                Autonomous agents shouldn't blind-sign. QuoteSeal sits directly between the HTTP 402 response and the wallet signer.
              </p>
            </motion.div>

            {/* Steps Container in Glassmorphism style */}
            <div className="space-y-3">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  animate={{
                    opacity: activeStep === i ? 1 : 0.45,
                    scale: activeStep === i ? 1 : 0.98,
                    x: activeStep === i ? 0 : -6,
                  }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className={`p-4 rounded-xl transition-all duration-300 cursor-pointer ${
                    activeStep === i
                      ? 'glass-panel-light border-[#00FF59]/60 shadow-[0_15px_35px_-10px_rgba(0,255,89,0.15)]'
                      : 'bg-white/40 backdrop-blur-md border-white/60 hover:bg-white/70'
                  }`}
                  onClick={() => setActiveStep(i)}
                >
                  <div className="flex gap-3.5 items-start">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      activeStep === i
                        ? 'bg-[#00FF59] text-[#081014] shadow-[0_0_15px_rgba(0,255,89,0.5)]'
                        : 'bg-[#E5E4DA] text-[#586974]'
                    }`}>
                      {step.num}
                    </div>
                    <div>
                      <h3 className={`font-title-sans text-sm font-semibold mb-0.5 transition-colors ${
                        activeStep === i ? 'text-[#141414]' : 'text-[#586974]'
                      }`}>
                        {step.title}
                      </h3>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        activeStep === i ? 'text-[#33321F]' : 'text-[#77766F]'
                      }`}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — sticky phone with scroll translation */}
          <motion.div
            style={{ y: phoneY, scale: phoneScale }}
            className="hidden lg:flex items-center justify-center"
          >
            <PhoneMockup activeStep={activeStep} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
