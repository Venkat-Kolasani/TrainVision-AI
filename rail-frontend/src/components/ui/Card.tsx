import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-surface-2 p-4 shadow ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="font-semibold text-slate-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
