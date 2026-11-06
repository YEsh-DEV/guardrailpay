'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

const nodes = [
  {
    id: 'agent',
    label: 'AI Agent',
    sublabel: 'claude-agent/2.0',
    color: '#9AEA62',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 20C6 17.2386 8.68629 15 12 15C15.3137 15 18 17.2386 18 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M19 11L21 13L19 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'guard',
    label: 'QuoteSeal Guard',
    sublabel: 'ENS + verify',
    color: '#00FF59',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'hedera',
    label: 'Hedera Network',
    sublabel: 'Mainnet 295',
    color: '#00F5D4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L18 6V12L12 16L6 12V6L12 2Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 9H16M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'hashscan',
    label: 'HashScan',
    sublabel: 'Tx confirmed',
    color: '#9AEA62',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function FeatureSectionC() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const inView = useInView(sectionRef, { amount: 0.4, once: true });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 70%', 'end 30%'],
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const nodeProgress = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 1, 2, 3]);

  const [activeNode, setActiveNode] = React.useState(-1);
  React.useEffect(() => {
    const unsubscribe = nodeProgress.on('change', (v) => {
      setActiveNode(Math.floor(v));
    });
    return unsubscribe;
  }, [nodeProgress]);

  return (
    <section ref={sectionRef} className="relative py-32 md:py-40 overflow-hidden bg-[#05090C]">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,89,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,89,0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <span className="font-mono text-[11px] text-[#00FF59] uppercase tracking-widest mb-4 block">
            Payment flow
          </span>
          <h2 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.1] tracking-tight text-white mb-4">
            Move money,{' '}
            <em className="not-italic text-[#00FF59]">not heaven and earth.</em>
          </h2>
          <p className="text-[#9BA9B2] text-lg max-w-2xl mx-auto">
            The entire payment rail — from agent instruction to HashScan confirmation — in four verified steps.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <div className="relative">
          {/* SVG path connecting nodes */}
          <div className="hidden md:block absolute inset-0 pointer-events-none">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9AEA62" stopOpacity="0.6" />
                  <stop offset="33%" stopColor="#00FF59" stopOpacity="0.8" />
                  <stop offset="66%" stopColor="#00F5D4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#9AEA62" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {/* Background path (dim) */}
              <path
                d="M 100 60 C 200 60 230 60 330 60 C 430 60 450 60 500 60 C 550 60 570 60 670 60 C 770 60 800 60 900 60"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Animated fill path */}
              <motion.path
                ref={pathRef}
                d="M 100 60 C 200 60 230 60 330 60 C 430 60 450 60 500 60 C 550 60 570 60 670 60 C 770 60 800 60 900 60"
                stroke="url(#pathGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ pathLength }}
                filter="url(#glow)"
              />
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>

          {/* Nodes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 relative z-10">
            {nodes.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex flex-col items-center text-center group"
              >
                {/* Node circle */}
                <motion.div
                  animate={{
                    scale: activeNode >= i ? 1 : 0.9,
                    boxShadow: activeNode >= i
                      ? `0 0 30px -5px ${node.color}80, 0 0 0 1px ${node.color}30`
                      : '0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-16 h-16 rounded-full border flex items-center justify-center mb-4 transition-all duration-500"
                  style={{
                    background: activeNode >= i
                      ? `radial-gradient(circle, ${node.color}25 0%, ${node.color}08 100%)`
                      : 'rgba(255,255,255,0.03)',
                    borderColor: activeNode >= i ? `${node.color}50` : 'rgba(255,255,255,0.1)',
                    color: activeNode >= i ? node.color : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {node.icon}
                </motion.div>

                <p className={`font-semibold text-sm mb-1 transition-colors duration-500 ${activeNode >= i ? 'text-white' : 'text-white/40'}`}>
                  {node.label}
                </p>
                <p className={`font-mono text-[11px] transition-colors duration-500 ${activeNode >= i ? 'text-[#586974]' : 'text-white/20'}`}>
                  {node.sublabel}
                </p>

                {/* Step number */}
                <div className={`mt-3 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                  activeNode >= i ? 'bg-[#00FF59]/20 border border-[#00FF59]/40' : 'bg-white/5 border border-white/10'
                }`}>
                  <span className={`font-mono text-[9px] font-bold ${activeNode >= i ? 'text-[#00FF59]' : 'text-white/25'}`}>
                    {i + 1}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20"
        >
          {[
            { label: 'Guard latency', value: '<12ms', desc: 'P99 resolution time' },
            { label: 'Attack surface', value: '0 bytes', desc: 'Payee stored only in ENS' },
            { label: 'On-chain proofs', value: 'HashScan', desc: 'Every settlement verifiable' },
          ].map((stat) => (
            <div key={stat.label} className="p-6 rounded-2xl border border-white/8 bg-white/[0.02] text-center hover:border-[#00FF59]/20 transition-colors duration-300">
              <p className="font-display text-3xl text-[#00FF59] mb-1">{stat.value}</p>
              <p className="font-semibold text-sm text-white mb-1">{stat.label}</p>
              <p className="font-mono text-[11px] text-[#586974]">{stat.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

