interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-700/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function KpiSkeleton() {
  return (
    <div className="flex gap-6 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading schedule">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="h-[280px] rounded border border-slate-700 bg-slate-900/40 p-4">
      <Skeleton className="h-full w-full" />
    </div>
  );
}
