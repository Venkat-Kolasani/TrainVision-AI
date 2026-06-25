import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface QuickActionsPanelProps {
  loading?: boolean;
  websocketConnected: boolean;
  trainCount: number;
  conflictCount: number;
  activeDelayCount: number;
  trackCount: number;
  onManualOverride: () => void;
  onInjectConflict: () => void;
  onInjectDelay: () => void;
  onClearDelays: () => void;
  onStartMovement: () => void;
  onCreateTestMovements: () => void;
  onForceConflict: () => void;
  onRefreshLogs: () => void;
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'info' | 'neutral';
}) {
  const tones = {
    success: 'border-success/30 bg-success/10 text-success',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-info/30 bg-info/10 text-info',
    neutral: 'border-slate-600 bg-slate-800/60 text-slate-300',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function QuickActionsPanel({
  loading,
  websocketConnected,
  trainCount,
  conflictCount,
  activeDelayCount,
  trackCount,
  onManualOverride,
  onInjectConflict,
  onInjectDelay,
  onClearDelays,
  onStartMovement,
  onCreateTestMovements,
  onForceConflict,
  onRefreshLogs,
}: QuickActionsPanelProps) {
  return (
    <div className="col-span-1 flex flex-col rounded-lg border border-slate-700 bg-surface-2 p-4 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">Actions</h3>
        <Badge variant={websocketConnected ? 'success' : 'danger'}>
          {websocketConnected ? 'Live' : 'Offline'}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatusPill label="Trains" value={String(trainCount)} tone="info" />
        <StatusPill
          label="Conflicts"
          value={conflictCount > 0 ? String(conflictCount) : 'None'}
          tone={conflictCount > 0 ? 'danger' : 'success'}
        />
        <StatusPill label="Delays" value={String(activeDelayCount)} tone={activeDelayCount > 0 ? 'danger' : 'neutral'} />
        <StatusPill label="Tracks" value={String(trackCount)} tone="neutral" />
      </div>

      <div className="mb-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Operations</p>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-center" onClick={onManualOverride}>
            Manual Override
          </Button>
          <Button
            variant="warning"
            className="w-full justify-center"
            onClick={onClearDelays}
            disabled={activeDelayCount === 0}
          >
            Clear Delays ({activeDelayCount})
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={onRefreshLogs}>
            Refresh Audit Logs
          </Button>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-700 pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Simulation tools</p>
        <div className="space-y-2">
          <Button variant="warning" className="w-full justify-center text-xs" onClick={onInjectConflict} disabled={loading}>
            Inject Conflict
          </Button>
          <Button variant="danger" className="w-full justify-center text-xs" onClick={onInjectDelay}>
            Inject Delay
          </Button>
          <Button variant="success" className="w-full justify-center text-xs" onClick={onStartMovement}>
            Start Movement
          </Button>
          <Button variant="secondary" className="w-full justify-center text-xs" onClick={onCreateTestMovements}>
            Test Movements
          </Button>
          <Button variant="danger" className="w-full justify-center text-xs" onClick={onForceConflict}>
            Force Conflict
          </Button>
        </div>
      </div>
    </div>
  );
}
