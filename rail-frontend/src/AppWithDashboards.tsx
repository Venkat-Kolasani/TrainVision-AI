import React, { useState, useEffect } from 'react';
import {
  Home,
  BarChart3,
  Play,
  Bot,
  AlertTriangle,
  Lightbulb,
  ClipboardList,
  RefreshCw,
  RotateCcw,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import App from './App';
import SimulationDashboard from './components/SimulationDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ChatBot } from './components/ChatBot';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { RecommendationsPanel } from './components/operations/RecommendationsPanel';
import { notify } from './lib/notify';
import { useDashboardShell } from './context/DashboardShellContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { getConflictCount } from './lib/apiNormalize';
import type { Recommendation, ConflictsResponse, ConflictItem } from './types/railway';

type DashboardView = 'main' | 'simulation' | 'analytics';

const healthStyles = {
  OPTIMAL: 'text-success bg-success/10 border-success/30',
  DELAYS: 'text-warning bg-warning/10 border-warning/30',
  CONFLICTS: 'text-danger bg-danger/10 border-danger/30',
} as const;

const AppWithDashboards: React.FC = () => {
  const { status, actions } = useDashboardShell();
  const [currentView, setCurrentView] = useState<DashboardView>('main');
  const [showChatBot, setShowChatBot] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendationsPanel, setShowRecommendationsPanel] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [applyingRecId, setApplyingRecId] = useState<string | null>(null);
  const [shellConflicts, setShellConflicts] = useState<ConflictsResponse>({});

  const [scheduleData, setScheduleData] = useState<unknown>(null);
  const [logs, setLogs] = useState<unknown[]>([]);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchConflicts();
      void fetchRecommendations();
      void fetchScheduleData();
      void fetchLogs();
    }, 10000);

    void fetchConflicts();
    void fetchRecommendations();
    void fetchScheduleData();
    void fetchLogs();

    return () => clearInterval(interval);
  }, []);

  const fetchConflicts = async () => {
    try {
      const response = await fetch(`${API_BASE}/conflicts`);
      if (response.ok) {
        const data: ConflictsResponse = await response.json();
        setShellConflicts(data);
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
      const response = await fetch(`${API_BASE}/log`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const applyRecommendation = async (recommendationId: string) => {
    setApplyingRecId(recommendationId);
    try {
      const response = await fetch(
        `${API_BASE}/apply-recommendation?recommendation_id=${encodeURIComponent(recommendationId)}`,
        { method: 'POST' }
      );

      if (response.ok) {
        await Promise.all([fetchRecommendations(), fetchConflicts(), fetchScheduleData()]);
        if (actions?.refreshAll) await actions.refreshAll();
        notify.success('Recommendation applied successfully');
      } else {
        const err = await response.json().catch(() => ({}));
        notify.error('Failed to apply recommendation', err.detail || 'Unknown error');
      }
    } catch (error) {
      console.error('Error applying recommendation:', error);
      notify.error('Failed to apply recommendation');
    } finally {
      setApplyingRecId(null);
    }
  };

  const handleRefresh = async () => {
    if (!actions?.refreshAll) return;
    setRefreshing(true);
    try {
      await actions.refreshAll();
      notify.success('Dashboard refreshed');
    } catch {
      notify.error('Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  const handleReset = async () => {
    if (!actions?.resetSystem) return;
    try {
      await actions.resetSystem();
      setShowResetConfirm(false);
    } catch {
      notify.error('Failed to reset system');
    }
  };

  useKeyboardShortcuts({
    onRefresh: () => {
      if (!actions?.refreshAll) return;
      setRefreshing(true);
      void actions.refreshAll()
        .then(() => notify.success('Dashboard refreshed'))
        .catch(() => notify.error('Failed to refresh dashboard'))
        .finally(() => setRefreshing(false));
    },
    onSearch: () => {
      const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
      searchInput?.focus();
    },
    onHelp: () => setShowShortcutHelp(true),
  });

  const shellConflictCount = getConflictCount(shellConflicts);

  const lastSyncLabel = status.lastSync
    ? status.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const renderNavigation = () => (
    <header className="border-b border-slate-700 bg-surface-2">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <img src="/train-logo.png" alt="TrainVision AI" className="h-8 w-8" />
            <div>
              <h1 className="text-lg font-semibold text-white">TrainVision AI</h1>
              <p className="text-xs text-slate-400">Operations Console</p>
            </div>
          </div>
          <nav className="flex space-x-1" aria-label="Main navigation">
            {(
              [
                { id: 'main' as const, label: 'Operations', icon: Home },
                { id: 'simulation' as const, label: 'Simulation', icon: Play },
                { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentView(id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  currentView === id
                    ? 'bg-primary text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {(shellConflictCount > 0 || conflicts.length > 0) && (
            <div className="flex items-center gap-2 rounded border border-danger/40 bg-danger/10 px-3 py-1.5">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <span className="text-sm text-danger">
                {Math.max(shellConflictCount, conflicts.length)} conflicts
              </span>
            </div>
          )}

          {recommendations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRecommendationsPanel((open) => !open)}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 transition-colors ${
                showRecommendationsPanel
                  ? 'border-info bg-info/20 text-info'
                  : 'border-info/40 bg-info/10 text-info hover:bg-info/20'
              }`}
            >
              <Lightbulb className="h-4 w-4 text-info" />
              <span className="text-sm text-info">{recommendations.length} recommendations</span>
            </button>
          )}

          {currentView === 'main' && (
            <>
              <button
                type="button"
                onClick={() => actions?.openAuditLogs()}
                className="flex items-center gap-2 rounded bg-slate-700 px-3 py-2 text-sm text-white transition-colors hover:bg-slate-600"
              >
                <ClipboardList className="h-4 w-4" />
                Audit Logs
              </button>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="flex items-center gap-2 rounded bg-success px-3 py-2 text-sm text-white transition-colors hover:bg-success-dark disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 rounded bg-danger/90 px-3 py-2 text-sm text-white transition-colors hover:bg-danger"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowChatBot(true)}
            className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm text-white transition-colors hover:bg-primary-light"
          >
            <Bot className="h-4 w-4" />
            AI Assistant
          </button>
        </div>
      </div>

      {currentView === 'main' && (
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-700/80 bg-surface-1 px-6 py-2 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            {status.websocketConnected ? (
              <Wifi className="h-3.5 w-3.5 text-success" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-danger" />
            )}
            <span>{status.websocketConnected ? 'Live connection' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Last sync: {lastSyncLabel}</span>
          </div>
          <div
            className={`rounded border px-2 py-0.5 font-medium ${healthStyles[status.systemHealth]}`}
          >
            {status.systemHealth}
          </div>
          <span>{status.trainCount} trains</span>
          <span>{status.onTimePct}% on-time</span>
          {status.conflictCount > 0 && (
            <span className="text-danger">{status.conflictCount} active conflicts</span>
          )}
          {status.activeDelayCount > 0 && (
            <span className="text-warning">{status.activeDelayCount} active delays</span>
          )}
        </div>
      )}
    </header>
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
    <div className={`min-h-screen bg-surface-1 transition-[padding] ${showRecommendationsPanel ? 'lg:pr-[28rem]' : ''}`}>
      {renderNavigation()}
      {renderContent()}

      <RecommendationsPanel
        open={showRecommendationsPanel}
        recommendations={recommendations}
        onClose={() => setShowRecommendationsPanel(false)}
        onApply={(id) => void applyRecommendation(id)}
        applyingId={applyingRecId}
      />

      {showShortcutHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowShortcutHelp(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowShortcutHelp(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-slate-600 bg-surface-2 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Keyboard Shortcuts</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">R</kbd> Refresh dashboard</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">/</kbd> Focus schedule search</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">Shift</kbd> + <kbd className="rounded bg-slate-700 px-2 py-0.5">?</kbd> Show this help</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowShortcutHelp(false)}
              className="mt-4 w-full rounded bg-primary py-2 text-sm text-white hover:bg-primary-light"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showChatBot && (
        <ChatBot
          onClose={() => setShowChatBot(false)}
          logsBefore={logs as never[]}
          logsAfter={logs as never[]}
          scheduleData={scheduleData as never}
          lastAction={null}
          autoExplain={false}
        />
      )}

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset system?"
        message="This will clear all overrides and regenerate the baseline schedule. This action cannot be undone."
        confirmLabel="Reset system"
        variant="danger"
        onConfirm={() => void handleReset()}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};

export default AppWithDashboards;
