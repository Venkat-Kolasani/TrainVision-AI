import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TrainPosition } from '../components/operations/NetworkMap';
import { getConflictCount, normalizeActiveDelays } from '../lib/apiNormalize';
import type {
  ActiveDelay,
  ConflictsResponse,
  LogEntry,
  Recommendation,
  ScheduleEntry,
  Station,
  Train,
} from '../types/railway';

export type FeedKey =
  | 'schedule'
  | 'trains'
  | 'stations'
  | 'logs'
  | 'delays'
  | 'positions'
  | 'conflicts'
  | 'trackStatus'
  | 'recommendations';

export interface TrackStatusResponse {
  track_occupancy?: Record<string, unknown>;
  active_movements?: number;
  conflicts_detected?: number;
}

export interface ScheduleResponse {
  schedule: ScheduleEntry[];
  delays_before_min?: number[];
  delays_after_min?: number[];
  reasons?: string[];
  conflicts?: ConflictsResponse['conflicts'];
}

const POLL_MS = 5000;
const STALE_MS = 15000;

interface OperationsFeedState {
  trains: Train[];
  schedule: ScheduleEntry[];
  baselineSchedule: ScheduleEntry[];
  previousSchedule: ScheduleEntry[];
  stations: Station[];
  logs: LogEntry[];
  activeDelays: ActiveDelay[];
  trainPositions: TrainPosition[];
  conflicts: ConflictsResponse;
  trackStatus: TrackStatusResponse | null;
  recommendations: Recommendation[];
  websocketConnected: boolean;
  loading: boolean;
  initialLoadComplete: boolean;
  lastUpdated: Partial<Record<FeedKey, Date>>;
  isStale: (key: FeedKey) => boolean;
  refreshAll: (silent?: boolean) => Promise<void>;
  refreshSchedule: (silent?: boolean) => Promise<void>;
  setPreviousScheduleFromCurrent: () => void;
  conflictCount: number;
  conflictList: ConflictsResponse['conflicts'];
}

const OperationsFeedContext = createContext<OperationsFeedState | null>(null);

function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
}

