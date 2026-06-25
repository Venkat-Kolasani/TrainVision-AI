import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function SectionCard({ title, subtitle, children, className = '', headerAction }: SectionCardProps) {
  return (
    <section className={`rounded-lg border border-slate-700/80 bg-surface-2 p-4 ${className}`}>
      {(title || headerAction) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      {children}
    </section>
  );
}
