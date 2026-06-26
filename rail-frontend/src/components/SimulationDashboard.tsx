import React, { useState, useEffect } from 'react';
import { Play, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, Train, Zap, X } from 'lucide-react';
import { ConflictTestingPanel } from './ConflictTestingPanel';
import { SimulationDiagnostics } from './operations/SimulationDiagnostics';
import { TrainGraph } from './operations/TrainGraph';
import { PageHeader } from './layout/PageHeader';
import { EmptyState } from './layout/EmptyState';
import { SectionCard } from './layout/SectionCard';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { notify } from '../lib/notify';
import { PRODUCT_COPY } from '../lib/productCopy';
import { useOperationsFeed } from '../context/OperationsFeedContext';
import type { ScheduleEntry } from '../types/railway';

function scheduleRowChanged(entry: ScheduleEntry, baseline: ScheduleEntry[]) {
  const base = baseline.find(
    (x) => x.train_id === entry.train_id && x.station_id === entry.station_id
  );
  if (!base) return true;
  return (
    base.assigned_platform !== entry.assigned_platform ||
    base.actual_arrival !== entry.actual_arrival ||
    base.actual_departure !== entry.actual_departure
  );
}

interface SimulationScenario {
  scenario_id: string;
  predicted_schedule: any[];
  kpi_delta: {
    total_delay_change: number;
    conflicts_change: number;
    safety_score_change: number;
    affected_trains: number;
  };
  conflicts_before: any[];
  conflicts_after: any[];
  recommendations: any[];
}

interface SimulationRequest {
  scenario_type: 'delay' | 'priority' | 'breakdown' | 'weather';
  train_id?: string;
  delay_minutes?: number;
  station_id?: string;
  parameters?: any;
}