export function OperationsFeedProvider({
  children,
  pauseRefresh = false,
}: {
  children: ReactNode;
  pauseRefresh?: boolean;
}) {
  const [trains, setTrains] = useState<Train[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [baselineSchedule, setBaselineSchedule] = useState<ScheduleEntry[]>([]);
  const [previousSchedule, setPreviousSchedule] = useState<ScheduleEntry[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeDelays, setActiveDelays] = useState<ActiveDelay[]>([]);
  const [trainPositions, setTrainPositions] = useState<TrainPosition[]>([]);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({});
  const [trackStatus, setTrackStatus] = useState<TrackStatusResponse | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Partial<Record<FeedKey, Date>>>({});

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const wsRef = useRef<WebSocket | null>(null);

  const markUpdated = useCallback((key: FeedKey) => {
    setLastUpdated((prev) => ({ ...prev, [key]: new Date() }));
  }, []);

  const isStale = useCallback(
    (key: FeedKey) => {
      const ts = lastUpdated[key];
      if (!ts) return true;
      return Date.now() - ts.getTime() > STALE_MS;
    },
    [lastUpdated]
  );

  const fetchTrains = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/trains`);
    if (!r.ok) return;
    setTrains(await r.json());
    markUpdated('trains');
  }, [markUpdated]);

  const fetchStations = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/stations`);
    if (!r.ok) return;
    const data = await r.json();
    const mapped: Station[] = data.map((s: Station) => ({
      id: s.id,
      platforms: s.platforms,
      station_code: s.id,
      station_name: s.station_name || s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      is_junction: s.is_junction ?? false,
    }));
    setStations(mapped);
    markUpdated('stations');
  }, [markUpdated]);

  const fetchSchedule = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await fetch(`${getApiBase()}/schedule`);
        if (!r.ok) return;
        const data: ScheduleResponse = await r.json();
        const current = scheduleRef.current;
        const nextSchedule = Array.isArray(data.schedule) ? data.schedule : [];
        if (current.length > 0 && JSON.stringify(current) !== JSON.stringify(nextSchedule)) {
          setPreviousSchedule([...current]);
        }
        setSchedule([...nextSchedule]);
        if (baselineSchedule.length === 0) {
          const baselineRes = await fetch(`${getApiBase()}/baseline`);
          if (baselineRes.ok) {
            setBaselineSchedule([...(await baselineRes.json())]);
          }
        }
        markUpdated('schedule');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [baselineSchedule.length, markUpdated]
  );

  const fetchLogs = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/log`);
    if (!r.ok) return;
    const data = await r.json();
    setLogs([...data.slice(-50).reverse()]);
    markUpdated('logs');
  }, [markUpdated]);

  const fetchDelays = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/active-delays`);
    if (!r.ok) return;
    setActiveDelays(normalizeActiveDelays(await r.json()));
    markUpdated('delays');
  }, [markUpdated]);

  const fetchPositions = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/train-positions`);
    if (!r.ok) return;
    setTrainPositions(await r.json());
    markUpdated('positions');
  }, [markUpdated]);

  const fetchConflicts = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/conflicts`);
    if (!r.ok) return;
    setConflicts(await r.json());
    markUpdated('conflicts');
  }, [markUpdated]);

  const fetchTrackStatus = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/track-status`);
    if (!r.ok) return;
    setTrackStatus(await r.json());
    markUpdated('trackStatus');
  }, [markUpdated]);

  const fetchRecommendations = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/recommendations`);
    if (!r.ok) return;
    setRecommendations(await r.json());
    markUpdated('recommendations');
  }, [markUpdated]);

  const refreshAll = useCallback(
    async (silent = true) => {
      setPreviousSchedule([...scheduleRef.current]);
      await Promise.all([
        fetchSchedule(silent),
        fetchTrains(),
        fetchStations(),
        fetchLogs(),
        fetchDelays(),
        fetchPositions(),
        fetchConflicts(),
        fetchTrackStatus(),
        fetchRecommendations(),
      ]);
    },
    [
      fetchSchedule,
      fetchTrains,
      fetchStations,
      fetchLogs,
      fetchDelays,
      fetchPositions,
      fetchConflicts,
      fetchTrackStatus,
      fetchRecommendations,
    ]
  );

  const refreshSchedule = useCallback(
    async (silent = true) => {
      await fetchSchedule(silent);
    },
    [fetchSchedule]
  );

  const setPreviousScheduleFromCurrent = useCallback(() => {
    setPreviousSchedule([...scheduleRef.current]);
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${getApiBase().replace(/^http/, 'ws')}/ws`);
      ws.onopen = () => {
        setWebsocketConnected(true);
        wsRef.current = ws;
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'train_positions') {
            setTrainPositions(data.data);
            markUpdated('positions');
          } else if (data.type === 'schedule_update') {
            void fetchSchedule(true);
            void fetchConflicts();
            void fetchLogs();
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setWebsocketConnected(false);
        wsRef.current = null;
        setTimeout(connect, 3000);
      };
      ws.onerror = () => setWebsocketConnected(false);
    };
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [fetchConflicts, fetchLogs, fetchSchedule, markUpdated]);

  useEffect(() => {
    const load = async () => {
      await refreshAll(false);
      setInitialLoadComplete(true);
    };
    void load();
  }, []);

  useEffect(() => {
    if (pauseRefresh) return;
    const t = setInterval(() => {
      void refreshAll(true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pauseRefresh, refreshAll]);

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

  const value = useMemo<OperationsFeedState>(
    () => ({
      trains,
      schedule,
      baselineSchedule,
      previousSchedule,
      stations,
      logs,
      activeDelays,
      trainPositions,
      conflicts,
      trackStatus,
      recommendations,
      websocketConnected,
      loading,
      initialLoadComplete,
      lastUpdated,
      isStale,
      refreshAll,
      refreshSchedule,
      setPreviousScheduleFromCurrent,
      conflictCount,
      conflictList,
    }),
    [
      trains,
      schedule,
      baselineSchedule,
      previousSchedule,
      stations,
      logs,
      activeDelays,
      trainPositions,
      conflicts,
      trackStatus,
      recommendations,
      websocketConnected,
      loading,
      initialLoadComplete,
      lastUpdated,
      isStale,
      refreshAll,
      refreshSchedule,
      setPreviousScheduleFromCurrent,
      conflictCount,
      conflictList,
    ]
  );

  return (
    <OperationsFeedContext.Provider value={value}>{children}</OperationsFeedContext.Provider>
  );
}

export function useOperationsFeed() {
  const ctx = useContext(OperationsFeedContext);
  if (!ctx) throw new Error('useOperationsFeed must be used within OperationsFeedProvider');
  return ctx;
}
