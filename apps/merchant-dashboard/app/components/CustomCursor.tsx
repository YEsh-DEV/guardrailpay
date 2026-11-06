'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [hoverMode, setHoverMode] = useState<'default' | 'pointer' | 'card'>('default');
  const [isHidden, setIsHidden] = useState(true);
  const rafRef = useRef<number>(0);
  const pos = useRef({ x: 0, y: 0 });
  const cursorPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Only show on desktop
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setIsHidden(false);

    const handleMouseMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
      }
    };

    const handleMouseLeave = () => setIsHidden(true);
    const handleMouseEnter = () => setIsHidden(false);

    const checkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const isCard = !!target.closest('[data-cursor-card]');
      const isInteractive = !!target.closest('a, button, [role="button"], input, label, [data-cursor-hover]');

      if (isCard) {
        setHoverMode('card');
      } else if (isInteractive) {
        setHoverMode('pointer');
      } else {
        setHoverMode('default');
      }
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const animate = () => {
      cursorPos.current.x = lerp(cursorPos.current.x, pos.current.x, 0.14);
      cursorPos.current.y = lerp(cursorPos.current.y, pos.current.y, 0.14);
      if (cursorRef.current) {
        let size = 24;
        if (hoverMode === 'card') {
          size = 64;
        } else if (hoverMode === 'pointer') {
          size = 48;
        }
        cursorRef.current.style.transform = `translate(${cursorPos.current.x - size / 2}px, ${cursorPos.current.y - size / 2}px)`;
        cursorRef.current.style.width = `${size}px`;
        cursorRef.current.style.height = `${size}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousemove', checkHover);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousemove', checkHover);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [hoverMode]);

  if (isHidden && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <>
      {/* Outer ring cursor */}
      <div
        ref={cursorRef}
        className={`fixed top-0 left-0 z-[9999] pointer-events-none rounded-full flex items-center justify-center transition-[width,height,border-color,background-color,box-shadow] duration-200 ${
          hoverMode === 'card'
            ? 'border-2 border-[#00B4D8] bg-[#00B4D8]/20 shadow-[0_0_28px_rgba(0,180,216,0.6)] backdrop-blur-[1px]'
            : hoverMode === 'pointer'
            ? 'border border-[#00B4D8]/80 bg-[#0077B6]/15 shadow-[0_0_15px_rgba(0,180,216,0.35)]'
            : 'border border-[#00B4D8]/60 mix-blend-difference'
        }`}
        style={{ willChange: 'transform' }}
      >
        {hoverMode === 'card' && (
          <span className="font-mono text-[10px] font-bold text-[#00B4D8] tracking-wider uppercase select-none pointer-events-none animate-pulse">
            TILT
          </span>
        )}
      </div>

      {/* Small dot cursor */}
      <div
        ref={dotRef}
        className={`fixed top-0 left-0 z-[9999] pointer-events-none rounded-full transition-opacity duration-200 ${
          hoverMode === 'card' ? 'w-2 h-2 bg-[#00B4D8] opacity-0' : 'w-2 h-2 bg-[#00B4D8] opacity-100'
        }`}
        style={{ willChange: 'transform' }}
      />
    </>
  );
}
