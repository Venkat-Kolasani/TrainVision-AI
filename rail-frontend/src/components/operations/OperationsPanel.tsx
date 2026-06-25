import { Button } from '../ui/Button';

interface OperationsPanelProps {
  activeDelayCount: number;
  onManualOverride: () => void;
  onClearDelays: () => void;
}

export function OperationsPanel({
  activeDelayCount,
  onManualOverride,
  onClearDelays,
}: OperationsPanelProps) {
  return (
    <div className="space-y-2 border-t border-slate-700/80 pt-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Operations</p>
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
