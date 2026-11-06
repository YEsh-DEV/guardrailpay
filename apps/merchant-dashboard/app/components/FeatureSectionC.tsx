'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

const nodes = [
  {
    id: 'agent',
    label: 'AI Agent',
    sublabel: 'claude-agent/2.0',
    bg: '#E3F2FD', // Frost Icy
    textColor: '#0A192F',
    border: '#90CAF9',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2"/>
        <path d="M5 20C5 16.5 8 14.5 12 14.5C16 14.5 19 16.5 19 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'guard',
    label: 'QuoteSeal Guard',
    sublabel: 'ENS identity verify',
    bg: '#2196F3', // Electric Action Azure
    textColor: '#FFFFFF',
    border: '#0D47A1',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 7V12C4 16.5 7.5 20 12 20C16.5 20 20 16.5 20 12V7L12 2Z" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'hedera',
    label: 'Hedera Network',
    sublabel: 'Consensus 296',
    bg: '#90CAF9', // Pastel Sky
    textColor: '#0A192F',
    border: '#2196F3',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L19 6.5V17.5L12 22L5 17.5V6.5L12 2Z" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 10H16M8 14H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'hashscan',
    label: 'HashScan',
    sublabel: 'Settled & verified',
    bg: '#0D47A1', // Deep Imperial Sapphire
    textColor: '#FFFFFF',
    border: '#2196F3',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="2"/>
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function FeatureSectionC() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

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
    <section ref={sectionRef} className="relative py-32 md:py-40 overflow-hidden bg-[#060E1A] text-white">
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(33,150,243,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(33,150,243,0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <span className="font-mono text-xs font-semibold text-[#2196F3] uppercase tracking-widest mb-3 block">
            Payment Flow Architecture
          </span>
          <h2 className="font-title-sans text-[clamp(36px,5vw,60px)] leading-[1.1] text-white mb-4">
            Move money,{' '}
            <em className="font-serif-accent not-italic text-[#90CAF9]">not heaven and earth.</em>
          </h2>
          <p className="text-[#90CAF9]/80 text-lg max-w-2xl mx-auto">
            The full autonomous payment pipeline — from HTTP 402 challenge to on-chain HashScan confirmation.
          </p>
        </motion.div>

        {/* Horizontal Flow Diagram with Cerulean Nodes */}
        <div className="relative">
          {/* Animated Connecting SVG Line */}
          <div className="hidden md:block absolute inset-0 pointer-events-none">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 140"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="tuyoRailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E3F2FD" stopOpacity="0.9" />
                  <stop offset="33%" stopColor="#2196F3" stopOpacity="1" />
                  <stop offset="66%" stopColor="#90CAF9" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0D47A1" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path
                d="M 125 70 C 240 70 260 70 375 70 C 490 70 510 70 625 70 C 740 70 760 70 875 70"
                stroke="rgba(144,202,249,0.12)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <motion.path
                ref={pathRef}
                d="M 125 70 C 240 70 260 70 375 70 C 490 70 510 70 625 70 C 740 70 760 70 875 70"
                stroke="url(#tuyoRailGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ pathLength }}
              />
            </svg>
          </div>

          {/* Nodes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 relative z-10">
            {nodes.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="flex flex-col items-center text-center group"
              >
                {/* Pastel Node Circle */}
                <motion.div
                  animate={{
                    scale: activeNode >= i ? 1.08 : 0.95,
                  }}
                  transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 shadow-md"
                  style={{
                    backgroundColor: node.bg,
                    color: node.textColor,
                    boxShadow: activeNode >= i ? `0 0 30px ${node.bg}80` : '0 10px 25px rgba(0,0,0,0.5)',
                  }}
                >
                  {node.icon}
                </motion.div>

                <p className="font-title-sans text-base text-white mb-1">
                  {node.label}
                </p>
                <p className="font-mono text-xs text-[#9BA9B2]">
                  {node.sublabel}
                </p>

                {/* Step Pill */}
                <div
                  className="mt-3 px-3 py-0.5 rounded-full font-mono text-[11px] font-bold"
                  style={{
                    backgroundColor: activeNode >= i ? node.bg : 'rgba(255,255,255,0.08)',
                    color: activeNode >= i ? node.textColor : 'rgba(255,255,255,0.4)',
                  }}
                >
                  Step 0{i + 1}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Technical Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          {[
            { label: 'Guard Latency', value: '<12ms', desc: 'Pre-flight ENS verification', color: '#2196F3' },
            { label: 'Signer Protection', value: '100%', desc: 'Signer count = 0 on attack', color: '#90CAF9' },
            { label: 'Hedera Settlement', value: 'HashScan', desc: 'Cryptographic receipt verified', color: '#E3F2FD' },
          ].map((stat) => (
            <div key={stat.label} className="p-6 rounded-2xl glass-panel-dark text-center">
              <p className="font-title-sans text-3xl mb-1" style={{ color: stat.color }}>{stat.value}</p>
              <p className="font-title-sans text-sm text-white mb-1">{stat.label}</p>
              <p className="font-mono text-xs text-[#90CAF9]/60">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
