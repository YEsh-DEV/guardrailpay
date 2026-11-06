'use client';

import React from 'react';
import { clsx } from 'clsx';
import { VerdictStatus } from '../types';

interface VerdictBadgeProps {
  status: VerdictStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function VerdictBadge({
  status,
  size = 'md',
  showDot = true,
  className,
}: VerdictBadgeProps) {
  const config = {
    PASS: {
      bg: 'bg-[#03045E]/80',
      border: 'border-[#00B4D8]/50',
      text: 'text-[#00B4D8]',
      glow: 'shadow-[0_0_15px_-3px_rgba(0,180,216,0.5)]',
      dot: 'bg-[#00B4D8]',
      label: 'VERIFIED · PASS',
    },
    BLOCK: {
      bg: 'bg-rose-950/80',
      border: 'border-rose-500/50',
      text: 'text-rose-400',
      glow: 'shadow-[0_0_15px_-3px_rgba(255,59,48,0.4)]',
      dot: 'bg-rose-400',
      label: 'DEFENDED · BLOCK',
    },
    HOLD: {
      bg: 'bg-amber-950/80',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_15px_-3px_rgba(255,159,10,0.3)]',
      dot: 'bg-amber-400',
      label: 'TIMELOCK · HOLD',
    },
    UNVERIFIABLE: {
      bg: 'bg-slate-900/90',
      border: 'border-slate-700',
      text: 'text-slate-400',
      glow: 'shadow-none',
      dot: 'bg-slate-500',
      label: 'UNKNOWN · UNVERIFIABLE',
    },
  }[status];

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3.5 py-1 gap-2',
    lg: 'text-sm px-4 py-1.5 gap-2.5 font-semibold',
  }[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-mono font-medium border backdrop-blur-md transition-all',
        config.bg,
        config.border,
        config.text,
        config.glow,
        sizeClasses,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.dot
            )}
          />
          <span className={clsx('relative inline-flex rounded-full h-2 w-2', config.dot)} />
        </span>
      )}
      {config.label}
    </span>
  );
}

