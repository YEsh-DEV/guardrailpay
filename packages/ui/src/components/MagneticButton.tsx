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
      'bg-[#00B4D8] text-[#03045E] hover:bg-[#90E0EF] hover:shadow-[0_0_30px_rgba(0,180,216,0.6)] font-bold border border-[#00B4D8]',
    secondary:
      'bg-transparent text-[#CAF0F8] border border-[#0077B6]/40 hover:border-[#00B4D8] hover:bg-[#0077B6]/15',
    glass:
      'bg-[#03045E]/40 backdrop-blur-xl text-[#CAF0F8] border border-[#90E0EF]/20 hover:border-[#00B4D8]/60 hover:bg-[#0077B6]/20 hover:shadow-[0_0_20px_rgba(0,180,216,0.3)]',
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

