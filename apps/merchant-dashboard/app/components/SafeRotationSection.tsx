'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const rotationSteps = [
  {
    id: 'propose',
    num: '01',
    title: 'Propose',
    subtitle: 'New address submitted',
    desc: 'The merchant operator submits a new payTo address through the QuoteSeal dashboard. This triggers an on-chain rotation proposal in the ENS Authorized Controller contract.',
    screen: 'propose',
    color: '#9AEA62',
  },
  {
    id: 'worldid',
    num: '02',
    title: 'World ID Check',
    subtitle: 'Human operator verified',
    desc: 'A World ID Agent Pass proof is generated for the operator. QuoteSeal verifies on-chain that the proposer is a unique human — no bots can authorize a payout address change.',
    screen: 'worldid',
    color: '#00FF59',
  },
  {
    id: 'delay',
    num: '03',
    title: '48h Time-Lock',
    subtitle: 'Emergency window open',
    desc: 'The proposal enters a 48-hour delay period. During this window, any observer can raise an alarm. AI agents continue paying the existing address safely.',
    screen: 'delay',
    color: '#FF9F0A',
  },
  {
    id: 'activate',
    num: '04',
    title: 'Activate',
    subtitle: 'New address goes live',
    desc: 'After the delay passes with no objections and the World ID proof is confirmed valid, the new payTo address is written to the ENS resolver and immediately enforced.',
    screen: 'activate',
    color: '#00F5D4',
  },
];

function CountdownRing({ seconds }: { seconds: number }) {
  const totalSeconds = 48 * 3600;
  const fraction = seconds / totalSeconds;
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - (1 - fraction));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,159,10,0.15)" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="#FF9F0A"
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ strokeDasharray: circumference, strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'linear' }}
            style={{ strokeDasharray: circumference, filter: 'drop-shadow(0 0 6px rgba(255,159,10,0.6))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] text-[#FF9F0A]/60 uppercase tracking-wider">Remaining</span>
          <span className="font-mono text-sm text-[#FF9F0A] font-semibold">
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-mono text-[10px] text-white/40">Emergency window open</p>
        <p className="font-mono text-[10px] text-white/25">Agents using old payTo</p>
      </div>
    </div>
  );
}

