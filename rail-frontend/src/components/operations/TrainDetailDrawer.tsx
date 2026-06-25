import { X } from 'lucide-react';
import type { ScheduleEntry, Train } from '../../types/railway';
import { getTrainStatus } from '../../lib/scheduleUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface TrainDetailDrawerProps {
  entry: ScheduleEntry | null;
  train: Train | null;
  onClose: () => void;
  onOverride?: (trainId: string) => void;
}

const statusVariant = {
  'on-time': 'success' as const,
  delayed: 'danger' as const,
  overridden: 'warning' as const,
  conflict: 'danger' as const,
};

export function TrainDetailDrawer({ entry, train, onClose, onOverride }: TrainDetailDrawerProps) {
  if (!entry) return null;

  const status = train ? getTrainStatus(entry, [train]) : 'on-time';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-600 bg-surface-2 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{entry.train_id}</h2>
            <p className="text-sm text-slate-400">
              {train?.origin} → {train?.destination}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[status]}>{status.replace('-', ' ')}</Badge>
            {train?.type && <Badge variant="info">{train.type}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded bg-surface-3 p-3">
              <div className="text-xs text-slate-400">Station</div>
              <div className="font-medium text-white">{entry.station_id}</div>
            </div>
            <div className="rounded bg-surface-3 p-3">
              <div className="text-xs text-slate-400">Platform</div>
              <div className="font-medium text-white">P{entry.assigned_platform}</div>
            </div>
            <div className="rounded bg-surface-3 p-3">
              <div className="text-xs text-slate-400">Arrival</div>
              <div className="font-medium text-white">
                {new Date(entry.actual_arrival).toLocaleString()}
              </div>
            </div>
            <div className="rounded bg-surface-3 p-3">
              <div className="text-xs text-slate-400">Departure</div>
              <div className="font-medium text-white">
                {new Date(entry.actual_departure).toLocaleString()}
              </div>
            </div>
          </div>

          {train?.scheduled_arrival && (
            <div className="rounded bg-surface-3 p-3 text-sm">
              <div className="text-xs text-slate-400">Scheduled arrival</div>
              <div className="text-white">{new Date(train.scheduled_arrival).toLocaleString()}</div>
            </div>
          )}

          {entry.reason && (
            <div className="rounded border border-slate-600 bg-slate-900/40 p-3 text-sm">
              <div className="text-xs text-slate-400">Reason</div>
              <div className="text-slate-200">{entry.reason}</div>
            </div>
          )}
        </div>

        {onOverride && (
          <div className="border-t border-slate-700 p-4">
            <Button className="w-full" variant="warning" onClick={() => onOverride(entry.train_id)}>
              Manual Override
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
