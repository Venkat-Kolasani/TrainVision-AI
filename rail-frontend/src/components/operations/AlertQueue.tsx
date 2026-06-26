import { useMemo, useState } from 'react';
import type { ActiveDelay, ConflictItem } from '../../types/railway';
import { Badge } from '../ui/Badge';

const ACK_KEY = 'trainvision_alert_acks';

type AlertKind = 'conflict' | 'delay';
type SortKey = 'severity' | 'time';

interface AlertItem {
  id: string;
  kind: AlertKind;
  trainIds: string[];
  title: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
}

interface AlertQueueProps {
  conflicts: ConflictItem[];
  activeDelays: ActiveDelay[];
  onSelectTrain?: (trainId: string) => void;
  onAckAll?: () => void;
}

function loadAcks(): Set<string> {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveAcks(acks: Set<string>) {
  localStorage.setItem(ACK_KEY, JSON.stringify([...acks]));
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export function AlertQueue({ conflicts, activeDelays, onSelectTrain, onAckAll }: AlertQueueProps) {
  const [acks, setAcks] = useState<Set<string>>(() => loadAcks());
  const [sortBy, setSortBy] = useState<SortKey>('severity');
  const [showAcked, setShowAcked] = useState(false);

  const alerts = useMemo(() => {
    const items: AlertItem[] = [];
    conflicts.forEach((c, i) => {
      const trains = c.trains_involved || [];
      items.push({
        id: c.id || `conflict-${i}`,
        kind: 'conflict',
        trainIds: trains,
        title: (c.type || 'platform conflict').replace(/_/g, ' '),
        detail: c.description || c.root_cause || trains.join(', '),
        severity: (c.severity as AlertItem['severity']) || 'high',
        timestamp: Date.now() - i * 1000,
      });
    });
    activeDelays.forEach((d) => {
      items.push({
        id: `delay-${d.train_id}`,
        kind: 'delay',
        trainIds: [d.train_id],
        title: 'Active delay',
        detail: `${d.minutes} min — ${d.reason || d.type}`,
        severity: d.minutes >= 15 ? 'high' : d.minutes >= 5 ? 'medium' : 'low',
        timestamp: Date.now(),
      });
    });
    return items.sort((a, b) => {
      if (sortBy === 'severity') {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.timestamp - a.timestamp;
    });
  }, [conflicts, activeDelays, sortBy]);

  const visible = alerts.filter((a) => showAcked || !acks.has(a.id));
  const unackedCount = alerts.filter((a) => !acks.has(a.id)).length;

  const ack = (id: string) => {
    const next = new Set(acks);
    next.add(id);
    setAcks(next);
    saveAcks(next);
  };

  const ackAll = () => {
    const next = new Set(acks);
    alerts.forEach((a) => next.add(a.id));
    setAcks(next);
    saveAcks(next);
    onAckAll?.();
  };

  return (
    <div className="mt-4 border-t border-slate-700/80 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          Alert queue
          {unackedCount > 0 && (
            <Badge variant="danger" className="ml-2">
              {unackedCount}
            </Badge>
          )}
        </h3>
        <div className="flex gap-1 text-[10px]">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-slate-300"
            aria-label="Sort alerts"
          >
            <option value="severity">Severity</option>
            <option value="time">Recent</option>
          </select>
          <button
            type="button"
            className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-400 hover:text-white"
            onClick={() => setShowAcked((v) => !v)}
          >
            {showAcked ? 'Hide ack' : 'Show ack'}
          </button>
          {unackedCount > 0 && (
            <button
              type="button"
              className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-400 hover:text-white"
              onClick={ackAll}
            >
              Ack all
            </button>
          )}
        </div>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-xs text-slate-500">No active alerts.</p>
        ) : (
          visible.map((alert) => (
            <div
              key={alert.id}
              className={`rounded border p-2 text-xs ${
                acks.has(alert.id)
                  ? 'border-slate-700 bg-slate-800/30 opacity-60'
                  : alert.kind === 'conflict'
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-warning/30 bg-warning/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize text-slate-200">{alert.title}</span>
                    <Badge
                      variant={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'danger'
                          : alert.severity === 'medium'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-slate-400">{alert.detail}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {alert.trainIds.map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        className="font-mono text-primary hover:underline"
                        onClick={() => onSelectTrain?.(tid)}
                      >
                        {tid}
                      </button>
                    ))}
                  </div>
                </div>
                {!acks.has(alert.id) && (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-600 px-2 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                    onClick={() => ack(alert.id)}
                  >
                    Ack
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
