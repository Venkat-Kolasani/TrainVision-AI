import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, TrendingUp, Clock, Train, Zap } from 'lucide-react';

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
  const [scenarios, setScenarios] = useState<Record<string, any>>({});
  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [trains, setTrains] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<any[]>([]);
  
  // Simulation form state
  const [scenarioType, setScenarioType] = useState<'delay' | 'priority' | 'breakdown' | 'weather'>('delay');
  const [selectedTrain, setSelectedTrain] = useState<string>('');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [selectedStation, setSelectedStation] = useState<string>('');

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchInitialData();
    fetchScenarios();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [trainsRes, stationsRes, scheduleRes] = await Promise.all([
        fetch(`${API_BASE}/trains`),
        fetch(`${API_BASE}/stations`),
        fetch(`${API_BASE}/schedule`)
      ]);

      if (trainsRes.ok) setTrains(await trainsRes.json());
      if (stationsRes.ok) setStations(await stationsRes.json());
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setCurrentSchedule(scheduleData.schedule);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

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
      alert('Please select a train for this scenario type');
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
    if (value > 0) return '↗️';
    if (value < 0) return '↘️';
    return '➡️';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🎯 Scenario Simulation Dashboard</h1>
          <p className="text-slate-400">Test what-if scenarios and analyze their impact on train operations</p>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScenario(id);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
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

                {/* Schedule Preview */}
                <div className="bg-slate-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Predicted Schedule Preview</h2>
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
                        {activeScenario.predicted_schedule.slice(0, 10).map((entry: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-700">
                            <td className="py-2 font-medium">{entry.train_id}</td>
                            <td className="py-2">{entry.station_id}</td>
                            <td className="py-2">P{entry.assigned_platform}</td>
                            <td className="py-2">{new Date(entry.actual_arrival).toLocaleTimeString()}</td>
                            <td className="py-2">{new Date(entry.actual_departure).toLocaleTimeString()}</td>
                            <td className="py-2 text-xs text-slate-400">{entry.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {activeScenario.predicted_schedule.length > 10 && (
                      <div className="text-center text-slate-400 py-2">
                        ... and {activeScenario.predicted_schedule.length - 10} more entries
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-semibold mb-2">No Simulation Selected</h2>
                <p className="text-slate-400 mb-6">
                  Run a new simulation or select an existing scenario from the history to view detailed results.
                </p>
                <button
                  onClick={() => {
                    if (trains.length > 0) {
                      setSelectedTrain(trains[0].id);
                      runSimulation();
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded"
                >
                  Run Sample Simulation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationDashboard;
