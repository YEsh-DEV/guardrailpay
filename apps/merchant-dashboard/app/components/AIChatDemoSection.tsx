'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Avatar, AvatarFallback } from '@quoteseal/ui';

type Mode = 'pass' | 'attack';

const passMessages = [
  {
    type: 'agent' as const,
    text: 'Pay ResearchPro 5 USDC for the research report on autonomous agent payment vulnerabilities.',
    delay: 500,
  },
  {
    type: 'system' as const,
    text: 'HTTP/1.1 402 Payment Required\nPAYMENT-REQUIRED: {"network":"hedera:296","asset":"0.0.456858","payTo":"0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B","amount":"5000000","version":"v2.4"}',
    delay: 1800,
  },
  {
    type: 'guard' as const,
    verdict: 'PASS' as const,
    text: 'ENS Identity: researchpro.eth (Sepolia)\nActive payTo matches on-chain record ✓\nAmount: $5.00 USDC <= $50.00 Max Cap ✓\nSigner called: 1 time ✓\n\nVerdict: PASS — Settled on Hedera Testnet',
    delay: 3200,
  },
];

const attackMessages = [
  {
    type: 'agent' as const,
    text: 'Pay ResearchPro 5 USDC for the research report on autonomous agent payment vulnerabilities.',
    delay: 500,
  },
  {
    type: 'system' as const,
    text: 'HTTP/1.1 402 Payment Required\nPAYMENT-REQUIRED: {"network":"hedera:296","asset":"0.0.456858","payTo":"0x9994F8c72aD5519a3929BC00dead1337caFE0000","amount":"5000000"}\n[ATTACK PROXY: payTo REWRITTEN]',
    delay: 1800,
    tampered: true,
  },
  {
    type: 'guard' as const,
    verdict: 'BLOCK' as const,
    text: 'ENS Identity: researchpro.eth (Sepolia)\nALERT: Recipient mismatch detected ✗\n  Expected: 0x71Cf3D14...8f4B\n  Received: 0x9994F8c7...0000\nSIGNER CALL COUNT: 0 ✗ (Wallet safe)\n\nVerdict: DEFENDED · BLOCK',
    delay: 3200,
  },
];

function TypingText({ text, startAt }: { text: string; startAt: boolean }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!startAt) {
      setDisplayed('');
      indexRef.current = 0;
      return;
    }
    const type = () => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, ++indexRef.current));
        rafRef.current = setTimeout(type, 16);
      }
    };
    rafRef.current = setTimeout(type, 80);
    return () => clearTimeout(rafRef.current);
  }, [text, startAt]);

  return <span className="whitespace-pre-wrap">{displayed}<span className="animate-pulse">▋</span></span>;
}

