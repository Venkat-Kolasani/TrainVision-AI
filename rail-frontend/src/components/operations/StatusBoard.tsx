import type { SystemHealth } from '../../context/DashboardShellContext';

interface StatusBoardProps {
  trainCount: number;
  onTimePct: number;
  conflictCount: number;
  avgDelay: string;
  systemHealth: SystemHealth;
}

const healthStyles: Record<SystemHealth, string> = {
  OPTIMAL: 'text-success border-success/30',
  DELAYS: 'text-warning border-warning/30',
  CONFLICTS: 'text-danger border-danger/30',
};

export function StatusBoard({
  trainCount,
  onTimePct,
  conflictCount,
  avgDelay,
  systemHealth,
}: StatusBoardProps) {
  const metrics = [
    { label: 'Trains', value: String(trainCount) },
    { label: 'On-time', value: `${onTimePct}%` },
    { label: 'Conflicts', value: conflictCount > 0 ? String(conflictCount) : 'None' },
    { label: 'Avg delay', value: `${avgDelay}m` },
  ];

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center justify-between rounded border bg-surface-3/50 px-3 py-2 ${healthStyles[systemHealth]}`}
        role="status"
      >
        <span className="text-[10px] font-medium uppercase tracking-widest">System status</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{systemHealth}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-slate-700/80 bg-surface-3/40 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{m.label}</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-white">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
