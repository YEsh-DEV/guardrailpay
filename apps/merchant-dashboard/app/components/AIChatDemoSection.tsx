
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

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
    <section id="demo" className="relative py-32 md:py-40 overflow-hidden bg-[#05090C] text-white">
      {/* Background Glass Glows */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-400 via-[#00FF59] to-indigo-500 blur-[130px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/4 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-pink-500 via-purple-600 to-amber-400 blur-[140px]"
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs font-semibold text-[#00FF59] uppercase tracking-widest mb-3 block">
            Interactive Agent Terminal
          </span>
          <h2 className="font-title-sans text-[clamp(36px,5vw,60px)] leading-[1.1] text-white mb-4">
            Let AI drive money.{' '}
            <em className="font-serif-accent not-italic text-[#00FF59]">Not criminals.</em>
          </h2>
          <p className="text-[#9BA9B2] text-lg max-w-xl mx-auto">
            Toggle the attack simulator to see QuoteSeal defend against a live payee substitution in real time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attack Toggle Card Glassmorphism */}
            <div className="p-6 rounded-[24px] glass-panel-dark space-y-4">
              <span className="font-mono text-xs text-white/50 uppercase tracking-widest block">
                Attack Proxy Simulator
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMode('pass')}
                  className={`flex-1 py-3 rounded-full font-sans font-bold text-xs tracking-wider transition-all ${
                    mode === 'pass'
                      ? 'bg-[#00FF59] text-[#081014] shadow-[0_0_20px_rgba(0,255,89,0.35)]'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:text-white'
                  }`}
                >
                  OFF (Normal PASS)
                </button>
                <button
                  onClick={() => setMode('attack')}
                  className={`flex-1 py-3 rounded-full font-sans font-bold text-xs tracking-wider transition-all ${
                    mode === 'attack'
                      ? 'bg-[#FF3B30] text-white shadow-[0_0_20px_rgba(255,59,48,0.4)]'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:text-white'
                  }`}
                >
                  ON (Simulate Attack)
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#9BA9B2]">
                {mode === 'attack'
                  ? '⚠ Intercepts 402 challenge and replaces payTo with malicious actor address'
                  : '✓ Direct connection to researchpro.eth merchant endpoint'}
              </p>
            </div>

            {/* Protocol Actors Guide */}
            <div className="p-6 rounded-[24px] glass-panel-dark space-y-3.5">
              <span className="font-mono text-xs text-white/50 uppercase tracking-widest block">
                Participant Architecture
              </span>
              {[
                { color: '#FFFFFF', label: 'AI Buyer Agent', desc: 'claude-agent/2.0 initiating query' },
                { color: '#9BA9B2', label: 'HTTP 402 Response', desc: mode === 'attack' ? 'Compromised proxy' : 'Merchant API' },
                { color: mode === 'pass' ? '#00FF59' : '#FF3B30', label: 'QuoteSeal Guard', desc: mode === 'pass' ? 'Verdict: PASS' : 'Verdict: BLOCK' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="font-title-sans text-xs text-white">{item.label}</p>
                    <p className="font-mono text-[10px] text-white/40">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Window with Glassmorphism Contrast */}
          <div
            ref={sectionRef}
            className="lg:col-span-3 rounded-[28px] glass-panel-dark overflow-hidden shadow-[0_35px_80px_rgba(0,0,0,0.8)]"
          >
            {/* Window Chrome Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-[#091217]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className="font-mono text-xs text-white/50 ml-3">QuoteSeal Agent Gateway</span>
              </div>
              <span className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                mode === 'attack'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {mode === 'attack' ? '⚠ MITM TRAP ACTIVE' : '● LIVE EVALUATION'}
              </span>
            </div>

            {/* Conversation Flow */}
            <div className="p-6 space-y-4 min-h-[390px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((i) => {
                  const msg = messages[i];
                  if (!msg) return null;

                  // 1. Agent message: Pure White card with Deep Ink text (Tuyo Signature Contrast)
                  if (msg.type === 'agent') {
                    return (
                      <motion.div
                        key={`${mode}-agent-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-white text-[#141414] font-title-sans font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                          AI
                        </div>
                        <div className="bg-white text-[#141414] rounded-3xl rounded-tl-sm px-5 py-3.5 text-sm font-medium shadow-[0_10px_25px_rgba(0,0,0,0.25)] max-w-[85%] leading-relaxed">
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
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            : 'bg-white/[0.04] border-white/10 text-white/60'
                        }`}>
                          {(msg as any).tampered && (
                            <p className="text-rose-400 font-bold mb-1 text-[10px] uppercase tracking-wider">
                              ⚠ ATTACK: PAYTO SUBSTITUTED
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
                        <div className={`rounded-3xl rounded-tr-sm px-5 py-4 max-w-[85%] border shadow-xl ${
                          isBlock
                            ? 'bg-gradient-to-br from-rose-950/70 to-rose-900/40 border-rose-500/50 shadow-[0_0_35px_rgba(255,59,48,0.25)]'
                            : 'bg-gradient-to-br from-emerald-950/70 to-emerald-900/40 border-emerald-500/50 shadow-[0_0_35px_rgba(0,255,89,0.2)]'
                        }`}>
                          <div className={`font-mono text-xl font-bold mb-2 flex items-center gap-2 ${
                            isBlock ? 'text-rose-400' : 'text-[#00FF59]'
                          }`}>
                            <span>{isBlock ? '✗ DEFENDED · BLOCK' : '✓ VERIFIED · PASS'}</span>
                          </div>
                          <div className={`font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap ${
                            isBlock ? 'text-rose-200/80' : 'text-emerald-200/80'
                          }`}>
                            {typingIndex === i ? (
                              <TypingText text={msg.text} startAt={true} />
                            ) : (
                              msg.text
                            )}
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold font-mono text-xs ${
                          isBlock
                            ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(255,59,48,0.5)]'
                            : 'bg-[#00FF59] text-[#081014] shadow-[0_0_15px_rgba(0,255,89,0.5)]'
                        }`}>
                          QS
                        </div>
                      </motion.div>
                    );
                  }

                  return null;
                })}
              </AnimatePresence>

              {visibleMessages.length === 0 && (
                <div className="flex items-center justify-center h-44 text-white/30 font-mono text-xs">
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
