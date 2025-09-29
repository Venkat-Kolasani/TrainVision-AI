import React, { useState, useEffect } from 'react';
import {
  Home,
  BarChart3,
  Play,
  Bot,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import App from './App';
import SimulationDashboard from './components/SimulationDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ChatBot } from './components/ChatBot';

type DashboardView = 'main' | 'simulation' | 'analytics';


interface Conflict {
  id: string;
  type: string;
  station_id: string;
  platform?: number;
  trains_involved: string[];
  root_cause: string;
  severity: string;
  suggested_actions: string[];
}

interface Recommendation {
  id: string;
  action_type: string;
  description: string;
  train_id: string;
  station_id?: string;
  new_platform?: number;
  delay_minutes?: number;
  cost_benefit: {
    delay_reduction: number;
    conflicts_resolved: number;
    cost_score: number;
  };
  impact: {
    affected_trains: string[];
    total_delay_change: number;
  };
}

const AppWithDashboards: React.FC = () => {
  const [currentView, setCurrentView] = useState<DashboardView>('main');
  const [showChatBot, setShowChatBot] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendationsPanel, setShowRecommendationsPanel] = useState(false);

  // Add state for ChatBot data
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    // Fetch all data periodically
    const interval = setInterval(() => {
      fetchConflicts();
      fetchRecommendations();
      fetchScheduleData();
      fetchLogs();
    }, 10000); // Every 10 seconds

    // Initial fetch
    fetchConflicts();
    fetchRecommendations();
    fetchScheduleData();
    fetchLogs();

    return () => clearInterval(interval);
  }, []);

  const fetchConflicts = async () => {
    try {
      const response = await fetch(`${API_BASE}/conflicts`);
      if (response.ok) {
        const data = await response.json();
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Error fetching conflicts:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`${API_BASE}/recommendations`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchScheduleData = async () => {
    try {
      const response = await fetch(`${API_BASE}/schedule`);
      if (response.ok) {
        const data = await response.json();
        setScheduleData(data);
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/log`);  // Note: singular 'log'
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };


  const applyRecommendation = async (recommendationId: string) => {
    try {
      const response = await fetch(`${API_BASE}/apply-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendation_id: recommendationId })
      });

      if (response.ok) {
        await fetchRecommendations(); // Refresh recommendations
        alert('Recommendation applied successfully!');
      }
    } catch (error) {
      console.error('Error applying recommendation:', error);
      alert('Failed to apply recommendation');
    }
  };



  const renderNavigation = () => (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <img src="/train-logo.png" alt="TrainVision AI" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-white">TrainVision AI</h1>
          </div>
          <nav className="flex space-x-4">
            <button
              onClick={() => setCurrentView('main')}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${currentView === 'main'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
            >
              <Home className="w-4 h-4" />
              Main Dashboard
            </button>
            <button
              onClick={() => setCurrentView('simulation')}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${currentView === 'simulation'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
            >
              <Play className="w-4 h-4" />
              Simulation
            </button>
            <button
              onClick={() => setCurrentView('analytics')}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${currentView === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {/* Conflicts Indicator */}
          {conflicts.length > 0 && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-600 rounded px-3 py-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{conflicts.length} conflicts</span>
            </div>
          )}

          {/* Recommendations Indicator */}
          {recommendations.length > 0 && (
            <button
              onClick={() => setShowRecommendationsPanel(true)}
              className="flex items-center gap-2 bg-blue-900/30 border border-blue-600 rounded px-3 py-1 hover:bg-blue-900/50 transition-colors"
            >
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm">{recommendations.length} recommendations</span>
            </button>
          )}

          <button
            onClick={() => setShowChatBot(true)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded transition-colors"
          >
            <Bot className="w-4 h-4" />
            AI Assistant
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'simulation':
        return <SimulationDashboard />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <App />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {renderNavigation()}
      {renderContent()}

      {/* Enhanced ChatBot */}
      {showChatBot && (
        <ChatBot
          onClose={() => setShowChatBot(false)}
          logsBefore={logs}
          logsAfter={logs}
          scheduleData={scheduleData}
          lastAction={lastAction}
          autoExplain={false}
        />
      )}

      {/* Recommendations Panel */}
      {showRecommendationsPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                AI Recommendations
              </h2>
              <button
                onClick={() => setShowRecommendationsPanel(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-1">{rec.description}</h3>
                      <div className="text-sm text-slate-400">
                        Train: {rec.train_id} • Action: {rec.action_type.replace('_', ' ')}
                        {rec.station_id && ` • Station: ${rec.station_id}`}
                        {rec.new_platform && ` • Platform: ${rec.new_platform}`}
                        {rec.delay_minutes && ` • Delay: ${rec.delay_minutes}min`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-400">
                        Score: {(rec.cost_benefit.cost_score * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-400">
                        {rec.cost_benefit.conflicts_resolved} conflicts resolved
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="bg-slate-600 rounded p-2">
                      <div className="text-xs text-slate-400">Impact</div>
                      <div className="text-sm">
                        {rec.impact.affected_trains.length} trains •
                        {rec.impact.total_delay_change > 0 ? '+' : ''}{rec.impact.total_delay_change.toFixed(1)}min
                      </div>
                    </div>
                    <div className="bg-slate-600 rounded p-2">
                      <div className="text-xs text-slate-400">Benefit</div>
                      <div className="text-sm">
                        {rec.cost_benefit.delay_reduction > 0 ? '+' : ''}{rec.cost_benefit.delay_reduction.toFixed(1)}min saved
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => applyRecommendation(rec.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
                  >
                    Apply Recommendation
                  </button>
                </div>
              ))}

              {recommendations.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recommendations available at this time.</p>
                  <p className="text-sm">The system will generate suggestions as conflicts arise.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppWithDashboards;
