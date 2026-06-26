import { useEffect, useMemo, useState, useRef } from "react";
import { notify } from './lib/notify';
import { useDashboardShell } from './context/DashboardShellContext';
import { useOperationsFeed } from './context/OperationsFeedContext';
import { useSelection } from './context/SelectionContext';
import type { WorkspaceTab } from './context/DashboardShellContext';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { KpiSkeleton, MapSkeleton, TableSkeleton } from './components/ui/Skeleton';
import { AlertQueue } from './components/operations/AlertQueue';
import { PlatformBoard } from './components/operations/PlatformBoard';
import { TrackOccupancyPanel } from './components/operations/TrackOccupancyPanel';
import { ScheduleTable } from './components/operations/ScheduleTable';
import { TrainDetailDrawer } from './components/operations/TrainDetailDrawer';
import { NetworkMap, MapLegend } from './components/operations/NetworkMap';
import { StatusBoard } from './components/operations/StatusBoard';
import { OperationsPanel } from './components/operations/OperationsPanel';
import { ActivityPanel } from './components/operations/ActivityPanel';
import { ScheduleTimelinePanel } from './components/operations/ScheduleTimelinePanel';
import { OverrideModal, DelayWarningModal } from './components/operations/OverrideModal';
import { CommandCenterView } from './components/operations/CommandCenterView';
import { ContextStrip } from './components/layout/ContextStrip';
import { SectionCard } from './components/layout/SectionCard';
import { Tabs } from './components/layout/Tabs';
import { LiveRegion } from './components/layout/LiveRegion';
import { computeKPIs as computeScheduleKPIs } from './lib/scheduleUtils';
import { playAlertTone } from './hooks/useCommandCenter';
import { PRODUCT_COPY } from './lib/productCopy';
import type { Recommendation } from './types/railway';

interface AppProps {
  commandCenter?: {
    isOpen: boolean;
    pauseRefresh: boolean;
    alertSoundEnabled: boolean;
    onClose: () => void;
    onTogglePause: () => void;
    onToggleAlertSound: () => void;
  };
  recommendations?: Recommendation[];
  onApplyRecommendation?: (id: string) => void;
}

