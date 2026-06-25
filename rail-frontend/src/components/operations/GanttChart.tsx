import { useMemo } from 'react';
import type { ScheduleEntry, Station, Train } from '../../types/railway';
import { colorForEntry, getTrainById, isOverriddenEntry } from '../../lib/scheduleUtils';

interface GanttChartProps {
  entries: ScheduleEntry[];
  title: string;
  timeWindow: { min: number; max: number };
  stations: Station[];
  trains: Train[];
  animTick?: number;
  onEntryClick?: (entry: ScheduleEntry) => void;
}

export function GanttChart({
  entries,
  title,
  timeWindow,
  stations,
  trains,
  animTick = 0,
  onEntryClick,
}: GanttChartProps) {
  const stationMap = useMemo(() => {
    const map: Record<string, { platforms: number; rows: Record<number, ScheduleEntry[]> }> = {};
    stations.forEach((s) => (map[s.id] = { platforms: s.platforms, rows: {} }));
    entries.forEach((e) => {
      if (!map[e.station_id]) return;
      const p = e.assigned_platform;
      if (!map[e.station_id].rows[p]) map[e.station_id].rows[p] = [];
      map[e.station_id].rows[p].push(e);
    });
    return map;
  }, [entries, stations, animTick]);

  const ticks = useMemo(() => {
    const res: { leftPct: number; label: string; isHour?: boolean }[] = [];
    const totalSpan = timeWindow.max - timeWindow.min;
    const span = Math.max(1, totalSpan);

    let tickInterval: number;
    if (totalSpan <= 2 * 60 * 60 * 1000) {
      tickInterval = 10 * 60 * 1000;
    } else if (totalSpan <= 8 * 60 * 60 * 1000) {
      tickInterval = 30 * 60 * 1000;
    } else {
      tickInterval = 60 * 60 * 1000;
    }

    const start = Math.floor(timeWindow.min / tickInterval) * tickInterval;
    const end = Math.ceil(timeWindow.max / tickInterval) * tickInterval;

    for (let t = start; t <= end; t += tickInterval) {
      const leftPct = ((t - timeWindow.min) / span) * 100;
      const date = new Date(t);
      const isHour = date.getMinutes() === 0;
      const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      res.push({ leftPct, label, isHour });
    }
    return res;
  }, [timeWindow.min, timeWindow.max]);

  const span = Math.max(1, timeWindow.max - timeWindow.min);

  return (
    <div className="rounded bg-slate-800 p-4 text-slate-100 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <div className="text-xs text-gray-500">
          Time window:{' '}
          {new Date(timeWindow.min).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          –{' '}
          {new Date(timeWindow.max).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          <span className="ml-2 text-slate-400">
            ({Math.round(((timeWindow.max - timeWindow.min) / (60 * 60 * 1000)) * 10) / 10}h span)
          </span>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
          Express
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: '#22c55e' }} />
          Local
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
          Intercity
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: '#8b5cf6' }} />
          Freight
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: '#ef4444' }} />
          Delayed
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px]">★</span> Overridden
        </div>
      </div>
      <div className="w-full">
        <div className="relative h-8 w-full border-b border-slate-700">
          {ticks.map((t, i) => (
            <div key={i} className="absolute top-0 text-[10px] text-slate-400" style={{ left: `${t.leftPct}%` }}>
              <div className={`border-l ${t.isHour ? 'h-4 border-slate-400' : 'h-2 border-slate-600'}`} />
              <div className={`translate-x-1 ${t.isHour ? 'font-medium text-slate-300' : 'text-slate-500'}`}>
                {t.label}
              </div>
            </div>
          ))}
        </div>

        <div className="divide-y divide-slate-700">
          {stations.map((st) => (
            <div key={st.id} className="py-3">
              <div className="mb-1 text-sm font-medium text-slate-200">{st.id}</div>
              {Array.from({ length: st.platforms }).map((_, idx) => {
                const p = idx + 1;
                const rowEntries = stationMap[st.id]?.rows[p] || [];
                return (
                  <div
                    key={p}
                    className="relative mb-3 h-10 w-full rounded border border-slate-700 bg-slate-900/40"
                  >
                    <div className="absolute left-2 top-1.5 text-[11px] text-slate-400">P{p}</div>
                    {rowEntries.map((e, i) => {
                      const start = new Date(e.actual_arrival).getTime();
                      const end = new Date(e.actual_departure).getTime();
                      const leftPct = Math.max(0, ((start - timeWindow.min) / span) * 100);
                      const widthPct = Math.max(0.5, ((end - start) / span) * 100);
                      const color = colorForEntry(e, trains);
                      const t = getTrainById(trains, e.train_id);
                      const heading = `${t?.origin || '-'} → ${t?.destination || '-'}`;
                      const tooltip = `Train ${e.train_id} • ${heading} @ ${st.id} P${p}\n${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          className="absolute top-1.5 flex h-7 cursor-pointer items-center rounded px-2 text-[10px] text-white shadow transition-opacity hover:opacity-90"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
                          title={tooltip}
                          onClick={() => onEntryClick?.(e)}
                        >
                          <span className="truncate font-medium">{e.train_id}</span>
                          <span className="ml-2 hidden text-white/90 md:inline">{heading}</span>
                          {isOverriddenEntry(e) && <span className="ml-1 text-[9px]">★</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
