'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
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
      const isInteractive = target.closest('a, button, [role="button"], input, label');
      setIsHovering(!!isInteractive);
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const animate = () => {
      cursorPos.current.x = lerp(cursorPos.current.x, pos.current.x, 0.12);
      cursorPos.current.y = lerp(cursorPos.current.y, pos.current.y, 0.12);
      if (cursorRef.current) {
        const size = isHovering ? 48 : 24;
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
  }, [isHovering]);

  if (isHidden && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <>
      {/* Large ring cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full border border-[#00FF59]/60 mix-blend-difference transition-[width,height] duration-200"
        style={{ willChange: 'transform', transition: 'width 0.25s ease, height 0.25s ease' }}
      />
      {/* Small dot cursor */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none w-2 h-2 rounded-full bg-[#00FF59]"
        style={{ willChange: 'transform' }}
      />
    </>
  );
}

