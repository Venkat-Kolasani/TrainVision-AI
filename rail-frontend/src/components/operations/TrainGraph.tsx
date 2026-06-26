import { useMemo, useState } from 'react';
import type { TrainPosition } from './NetworkMap';
import type { ConflictItem, ScheduleEntry, Station, Train } from '../../types/railway';
import { colorForEntry, isOverriddenEntry } from '../../lib/scheduleUtils';

type GraphMode = 'occupation' | 'corridor' | 'compare';

interface TrainGraphProps {
  baselineEntries: ScheduleEntry[];
  actualEntries: ScheduleEntry[];
  stations: Station[];
  trains: Train[];
  conflicts: ConflictItem[];
  trainPositions?: TrainPosition[];
  now?: Date;
  animTick?: number;
  onEntryClick?: (entry: ScheduleEntry) => void;
}

function getTimeWindow(entries: ScheduleEntry[], nowMs: number) {
  if (entries.length === 0) {
    return { min: nowMs - 60 * 60 * 1000, max: nowMs + 2 * 60 * 60 * 1000 };
  }
  const times = entries.flatMap((e) => [
    new Date(e.actual_arrival).getTime(),
    new Date(e.actual_departure).getTime(),
  ]);
  const minTime = Math.min(...times, nowMs - 30 * 60 * 1000);
  const maxTime = Math.max(...times, nowMs + 90 * 60 * 1000);
  const padding = 20 * 60 * 1000;
  return { min: minTime - padding, max: maxTime + padding };
}

function conflictTrainIds(conflicts: ConflictItem[]): Set<string> {
  const ids = new Set<string>();
  conflicts.forEach((c) => (c.trains_involved || []).forEach((t) => ids.add(t)));
  return ids;
}

