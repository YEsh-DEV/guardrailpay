'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const rotationSteps = [
  {
    id: 'propose',
    num: '01',
    title: 'Propose',
    subtitle: 'New address submitted',
    desc: 'The merchant operator submits a new payTo address through the QuoteSeal dashboard. This triggers an on-chain rotation proposal in the ENS Authorized Controller contract.',
    bg: '#CAF0F8', // Frosted Foam
    text: '#03045E', // Navy Ink
    accent: '#00B4D8',
    border: 'rgba(0, 180, 216, 0.25)',
  },
  {
    id: 'worldid',
    num: '02',
    title: 'World ID Check',
    subtitle: 'Human operator verified',
    desc: 'A World ID Agent Pass proof is generated for the operator. QuoteSeal verifies on-chain that the proposer is a unique human — no bots can authorize a payout address change.',
    bg: '#90E0EF', // Glacial Aqua
    text: '#03045E',
    accent: '#0077B6',
    border: 'rgba(0, 119, 182, 0.25)',
  },
  {
    id: 'delay',
    num: '03',
    title: '48h Time-Lock',
    subtitle: 'Emergency window open',
    desc: 'The proposal enters a 48-hour delay period. During this window, any observer can raise an alarm. AI agents continue paying the existing address safely.',
    bg: '#00B4D8', // Electric Cyan
    text: '#03045E',
    accent: '#03045E',
    border: 'rgba(3, 4, 94, 0.3)',
  },
  {
    id: 'activate',
    num: '04',
    title: 'Activate',
    subtitle: 'New address goes live',
    desc: 'After the delay passes with no objections and the World ID proof is confirmed valid, the new payTo address is written to the ENS resolver and immediately enforced.',
    bg: '#0077B6', // Oceanic Cerulean
    text: '#CAF0F8',
    accent: '#CAF0F8',
    border: 'rgba(202, 240, 248, 0.3)',
  },
];

