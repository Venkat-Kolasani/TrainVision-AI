import type { ActiveDelay, ConflictItem } from '../../types/railway';
import { Badge } from '../ui/Badge';

interface AlertsPanelProps {
  conflictCount: number;
  conflicts: ConflictItem[];
  activeDelays: ActiveDelay[];
}

const severityVariant = {
  critical: 'danger' as const,
  high: 'danger' as const,
  medium: 'warning' as const,
  low: 'info' as const,
};

export function AlertsPanel({ conflictCount, conflicts, activeDelays }: AlertsPanelProps) {
  const affectedTrains = new Set([
    ...conflicts.flatMap((c) => c.trains_involved || []),
    ...activeDelays.map((d) => d.train_id),
  ]);

  const totalDelayImpact = activeDelays.reduce((sum, d) => sum + d.minutes, 0);
  const systemStatus =
    conflictCount > 0 ? 'CONFLICTS' : activeDelays.length > 0 ? 'DELAYS' : 'OPTIMAL';
  const statusColor =
    systemStatus === 'OPTIMAL' ? 'text-success' : systemStatus === 'CONFLICTS' ? 'text-danger' : 'text-warning';

  return (
    <div className="mt-5 border-t border-slate-700/80 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">System Alerts</h3>
        <Badge variant={systemStatus === 'OPTIMAL' ? 'success' : systemStatus === 'CONFLICTS' ? 'danger' : 'warning'}>
          {systemStatus}
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-danger/20 bg-surface-3/60 p-3">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            Active Conflicts ({conflictCount})
          </h4>
          <div className="max-h-36 space-y-2 overflow-y-auto">
            {conflicts.length === 0 ? (
              <p className="text-xs text-slate-400">No schedule conflicts detected.</p>
            ) : (
              conflicts.map((conflict, idx) => (
                <div key={conflict.id || idx} className="rounded border border-slate-600/60 bg-slate-800/60 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize text-red-300">
                      {(conflict.type || 'platform').replace(/_/g, ' ')}
                    </span>
                    {conflict.severity && (
                      <Badge variant={severityVariant[conflict.severity as keyof typeof severityVariant] || 'neutral'}>
                        {conflict.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-slate-300">
                    {conflict.trains_involved?.join(', ') || 'Multiple trains'}
                    {conflict.station_id && ` @ ${conflict.station_id}`}
                    {conflict.platform != null && ` P${conflict.platform}`}
                  </p>
                  {conflict.root_cause && (
                    <p className="mt-1 text-slate-400">{conflict.root_cause}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-warning/20 bg-surface-3/60 p-3">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
            <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
            Active Delays ({activeDelays.length})
          </h4>
          <div className="max-h-36 space-y-2 overflow-y-auto">
            {activeDelays.length === 0 ? (
              <p className="text-xs text-slate-400">No active delays.</p>
            ) : (
              activeDelays.map((delay) => (
                <div key={delay.train_id} className="rounded border border-slate-600/60 bg-slate-800/60 p-2 text-xs">
                  <div className="font-medium capitalize text-yellow-300">{delay.type}</div>
                  <p className="text-slate-300">
                    Train {delay.train_id} — {delay.minutes} min
                  </p>
                  {delay.reason && <p className="mt-1 text-slate-400">{delay.reason}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-slate-600/60 bg-surface-3/40 p-3 text-center text-xs">
        <div>
          <div className="text-slate-400">Affected trains</div>
          <div className="text-lg font-bold text-white">{affectedTrains.size}</div>
        </div>
        <div>
          <div className="text-slate-400">Delay impact</div>
          <div className="text-lg font-bold text-warning">{totalDelayImpact.toFixed(0)} min</div>
        </div>
        <div>
          <div className="text-slate-400">Status</div>
          <div className={`text-lg font-bold ${statusColor}`}>{systemStatus}</div>
        </div>
      </div>
    </div>
  );
}
