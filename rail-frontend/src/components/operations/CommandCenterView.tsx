import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { Recommendation, ActiveDelay, ConflictItem } from '../../types/railway';
import type { SystemHealth } from '../../context/DashboardShellContext';
import { PRODUCT_COPY } from '../../lib/productCopy';
import { NetworkMap, type TrainPosition } from './NetworkMap';
import type { ScheduleEntry, Station, Train } from '../../types/railway';
import type { ActivityLogEntry } from './ActivityPanel';
import { formatAuditDetails, stripEmoji } from '../../lib/auditFormat';
import { Button } from '../ui/Button';

interface CommandCenterViewProps {
  now: Date;
  systemHealth: SystemHealth;
  websocketConnected: boolean;
  pauseRefresh: boolean;
  alertSoundEnabled: boolean;
  stations: Station[];
  schedule: ScheduleEntry[];
  trains: Train[];
  trainPositions: TrainPosition[];
  animTick: number;
  conflictCount: number;
  conflicts: ConflictItem[];
  activeDelays: ActiveDelay[];
  onTimePct: number;
  recommendations: Recommendation[];
  logs: ActivityLogEntry[];
  onClose: () => void;
  onTogglePause: () => void;
  onToggleAlertSound: () => void;
  onApplyRecommendation?: (id: string) => void;
}

export function CommandCenterView({
  now,
  systemHealth,
  websocketConnected,
  pauseRefresh,
  alertSoundEnabled,
  stations,
  schedule,
  trains,
  trainPositions,
  animTick,
  conflictCount,
  conflicts,
  activeDelays,
  onTimePct,
  recommendations,
  logs,
  onClose,
  onTogglePause,
  onToggleAlertSound,
  onApplyRecommendation,
}: CommandCenterViewProps) {
  const topRecs = recommendations.slice(0, 3);
  const ticker = logs.slice(0, 5);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-1 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Hyderabad corridor
          </span>
          <span
            className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${
              websocketConnected ? 'border-success/40 text-success' : 'border-danger/40 text-danger'
            }`}
          >
            {websocketConnected ? 'LIVE' : 'OFFLINE'}
          </span>
          <time className="font-mono text-lg tabular-nums text-white">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </time>
          <span
            className={`font-mono text-sm font-semibold uppercase ${
              systemHealth === 'CONFLICTS'
                ? 'text-danger'
                : systemHealth === 'DELAYS'
                  ? 'text-warning'
                  : 'text-success'
            }`}
          >
            {systemHealth}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onTogglePause} aria-pressed={pauseRefresh}>
            {pauseRefresh ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {pauseRefresh ? 'Resume' : 'Pause'} refresh
          </Button>
          <Button variant="ghost" onClick={onToggleAlertSound} aria-pressed={alertSoundEnabled}>
            {alertSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Alert sound
          </Button>
          <Button variant="ghost" onClick={onClose} aria-label="Exit command center">
            <X className="h-4 w-4" />
            Exit
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-[50vh] flex-1 p-4 lg:min-h-0">
          <p className="mb-2 text-xs text-slate-500">{PRODUCT_COPY.commandCenter}</p>
          <NetworkMap
            stations={stations}
            schedule={schedule}
            trains={trains}
            trainPositions={trainPositions}
            animTick={animTick}
            className="h-full min-h-[320px]"
          />
        </div>
        <aside className="w-full shrink-0 border-t border-slate-700 bg-surface-2 p-4 lg:w-80 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Conflicts ({conflictCount})
              </h3>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-sm">
                {conflicts.length === 0 ? (
                  <li className="text-slate-400">All clear</li>
                ) : (
                  conflicts.map((c, i) => (
                    <li key={c.id || i} className="font-mono text-danger">
                      {(c.trains_involved || []).join(', ')} @ {c.station_id || 'network'}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Delays ({activeDelays.length})
              </h3>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-sm">
                {activeDelays.length === 0 ? (
                  <li className="text-slate-400">None active</li>
                ) : (
                  activeDelays.map((d) => (
                    <li key={d.train_id} className="font-mono text-warning">
                      {d.train_id} +{d.minutes}m
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                On-time performance
              </h3>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-white">{onTimePct}%</p>
            </div>
            {topRecs.length > 0 && (
              <div>
                <h3 className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                  Next actions
                </h3>
                <ul className="mt-2 space-y-2">
                  {topRecs.map((rec) => (
                    <li key={rec.id} className="rounded border border-slate-600 bg-surface-3/50 p-2 text-xs">
                      <p className="text-slate-200">{rec.description}</p>
                      {onApplyRecommendation && (
                        <button
                          type="button"
                          onClick={() => onApplyRecommendation(rec.id)}
                          className="mt-1 text-primary hover:underline"
                        >
                          Apply
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="border-t border-slate-700 bg-surface-2 px-4 py-2">
        <div className="flex gap-6 overflow-hidden font-mono text-xs text-slate-400">
          {ticker.length === 0 ? (
            <span>No recent activity</span>
          ) : (
            ticker.map((log, i) => (
              <span key={i} className="shrink-0 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()} —{' '}
                {stripEmoji(formatAuditDetails(log.details).title)}: {stripEmoji(log.details).slice(0, 80)}
              </span>
            ))
          )}
        </div>
      </footer>
    </div>
  );
}
