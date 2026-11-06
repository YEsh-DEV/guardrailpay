'use client';

import React, { useRef, useState } from 'react';
import { clsx } from 'clsx';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'danger';
  children: React.ReactNode;
  magneticStrength?: number;
  className?: string;
  asChild?: boolean;
}

export function MagneticButton({
  variant = 'primary',
  children,
  magneticStrength = 0.25,
  className,
  onClick,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const deltaX = (clientX - centerX) * magneticStrength;
    const deltaY = (clientY - centerY) * magneticStrength;
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const variantStyles = {
    primary:
      'bg-[#00FF59] text-[#081014] hover:bg-[#9AEA62] hover:shadow-[0_0_30px_rgba(0,255,89,0.5)] font-semibold border border-[#00FF59]',
    secondary:
      'bg-transparent text-white border border-white/20 hover:border-white/50 hover:bg-white/5',
    glass:
      'bg-white/5 backdrop-blur-xl text-white border border-white/10 hover:border-[#00FF59]/40 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(0,255,89,0.2)]',
    danger:
      'bg-rose-600/90 text-white border border-rose-500/50 hover:bg-rose-500 hover:shadow-[0_0_25px_rgba(255,59,48,0.4)]',
  }[variant];

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: position.x === 0 ? 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'transform 0.1s ease-out',
      }}
      className={clsx(
        'relative inline-flex items-center justify-center px-6 py-3.5 rounded-full font-sans text-sm tracking-wide cursor-pointer select-none active:scale-[0.98]',
        variantStyles,
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}