export default function App({
  commandCenter,
  recommendations: recommendationsProp,
  onApplyRecommendation,
}: AppProps = {}) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const {
    trains,
    schedule,
    baselineSchedule,
    previousSchedule,
    logs,
    stations,
    activeDelays,
    trainPositions,
    conflicts: _conflicts,
    trackStatus,
    recommendations: feedRecommendations,
    websocketConnected,
    loading: feedLoading,
    initialLoadComplete,
    lastUpdated,
    isStale,
    refreshAll,
    conflictCount,
    conflictList,
  } = useOperationsFeed();

  const recommendations = recommendationsProp ?? feedRecommendations;

  const { selectedTrainId, selectedEntry, selectTrain, selectEntry, clearSelection } =
    useSelection();

  const [actionLoading, setActionLoading] = useState(false);
  const [overridePlatform, setOverridePlatform] = useState<number>(1);
  const [overrideMsg, setOverrideMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [delayImpact, setDelayImpact] = useState<{current: number, predicted: number, difference: number} | null>(null);
  const [showDelayWarning, setShowDelayWarning] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{trainId: string, stationId: string, platform: number} | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('schedule');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [nowClock, setNowClock] = useState(new Date());
  const [animTick, setAnimTick] = useState(0);
  const [showClearDelaysConfirm, setShowClearDelaysConfirm] = useState(false);

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const lastSync = lastUpdated.schedule ?? null;
  const loading = feedLoading || actionLoading;

  const { updateStatus, registerActions, unregisterActions } = useDashboardShell();

  const conflictTrainIds = useMemo(() => {
    const ids = new Set<string>();
    (conflictList ?? []).forEach((c) => (c.trains_involved || []).forEach((t) => ids.add(t)));
    return ids;
  }, [conflictList]);

  const handleTrainSelect = (trainId: string) => {
    const entry = schedule.find((s) => s.train_id === trainId);
    if (entry) selectEntry(entry);
    else selectTrain(trainId);
  };

  const getTrain = (id: string) => trains.find((t) => t.id === id);

  async function clearAllDelays() {
    if (activeDelays.length === 0) {
      notify.info('No active delays to clear');
      return;
    }
    setShowClearDelaysConfirm(true);
  }

  async function performClearDelays() {
    setShowClearDelaysConfirm(false);
    setActionLoading(true);
    try {
      const r = await fetch(`${API_BASE}/clear-delays`, {
        method: "DELETE"
      });
      
      const resp = await r.json();
      if (!r.ok) {
        notify.error('Failed to clear delays', resp.detail || JSON.stringify(resp));
        return;
      }
      
      await refreshAll(true);
      notify.success(`Cleared ${resp.cleared_count} delays successfully`);
      
    } catch (e) {
      notify.error('Network error clearing delays');
    } finally {
      setActionLoading(false);
    }
  }

  async function resetSystem() {
    try {
      const r = await fetch(`${API_BASE}/reset`, { method: 'POST' });
      if (!r.ok) return;
      await refreshAll(false);
    } catch (e) {
      console.error('Reset failed:', e);
    }
  }

  const prevConflictCount = useRef(0);

  useEffect(() => {
    const a = setInterval(() => {
      setNowClock(new Date());
      setAnimTick((v) => v + 1);
    }, commandCenter?.pauseRefresh ? 150 : 1000);
    return () => clearInterval(a);
  }, [commandCenter?.pauseRefresh]);

  const kpis = useMemo(
    () => computeScheduleKPIs(schedule, trains),
    [schedule, trains]
  );

  const systemHealth = useMemo(() => {
    if (conflictCount > 0) return 'CONFLICTS' as const;
    if (activeDelays.length > 0) return 'DELAYS' as const;
    return 'OPTIMAL' as const;
  }, [conflictCount, activeDelays.length]);

  useEffect(() => {
    updateStatus({
      websocketConnected,
      lastSync,
      systemHealth,
      conflictCount,
      activeDelayCount: activeDelays.length,
      trainCount: kpis.total || trains.length,
      onTimePct: Number(kpis.ontimePct) || 0,
      isInitialLoadComplete: initialLoadComplete,
    });
  }, [
    websocketConnected,
    lastSync,
    systemHealth,
    conflictCount,
    activeDelays.length,
    schedule.length,
    trains.length,
    kpis.ontimePct,
    initialLoadComplete,
    updateStatus,
  ]);

  useEffect(() => {
    if (conflictCount > prevConflictCount.current && conflictCount > 0) {
      setLiveAnnouncement(`${conflictCount} active conflicts detected`);
      if (commandCenter?.alertSoundEnabled) playAlertTone();
    }
    prevConflictCount.current = conflictCount;
  }, [conflictCount, commandCenter?.alertSoundEnabled]);

  useEffect(() => {
    registerActions({
      refreshAll: async () => {
        setActionLoading(true);
        await refreshAll(false);
        setAnimTick((prev) => prev + 1);
        setActionLoading(false);
      },
      resetSystem: async () => {
        await resetSystem();
        notify.success('System reset', 'Baseline schedule restored and overrides cleared.');
      },
      openAuditLogs: () => {
        setWorkspaceTab('activity');
      },
      openWorkspaceTab: (tab) => setWorkspaceTab(tab),
    });
    return () => unregisterActions();
  }, [registerActions, unregisterActions, refreshAll]);

  const beforeEntries = useMemo(() => {
    if (baselineSchedule.length > 0) return baselineSchedule;
    if (previousSchedule.length > 0) return previousSchedule;
    return trains.map((t) => ({
      train_id: t.id,
      station_id: t.origin || '',
      assigned_platform: t.platform_pref || 1,
      actual_arrival: t.scheduled_arrival || new Date().toISOString(),
      actual_departure: t.scheduled_departure || t.scheduled_arrival || new Date().toISOString(),
      reason: 'initial schedule',
    }));
  }, [baselineSchedule, previousSchedule, trains]);

  const afterEntries = schedule.length > 0 ? schedule : beforeEntries;

  // Calculate delay impact for a potential override
  async function calculateDelayImpact(trainId: string, newPlatform: number): Promise<{current: number, predicted: number, difference: number} | null> {
    try {
      const currentEntry = schedule.find(s => s.train_id === trainId);
      const train = getTrain(trainId);
      
      if (!currentEntry || !train || !train.scheduled_arrival) {
        return null;
      }
      
      // Calculate current delay
      const scheduledTime = new Date(train.scheduled_arrival).getTime();
      const currentActualTime = new Date(currentEntry.actual_arrival).getTime();
      const currentDelay = Math.max(0, (currentActualTime - scheduledTime) / (60 * 1000)); // in minutes
      
      // Simulate the override to predict new delay
      const response = await fetch(`${API_BASE}/simulate-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: trainId,
          station_id: currentEntry.station_id,
          new_platform: newPlatform,
        }),
      });
      
      if (response.ok) {
        const simulation = await response.json();
        
        if (simulation.target_train_impact) {
          return {
            current: simulation.target_train_impact.current_delay,
            predicted: simulation.target_train_impact.predicted_delay,
            difference: simulation.target_train_impact.delay_change
          };
        }
      }
      
      // Fallback: estimate based on platform conflicts
      const conflictingTrains = schedule.filter(s => 
        s.station_id === currentEntry.station_id && 
        s.assigned_platform === newPlatform &&
        s.train_id !== trainId
      );
      
      // Simple heuristic: each conflicting train adds ~2-5 minutes delay
      const estimatedAdditionalDelay = conflictingTrains.length * 3;
      const predictedDelay = currentDelay + estimatedAdditionalDelay;
      
      return {
        current: currentDelay,
        predicted: predictedDelay,
        difference: estimatedAdditionalDelay
      };
      
    } catch (error) {
      console.error('Error calculating delay impact:', error);
      return null;
    }
  }

  // override handler
  async function openOverride(trainId: string) {
    selectTrain(trainId, schedule.find((s) => s.train_id === trainId) ?? null);
    setOverridePlatform(1);
    setOverrideMsg("");
    setDelayImpact(null);
    setShowDelayWarning(false);
    setShowModal(true);
    
    const impact = await calculateDelayImpact(trainId, 1);
    setDelayImpact(impact);
  }

  async function submitOverride(forceOverride: boolean = false) {
    if (!selectedTrainId) return;
    const stationId = schedule.find(
      (s) => s.train_id === selectedTrainId
    )?.station_id;
    if (!stationId) {
      setOverrideMsg("Train not found in current schedule");
      return;
    }
    
    // Check delay impact before proceeding (unless forced)
    if (!forceOverride && delayImpact && delayImpact.difference > 2) {
      setShowDelayWarning(true);
      setPendingOverride({
        trainId: selectedTrainId,
        stationId: stationId,
        platform: Number(overridePlatform)
      });
      return;
    }
    
    setActionLoading(true);
    try {
      const r = await fetch(`${API_BASE}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: selectedTrainId,
          station_id: stationId,
          new_platform: Number(overridePlatform),
        }),
      });
      const resp = await r.json();
      if (!r.ok) {
        if (resp.status === "rejected") {
          // Handle rejection with alternatives
          let alternativesText = "";
          if (resp.alternatives && resp.alternatives.length > 0) {
            const feasibleAlts = resp.alternatives.filter((alt: any) => alt.feasible);
            if (feasibleAlts.length > 0) {
              alternativesText = `\n\nSuggested alternatives:\n${feasibleAlts.map((alt: any) => 
                `• Platform ${alt.platform} (+${alt.delay_increase.toFixed(1)} min delay)`
              ).join('\n')}`;
            }
          }
          
          setOverrideMsg(`Override rejected: ${resp.reason}${alternativesText}`);
          
          // Show delay analysis if available
          if (resp.delay_analysis) {
            const analysis = resp.delay_analysis;
            setOverrideMsg(prev => prev + `\n\nDelay Analysis:\n• Current total delay: ${analysis.current_total_delay.toFixed(1)} min\n• Predicted total delay: ${analysis.predicted_total_delay.toFixed(1)} min\n• Increase: +${analysis.delay_increase.toFixed(1)} min`);
          }
          
          // Set last action for chatbot auto-explanation
        } else {
          setOverrideMsg(resp.detail || JSON.stringify(resp));
        }
      } else {
        // Success case
        let successMsg = `Override applied: ${resp.reason || 're-optimized'}`;
        
        if (resp.feasibility_analysis) {
          const analysis = resp.feasibility_analysis;
          successMsg += `\n\nOptimization Result:\n• Total delay increase: +${analysis.delay_increase.toFixed(1)} min\n• Trains affected: ${analysis.affected_trains_count}\n• System efficiency maintained`;
        }
        
        setOverrideMsg(successMsg);
        
        // Set last action for chatbot auto-explanation
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshAll(true);
      
      setTimeout(() => {
        setShowModal(false);
        setShowDelayWarning(false);
        setPendingOverride(null);
      }, 800);
    } catch (e) {
      setOverrideMsg("Network error");
    } finally {
      setActionLoading(false);
    }
  }
  
  // Handle forced override after warning
  async function proceedWithOverride() {
    if (pendingOverride) {
      setShowDelayWarning(false);
      await submitOverride(true);
    }
  }
  
  // Cancel override after warning
  function cancelOverride() {
    setShowDelayWarning(false);
    setPendingOverride(null);
    setOverrideMsg("Override cancelled due to high delay impact");
  }

  return (
    <>
      <LiveRegion message={liveAnnouncement} />
      {commandCenter?.isOpen && (
        <CommandCenterView
          now={nowClock}
          systemHealth={systemHealth}
          websocketConnected={websocketConnected}
          pauseRefresh={commandCenter.pauseRefresh}
          alertSoundEnabled={commandCenter.alertSoundEnabled}
          stations={stations}
          schedule={schedule}
          trains={trains}
          trainPositions={trainPositions}
          animTick={animTick}
          conflictCount={conflictCount}
          conflicts={conflictList ?? []}
          activeDelays={activeDelays}
          onTimePct={Number(kpis.ontimePct) || 0}
          recommendations={recommendations}
          logs={logs}
          onClose={commandCenter.onClose}
          onTogglePause={commandCenter.onTogglePause}
          onToggleAlertSound={commandCenter.onToggleAlertSound}
          onApplyRecommendation={onApplyRecommendation}
        />
      )}

      <div className="bg-surface-1 text-slate-100">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <ContextStrip />

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <SectionCard
              className="lg:col-span-8"
              title="Network map"
              subtitle={PRODUCT_COPY.tagline}
              headerAction={
                <time className="font-mono text-sm tabular-nums text-slate-300">
                  {nowClock.toLocaleTimeString()}
                </time>
              }
            >
              {!initialLoadComplete ? (
                <MapSkeleton />
              ) : (
                <NetworkMap
                  stations={stations}
                  schedule={schedule}
                  trains={trains}
                  trainPositions={trainPositions}
                  animTick={animTick}
                  trackStatus={trackStatus}
                  onTrainClick={handleTrainSelect}
                />
              )}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Live positions across HYB, SC, KCG</p>
                <MapLegend />
              </div>
            </SectionCard>

            <div className="lg:col-span-4">
              <SectionCard title="Operations rail">
                {!initialLoadComplete ? (
                  <KpiSkeleton />
                ) : (
                  <>
                    <StatusBoard
                      trainCount={kpis.total || trains.length}
                      onTimePct={Number(kpis.ontimePct) || 0}
                      conflictCount={conflictCount}
                      avgDelay={String(kpis.avgDelay)}
                      systemHealth={systemHealth}
                    />
                    <div className="mt-4">
                      <AlertQueue
                        conflicts={conflictList ?? []}
                        activeDelays={activeDelays}
                        onSelectTrain={(trainId) => {
                          const entry = schedule.find((s) => s.train_id === trainId);
                          selectEntry(entry ?? { train_id: trainId, station_id: '', assigned_platform: 1, actual_arrival: '', actual_departure: '' });
                        }}
                      />
                    </div>
                    <PlatformBoard
                      stations={stations}
                      schedule={schedule}
                      trains={trains}
                      now={nowClock}
                      onSelectTrain={(_trainId, entry) => selectEntry(entry)}
                    />
                    <TrackOccupancyPanel
                      trackStatus={trackStatus}
                      isStale={isStale('trackStatus')}
                    />
                    {recommendations.length > 0 && onApplyRecommendation && (
                      <div className="mt-4 border-t border-slate-700/80 pt-4">
                        <h3 className="mb-2 text-sm font-semibold text-white">Top recommendations</h3>
                        <ul className="space-y-2">
                          {recommendations.slice(0, 3).map((rec) => (
                            <li
                              key={rec.id}
                              className="rounded border border-slate-700 bg-slate-800/40 p-2 text-xs"
                            >
                              <p className="text-slate-300">{rec.description}</p>
                              <button
                                type="button"
                                className="mt-1 text-primary hover:underline"
                                onClick={() => onApplyRecommendation(rec.id)}
                              >
                                Apply for {rec.train_id}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <OperationsPanel
                      activeDelayCount={activeDelays.length}
                      selectedTrainId={selectedTrainId}
                      onManualOverride={() => {
                        const trainId = selectedTrainId ?? schedule[0]?.train_id;
                        if (trainId) void openOverride(trainId);
                      }}
                      onClearDelays={clearAllDelays}
                    />
                  </>
                )}
              </SectionCard>
            </div>
          </div>

          <SectionCard className="mb-6">
            <Tabs
              activeId={workspaceTab}
              onChange={(id) => setWorkspaceTab(id as WorkspaceTab)}
              ariaLabel="Operations workspace"
              tabs={[
                {
                  id: 'schedule',
                  label: 'Schedule',
                  content: !initialLoadComplete ? (
                    <TableSkeleton rows={8} />
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-slate-500">{PRODUCT_COPY.scheduleTab}</p>
                      <ScheduleTable
                        schedule={schedule}
                        trains={trains}
                        loading={false}
                        conflictTrainIds={conflictTrainIds}
                        onOverride={openOverride}
                        onRowClick={selectEntry}
                      />
                    </>
                  ),
                },
                {
                  id: 'timeline',
                  label: 'Timeline',
                  content: !initialLoadComplete ? (
                    <KpiSkeleton />
                  ) : (
                    <ScheduleTimelinePanel
                      beforeEntries={beforeEntries}
                      afterEntries={afterEntries}
                      stations={stations}
                      trains={trains}
                      conflicts={conflictList ?? []}
                      trainPositions={trainPositions}
                      now={nowClock}
                      animTick={animTick}
                      onEntryClick={selectEntry}
                    />
                  ),
                },
                {
                  id: 'activity',
                  label: 'Activity',
                  content: (
                    <>
                      <p className="mb-3 text-xs text-slate-500">{PRODUCT_COPY.activityTab}</p>
                      <ActivityPanel logs={logs} />
                    </>
                  ),
                },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      <TrainDetailDrawer
        entry={selectedEntry}
        train={selectedEntry ? getTrain(selectedEntry.train_id) ?? null : null}
        onClose={clearSelection}
        onOverride={(trainId) => {
          clearSelection();
          void openOverride(trainId);
        }}
      />

      <OverrideModal
        open={showModal}
        trainId={selectedTrainId}
        platform={overridePlatform}
        maxPlatform={
          selectedTrainId
            ? stations.find(
                (s) => s.id === schedule.find((e) => e.train_id === selectedTrainId)?.station_id
              )?.platforms
            : undefined
        }
        message={overrideMsg}
        delayImpact={delayImpact}
        loading={loading}
        onPlatformChange={async (p) => {
          setOverridePlatform(p);
          if (selectedTrainId) {
            const impact = await calculateDelayImpact(selectedTrainId, p);
            setDelayImpact(impact);
          }
        }}
        onClose={() => setShowModal(false)}
        onSubmit={() => void submitOverride(false)}
      />

      {pendingOverride && (
        <DelayWarningModal
          open={showDelayWarning}
          trainId={pendingOverride.trainId}
          platform={pendingOverride.platform}
          delayImpact={delayImpact}
          onCancel={cancelOverride}
          onProceed={() => void proceedWithOverride()}
        />
      )}

      <ConfirmDialog
        open={showClearDelaysConfirm}
        title="Clear all active delays?"
        message={`This will clear ${activeDelays.length} active delay${activeDelays.length === 1 ? '' : 's'} from the system.`}
        confirmLabel="Clear delays"
        variant="warning"
        onConfirm={() => void performClearDelays()}
        onCancel={() => setShowClearDelaysConfirm(false)}
      />
    </>
  );
}
