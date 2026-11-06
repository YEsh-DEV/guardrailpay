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
      <div className="relative rounded-[42px] bg-gradient-to-b from-[#0077B6] to-[#02033B] p-[2.5px] shadow-[0_30px_70px_-15px_rgba(2,3,59,0.7),0_0_0_1px_rgba(0,180,216,0.3)]">
        <div className="rounded-[40px] bg-[#03045E] overflow-hidden">
          {/* Dynamic Island */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-[90px] h-[22px] bg-[#02033B] rounded-full" />
          </div>

          {/* Screen content */}
          <div className="px-4 pb-6 pt-1 min-h-[390px] font-mono text-[#CAF0F8]">
            {activeStep === 0 && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#00B4D8] font-mono uppercase tracking-widest">Incoming 402</span>
                  <span className="text-[10px] text-[#90E0EF]/60">hedera:296</span>
                </div>
                <div className="bg-[#02033B]/90 rounded-2xl p-3.5 border border-[#0077B6]/30 text-[11px] space-y-1.5 shadow-sm">
                  <p><span className="text-[#00B4D8] font-semibold">GET</span> <span className="text-white">/api/research/paid</span></p>
                  <p className="text-[#90E0EF]/60">Host: <span className="text-white font-medium">researchpro.eth</span></p>
                  <p className="text-[#90E0EF]/60">Agent: <span className="text-[#00B4D8]">claude-agent/2.0</span></p>
                </div>
                <div className="bg-[#02033B]/90 rounded-2xl p-3.5 border border-[#0077B6]/30 text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-[#FF9F0A]">
                    <span className="font-semibold">HTTP 402 Required</span>
                    <span>$5.00</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 space-y-1 text-[#90E0EF]/60">
                    <p>payTo: <span className="text-[#00B4D8] break-all">0x71Cf3D14...8f4B</span></p>
                    <p>asset: <span className="text-white">USDC (0.0.456858)</span></p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-[#0077B6]/20 text-center text-[10px] text-[#90E0EF]/60">
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
                  <span className="text-[10px] text-[#00B4D8] font-mono uppercase tracking-widest">ENSv2 Resolution</span>
                  <span className="text-[10px] text-[#90E0EF] font-semibold">Sepolia 11155111</span>
                </div>
                <div className="bg-[#02033B]/90 rounded-2xl p-4 border border-[#00B4D8]/35 text-[11px] space-y-2 shadow-[0_0_20px_rgba(0,180,216,0.2)]">
                  <div className="flex items-center gap-2 text-white font-medium pb-2 border-b border-white/5">
                    <span className="text-[#00B4D8]">✓</span>
                    <span>researchpro.eth</span>
                  </div>
                  <div className="space-y-1 text-[#90E0EF]/70 text-[10.5px]">
                    <p>x402.payTo: <span className="text-[#00B4D8] font-medium">0x71Cf3D...8f4B</span></p>
                    <p>x402.network: <span className="text-white">hedera:296</span></p>
                    <p>x402.maxAmount: <span className="text-[#CAF0F8]">$50.00 USDC</span></p>
                    <p>x402.version: <span className="text-white">v2.4</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/25 text-[10px] text-[#00B4D8]">
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
                  <span className="text-[10px] text-[#00B4D8] font-mono uppercase tracking-widest">Payee Verification</span>
                  <span className="text-[10px] text-[#00B4D8] font-semibold">&lt;9ms latency</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between bg-[#02033B]/90 p-3 rounded-xl border border-[#0077B6]/30">
                    <span className="text-[#90E0EF]/60">402 payTo</span>
                    <span className="text-[#00B4D8] font-medium">0x71Cf...8f4B</span>
                  </div>
                  <div className="flex items-center justify-center py-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#00B4D8]/20 text-[#00B4D8] text-[10px] font-semibold">
                      ≡ EXACT MATCH
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-[#02033B]/90 p-3 rounded-xl border border-[#00B4D8]/30">
                    <span className="text-[#90E0EF]/60">ENS Record</span>
                    <span className="text-[#00B4D8] font-medium">0x71Cf...8f4B</span>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 20 }}
                  className="py-4 rounded-2xl bg-gradient-to-br from-[#00B4D8]/25 to-[#0077B6]/20 border border-[#00B4D8]/50 text-center shadow-[0_0_35px_rgba(0,180,216,0.35)]"
                >
                  <p className="text-[#00B4D8] font-mono text-2xl font-bold mb-0.5">✓ PASS</p>
                  <p className="text-[#CAF0F8] text-xs font-medium">Signer Invoked · Settle on Hedera</p>
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
      className="relative bg-[#FFFFFF] text-[#0F172A] transition-colors duration-500"
      style={{ height: `${steps.length * 100}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* Soft background blue ambient mesh */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[#1A6CFF]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#E8F1FF] blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

          {/* Left — Editorial Steps Text with Glass Focus Cards */}
          <div className="space-y-6 lg:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-[#1A6CFF]/20">
                Verification Protocol
              </span>
              <h2 className="font-title-sans text-[clamp(30px,4.2vw,52px)] font-bold tracking-tight leading-[1.08] text-[#0F172A] mb-3">
                Get The Most Powerful and{' '}
                <em className="font-serif-accent not-italic text-[#1A6CFF]">Secure Payment Rail.</em>
              </h2>
              <p className="text-[#64748B] text-base sm:text-lg leading-relaxed max-w-lg">
                Autonomous agents shouldn't blind-sign. QuoteSeal sits directly between the HTTP 402 response and the wallet signer.
              </p>
            </motion.div>

            {/* Steps Container in Gabrun Card style */}
            <div className="space-y-3.5">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  animate={{
                    opacity: activeStep === i ? 1 : 0.6,
                    scale: activeStep === i ? 1 : 0.98,
                    x: activeStep === i ? 0 : -6,
                  }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className={`p-5 rounded-2xl transition-all duration-300 cursor-pointer ${
                    activeStep === i
                      ? 'bg-white border-2 border-[#1A6CFF] shadow-[0_15px_35px_-5px_rgba(26,108,255,0.18)]'
                      : 'bg-[#F8FAFC] border border-slate-200/70 hover:bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setActiveStep(i)}
                >
                  <div className="flex gap-4 items-start">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      activeStep === i
                        ? 'bg-[#1A6CFF] text-white shadow-[0_0_15px_rgba(26,108,255,0.4)]'
                        : 'bg-slate-200 text-[#64748B]'
                    }`}>
                      {step.num}
                    </div>
                    <div>
                      <h3 className={`font-title-sans text-base font-bold mb-1 transition-colors ${
                        activeStep === i ? 'text-[#0F172A]' : 'text-[#64748B]'
                      }`}>
                        {step.title}
                      </h3>
                      <p className={`text-xs sm:text-sm leading-relaxed transition-colors ${
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
