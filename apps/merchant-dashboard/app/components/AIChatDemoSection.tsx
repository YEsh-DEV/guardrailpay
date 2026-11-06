'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

type Mode = 'pass' | 'attack';

const passMessages = [
  {
    type: 'agent' as const,
    text: 'Pay ResearchPro 5 USDC for the research report on AI payment security.',
    delay: 500,
  },
  {
    type: 'system' as const,
    text: '402 Payment Required\npayTo: 0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B\namount: 5000000 (USDC)\nnetwork: hedera:296\nversion: v2.4',
    delay: 1800,
  },
  {
    type: 'guard' as const,
    verdict: 'PASS' as const,
    text: 'ENS resolved: researchpro.eth\npayTo matches on-chain record ✓\nSigner called: 1 time ✓\nAmount within limit ✓\n\nAuthorizing payment...',
    delay: 3200,
  },
];

const attackMessages = [
  {
    type: 'agent' as const,
    text: 'Pay ResearchPro 5 USDC for the research report on AI payment security.',
    delay: 500,
  },
  {
    type: 'system' as const,
    text: '402 Payment Required\npayTo: 0x9994F8c72aD5519a3929BC00dead1337caFE0000\namount: 5000000 (USDC)\nnetwork: hedera:296\n[PROXY MODIFIED]',
    delay: 1800,
    tampered: true,
  },
  {
    type: 'guard' as const,
    verdict: 'BLOCK' as const,
    text: 'ENS resolved: researchpro.eth\npayTo MISMATCH ✗\n  expected: 0x71Cf3D14...8f4B\n  received: 0x9994F8c7...0000\nSigner call count: 0 ✗\n\nPayment BLOCKED.',
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
        rafRef.current = setTimeout(type, 18);
      }
    };
    rafRef.current = setTimeout(type, 100);
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
    // Clear all timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleMessages([]);
    setTypingIndex(-1);

    if (!inView) return;

    const run = () => {
      messages.forEach((msg, i) => {
        const t1 = setTimeout(() => {
          setVisibleMessages((prev) => [...prev, i]);
          setTypingIndex(i);
        }, msg.delay);
        const t2 = setTimeout(() => {
          setTypingIndex(-1);
        }, msg.delay + msg.text.length * 18 + 200);
        timeoutsRef.current.push(t1, t2);
      });
    };

    run();
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [mode, inView]);

  return (
    <section id="demo" className="relative py-32 md:py-40 overflow-hidden">
      {/* BG */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#081014] via-[#060D10] to-[#081014]" />
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] opacity-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,59,48,0.4) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
            Attack simulator
          </span>
          <h2 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.1] tracking-tight text-white mb-4">
            Let AI drive money.{' '}
            <em className="not-italic text-[#00FF59]">Not criminals.</em>
          </h2>
          <p className="text-[#9BA9B2] text-lg max-w-xl mx-auto">
            Toggle the attack proxy to see QuoteSeal intercept a payTo substitution in real time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attack toggle */}
            <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-4">Attack Proxy</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMode('pass')}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    mode === 'pass'
                      ? 'bg-[#00FF59]/20 border border-[#00FF59]/40 text-[#00FF59] shadow-[0_0_15px_rgba(0,255,89,0.2)]'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70'
                  }`}
                >
                  OFF
                </button>
                <button
                  onClick={() => setMode('attack')}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    mode === 'attack'
                      ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(255,59,48,0.2)]'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70'
                  }`}
                >
                  ON
                </button>
              </div>
              <p className="font-mono text-[10px] text-white/25 mt-3 text-center">
                {mode === 'attack' ? '⚠ payTo rewritten to attacker address' : '✓ Direct connection to merchant'}
              </p>
            </div>

            {/* Legend */}
            <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-3">Actors</p>
              {[
                { color: '#9AEA62', label: 'AI Agent', desc: 'claude-agent/2.0' },
                { color: '#586974', label: '402 Response', desc: mode === 'attack' ? 'Attack proxy ⚠' : 'Merchant direct' },
                { color: mode === 'pass' ? '#00FF59' : '#FF3B30', label: 'QuoteSeal Guard', desc: mode === 'pass' ? 'Verdict: PASS' : 'Verdict: BLOCK' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <div>
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="font-mono text-[10px] text-white/35">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div
            ref={sectionRef}
            className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#07111A] overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#060E16]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="font-mono text-[11px] text-white/30 flex-1 text-center">QuoteSeal Guard Console</span>
              <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full border ${
                mode === 'attack'
                  ? 'text-rose-400 border-rose-500/40 bg-rose-950/60'
                  : 'text-[#00FF59] border-[#00FF59]/30 bg-[#00FF59]/10'
              }`}>
                {mode === 'attack' ? '⚠ ATTACK MODE' : '● LIVE'}
              </span>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 min-h-[380px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((i) => {
                  const msg = messages[i];
                  if (!msg) return null;

                  if (msg.type === 'agent') {
                    return (
                      <motion.div
                        key={`${mode}-agent-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#9AEA62]/20 border border-[#9AEA62]/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[#9AEA62] text-[10px]">AI</span>
                        </div>
                        <div className="bg-[#0E1E28] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white max-w-[85%]">
                          {typingIndex === i ? (
                            <TypingText text={msg.text} startAt={true} />
                          ) : (
                            msg.text
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  if (msg.type === 'system') {
                    return (
                      <motion.div
                        key={`${mode}-system-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mx-auto max-w-[90%]"
                      >
                        <div className={`rounded-xl px-4 py-3 border font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${
                          (msg as any).tampered
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                            : 'bg-white/[0.04] border-white/10 text-white/50'
                        }`}>
                          {(msg as any).tampered && (
                            <p className="text-rose-400 font-semibold mb-1 text-[10px] uppercase tracking-wider">⚠ TAMPERED RESPONSE</p>
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

                  if (msg.type === 'guard') {
                    const isBlock = msg.verdict === 'BLOCK';
                    return (
                      <motion.div
                        key={`${mode}-guard-${i}`}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.4, type: 'spring', stiffness: 260, damping: 22 }}
                        className="flex gap-3 justify-end"
                      >
                        <div className={`rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] border ${
                          isBlock
                            ? 'bg-rose-950/50 border-rose-500/40 shadow-[0_0_30px_rgba(255,59,48,0.2)]'
                            : 'bg-[#00FF59]/10 border-[#00FF59]/30 shadow-[0_0_30px_rgba(0,255,89,0.15)]'
                        }`}>
                          <div className={`font-mono text-lg font-bold mb-2 ${isBlock ? 'text-rose-400' : 'text-[#00FF59]'}`}>
                            {isBlock ? '✗ BLOCK' : '✓ PASS'}
                          </div>
                          <div className={`font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${isBlock ? 'text-rose-300/70' : 'text-[#9AEA62]/70'}`}>
                            {typingIndex === i ? (
                              <TypingText text={msg.text} startAt={true} />
                            ) : (
                              msg.text
                            )}
                          </div>
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          isBlock
                            ? 'bg-rose-950/60 border-rose-500/40'
                            : 'bg-[#00FF59]/20 border-[#00FF59]/30'
                        }`}>
                          <span className={`text-[10px] font-bold ${isBlock ? 'text-rose-400' : 'text-[#00FF59]'}`}>QS</span>
                        </div>
                      </motion.div>
                    );
                  }

                  return null;
                })}
              </AnimatePresence>

              {visibleMessages.length === 0 && (
                <div className="flex items-center justify-center h-40 text-white/20 font-mono text-sm">
                  Scroll into view to start demo...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