const SimulationDashboard: React.FC = () => {
  const { trains, stations, schedule, refreshAll } = useOperationsFeed();
  const currentSchedule = schedule;

  const [scenarios, setScenarios] = useState<Record<string, any>>({});
  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEntryPreview, setSelectedEntryPreview] = useState<ScheduleEntry | null>(null);
  
  // Simulation form state
  const [scenarioType, setScenarioType] = useState<'delay' | 'priority' | 'breakdown' | 'weather'>('delay');
  const [selectedTrain, setSelectedTrain] = useState<string>('');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [compareScenarioId, setCompareScenarioId] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    void fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const response = await fetch(`${API_BASE}/scenarios`);
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
  };

  const runSimulation = async () => {
    if (!selectedTrain && scenarioType !== 'weather') {
      notify.warning('Please select a train for this scenario type');
      return;
    }

    setIsRunning(true);
    
    const request: SimulationRequest = {
      scenario_type: scenarioType,
      train_id: selectedTrain || undefined,
      delay_minutes: delayMinutes,
      station_id: selectedStation || undefined,
      parameters: {}
    };

    try {
      const response = await fetch(`${API_BASE}/simulate/${scenarioType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (response.ok) {
        const scenario = await response.json();
        setActiveScenario(scenario);
        await fetchScenarios(); // Refresh scenarios list
      } else {
        console.error('Simulation failed:', await response.text());
      }
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      const response = await fetch(`${API_BASE}/scenarios/${scenarioId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchScenarios();
        if (activeScenario?.scenario_id === scenarioId) {
          setActiveScenario(null);
        }
      }
    } catch (error) {
      console.error('Error deleting scenario:', error);
    }
  };

  const promoteToLive = async () => {
    if (!activeScenario?.recommendations?.length) {
      notify.warning('No recommendations to promote from this scenario');
      return;
    }
    const rec = activeScenario.recommendations[0];
    try {
      const response = await fetch(
        `${API_BASE}/apply-recommendation?recommendation_id=${encodeURIComponent(rec.id)}`,
        { method: 'POST' }
      );
      if (response.ok) {
        notify.success('Scenario recommendation promoted to live schedule');
        await refreshAll();
      } else {
        const err = await response.json().catch(() => ({}));
        notify.error('Promote failed', err.detail || 'Unknown error');
      }
    } catch {
      notify.error('Promote failed');
    } finally {
      setShowPromoteConfirm(false);
    }
  };

  const compareScenario =
    compareScenarioId && scenarios[compareScenarioId]
      ? { ...scenarios[compareScenarioId], scenario_id: compareScenarioId }
      : null;

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'delay': return <Clock className="w-4 h-4" />;
      case 'breakdown': return <AlertTriangle className="w-4 h-4" />;
      case 'weather': return <Zap className="w-4 h-4" />;
      case 'priority': return <TrendingUp className="w-4 h-4" />;
      default: return <Train className="w-4 h-4" />;
    }
  };

  const getImpactColor = (value: number) => {
    if (value > 0) return 'text-red-400';
    if (value < 0) return 'text-green-400';
    return 'text-gray-400';
  };

  const getImpactIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-danger" aria-hidden />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-success" aria-hidden />;
    return <Minus className="h-4 w-4 text-slate-400" aria-hidden />;
  };

  const applyPreset = (preset: 'hyb-delay' | 'priority-swap') => {
    if (preset === 'hyb-delay') {
      setScenarioType('delay');
      setDelayMinutes(15);
      setSelectedStation('HYB');
      if (trains[0]) setSelectedTrain(trains[0].id);
    } else {
      setScenarioType('priority');
      if (trains.length >= 2) setSelectedTrain(trains[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-surface-1 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <PageHeader title="Scenario simulation" subtitle={PRODUCT_COPY.simulation} />

        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => applyPreset('hyb-delay')}>
            15 min delay at HYB
          </Button>
          <Button variant="ghost" onClick={() => applyPreset('priority-swap')}>
            Priority swap
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulation Controls */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" />
                Run Simulation
              </h2>

              <div className="space-y-4">
                {/* Scenario Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Scenario Type</label>
                  <select
                    value={scenarioType}
                    onChange={(e) => setScenarioType(e.target.value as any)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                  >
                    <option value="delay">Train Delay</option>
                    <option value="breakdown">Train Breakdown</option>
                    <option value="weather">Weather Impact</option>
                    <option value="priority">Priority Change</option>
                  </select>
                </div>

                {/* Train Selection */}
                {scenarioType !== 'weather' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Train</label>
                    <select
                      value={selectedTrain}
                      onChange={(e) => setSelectedTrain(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                    >
                      <option value="">Select a train...</option>
                      {trains.map((train) => (
                        <option key={train.id} value={train.id}>
                          {train.id} - {train.type} (Priority: {train.priority})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Delay Minutes */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Delay Minutes {scenarioType === 'breakdown' ? '(Default: 60)' : ''}
                  </label>
                  <input
                    type="number"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                    min="1"
                    max="180"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                  />
                </div>

                {/* Station Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Station (Optional)</label>
                  <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                  >
                    <option value="">Any station...</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.id} ({station.platforms} platforms)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Run Button */}
                <button
                  onClick={runSimulation}
                  disabled={isRunning}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Simulation
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scenarios History */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Scenarios History</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(scenarios).map(([id, scenario]) => (
                  <div
                    key={id}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      activeScenario?.scenario_id === id
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setActiveScenario({ ...scenario, scenario_id: id })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScenarioIcon(scenario.request?.scenario_type)}
                        <span className="text-sm font-medium">
                          {scenario.request?.scenario_type} - {scenario.request?.train_id || 'Multiple'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScenario(id);
                        }}
                        className="text-red-400 hover:text-red-300"
                        aria-label="Remove scenario"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(scenario.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
                {Object.keys(scenarios).length === 0 && (
                  <div className="text-slate-400 text-center py-4">
                    No scenarios yet. Run a simulation to get started.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {activeScenario ? (
              <div className="space-y-6">
                {/* Impact Summary */}
                <div className="bg-slate-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Impact Analysis</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-700 rounded p-4">
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <span className={getImpactColor(activeScenario.kpi_delta.total_delay_change)}>
                          {getImpactIcon(activeScenario.kpi_delta.total_delay_change)}
                          {Math.abs(activeScenario.kpi_delta.total_delay_change).toFixed(1)}m
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">Total Delay Change</div>
                    </div>
                    
                    <div className="bg-slate-700 rounded p-4">
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <span className={getImpactColor(activeScenario.kpi_delta.conflicts_change)}>
                          {getImpactIcon(activeScenario.kpi_delta.conflicts_change)}
                          {Math.abs(activeScenario.kpi_delta.conflicts_change)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">Conflicts Change</div>
                    </div>
                    
                    <div className="bg-slate-700 rounded p-4">
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <span className={getImpactColor(activeScenario.kpi_delta.safety_score_change)}>
                          {getImpactIcon(activeScenario.kpi_delta.safety_score_change)}
                          {(Math.abs(activeScenario.kpi_delta.safety_score_change) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">Safety Score Change</div>
                    </div>
                    
                    <div className="bg-slate-700 rounded p-4">
                      <div className="text-2xl font-bold text-yellow-400">
                        {activeScenario.kpi_delta.affected_trains}
                      </div>
                      <div className="text-sm text-slate-400">Affected Trains</div>
                    </div>
                  </div>
                </div>

                {/* Before/After Comparison */}
                <div className="bg-slate-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Before vs After Comparison</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Before */}
                    <div>
                      <h3 className="font-medium mb-3 text-green-400">Current State</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Conflicts:</span>
                          <span className="font-mono">{activeScenario.conflicts_before.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Schedule Entries:</span>
                          <span className="font-mono">{currentSchedule.length}</span>
                        </div>
                      </div>
                      
                      {activeScenario.conflicts_before.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Current Conflicts:</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {activeScenario.conflicts_before.map((conflict: any, idx: number) => (
                              <div key={idx} className="text-xs bg-slate-700 rounded p-2">
                                <div className="font-medium">{conflict.type.replace('_', ' ')}</div>
                                <div className="text-slate-400">{conflict.root_cause}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* After */}
                    <div>
                      <h3 className="font-medium mb-3 text-blue-400">Predicted State</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Conflicts:</span>
                          <span className="font-mono">{activeScenario.conflicts_after.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Schedule Entries:</span>
                          <span className="font-mono">{activeScenario.predicted_schedule.length}</span>
                        </div>
                      </div>
                      
                      {activeScenario.conflicts_after.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Predicted Conflicts:</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {activeScenario.conflicts_after.map((conflict: any, idx: number) => (
                              <div key={idx} className="text-xs bg-slate-700 rounded p-2">
                                <div className="font-medium">{conflict.type.replace('_', ' ')}</div>
                                <div className="text-slate-400">{conflict.root_cause}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {activeScenario.recommendations.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Recommended Actions</h2>
                    <div className="space-y-3">
                      {activeScenario.recommendations.map((rec: any, idx: number) => (
                        <div key={idx} className="bg-slate-700 rounded p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{rec.description}</div>
                              <div className="text-sm text-slate-400 mt-1">
                                Action: {rec.action_type.replace('_', ' ')} • 
                                Impact: {rec.impact.affected_trains.length} trains • 
                                Score: {(rec.cost_benefit.cost_score * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                              {rec.action_type}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Side-by-side scenario KPI compare */}
                {compareScenario && (
                  <div className="bg-slate-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Active vs compare scenario</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-blue-400 mb-3">Active scenario</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-700 rounded p-3 text-sm">
                            <div className="text-slate-400">Delay Δ</div>
                            <div className="font-mono text-lg">
                              {activeScenario.kpi_delta.total_delay_change.toFixed(1)}m
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3 text-sm">
                            <div className="text-slate-400">Conflicts Δ</div>
                            <div className="font-mono text-lg">
                              {activeScenario.kpi_delta.conflicts_change}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-amber-400 mb-3">Compare scenario</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-700 rounded p-3 text-sm">
                            <div className="text-slate-400">Delay Δ</div>
                            <div className="font-mono text-lg">
                              {(compareScenario.kpi_delta?.total_delay_change ?? 0).toFixed(1)}m
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3 text-sm">
                            <div className="text-slate-400">Conflicts Δ</div>
                            <div className="font-mono text-lg">
                              {compareScenario.kpi_delta?.conflicts_change ?? 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Train graph preview */}
                <div className="bg-slate-800 rounded-lg p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Occupation preview</h2>
                    {activeScenario.recommendations.length > 0 && (
                      <Button variant="primary" onClick={() => setShowPromoteConfirm(true)}>
                        Promote to live
                      </Button>
                    )}
                  </div>
                  {compareScenario?.predicted_schedule ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs text-blue-400">Active scenario</p>
                        <TrainGraph
                          baselineEntries={currentSchedule}
                          actualEntries={activeScenario.predicted_schedule}
                          stations={stations}
                          trains={trains}
                          conflicts={activeScenario.conflicts_after}
                          now={new Date()}
                          onEntryClick={setSelectedEntryPreview}
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-amber-400">Compare scenario</p>
                        <TrainGraph
                          baselineEntries={currentSchedule}
                          actualEntries={compareScenario.predicted_schedule}
                          stations={stations}
                          trains={trains}
                          conflicts={[]}
                          now={new Date()}
                          onEntryClick={setSelectedEntryPreview}
                        />
                      </div>
                    </div>
                  ) : (
                    <TrainGraph
                      baselineEntries={currentSchedule}
                      actualEntries={activeScenario.predicted_schedule}
                      stations={stations}
                      trains={trains}
                      conflicts={activeScenario.conflicts_after}
                      now={new Date()}
                      onEntryClick={setSelectedEntryPreview}
                    />
                  )}
                  {selectedEntryPreview && (
                    <div className="mt-4 rounded border border-slate-600 bg-slate-900/60 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-white">
                          {selectedEntryPreview.train_id} @ {selectedEntryPreview.station_id} P
                          {selectedEntryPreview.assigned_platform}
                        </span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-white"
                          onClick={() => setSelectedEntryPreview(null)}
                          aria-label="Close preview"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-slate-400">{selectedEntryPreview.reason}</p>
                    </div>
                  )}
                  {Object.keys(scenarios).length > 1 && (
                    <div className="mt-4">
                      <label className="text-xs text-slate-400">Compare with scenario</label>
                      <select
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                        value={compareScenarioId ?? ''}
                        onChange={(e) => setCompareScenarioId(e.target.value || null)}
                      >
                        <option value="">None</option>
                        {Object.entries(scenarios)
                          .filter(([id]) => id !== activeScenario.scenario_id)
                          .map(([id, sc]) => (
                            <option key={id} value={id}>
                              {sc.request?.scenario_type} — {sc.request?.train_id || 'all'}
                            </option>
                          ))}
                      </select>
                      {compareScenario && (
                        <p className="mt-2 text-xs text-slate-400">
                          Compare delay delta:{' '}
                          <span className="font-mono text-white">
                            {(
                              (compareScenario.kpi_delta?.total_delay_change ?? 0) -
                              activeScenario.kpi_delta.total_delay_change
                            ).toFixed(1)}
                            m
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Schedule Preview */}
                <div className="bg-slate-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Full schedule diff ({activeScenario.predicted_schedule.length} legs)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-slate-400 border-b border-slate-600">
                        <tr>
                          <th className="text-left py-2">Train ID</th>
                          <th className="text-left py-2">Station</th>
                          <th className="text-left py-2">Platform</th>
                          <th className="text-left py-2">Arrival</th>
                          <th className="text-left py-2">Departure</th>
                          <th className="text-left py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScenario.predicted_schedule.map((entry: ScheduleEntry, idx: number) => {
                          const changed = scheduleRowChanged(entry, currentSchedule);
                          return (
                          <tr
                            key={idx}
                            className={`border-b border-slate-700 ${changed ? 'bg-amber-500/10' : ''}`}
                          >
                            <td className="py-2 font-medium">{entry.train_id}</td>
                            <td className="py-2">{entry.station_id}</td>
                            <td className="py-2">P{entry.assigned_platform}</td>
                            <td className="py-2">{new Date(entry.actual_arrival).toLocaleTimeString()}</td>
                            <td className="py-2">{new Date(entry.actual_departure).toLocaleTimeString()}</td>
                            <td className="py-2 text-xs text-slate-400">{entry.reason}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <SectionCard>
                <EmptyState
                  icon={Play}
                  title="No simulation selected"
                  description="Run a new simulation or select an existing scenario from history to view predicted impact."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (trains.length > 0) {
                          setSelectedTrain(trains[0].id);
                          void runSimulation();
                        }
                      }}
                    >
                      Run sample simulation
                    </Button>
                  }
                />
              </SectionCard>
            )}
          </div>
        </div>

        <SimulationDiagnostics
          trains={trains}
          onRefresh={async () => {
            await refreshAll();
          }}
        />

        <div className="mt-8">
          <ConflictTestingPanel
            trains={trains}
            apiBase={API_BASE}
            onDataRefresh={async () => {
              await refreshAll();
            }}
          />
        </div>

      <ConfirmDialog
        open={showPromoteConfirm}
        title="Promote scenario to live?"
        message="This applies the top simulation recommendation to the live schedule via the standard override API. Confirm only if you intend to change production state."
        confirmLabel="Promote to live"
        variant="warning"
        onConfirm={() => void promoteToLive()}
        onCancel={() => setShowPromoteConfirm(false)}
      />
      </div>
    </div>
  );
};

export default SimulationDashboard;