export default function AIChatDemoSection() {
  const [mode, setMode] = useState<Mode>('pass');
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [typingIndex, setTypingIndex] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { amount: 0.3, once: false });
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const messages = mode === 'pass' ? passMessages : attackMessages;

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleMessages([]);
    setTypingIndex(-1);

    if (!inView) return;

    messages.forEach((msg, i) => {
      const t1 = setTimeout(() => {
        setVisibleMessages((prev) => [...prev, i]);
        setTypingIndex(i);
      }, msg.delay);
      const t2 = setTimeout(() => {
        setTypingIndex(-1);
      }, msg.delay + msg.text.length * 16 + 200);
      timeoutsRef.current.push(t1, t2);
    });

    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [mode, inView]);

  return (
    <section id="demo" className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden bg-[#0E0E0E] text-[#E2E8F0] border-t border-[#262626]">
      {/* Background Lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#7F359B] to-[#D152F5] blur-[130px]"
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-10 sm:mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D152F5]/10 text-[#DD60F7] font-mono text-xs font-bold uppercase tracking-wider mb-3 border border-[#D152F5]/25">
            Interactive Agent Terminal
          </span>
          <h2 className="font-title-sans text-[clamp(28px,4.5vw,52px)] font-bold tracking-tight leading-[1.1] text-[#FFFFFF] mb-3">
            Rewards That are Endlessly{' '}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D152F5] to-[#EA9DFD]">
              Rewarding.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto">
            Test the interceptor in real time. Watch how GuardRail Pay protects an autonomous AI agent when encountering hostile 402 responses.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attack Toggle Card Glassmorphism */}
            <div className="p-6 rounded-[24px] bg-[#141414] border border-[#262626] shadow-xl space-y-4">
              <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-widest block font-bold">
                Attack Proxy Simulator
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMode('pass')}
                  className={`flex-1 py-3 rounded-full font-sans font-bold text-xs tracking-wider transition-all ${
                    mode === 'pass'
                      ? 'bg-[#D152F5] text-[#050505] shadow-[0_4px_16px_rgba(209,82,245,0.4)]'
                      : 'bg-[#1F1F1F] border border-[#262626] text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  OFF (Normal PASS)
                </button>
                <button
                  onClick={() => setMode('attack')}
                  className={`flex-1 py-3 rounded-full font-sans font-bold text-xs tracking-wider transition-all ${
                    mode === 'attack'
                      ? 'bg-[#F43F5E] text-white shadow-[0_4px_16px_rgba(244,63,94,0.4)]'
                      : 'bg-[#1F1F1F] border border-[#262626] text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  ON (Simulate Attack)
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#94A3B8]">
                {mode === 'attack'
                  ? '⚠ Intercepts 402 challenge and replaces payTo with malicious actor address'
                  : '✓ Direct connection to researchpro.eth merchant endpoint'}
              </p>
            </div>

            {/* Protocol Actors Guide */}
            <div className="p-6 rounded-[24px] bg-[#141414] border border-[#262626] shadow-xl space-y-3.5">
              <span className="font-mono text-xs text-[#94A3B8] uppercase tracking-widest block font-bold">
                Participant Architecture
              </span>
              {[
                { color: '#D152F5', label: 'AI Buyer Agent', desc: 'claude-agent/2.0 initiating query' },
                { color: '#94A3B8', label: 'HTTP 402 Response', desc: mode === 'attack' ? 'Compromised proxy' : 'Merchant API' },
                { color: mode === 'pass' ? '#34D399' : '#F43F5E', label: 'GuardRail Pay Guard', desc: mode === 'pass' ? 'Verdict: PASS' : 'Verdict: BLOCK' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="font-title-sans text-xs text-[#FFFFFF] font-bold">{item.label}</p>
                    <p className="font-mono text-[10px] text-[#94A3B8]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Window with Glassmorphism Contrast */}
          <div
            ref={sectionRef}
            className="lg:col-span-3 rounded-[28px] bg-[#141414] border border-[#262626] shadow-2xl overflow-hidden"
          >
            {/* Window Chrome Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262626] bg-[#0E0E0E]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className="font-mono text-xs text-[#E2E8F0] font-bold ml-3">GuardRail Pay Agent Gateway</span>
              </div>
              <span className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                mode === 'attack'
                  ? 'bg-rose-950/40 text-rose-400 border border-rose-800/60'
                  : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
              }`}>
                {mode === 'attack' ? '⚠ MITM TRAP ACTIVE' : '● LIVE EVALUATION'}
              </span>
            </div>

            {/* Conversation Flow */}
            <div className="p-6 space-y-4 min-h-[390px] overflow-y-auto bg-[#0A0A0A]">
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((i) => {
                  const msg = messages[i];
                  if (!msg) return null;

                  // 1. Agent message
                  if (msg.type === 'agent') {
                    return (
                      <motion.div
                        key={`${mode}-agent-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm border border-[#D152F5]/30">
                          <AvatarFallback className="bg-gradient-to-br from-[#7F359B] to-[#D152F5] text-white text-xs font-semibold">
                            AI
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-[#141414] text-[#E2E8F0] border border-[#262626] rounded-3xl rounded-tl-sm px-5 py-3.5 text-sm font-medium shadow-sm max-w-[85%] leading-relaxed">
                          {typingIndex === i ? (
                            <TypingText text={msg.text} startAt={true} />
                          ) : (
                            msg.text
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  // 2. System 402 challenge
                  if (msg.type === 'system') {
                    return (
                      <motion.div
                        key={`${mode}-system-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-auto max-w-[92%]"
                      >
                        <div className={`rounded-2xl px-4 py-3 border font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${
                          (msg as any).tampered
                            ? 'bg-rose-950/20 border-rose-800/50 text-rose-300'
                            : 'bg-[#141414] border-[#262626] text-[#E2E8F0]'
                        }`}>
                          {(msg as any).tampered && (
                            <p className="text-rose-400 font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                              <span>⚠</span> ATTACK: PAYTO SUBSTITUTED
                            </p>
                          )}
                          {typingIndex === i ? (
                            <TypingText text={msg.text} startAt={true} />
                          ) : (
                            msg.text
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  // 3. QuoteSeal Guard verdict bubble
                  if (msg.type === 'guard') {
                    const isBlock = msg.verdict === 'BLOCK';
                    return (
                      <motion.div
                        key={`${mode}-guard-${i}`}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                        className="flex gap-3 justify-end"
                      >
                        <div className={`rounded-3xl rounded-tr-sm px-5 py-4 max-w-[85%] border shadow-md ${
                          isBlock
                            ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                            : 'bg-[#141414] border-[#D152F5]/30 shadow-[0_10px_30px_rgba(209,82,245,0.15)] text-[#E2E8F0]'
                        }`}>
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#262626]">
                            <span className={`w-2 h-2 rounded-full ${isBlock ? 'bg-rose-500' : 'bg-[#34D399]'}`} />
                            <span className="font-title-sans text-xs font-bold text-[#FFFFFF]">GuardRail Pay Guard</span>
                          </div>
                          <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                            {typingIndex === i ? (
                              <TypingText text={msg.text} startAt={true} />
                            ) : (
                              msg.text
                            )}
                          </div>
                        </div>
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm border border-[#262626]">
                          <AvatarFallback className={isBlock ? 'bg-rose-600 text-white text-xs font-semibold' : 'bg-gradient-to-br from-[#7F359B] to-[#D152F5] text-white text-xs font-semibold'}>
                            QS
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                    );
                  }
                  return null;
                })}
              </AnimatePresence>

              {visibleMessages.length === 0 && (
                <div className="flex items-center justify-center h-44 text-[#64748B] font-mono text-xs">
                  Scroll into view to run automated sequence...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
