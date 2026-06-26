import { useState } from 'react';
import { AlertTriangle, FlaskConical, Lightbulb } from 'lucide-react';
import { notify } from '../lib/notify';
import { diagnosticsEnabled } from '../lib/devFlags';

interface Train {
  id: string;
  type?: string;
  origin?: string;
  destination?: string;
}

interface ConflictTestingPanelProps {
  trains: Train[];
  apiBase: string;
  onDataRefresh?: () => Promise<void>;
}

export function ConflictTestingPanel({
  trains,
  apiBase,
  onDataRefresh,
}: ConflictTestingPanelProps) {
  const [selectedTrain, setSelectedTrain] = useState<string>('');
  const [overridePlatform, setOverridePlatform] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  if (!diagnosticsEnabled) return null;

  const submitOverrideForTrain = async (
    trainId: string,
    stationId: string,
    platform: number
  ) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          train_id: trainId,
          station_id: stationId,
          new_platform: platform,
        }),
      });
      const resp = await response.json();

      if (response.ok) {
        notify.success(`Override applied for ${trainId}`, `Platform ${platform} at ${stationId}`);
        await onDataRefresh?.();
      } else {
        notify.error('Override failed', resp.detail || JSON.stringify(resp));
      }
    } catch {
      notify.error('Network error during override');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-2 rounded-lg border border-slate-700 p-6">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-100">
        <FlaskConical className="h-5 w-5 text-warning" />
        Advanced testing
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Developer tools for validating optimizer conflict resolution and feasibility checks.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-surface-3 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-medium text-slate-100">
            <AlertTriangle className="h-4 w-4 text-danger" />
            Create Platform Conflict
          </h3>
          <p className="mb-3 text-sm text-slate-300">
            Force two trains to the same platform at overlapping times to test conflict resolution.
          </p>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Train 1</label>
              <select
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                disabled={loading}
                onChange={(e) => {
                  const train = trains.find((t) => t.id === e.target.value);
                  if (train) {
                    void submitOverrideForTrain(train.id, train.origin || 'HYB', 1);
                  }
                  e.target.value = '';
                }}
                defaultValue=""
              >
                <option value="">Select train to force to Platform 1</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} ({t.type}) - {t.origin}→{t.destination}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Train 2</label>
              <select
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                disabled={loading}
                onChange={(e) => {
                  const train = trains.find((t) => t.id === e.target.value);
                  if (train) {
                    void submitOverrideForTrain(train.id, train.origin || 'HYB', 1);
                  }
                  e.target.value = '';
                }}
                defaultValue=""
              >
                <option value="">Select another train to force to Platform 1</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} ({t.type}) - {t.origin}→{t.destination}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-3 p-4">
          <h3 className="mb-2 font-medium text-slate-100">Manual Override Test</h3>
          <p className="mb-3 text-sm text-slate-300">
            Test the feasibility checker by moving a train to an occupied platform.
          </p>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Train to Override</label>
              <select
                value={selectedTrain}
                onChange={(e) => setSelectedTrain(e.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                disabled={loading}
              >
                <option value="">Select train</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} ({t.type}) - {t.origin}→{t.destination}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Target Platform</label>
              <input
                type="number"
                min={1}
                max={4}
                value={overridePlatform}
                onChange={(e) => setOverridePlatform(Number(e.target.value))}
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                disabled={loading}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!selectedTrain) return;
                const train = trains.find((t) => t.id === selectedTrain);
                void submitOverrideForTrain(
                  selectedTrain,
                  train?.origin || 'HYB',
                  overridePlatform
                );
              }}
              disabled={!selectedTrain || loading}
              className="w-full rounded bg-warning px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-slate-600 disabled:text-slate-400"
            >
              Test Override
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-900 p-3">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Lightbulb className="h-4 w-4 text-info" />
          How to test conflicts
        </h4>
        <ul className="space-y-1 text-xs text-slate-300">
          <li>1. Select two trains with overlapping times (e.g. T101 and T104 around 09:00)</li>
          <li>2. Force both to Platform 1 using the dropdowns above</li>
          <li>3. Watch the optimizer resolve the conflict via delay or reassignment</li>
          <li>4. Try manual overrides to see feasibility checking in action</li>
          <li>5. Check audit logs on the Operations dashboard for resolution reasoning</li>
        </ul>
      </div>
    </div>
  );
}
