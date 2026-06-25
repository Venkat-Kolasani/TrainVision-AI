import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';

const DELAY_TYPES = [
  { value: 'breakdown', label: 'Train breakdown' },
  { value: 'weather', label: 'Bad weather' },
  { value: 'signal', label: 'Signal failure' },
  { value: 'passenger', label: 'Passenger issue' },
  { value: 'maintenance', label: 'Maintenance' },
] as const;

interface DelayInjectionModalProps {
  open: boolean;
  trains: { id: string }[];
  selectedTrain: string | null;
  delayType: string;
  delayMinutes: number;
  delayReason: string;
  loading?: boolean;
  onTrainChange: (id: string) => void;
  onTypeChange: (type: string) => void;
  onMinutesChange: (min: number) => void;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function DelayInjectionModal({
  open,
  trains,
  selectedTrain,
  delayType,
  delayMinutes,
  delayReason,
  loading,
  onTrainChange,
  onTypeChange,
  onMinutesChange,
  onReasonChange,
  onClose,
  onSubmit,
}: DelayInjectionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delay-inject-title"
        tabIndex={-1}
        className="relative z-50 w-full max-w-md rounded-lg border border-slate-700 bg-surface-2 p-6"
      >
        <h2 id="delay-inject-title" className="text-lg font-semibold text-white">
          Inject delay
        </h2>
        <p className="mt-1 text-sm text-slate-400">Simulation tool — models a disruption scenario.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase text-slate-500">
            Train
            <select
              value={selectedTrain ?? ''}
              onChange={(e) => onTrainChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-surface-1 px-3 py-2 text-sm text-slate-100"
            >
              {trains.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase text-slate-500">
            Type
            <select
              value={delayType}
              onChange={(e) => onTypeChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-surface-1 px-3 py-2 text-sm text-slate-100"
            >
              {DELAY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase text-slate-500">
            Minutes
            <input
              type="number"
              min={1}
              value={delayMinutes}
              onChange={(e) => onMinutesChange(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-600 bg-surface-1 px-3 py-2 font-mono text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium uppercase text-slate-500">
            Reason (optional)
            <input
              type="text"
              value={delayReason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-surface-1 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={loading || !selectedTrain}>
            Inject delay
          </Button>
        </div>
      </div>
    </div>
  );
}