function RotationScreen({ step }: { step: typeof rotationSteps[0] }) {
  const [countdown, setCountdown] = useState(47 * 3600 + 23 * 60 + 14);

  useEffect(() => {
    if (step.id !== 'delay') return;
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step.id]);

  return (
    <div className="p-5 min-h-[220px] flex flex-col justify-between">
      {step.id === 'propose' && (
        <div className="space-y-3 font-mono text-[11px]">
          <p className="text-white/40 uppercase tracking-wider text-[10px] mb-2">New Proposal</p>
          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-white/5 rounded-lg border border-white/8">
              <span className="text-white/40">Current payTo</span>
              <span className="text-[#00F5D4]">0x71Cf...8f4B</span>
            </div>
            <div className="text-center text-[#9AEA62] text-xs">↓ replace with</div>
            <div className="flex justify-between p-2.5 bg-[#9AEA62]/10 rounded-lg border border-[#9AEA62]/30">
              <span className="text-white/40">Proposed payTo</span>
              <span className="text-[#9AEA62]">0x3A2B...C901</span>
            </div>
          </div>
          <button className="w-full py-2 mt-2 rounded-lg bg-[#9AEA62]/20 border border-[#9AEA62]/30 text-[#9AEA62] text-xs font-semibold">
            Submit Proposal →
          </button>
        </div>
      )}

      {step.id === 'worldid' && (
        <div className="space-y-3">
          <p className="font-mono text-white/40 uppercase tracking-wider text-[10px] mb-2">World ID Verification</p>
          <div className="flex items-center gap-3 p-3 bg-[#00FF59]/10 rounded-xl border border-[#00FF59]/25">
            <div className="w-10 h-10 rounded-full bg-[#00FF59]/20 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#00FF59" strokeWidth="1.5"/>
                <path d="M9 12L11 14L15 10" stroke="#00FF59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-mono text-xs text-[#00FF59] font-semibold">Proof Verified</p>
              <p className="font-mono text-[10px] text-white/40">nullifier: 0x87ab...3f21</p>
              <p className="font-mono text-[10px] text-white/40">signal: rotation:v2.4</p>
            </div>
          </div>
          <div className="flex gap-2 font-mono text-[10px]">
            <span className="flex-1 text-center py-1.5 bg-[#00FF59]/10 border border-[#00FF59]/20 rounded-lg text-[#00FF59]">✓ Unique human</span>
            <span className="flex-1 text-center py-1.5 bg-[#00FF59]/10 border border-[#00FF59]/20 rounded-lg text-[#00FF59]">✓ Not reused</span>
          </div>
        </div>
      )}

      {step.id === 'delay' && (
        <div className="flex flex-col items-center gap-4 py-2">
          <CountdownRing seconds={countdown} />
        </div>
      )}

      {step.id === 'activate' && (
        <div className="space-y-3">
          <p className="font-mono text-white/40 uppercase tracking-wider text-[10px] mb-2">Activation Complete</p>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 rounded-xl bg-[#00F5D4]/10 border border-[#00F5D4]/30 text-center shadow-[0_0_20px_rgba(0,245,212,0.15)]"
          >
            <p className="font-mono text-2xl text-[#00F5D4] mb-1">✓</p>
            <p className="font-mono text-xs text-[#00F5D4] font-semibold">New address active</p>
            <p className="font-mono text-[10px] text-white/40 mt-1">0x3A2B...C901</p>
          </motion.div>
          <div className="font-mono text-[10px] text-white/30 text-center space-y-0.5">
            <p>ENS record updated ✓</p>
            <p>All agents using new address ✓</p>
            <p>HashScan proof: 0.0.9847231 ✓</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SafeRotationSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="relative py-32 md:py-40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
            Payout rotation
          </span>
          <h2 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.1] tracking-tight text-white mb-4">
            From propose to live{' '}
            <em className="not-italic text-[#00FF59]">in 48 hours.</em>
          </h2>
          <p className="text-[#9BA9B2] text-lg max-w-xl mx-auto">
            Legitimate payout changes go through an announced, human-verified, time-locked rotation — not a silent override.
          </p>
        </motion.div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {rotationSteps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={() => setActiveStep(i)}
              animate={{
                scale: activeStep === i ? 1.03 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.08 }}
              className={`rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 ${
                activeStep === i
                  ? 'shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
                  : 'opacity-70 hover:opacity-90'
              }`}
              style={{
                borderColor: activeStep === i ? `${step.color}40` : 'rgba(255,255,255,0.08)',
                background: activeStep === i
                  ? `linear-gradient(135deg, ${step.color}08 0%, rgba(8,16,20,0.95) 100%)`
                  : 'rgba(14,23,29,0.5)',
              }}
            >
              {/* Card header */}
              <div
                className="px-5 py-4 border-b"
                style={{ borderColor: activeStep === i ? `${step.color}20` : 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-white/30">{step.num}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: activeStep === i ? step.color : 'rgba(255,255,255,0.15)',
                      boxShadow: activeStep === i ? `0 0 10px ${step.color}80` : 'none',
                    }}
                  />
                </div>
                <h3
                  className="font-semibold text-sm mb-0.5 transition-colors"
                  style={{ color: activeStep === i ? step.color : 'rgba(255,255,255,0.8)' }}
                >
                  {step.title}
                </h3>
                <p className="font-mono text-[10px] text-white/35">{step.subtitle}</p>
              </div>

              {/* Screen area */}
              <AnimatePresence mode="wait">
                {activeStep === i && (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RotationScreen step={step} />
                  </motion.div>
                )}
                {activeStep !== i && (
                  <div className="p-5">
                    <p className="text-xs text-white/35 leading-relaxed">{step.desc}</p>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

