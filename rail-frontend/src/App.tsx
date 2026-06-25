import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { notify } from './lib/notify';
import { useDashboardShell } from './context/DashboardShellContext';
import type { WorkspaceTab } from './context/DashboardShellContext';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { KpiSkeleton, MapSkeleton, TableSkeleton } from './components/ui/Skeleton';
import { AlertsPanel } from './components/operations/AlertsPanel';
import { ScheduleTable } from './components/operations/ScheduleTable';
import { TrainDetailDrawer } from './components/operations/TrainDetailDrawer';
import { NetworkMap, MapLegend, type TrainPosition } from './components/operations/NetworkMap';
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
import { getConflictCount, normalizeActiveDelays } from './lib/apiNormalize';
import { playAlertTone } from './hooks/useCommandCenter';
import { PRODUCT_COPY } from './lib/productCopy';
import type {
  ScheduleEntry as ScheduleEntryType,
  ActiveDelay,
  ConflictsResponse,
  Recommendation,
  Train,
  Station,
} from './types/railway';

interface ScheduleEntry {
  train_id: string;
  station_id: string;
  assigned_platform: number;
  actual_arrival: string;
  actual_departure: string;
  reason?: string;
}

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

interface ScheduleResponse {
  schedule: ScheduleEntry[];
  delays_before_min: number[];
  delays_after_min: number[];
  reasons?: string[];
}

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