export function TrainGraph({
  baselineEntries,
  actualEntries,
  stations,
  trains,
  conflicts,
  trainPositions = [],
  now = new Date(),
  animTick = 0,
  onEntryClick,
}: TrainGraphProps) {
  const [mode, setMode] = useState<GraphMode>('occupation');
  const nowMs = now.getTime();
  const conflictIds = useMemo(() => conflictTrainIds(conflicts), [conflicts]);

  const displayEntries = mode === 'compare'
    ? actualEntries.filter((a) => {
        const b = baselineEntries.find(
          (x) => x.train_id === a.train_id && x.station_id === a.station_id
        );
        return (
          !b ||
          b.assigned_platform !== a.assigned_platform ||
          b.actual_arrival !== a.actual_arrival
        );
      })
    : actualEntries;

  const mutedEntries = mode === 'occupation' ? baselineEntries : [];

  const timeWindow = useMemo(
    () => getTimeWindow([...displayEntries, ...mutedEntries], nowMs),
    [displayEntries, mutedEntries, nowMs, animTick]
  );
  const span = Math.max(1, timeWindow.max - timeWindow.min);
  const nowPct = ((nowMs - timeWindow.min) / span) * 100;

  const stationMap = useMemo(() => {
    const map: Record<string, { platforms: number; rows: Record<number, ScheduleEntry[]> }> = {};
    stations.forEach((s) => (map[s.id] = { platforms: s.platforms, rows: {} }));
    displayEntries.forEach((e) => {
      if (!map[e.station_id]) return;
      const p = e.assigned_platform;
      if (!map[e.station_id].rows[p]) map[e.station_id].rows[p] = [];
      map[e.station_id].rows[p].push(e);
    });
    return map;
  }, [displayEntries, stations, animTick]);

  const corridorLanes = useMemo(() => {
    const byTrain: Record<string, ScheduleEntry[]> = {};
    displayEntries.forEach((e) => {
      if (!byTrain[e.train_id]) byTrain[e.train_id] = [];
      byTrain[e.train_id].push(e);
    });
    Object.values(byTrain).forEach((arr) =>
      arr.sort((a, b) => new Date(a.actual_arrival).getTime() - new Date(b.actual_arrival).getTime())
    );
    return byTrain;
  }, [displayEntries]);

  const liveMarkers = useMemo(() => {
    return trainPositions
      .filter((p) => p.status === 'moving')
      .map((pos) => {
        const entries = actualEntries
          .filter((e) => e.train_id === pos.train_id)
          .sort(
            (a, b) =>
              new Date(a.actual_arrival).getTime() - new Date(b.actual_arrival).getTime()
          );
        const fromEntry = entries.find((e) => e.station_id === pos.from_station);
        const toEntry = entries.find((e) => e.station_id === pos.to_station);
        if (!fromEntry || !toEntry) return null;
        const departMs = new Date(fromEntry.actual_departure).getTime();
        const arriveMs = new Date(toEntry.actual_arrival).getTime();
        const progress = Math.min(1, Math.max(0, pos.progress ?? 0.5));
        const markerMs = departMs + (arriveMs - departMs) * progress;
        const leftPct = Math.min(100, Math.max(0, ((markerMs - timeWindow.min) / span) * 100));
        return {
          trainId: pos.train_id,
          leftPct,
          stationId: fromEntry.station_id,
          platform: fromEntry.assigned_platform,
          corridorTrainId: pos.train_id,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [trainPositions, actualEntries, timeWindow.min, span]);

  const renderBar = (e: ScheduleEntry, muted: boolean, key: string) => {
    const start = new Date(e.actual_arrival).getTime();
    const end = new Date(e.actual_departure).getTime();
    const leftPct = Math.max(0, ((start - timeWindow.min) / span) * 100);
    const widthPct = Math.max(0.5, ((end - start) / span) * 100);
    const color = muted ? '#475569' : colorForEntry(e, trains);
    const isConflict = conflictIds.has(e.train_id);
    return (
      <button
        key={key}
        type="button"
        className={`absolute top-1.5 flex h-7 items-center rounded px-2 text-[10px] text-white shadow transition-opacity hover:opacity-90 ${isConflict ? 'ring-2 ring-danger' : ''}`}
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          backgroundColor: color,
          opacity: muted ? 0.45 : 1,
          backgroundImage: isConflict
            ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 8px)'
            : undefined,
        }}
        title={`${e.train_id} @ ${e.station_id} P${e.assigned_platform}`}
        onClick={() => onEntryClick?.(e)}
      >
        <span className="truncate font-mono font-medium">{e.train_id}</span>
        {isOverriddenEntry(e) && <span className="ml-1 text-[9px]">★</span>}
      </button>
    );
  };

  const renderLiveHead = (marker: (typeof liveMarkers)[number], key: string) => (
    <div
      key={key}
      className="pointer-events-none absolute top-1 z-30 flex h-7 items-center"
      style={{ left: `${marker.leftPct}%`, transform: 'translateX(-50%)' }}
      title={`${marker.trainId} live head`}
      aria-hidden
    >
      <span className="inline-block h-3 w-3 rotate-45 border-2 border-white bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
    </div>
  );

  return (
    <div className="rounded border border-slate-700 bg-slate-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">Train graph</h3>
        <div className="flex gap-1 rounded border border-slate-600 p-0.5 text-xs">
          {(['occupation', 'corridor', 'compare'] as GraphMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded px-2 py-1 capitalize ${mode === m ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-2 h-6 border-b border-slate-700 font-mono text-[10px] text-slate-400">
        <span className="absolute left-0">
          {new Date(timeWindow.min).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="absolute right-0">
          {new Date(timeWindow.max).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="relative">
        <div
          className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ left: `${Math.min(100, Math.max(0, nowPct))}%` }}
          aria-hidden
        >
          <span className="absolute -top-5 -translate-x-1/2 rounded bg-danger px-1 text-[9px] text-white">
            NOW
          </span>
        </div>

        {mode === 'corridor' ? (
          <div className="space-y-2">
            {Object.entries(corridorLanes).map(([trainId, entries]) => (
              <div key={trainId} className="relative h-10 rounded border border-slate-700 bg-slate-800/40">
                <div className="absolute left-2 top-2 font-mono text-[11px] text-slate-400">{trainId}</div>
                {entries.map((e, i) => renderBar(e, false, `${trainId}-${i}`))}
                {liveMarkers
                  .filter((m) => m.corridorTrainId === trainId)
                  .map((m) => renderLiveHead(m, `live-${trainId}`))}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {stations.map((st) => (
              <div key={st.id} className="py-2">
                <div className="mb-1 font-mono text-sm text-slate-200">{st.id}</div>
                {Array.from({ length: st.platforms }).map((_, idx) => {
                  const p = idx + 1;
                  const rowEntries = stationMap[st.id]?.rows[p] || [];
                  const mutedRow = mutedEntries.filter(
                    (e) => e.station_id === st.id && e.assigned_platform === p
                  );
                  return (
                    <div
                      key={p}
                      className="relative mb-2 h-10 rounded border border-slate-700 bg-slate-800/30"
                    >
                      <div className="absolute left-2 top-2 font-mono text-[11px] text-slate-500">
                        P{p}
                      </div>
                      {mutedRow.map((e, i) => renderBar(e, true, `m-${st.id}-${p}-${i}`))}
                      {rowEntries.map((e, i) => renderBar(e, false, `${st.id}-${p}-${i}`))}
                      {liveMarkers
                        .filter((m) => m.stationId === st.id && m.platform === p)
                        .map((m) => renderLiveHead(m, `live-${st.id}-${p}-${m.trainId}`))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {trainPositions.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Live head markers: {liveMarkers.length} en route ·{' '}
          {trainPositions.filter((p) => p.status === 'moving').length} moving
        </p>
      )}
    </div>
  );
}
