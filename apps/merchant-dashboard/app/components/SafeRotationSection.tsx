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
    accent: '#D152F5',
  },
  {
    id: 'worldid',
    num: '02',
    title: 'World ID Check',
    subtitle: 'Human operator verified',
    desc: 'A World ID Agent Pass proof is generated for the operator. QuoteSeal verifies on-chain that the proposer is a unique human — no bots can authorize a payout address change.',
    accent: '#DD60F7',
  },
  {
    id: 'delay',
    num: '03',
    title: '48h Time-Lock',
    subtitle: 'Emergency window open',
    desc: 'The proposal enters a 48-hour delay period. During this window, any observer can raise an alarm. AI agents continue paying the existing address safely.',
    accent: '#D152F5',
  },
  {
    id: 'activate',
    num: '04',
    title: 'Activate',
    subtitle: 'New address goes live',
    desc: 'After the delay passes with no objections and the World ID proof is confirmed valid, the new payTo address is written to the ENS resolver and immediately enforced.',
    accent: '#34D399',
  },
];

function CountdownRing({ seconds, accentColor }: { seconds: number; accentColor: string }) {
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
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(226,232,240,0.1)" strokeWidth="6" />
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
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#94A3B8]">Delay</span>
          <span className="font-mono text-sm font-bold text-[#E2E8F0]">
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="text-center font-mono text-[10px] text-[#94A3B8]">
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
    <div className="p-4 min-h-[220px] flex flex-col justify-between text-[#E2E8F0]">
      {step.id === 'propose' && (
        <div className="space-y-3 font-mono text-[11px]">
          <p className="uppercase tracking-wider text-[10px] font-semibold text-[#94A3B8]">Proposal Submission</p>
          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-[#0E0E0E] rounded-xl border border-[#262626]">
              <span className="text-[#64748B]">Current payTo</span>
              <span className="font-semibold text-[#E2E8F0]">0x71Cf...8f4B</span>
            </div>
            <div className="text-center font-bold text-xs text-[#DD60F7]">↓ replace with</div>
            <div className="flex justify-between p-2.5 bg-[#1A1A1A] rounded-xl border border-[#D152F5]/30 shadow-sm">
              <span className="text-[#94A3B8]">Proposed</span>
              <span className="font-bold text-[#D152F5]">0x3A2B...C901</span>
            </div>
          </div>
          <div className="w-full py-2 mt-2 rounded-xl bg-[#0E0E0E] border border-[#262626] text-center text-xs font-bold text-[#E2E8F0] shadow-sm">
            EAC Contract Proposal Queued
          </div>
        </div>
      )}

      {step.id === 'worldid' && (
        <div className="space-y-3">
          <p className="font-mono uppercase tracking-wider text-[10px] font-semibold text-[#94A3B8]">Human Verification</p>
          <div className="flex items-center gap-3 p-3 bg-[#0E0E0E] rounded-2xl border border-[#262626] shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#D152F5]/15 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#D152F5" strokeWidth="2"/>
                <path d="M9 12L11 14L15 10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-[#FFFFFF]">World ID Agent Pass</p>
              <p className="font-mono text-[10px] text-[#94A3B8]">Nullifier: 0x87ab...3f21</p>
              <p className="font-mono text-[10px] text-[#34D399]">Unique human proof: Valid ✓</p>
            </div>
          </div>
          <div className="flex gap-2 font-mono text-[10px]">
            <span className="flex-1 text-center py-1.5 bg-[#1F1F1F] rounded-lg font-semibold text-[#E2E8F0]">Zero-Knowledge</span>
            <span className="flex-1 text-center py-1.5 bg-[#1F1F1F] rounded-lg font-semibold text-[#E2E8F0]">Bot-Proof</span>
          </div>
        </div>
      )}

      {step.id === 'delay' && (
        <div className="flex flex-col items-center justify-center py-1">
          <CountdownRing seconds={countdown} accentColor={step.accent} />
        </div>
      )}

      {step.id === 'activate' && (
        <div className="space-y-3 text-center">
          <p className="font-mono uppercase tracking-wider text-[10px] font-semibold text-[#94A3B8]">Final Activation</p>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#34D399]/30 shadow-sm"
          >
            <p className="font-mono text-2xl font-bold mb-1 text-[#34D399]">✓</p>
            <p className="font-mono text-xs font-bold text-[#FFFFFF]">New Address Live On-Chain</p>
            <p className="font-mono text-[10px] text-[#94A3B8] mt-1">0x3A2B5E...C901</p>
          </motion.div>
          <div className="font-mono text-[10px] text-[#94A3B8] space-y-0.5">
            <p className="text-[#34D399]">ENS Resolver Text Record Written ✓</p>
            <p className="text-[#E2E8F0]">All Agents Settle to New Payee ✓</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SafeRotationSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="relative py-12 md:py-24 overflow-hidden bg-[#050505] text-[#E2E8F0] border-t border-[#262626]">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] opacity-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(209,82,245,0.2) 0%, transparent 70%)',
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D152F5]/10 text-[#DD60F7] font-mono text-xs font-bold uppercase tracking-wider mb-3 border border-[#D152F5]/25">
            Safe Payout Rotation
          </span>
          <h2 className="font-title-sans text-[clamp(28px,4.5vw,52px)] font-bold tracking-tight leading-[1.1] text-[#FFFFFF] mb-3">
            From Propose to Live{' '}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
              in 48 Hours.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto">
            Legitimate payout changes go through an announced, delayed, human-approved rotation guarded by World ID Agent Pass.
          </p>
        </motion.div>

        {/* 4 Cards Grid with Finovate Three-Layer System */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {rotationSteps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={() => setActiveStep(i)}
              animate={{
                scale: activeStep === i ? 1.02 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.08 }}
              className={`rounded-[26px] cursor-pointer overflow-hidden transition-all duration-300 ${
                activeStep === i
                  ? 'bg-[#141414] border-2 border-[#D152F5] shadow-[0_20px_50px_rgba(209,82,245,0.25)]'
                  : 'bg-[#0E0E0E] border border-[#262626] opacity-85 hover:opacity-100 hover:border-[#64748B]'
              }`}
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-[#262626]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-[#64748B]">{step.num}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: step.accent,
                      boxShadow: activeStep === i ? `0 0 10px ${step.accent}` : 'none',
                    }}
                  />
                </div>
                <h3 className="font-title-sans text-lg mb-0.5 text-[#FFFFFF]">
                  {step.title}
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8] font-medium">{step.subtitle}</p>
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
                    <p className="text-sm leading-relaxed font-medium text-[#94A3B8]">
                      {step.desc}
                    </p>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D152F5]">
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