export default function App({
  commandCenter,
  recommendations = [],
  onApplyRecommendation,
}: AppProps = {}) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const [trains, setTrains] = useState<Train[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [baselineSchedule, setBaselineSchedule] = useState<ScheduleEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [previousSchedule, setPreviousSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
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
  const [activeDelays, setActiveDelays] = useState<ActiveDelay[]>([]);
  const [trainPositions, setTrainPositions] = useState<TrainPosition[]>([]);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({});
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showClearDelaysConfirm, setShowClearDelaysConfirm] = useState(false);
  const [ganttSelectedEntry, setGanttSelectedEntry] = useState<ScheduleEntryType | null>(null);

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const { updateStatus, registerActions, unregisterActions } = useDashboardShell();

  const markSync = useCallback(() => {
    setLastSync(new Date());
  }, []);

  // Removed conflict banner/context; app runs only on HYB–VSKP dataset

  // helpers & derived data
  const getTrain = (id: string) => trains.find((t) => t.id === id);

  // Fetch stations from backend
  async function fetchStations() {
    try {
      const res = await fetch(`${API_BASE}/stations`);
      if (res.ok) {
        const backendStations = await res.json();
        // Map backend stations to our Station interface with Hyderabad station details
        const stationDetails: Record<string, any> = {
          'HYB': { station_name: 'Hyderabad Deccan', latitude: 17.385, longitude: 78.4867, is_junction: true },
          'SC': { station_name: 'Secunderabad Junction', latitude: 17.4399, longitude: 78.5017, is_junction: true },
          'KCG': { station_name: 'Kacheguda', latitude: 17.3753, longitude: 78.4983, is_junction: true }
        };
        
        const mappedStations: Station[] = backendStations.map((s: any) => ({
          id: s.id,
          platforms: s.platforms,
          station_code: s.id,
          station_name: stationDetails[s.id]?.station_name || s.id,
          latitude: stationDetails[s.id]?.latitude,
          longitude: stationDetails[s.id]?.longitude,
          is_junction: stationDetails[s.id]?.is_junction || false,
        }));
        setStations(mappedStations);
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
  }


  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const prevConflictCount = useRef(0);

  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWebsocketConnected(true);
        wsRef.current = websocket;
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket received:', data);
          if (data.type === 'train_positions') {
            console.log('Setting train positions:', data.data);
            setTrainPositions(data.data);
          } else if (data.type === 'schedule_update') {
            void fetchSchedule(true);
            void fetchConflicts();
            void fetchLogs();
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
      
      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setWebsocketConnected(false);
        wsRef.current = null;
        setTimeout(connectWebSocket, 3000);
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWebsocketConnected(false);
      };
    };
    
    connectWebSocket();
    
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // polling / refresh interval
  useEffect(() => {
    const loadInitial = async () => {
      await Promise.all([
        fetchStations(),
        fetchDataset(),
        fetchSchedule(),
        fetchLogs(),
        fetchActiveDelays(),
        fetchTrainPositions(),
        fetchConflicts(),
        fetchTrackStatus(),
      ]);
      setInitialLoadComplete(true);
    };
    void loadInitial();
    if (commandCenter?.pauseRefresh) {
      const a = setInterval(() => setAnimTick((v) => v + 1), 150);
      return () => clearInterval(a);
    }
    const t = setInterval(() => {
      void fetchSchedule(true);
      void fetchActiveDelays();
      void fetchTrainPositions();
      void fetchConflicts();
      void fetchTrackStatus();
      setNowClock(new Date());
    }, 3000);
    const a = setInterval(() => setAnimTick((v) => v + 1), 150);
    return () => { clearInterval(t); clearInterval(a); };
  }, [commandCenter?.pauseRefresh]);

  async function fetchDataset() {
    try {
      const r = await fetch(`${API_BASE}/trains`);
      if (!r.ok) return;
      const data = await r.json();
      setTrains(data);
      markSync();
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchSchedule(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/schedule`);
      if (!r.ok) return;
      const data: ScheduleResponse = await r.json();
      
      // Store previous schedule for comparison (only if we have existing data)
      if (schedule.length > 0 && baselineSchedule.length === 0) {
        // First time: current schedule becomes baseline
        setBaselineSchedule([...schedule]);
      } else if (schedule.length > 0 && JSON.stringify(schedule) !== JSON.stringify(data.schedule)) {
        // Update previous schedule only if data actually changed
        setPreviousSchedule([...schedule]);
      }
      
      // Force new array references to trigger re-renders
      setSchedule([...data.schedule]);
      
      // Fetch baseline if not set
      if (baselineSchedule.length === 0) {
        try {
          const baselineRes = await fetch(`${API_BASE}/baseline`);
          if (baselineRes.ok) {
            const baselineData = await baselineRes.json();
            setBaselineSchedule([...baselineData]);
          }
        } catch (e) {
          console.log('Could not fetch baseline');
        }
      }
    } catch (e) {
      console.error('Error fetching schedule:', e);
    } finally {
      if (!silent) setLoading(false);
      markSync();
    }
  }

  async function fetchLogs() {
    try {
      const r = await fetch(`${API_BASE}/log`);
      if (!r.ok) return;
      const data = await r.json();
      setLogs([...data.slice(-50).reverse()]); // show recent first, force new array
    } catch (e) {
      // Silent error handling
    }
  }

  async function fetchActiveDelays() {
    try {
      const r = await fetch(`${API_BASE}/active-delays`);
      if (!r.ok) return;
      const data = await r.json();
      setActiveDelays(normalizeActiveDelays(data));
    } catch (e) {
      console.error('Error fetching active delays:', e);
    }
  }

  async function fetchTrainPositions() {
    try {
      const r = await fetch(`${API_BASE}/train-positions`);
      if (!r.ok) return;
      const data = await r.json();
      setTrainPositions(data);
    } catch (e) {
      console.error('Error fetching train positions:', e);
    }
  }

  async function fetchConflicts() {
    try {
      const r = await fetch(`${API_BASE}/conflicts`);
      if (r.ok) {
        const data = await r.json();
        setConflicts(data);
      }
    } catch (e) {
      console.error('Error fetching conflicts:', e);
    }
  }

  async function fetchTrackStatus() {
    try {
      await fetch(`${API_BASE}/track-status`);
    } catch {
      // optional endpoint
    }
  }

  async function clearAllDelays() {
    if (activeDelays.length === 0) {
      notify.info('No active delays to clear');
      return;
    }
    setShowClearDelaysConfirm(true);
  }

  async function performClearDelays() {
    setShowClearDelaysConfirm(false);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/clear-delays`, {
        method: "DELETE"
      });
      
      const resp = await r.json();
      if (!r.ok) {
        notify.error('Failed to clear delays', resp.detail || JSON.stringify(resp));
        return;
      }
      
      await Promise.all([
        fetchSchedule(),
        fetchLogs(),
        fetchActiveDelays()
      ]);
      
      notify.success(`Cleared ${resp.cleared_count} delays successfully`);
      
    } catch (e) {
      notify.error('Network error clearing delays');
    } finally {
      setLoading(false);
    }
  }

  async function resetSystem() {
    try {
      const r = await fetch(`${API_BASE}/reset`, { method: 'POST' });
      if (!r.ok) return;
      
      // Clear local state
      setBaselineSchedule([]);
      setPreviousSchedule([]);
      setSchedule([]);
      
      // Refresh everything
      await fetchSchedule();
      await fetchLogs();
    } catch (e) {
      console.error('Reset failed:', e);
    }
  }

  const kpis = useMemo(
    () => computeScheduleKPIs(schedule, trains),
    [schedule, trains]
  );

  const conflictCount = useMemo(() => getConflictCount(conflicts), [conflicts]);
  const conflictList = useMemo(() => {
    if (conflicts.conflicts?.length) return conflicts.conflicts;
    return (conflicts.conflict_log || []).map((log, i) => ({
      id: `log-${i}`,
      type: log.type || 'track_conflict',
      trains_involved: log.trains || [],
      root_cause: log.track ? `Track ${log.track}` : undefined,
      severity: 'medium',
    }));
  }, [conflicts]);

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
        setLoading(true);
        setPreviousSchedule([...scheduleRef.current]);
        await Promise.all([
          fetchSchedule(true),
          fetchLogs(),
          fetchDataset(),
          fetchActiveDelays(),
          fetchConflicts(),
          fetchTrackStatus(),
        ]);
        setAnimTick((prev) => prev + 1);
        setLoading(false);
      },
      resetSystem: async () => {
        await resetSystem();
        notify.success('System reset', 'Baseline schedule restored and overrides cleared.');
      },
      openAuditLogs: () => {
        void fetchLogs();
        setWorkspaceTab('activity');
      },
      openWorkspaceTab: (tab) => setWorkspaceTab(tab),
    });
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

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
    setSelectedTrain(trainId);
    setOverridePlatform(1);
    setOverrideMsg("");
    setDelayImpact(null);
    setShowDelayWarning(false);
    setShowModal(true);
    
    // Calculate initial delay impact for platform 1
    const impact = await calculateDelayImpact(trainId, 1);
    setDelayImpact(impact);
  }

  async function submitOverride(forceOverride: boolean = false) {
    if (!selectedTrain) return;
    const stationId = schedule.find(
      (s) => s.train_id === selectedTrain
    )?.station_id;
    if (!stationId) {
      setOverrideMsg("Train not found in current schedule");
      return;
    }
    
    // Check delay impact before proceeding (unless forced)
    if (!forceOverride && delayImpact && delayImpact.difference > 2) {
      setShowDelayWarning(true);
      setPendingOverride({
        trainId: selectedTrain,
        stationId: stationId,
        platform: Number(overridePlatform)
      });
      return;
    }
    
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: selectedTrain,
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
      
      // Force state invalidation and refresh
      setPreviousSchedule([...schedule]); // Store current as previous
      setSchedule([]); // Clear current to force re-render
      
      // Wait a moment for backend to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh all data
      await Promise.all([
        fetchSchedule(),
        fetchLogs()
      ]);
      
      setTimeout(() => {
        setShowModal(false);
        setShowDelayWarning(false);
        setPendingOverride(null);
      }, 800);
    } catch (e) {
      setOverrideMsg("Network error");
    } finally {
      setLoading(false);
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
          conflicts={conflictList}
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
                      <AlertsPanel
                        conflictCount={conflictCount}
                        conflicts={conflictList}
                        activeDelays={activeDelays}
                      />
                    </div>
                    <OperationsPanel
                      activeDelayCount={activeDelays.length}
                      onManualOverride={() => {
                        const trainId = schedule[0]?.train_id;
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
                        onOverride={openOverride}
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
                      animTick={animTick}
                      onEntryClick={setGanttSelectedEntry}
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
        entry={ganttSelectedEntry}
        train={ganttSelectedEntry ? getTrain(ganttSelectedEntry.train_id) ?? null : null}
        onClose={() => setGanttSelectedEntry(null)}
        onOverride={(trainId) => {
          setGanttSelectedEntry(null);
          void openOverride(trainId);
        }}
      />

      <OverrideModal
        open={showModal}
        trainId={selectedTrain}
        platform={overridePlatform}
        message={overrideMsg}
        delayImpact={delayImpact}
        loading={loading}
        onPlatformChange={async (p) => {
          setOverridePlatform(p);
          if (selectedTrain) {
            const impact = await calculateDelayImpact(selectedTrain, p);
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