function CountdownRing({ seconds, textColor, accentColor }: { seconds: number; textColor: string; accentColor: string }) {
  const totalSeconds = 48 * 3600;
  const fraction = seconds / totalSeconds;
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - (1 - fraction));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-26 h-26">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={accentColor}
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ strokeDasharray: circumference, strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'linear' }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">Delay</span>
          <span className="font-mono text-sm font-bold" style={{ color: textColor }}>
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="text-center font-mono text-[10px] opacity-75">
        <p>48-hour timelock countdown</p>
        <p>Agents safely pay current address</p>
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
    <div className="p-4 min-h-[220px] flex flex-col justify-between" style={{ color: step.text }}>
      {step.id === 'propose' && (
        <div className="space-y-3 font-mono text-[11px]">
          <p className="uppercase tracking-wider text-[10px] font-semibold opacity-75">Proposal Submission</p>
          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-white/60 rounded-xl border border-black/10">
              <span className="opacity-60">Current payTo</span>
              <span className="font-semibold">0x71Cf...8f4B</span>
            </div>
            <div className="text-center font-bold text-xs">↓ replace with</div>
            <div className="flex justify-between p-2.5 bg-white rounded-xl border border-black/15 shadow-sm">
              <span className="opacity-60">Proposed</span>
              <span className="font-bold text-[#1F5E24]">0x3A2B...C901</span>
            </div>
          </div>
          <div className="w-full py-2 mt-2 rounded-xl bg-white/80 border border-black/15 text-center text-xs font-bold shadow-sm">
            EAC Contract Proposal Queued
          </div>
        </div>
      )}

      {step.id === 'worldid' && (
        <div className="space-y-3">
          <p className="font-mono uppercase tracking-wider text-[10px] font-semibold opacity-75">Human Verification</p>
          <div className="flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-black/10 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#8C6C00]/15 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#33321F" strokeWidth="2"/>
                <path d="M9 12L11 14L15 10" stroke="#33321F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-[#33321F]">World ID Agent Pass</p>
              <p className="font-mono text-[10px] opacity-75">Nullifier: 0x87ab...3f21</p>
              <p className="font-mono text-[10px] opacity-75">Unique human proof: Valid ✓</p>
            </div>
          </div>
          <div className="flex gap-2 font-mono text-[10px]">
            <span className="flex-1 text-center py-1.5 bg-white/60 rounded-lg font-semibold">Zero-Knowledge</span>
            <span className="flex-1 text-center py-1.5 bg-white/60 rounded-lg font-semibold">Bot-Proof</span>
          </div>
        </div>
      )}

      {step.id === 'delay' && (
        <div className="flex flex-col items-center justify-center py-1">
          <CountdownRing seconds={countdown} textColor={step.text} accentColor={step.accent} />
        </div>
      )}

      {step.id === 'activate' && (
        <div className="space-y-3 text-center">
          <p className="font-mono uppercase tracking-wider text-[10px] font-semibold opacity-75">Final Activation</p>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 rounded-2xl bg-white border border-black/10 shadow-sm"
          >
            <p className="font-mono text-2xl font-bold mb-1 text-[#1B5B8E]">✓</p>
            <p className="font-mono text-xs font-bold">New Address Live On-Chain</p>
            <p className="font-mono text-[10px] opacity-70 mt-1">0x3A2B5E...C901</p>
          </motion.div>
          <div className="font-mono text-[10px] opacity-75 space-y-0.5">
            <p>ENS Resolver Text Record Written ✓</p>
            <p>All Agents Settle to New Payee ✓</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SafeRotationSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="relative py-12 md:py-16 overflow-hidden bg-[#FFFFFF] text-[#0F172A] border-t border-slate-200/80">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] opacity-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(26,108,255,0.2) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-10 sm:mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1FF] text-[#1A6CFF] font-mono text-xs font-bold uppercase tracking-wider mb-3 border border-[#1A6CFF]/20">
            Safe Payout Rotation
          </span>
          <h2 className="font-title-sans text-[clamp(28px,4.5vw,52px)] font-bold tracking-tight leading-[1.1] text-[#0F172A] mb-3">
            From Propose to Live{' '}
            <span className="font-medium text-[#1A6CFF]">in 48 Hours.</span>
          </h2>
          <p className="text-[#64748B] text-sm sm:text-base max-w-xl mx-auto">
            Legitimate payout changes go through an announced, delayed, human-approved rotation guarded by World ID Agent Pass.
          </p>
        </motion.div>

        {/* The 4-Color Pastel Card Mixture (Tuyo Pattern) */}
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
              className={`rounded-[26px] cursor-pointer overflow-hidden transition-all duration-300 ${
                activeStep === i
                  ? 'ring-2 ring-white/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
                  : 'opacity-85 hover:opacity-100 hover:scale-[1.01]'
              }`}
              style={{
                backgroundColor: step.bg,
                color: step.text,
              }}
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-black/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold opacity-60">{step.num}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: step.accent,
                      boxShadow: activeStep === i ? `0 0 10px ${step.accent}` : 'none',
                    }}
                  />
                </div>
                <h3 className="font-title-sans text-lg mb-0.5" style={{ color: step.text }}>
                  {step.title}
                </h3>
                <p className="font-mono text-[11px] opacity-70 font-medium">{step.subtitle}</p>
              </div>

              {/* Dynamic screen or preview */}
              <AnimatePresence mode="wait">
                {activeStep === i ? (
                  <motion.div
                    key={`${step.id}-active`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <RotationScreen step={step} />
                  </motion.div>
                ) : (
                  <div className="p-5 min-h-[220px] flex flex-col justify-between">
                    <p className="text-sm leading-relaxed font-medium opacity-80" style={{ color: step.text }}>
                      {step.desc}
                    </p>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
                      Click to inspect →
                    </span>
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
