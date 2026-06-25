import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'bg-danger hover:bg-danger/90'
      : variant === 'warning'
        ? 'bg-warning hover:bg-warning/90 text-slate-900'
        : 'bg-primary hover:bg-primary-light';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative z-[61] w-full max-w-md rounded-lg border border-slate-600 bg-surface-2 p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start gap-3">
          {(variant === 'danger' || variant === 'warning') && (
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${variant === 'danger' ? 'text-danger' : 'text-warning'}`}
            />
          )}
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm text-slate-300">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-600 bg-surface-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-sm font-medium text-white ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
