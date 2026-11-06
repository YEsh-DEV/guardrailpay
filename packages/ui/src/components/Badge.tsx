import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#1A6CFF] text-white shadow hover:bg-[#0052E0]',
        secondary:
          'border-slate-200/80 bg-[#F8FAFC] text-[#0F172A] hover:bg-slate-100',
        destructive:
          'border-transparent bg-rose-500 text-white shadow hover:bg-rose-600',
        outline: 'border-slate-200 text-[#0F172A]',
        subtle: 'border-[#1A6CFF]/20 bg-[#E8F1FF] text-[#1A6CFF]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

