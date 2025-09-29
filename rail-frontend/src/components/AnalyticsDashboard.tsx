import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, AlertCircle, Clock, Train, Settings, RefreshCw } from 'lucide-react';

interface AnalyticsData {
  summary: {
    total_trains: number;
    on_time_trains: number;
    delayed_trains: number;
    on_time_percentage: number;
    average_delay_minutes: number;
    total_delay_minutes: number;
  };
  delays_by_station: Record<string, number>;
  delays_by_train_type: Record<string, number>;
  platform_utilization: Record<string, number>;
  conflicts_analysis: {
    total_conflicts: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
  };
  active_overrides: number;
  active_delays: number;
  optimizer_mode: string;
  last_updated: string;
}

interface OptimizerSettings {
  mode: 'greedy' | 'ilp';
  objective: 'minimize_delays' | 'minimize_conflicts' | 'balanced';
  time_limit_seconds: number;
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizerSettings, setOptimizerSettings] = useState<OptimizerSettings>({
    mode: 'greedy',
    objective: 'balanced',
    time_limit_seconds: 30
  });
  const [showSettings, setShowSettings] = useState(false);
  const [updating, setUpdating] = useState(false);

  const API_BASE = "http://127.0.0.1:8000";

  useEffect(() => {
    fetchAnalytics();
    fetchOptimizerSettings();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/summary`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptimizerSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings/optimizer`);
      if (response.ok) {
        const settings = await response.json();
        setOptimizerSettings(settings);
      }
    } catch (error) {
      console.error('Error fetching optimizer settings:', error);
    }
  };

  const updateOptimizerSettings = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/settings/optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimizerSettings)
      });
      
      if (response.ok) {
        setShowSettings(false);
        await fetchAnalytics(); // Refresh analytics after settings change
      }
    } catch (error) {
      console.error('Error updating optimizer settings:', error);
    } finally {
      setUpdating(false);
    }
  };

  const refreshAnalytics = async () => {
    setLoading(true);
    await fetchAnalytics();
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p>No analytics data available</p>
          <button 
            onClick={refreshAnalytics}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConflictSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">📊 Analytics Dashboard</h1>
            <p className="text-slate-400">
              Comprehensive performance analysis and system insights
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshAnalytics}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Train className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold">{analytics.summary.total_trains}</span>
            </div>
            <h3 className="text-slate-400 text-sm">Total Trains</h3>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-green-400" />
              <span className={`text-2xl font-bold ${getPerformanceColor(analytics.summary.on_time_percentage)}`}>
                {analytics.summary.on_time_percentage}%
              </span>
            </div>
            <h3 className="text-slate-400 text-sm">On-Time Performance</h3>
            <div className="text-xs text-slate-500 mt-1">
              {analytics.summary.on_time_trains} of {analytics.summary.total_trains} trains
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-yellow-400" />
              <span className="text-2xl font-bold">{analytics.summary.average_delay_minutes.toFixed(1)}m</span>
            </div>
            <h3 className="text-slate-400 text-sm">Average Delay</h3>
            <div className="text-xs text-slate-500 mt-1">
              Total: {analytics.summary.total_delay_minutes.toFixed(1)} minutes
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <span className="text-2xl font-bold">{analytics.conflicts_analysis.total_conflicts}</span>
            </div>
            <h3 className="text-slate-400 text-sm">Active Conflicts</h3>
            <div className="text-xs text-slate-500 mt-1">
              {analytics.active_overrides} overrides active
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Delays by Station */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Delays by Station
            </h2>
            <div className="space-y-3">
              {Object.entries(analytics.delays_by_station).map(([station, delay]) => (
                <div key={station} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{station}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (delay / Math.max(...Object.values(analytics.delays_by_station))) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-slate-400 w-12 text-right">
                      {delay.toFixed(1)}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delays by Train Type */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Delays by Train Type
            </h2>
            <div className="space-y-3">
              {Object.entries(analytics.delays_by_train_type).map(([type, delay]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{type}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (delay / Math.max(...Object.values(analytics.delays_by_train_type))) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-slate-400 w-12 text-right">
                      {delay.toFixed(1)}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Platform Utilization */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Platform Utilization</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(analytics.platform_utilization)
                .sort(([,a], [,b]) => b - a)
                .map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{platform}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-700 rounded-full h-1.5">
                      <div 
                        className="bg-purple-500 h-1.5 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (count / Math.max(...Object.values(analytics.platform_utilization))) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-slate-400 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conflicts by Type */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Conflicts by Type</h2>
            <div className="space-y-3">
              {Object.entries(analytics.conflicts_analysis.by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(analytics.conflicts_analysis.by_type).length === 0 && (
                <div className="text-center text-slate-400 py-4">
                  No conflicts detected
                </div>
              )}
            </div>
          </div>

          {/* Conflicts by Severity */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Conflicts by Severity</h2>
            <div className="space-y-3">
              {Object.entries(analytics.conflicts_analysis.by_severity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{severity}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getConflictSeverityColor(severity)}`}
                        style={{ 
                          width: `${Math.min(100, (count / Math.max(1, ...Object.values(analytics.conflicts_analysis.by_severity))) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-slate-400 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(analytics.conflicts_analysis.by_severity).length === 0 && (
                <div className="text-center text-slate-400 py-4">
                  No conflicts by severity
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium text-slate-300">Optimizer</h3>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span className="font-mono bg-slate-700 px-2 py-1 rounded text-xs">
                    {analytics.optimizer_mode.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Active Overrides:</span>
                  <span className="font-mono">{analytics.active_overrides}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Active Delays:</span>
                  <span className="font-mono">{analytics.active_delays}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-300">Performance</h3>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span>Delayed Trains:</span>
                  <span className="font-mono text-red-400">{analytics.summary.delayed_trains}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>On-Time Trains:</span>
                  <span className="font-mono text-green-400">{analytics.summary.on_time_trains}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Success Rate:</span>
                  <span className={`font-mono ${getPerformanceColor(analytics.summary.on_time_percentage)}`}>
                    {analytics.summary.on_time_percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-300">Last Updated</h3>
              <div className="text-sm text-slate-400">
                {new Date(analytics.last_updated).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                Auto-refreshes every 30 seconds
              </div>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Optimizer Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Optimizer Mode</label>
                  <select
                    value={optimizerSettings.mode}
                    onChange={(e) => setOptimizerSettings({
                      ...optimizerSettings,
                      mode: e.target.value as 'greedy' | 'ilp'
                    })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                  >
                    <option value="greedy">Greedy (Fast)</option>
                    <option value="ilp">ILP (Optimal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Objective</label>
                  <select
                    value={optimizerSettings.objective}
                    onChange={(e) => setOptimizerSettings({
                      ...optimizerSettings,
                      objective: e.target.value as any
                    })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                  >
                    <option value="minimize_delays">Minimize Delays</option>
                    <option value="minimize_conflicts">Minimize Conflicts</option>
                    <option value="balanced">Balanced</option>
                  </select>
                </div>

                {optimizerSettings.mode === 'ilp' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Time Limit (seconds)</label>
                    <input
                      type="number"
                      value={optimizerSettings.time_limit_seconds}
                      onChange={(e) => setOptimizerSettings({
                        ...optimizerSettings,
                        time_limit_seconds: parseInt(e.target.value) || 30
                      })}
                      min="5"
                      max="300"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateOptimizerSettings}
                  disabled={updating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded"
                >
                  {updating ? 'Updating...' : 'Update Settings'}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
