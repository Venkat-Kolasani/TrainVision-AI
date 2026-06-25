import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { Button } from '../ui/Button';
import { notify } from '../../lib/notify';
import {
  injectConflict,
  injectDelay,
  startMovementSimulation,
  createTestMovements,
  forceConflict,
} from '../../lib/operationsApi';
import { DelayInjectionModal } from './DelayInjectionModal';

interface SimulationDiagnosticsProps {
  trains: { id: string }[];
  onRefresh: () => Promise<void>;
}

export function SimulationDiagnostics({ trains, onRefresh }: SimulationDiagnosticsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(trains[0]?.id ?? '');
  const [delayType, setDelayType] = useState('breakdown');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [delayReason, setDelayReason] = useState('');

  const run = async (action: () => Promise<void>, success: string) => {
    setLoading(true);
    try {
      await action();
      notify.success(success);
      await onRefresh();
    } catch (e) {
      notify.error('Diagnostic action failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-slate-700 bg-surface-2">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium text-white">
          <Wrench className="h-4 w-4 text-slate-400" />
          Diagnostics
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-500">
            Test tools for validating conflict detection and optimizer behavior. Not for live operations.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() =>
                void run(async () => {
                  const result = await injectConflict();
                  if (result.status === 'conflict_rejected') {
                    notify.warning('Conflict injection rejected', String(result.reason));
                  }
                }, 'Conflict injection completed')
              }
            >
              Inject conflict
            </Button>
            <Button variant="ghost" disabled={loading} onClick={() => setShowDelayModal(true)}>
              Inject delay
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => void run(() => startMovementSimulation(), 'Movement simulation started')}
            >
              Start movement
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() =>
                void run(async () => {
                  const data = await createTestMovements();
                  notify.info('Test movements', data.message);
                }, 'Test movements created')
              }
            >
              Test movements
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() =>
                void run(async () => {
                  const data = await forceConflict();
                  notify.warning('Conflict forced', data.message);
                }, 'Force conflict completed')
              }
            >
              Force conflict
            </Button>
          </div>
        </div>
      )}

      <DelayInjectionModal
        open={showDelayModal}
        trains={trains}
        selectedTrain={selectedTrain}
        delayType={delayType}
        delayMinutes={delayMinutes}
        delayReason={delayReason}
        loading={loading}
        onTrainChange={setSelectedTrain}
        onTypeChange={setDelayType}
        onMinutesChange={setDelayMinutes}
        onReasonChange={setDelayReason}
        onClose={() => setShowDelayModal(false)}
        onSubmit={() =>
          void run(async () => {
            await injectDelay({
              train_id: selectedTrain,
              delay_type: delayType,
              delay_minutes: delayMinutes,
              reason: delayReason || undefined,
            });
            setShowDelayModal(false);
          }, 'Delay injected')
        }
      />
    </div>
  );
}
