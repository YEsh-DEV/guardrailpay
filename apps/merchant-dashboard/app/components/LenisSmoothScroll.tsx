'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LenisSmoothScrollProps {
  children: React.ReactNode;
}

export default function LenisSmoothScroll({ children }: LenisSmoothScrollProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let lenis: any;

    const initLenis = async () => {
      try {
        const { default: Lenis } = await import('lenis');
        lenis = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          wheelMultiplier: 1.0,
          touchMultiplier: 1.5,
          infinite: false,
        });

        let rafId: number;
        function raf(time: number) {
          if (lenis) lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        return () => {
          cancelAnimationFrame(rafId);
          if (lenis) lenis.destroy();
        };
      } catch (err) {
        console.warn('Lenis smooth scroll initialization skipped:', err);
      }
    };

    const cleanup = initLenis();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  return <>{children}</>;
}

