import { Button } from '../ui/Button';

interface OperationsPanelProps {
  activeDelayCount: number;
  selectedTrainId?: string | null;
  onManualOverride: () => void;
  onClearDelays: () => void;
}

export function OperationsPanel({
  activeDelayCount,
  selectedTrainId,
  onManualOverride,
  onClearDelays,
}: OperationsPanelProps) {
  return (
    <div className="space-y-2 border-t border-slate-700/80 pt-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Operations</p>
      {selectedTrainId && (
        <p className="text-xs text-slate-400">
          Selected: <span className="font-mono text-primary">{selectedTrainId}</span>
        </p>
      )}
      <Button variant="secondary" className="w-full justify-center" onClick={onManualOverride}>
        Manual override
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-center"
        onClick={onClearDelays}
        disabled={activeDelayCount === 0}
      >
        Clear delays ({activeDelayCount})
      </Button>
    </div>
  );
}
