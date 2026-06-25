import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-light',
  success: 'bg-success text-white hover:bg-success-dark',
  danger: 'bg-danger text-white hover:bg-danger-dark',
  warning: 'bg-warning text-slate-900 hover:bg-warning-light',
  secondary: 'border border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900/60',
  ghost: 'border border-slate-600 bg-surface-3 text-slate-200 hover:bg-slate-700',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  children: ReactNode;
}

export function Button({ variant = 'ghost', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`rounded px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
