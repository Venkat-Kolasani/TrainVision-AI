import { useMemo } from 'react';
import { Wifi, WifiOff, AlertTriangle, Clock } from 'lucide-react';
import { useOperationsFeed } from '../../context/OperationsFeedContext';
import { computeKPIs } from '../../lib/scheduleUtils';

export function ContextStrip() {
  const {
    websocketConnected,
    conflictCount,
    activeDelays,
    schedule,
    trains,
    isStale,
    lastUpdated,
  } = useOperationsFeed();

  const kpis = useMemo(() => computeKPIs(schedule, trains), [schedule, trains]);

  const systemStatus =
    conflictCount > 0 ? 'CONFLICTS' : activeDelays.length > 0 ? 'DELAYS' : 'OPTIMAL';

  const statusColor =
    systemStatus === 'OPTIMAL'
      ? 'text-success'
      : systemStatus === 'CONFLICTS'
        ? 'text-danger'
        : 'text-warning';

  const scheduleAge = lastUpdated.schedule
    ? Math.round((Date.now() - lastUpdated.schedule.getTime()) / 1000)
    : null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-surface-2 px-4 py-2 text-sm">
      <div className={`flex items-center gap-1.5 font-medium ${statusColor}`}>
        {systemStatus === 'CONFLICTS' ? (
          <AlertTriangle className="h-4 w-4" aria-hidden />
        ) : (
          <Clock className="h-4 w-4" aria-hidden />
        )}
        <span>{systemStatus}</span>
      </div>

      <span className="text-slate-500">|</span>
      <span className="text-slate-300">
        <span className="font-mono tabular-nums">{kpis.total}</span> trains
      </span>
      <span className="text-slate-300">
        <span className="font-mono tabular-nums">{kpis.ontimePct}%</span> on-time
      </span>
      {conflictCount > 0 && (
        <span className="text-danger">
          <span className="font-mono tabular-nums">{conflictCount}</span> conflicts
        </span>
      )}
      {activeDelays.length > 0 && (
        <span className="text-warning">
          <span className="font-mono tabular-nums">{activeDelays.length}</span> delays
        </span>
      )}

      <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
        {websocketConnected ? (
          <span className="flex items-center gap-1 text-success">
            <Wifi className="h-3.5 w-3.5" /> Live
          </span>
        ) : (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3.5 w-3.5" /> Polling
          </span>
        )}
        {scheduleAge !== null && (
          <span className={isStale('schedule') ? 'text-warning' : ''}>
            Updated {scheduleAge}s ago
          </span>
        )}
      </span>
    </div>
  );
}
