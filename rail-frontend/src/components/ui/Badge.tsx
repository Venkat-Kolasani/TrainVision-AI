import type { ReactNode } from 'react';

const variants = {
  success: 'bg-success/20 text-success border-success/30',
  warning: 'bg-warning/20 text-warning border-warning/30',
  danger: 'bg-danger/20 text-danger border-danger/30',
  info: 'bg-info/20 text-info border-info/30',
  neutral: 'bg-slate-600/40 text-slate-300 border-slate-500/30',
} as const;

interface BadgeProps {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
