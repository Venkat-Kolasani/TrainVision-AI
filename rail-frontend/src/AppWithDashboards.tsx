import React, { useState } from 'react';
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
  Maximize2,
} from 'lucide-react';
import App from './App';
import SimulationDashboard from './components/SimulationDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ChatBot } from './components/ChatBot';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Button } from './components/ui/Button';
import { RecommendationsPanel } from './components/operations/RecommendationsPanel';
import { SkipLink } from './components/layout/SkipLink';
import { notify } from './lib/notify';
import { useDashboardShell } from './context/DashboardShellContext';
import { useOperationsFeed } from './context/OperationsFeedContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCommandCenter } from './hooks/useCommandCenter';

type DashboardView = 'main' | 'simulation' | 'analytics';

const healthStyles = {
  OPTIMAL: 'text-success bg-success/10 border-success/30',
  DELAYS: 'text-warning bg-warning/10 border-warning/30',
  CONFLICTS: 'text-danger bg-danger/10 border-danger/30',
} as const;

const AppWithDashboards: React.FC = () => {
  const { status, actions } = useDashboardShell();
  const commandCenter = useCommandCenter();
  const {
    recommendations,
    conflictCount,
    logs,
    schedule,
    refreshAll,
  } = useOperationsFeed();
  const [currentView, setCurrentView] = useState<DashboardView>('main');
  const [showChatBot, setShowChatBot] = useState(false);
  const [showRecommendationsPanel, setShowRecommendationsPanel] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [applyingRecId, setApplyingRecId] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const applyRecommendation = async (recommendationId: string) => {
    setApplyingRecId(recommendationId);
    try {
      const response = await fetch(
        `${API_BASE}/apply-recommendation?recommendation_id=${encodeURIComponent(recommendationId)}`,
        { method: 'POST' }
      );

      if (response.ok) {
        await refreshAll(true);
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
    onCommandCenter: () => {
      if (currentView === 'main') commandCenter.open();
    },
  });

  const shellConflictCount = conflictCount;

  const lastSyncLabel = status.lastSync
    ? status.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const ccProps = {
    isOpen: commandCenter.isOpen,
    pauseRefresh: commandCenter.pauseRefresh,
    alertSoundEnabled: commandCenter.alertSoundEnabled,
    onClose: commandCenter.close,
    onTogglePause: () => commandCenter.setPause(!commandCenter.pauseRefresh),
    onToggleAlertSound: commandCenter.toggleAlertSound,
  };

  return (
    <div className={`min-h-screen bg-surface-1 transition-[padding] ${showRecommendationsPanel ? 'lg:pr-[28rem]' : ''}`}>
      <SkipLink />
      <header className="border-b border-slate-700 bg-surface-2">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <img src="/train-logo.png" alt="" className="h-8 w-8" aria-hidden />
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
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    currentView === id
                      ? 'bg-primary text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(shellConflictCount > 0) && (
              <div className="flex items-center gap-2 rounded border border-danger/40 bg-danger/10 px-3 py-1.5" role="status">
                <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
                <span className="text-sm text-danger">
                  {shellConflictCount} conflicts
                </span>
              </div>
            )}

            {recommendations.length > 0 && (
              <Button
                variant="ghost"
                className="border border-info/40 bg-info/10 text-info"
                onClick={() => setShowRecommendationsPanel((open) => !open)}
              >
                <Lightbulb className="h-4 w-4" />
                {recommendations.length} recommendations
              </Button>
            )}

            {currentView === 'main' && (
              <>
                <Button variant="ghost" onClick={() => commandCenter.open()}>
                  <Maximize2 className="h-4 w-4" />
                  Command center
                </Button>
                <Button variant="ghost" onClick={() => actions?.openAuditLogs()}>
                  <ClipboardList className="h-4 w-4" />
                  Activity
                </Button>
                <Button variant="secondary" onClick={() => void handleRefresh()} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </>
            )}

            <Button variant="primary" onClick={() => setShowChatBot(true)}>
              <Bot className="h-4 w-4" />
              AI Assistant
            </Button>
          </div>
        </div>

        {currentView === 'main' && (
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-700/80 bg-surface-1 px-6 py-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              {status.websocketConnected ? (
                <Wifi className="h-3.5 w-3.5 text-success" aria-hidden />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-danger" aria-hidden />
              )}
              <span>{status.websocketConnected ? 'Live connection' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <span>Last sync: {lastSyncLabel}</span>
            </div>
            <div className={`rounded border px-2 py-0.5 font-mono font-medium ${healthStyles[status.systemHealth]}`} role="status">
              {status.systemHealth}
            </div>
            <span>{status.trainCount} trains</span>
            <span className="font-mono tabular-nums">{status.onTimePct}% on-time</span>
            <span className="text-slate-500">HYB · SC · KCG</span>
          </div>
        )}
      </header>

      <main id="main-content">
        {currentView === 'simulation' && <SimulationDashboard />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
        {currentView === 'main' && (
          <App
            commandCenter={ccProps}
            recommendations={recommendations}
            onApplyRecommendation={(id) => void applyRecommendation(id)}
          />
        )}
      </main>

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
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-slate-600 bg-surface-2 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Keyboard shortcuts</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">R</kbd> Refresh dashboard</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">F</kbd> Command center fullscreen</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">/</kbd> Focus schedule search</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">Esc</kbd> Exit command center</li>
              <li><kbd className="rounded bg-slate-700 px-2 py-0.5">Shift</kbd> + <kbd className="rounded bg-slate-700 px-2 py-0.5">?</kbd> Show this help</li>
            </ul>
            <Button variant="primary" className="mt-4 w-full" onClick={() => setShowShortcutHelp(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {showChatBot && (
        <ChatBot
          onClose={() => setShowChatBot(false)}
          logsBefore={logs}
          logsAfter={logs}
          scheduleData={{ schedule, delays_before_min: [], delays_after_min: [] }}
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
