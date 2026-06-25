import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

export interface DelayImpact {
  current: number;
  predicted: number;
  difference: number;
}

interface OverrideModalProps {
  open: boolean;
  trainId: string | null;
  platform: number;
  message: string;
  delayImpact: DelayImpact | null;
  loading?: boolean;
  onPlatformChange: (platform: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function OverrideModal({
  open,
  trainId,
  platform,
  message,
  delayImpact,
  loading,
  onPlatformChange,
  onClose,
  onSubmit,
}: OverrideModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, [open]);

  if (!open || !trainId) return null;

  const impactLabel =
    delayImpact && delayImpact.difference > 2
      ? 'High delay impact'
      : delayImpact && delayImpact.difference > 0
        ? 'Moderate delay impact'
        : 'No additional delay';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-title"
        tabIndex={-1}
        className="relative z-50 w-full max-w-md rounded-lg border border-slate-700 bg-surface-2 p-6 shadow-xl"
      >
        <h2 id="override-title" className="text-lg font-semibold text-white">
          Manual override
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Train <span className="font-mono text-slate-200">{trainId}</span>
        </p>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
          New platform
          <input
            type="number"
            min={1}
            value={platform}
            onChange={(e) => onPlatformChange(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-600 bg-surface-1 px-3 py-2 font-mono text-slate-100 focus:border-primary focus:outline-none"
          />
        </label>
        {delayImpact && (
          <div
            className={`mt-3 rounded border p-3 text-sm ${
              delayImpact.difference > 2
                ? 'border-danger/50 bg-danger/10'
                : delayImpact.difference > 0
                  ? 'border-warning/50 bg-warning/10'
                  : 'border-success/50 bg-success/10'
            }`}
          >
            <p className="font-medium text-white">{impactLabel}</p>
            <dl className="mt-2 space-y-1 font-mono text-xs text-slate-300 tabular-nums">
              <div className="flex justify-between">
                <dt>Current</dt>
                <dd>{delayImpact.current.toFixed(1)} min</dd>
              </div>
              <div className="flex justify-between">
                <dt>Predicted</dt>
                <dd>{delayImpact.predicted.toFixed(1)} min</dd>
              </div>
              <div className="flex justify-between font-medium text-white">
                <dt>Impact</dt>
                <dd>
                  {delayImpact.difference > 0 ? '+' : ''}
                  {delayImpact.difference.toFixed(1)} min
                </dd>
              </div>
            </dl>
          </div>
        )}
        {message && <p className="mt-2 text-sm text-danger">{message}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={loading}>
            {delayImpact && delayImpact.difference > 2 ? 'Apply (high delay)' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DelayWarningModalProps {
  open: boolean;
  trainId: string;
  platform: number;
  delayImpact: DelayImpact | null;
  onCancel: () => void;
  onProceed: () => void;
}

export function DelayWarningModal({
  open,
  trainId,
  platform,
  delayImpact,
  onCancel,
  onProceed,
}: DelayWarningModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-labelledby="delay-warning-title"
        className="relative z-50 w-full max-w-md rounded-lg border border-danger/50 bg-surface-2 p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
          <h2 id="delay-warning-title" className="text-lg font-semibold text-danger">
            High delay warning
          </h2>
        </div>
        <p className="text-sm text-slate-300">
          Moving train <span className="font-mono text-white">{trainId}</span> to platform{' '}
          <span className="font-mono text-white">{platform}</span> will cause significant delays.
        </p>
        {delayImpact && (
          <dl className="mt-3 space-y-1 rounded border border-danger/30 bg-danger/10 p-3 font-mono text-sm tabular-nums text-slate-300">
            <div className="flex justify-between">
              <dt>Current delay</dt>
              <dd>{delayImpact.current.toFixed(1)} min</dd>
            </div>
            <div className="flex justify-between">
              <dt>Predicted delay</dt>
              <dd>{delayImpact.predicted.toFixed(1)} min</dd>
            </div>
            <div className="flex justify-between font-medium text-danger">
              <dt>Additional</dt>
              <dd>+{delayImpact.difference.toFixed(1)} min</dd>
            </div>
          </dl>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onProceed}>
            Proceed anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
