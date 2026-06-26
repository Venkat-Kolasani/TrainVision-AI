import { useMemo } from 'react';
import type { ScheduleEntry, Station, Train } from '../../types/railway';
import { getTrainById } from '../../lib/scheduleUtils';

interface PlatformBoardProps {
  stations: Station[];
  schedule: ScheduleEntry[];
  trains: Train[];
  now?: Date;
  onSelectTrain?: (trainId: string, entry: ScheduleEntry) => void;
}

interface CellInfo {
  trainId: string;
  entry: ScheduleEntry;
  arr: string;
  dep: string;
  delayMin: number;
  kind: 'now' | 'next';
}

function delayMinutes(entry: ScheduleEntry, train: Train | undefined): number {
  if (!train?.scheduled_arrival) return 0;
  return Math.max(
    0,
    (new Date(entry.actual_arrival).getTime() - new Date(train.scheduled_arrival).getTime()) / 60000
  );
}

export function PlatformBoard({
  stations,
  schedule,
  trains,
  now = new Date(),
  onSelectTrain,
}: PlatformBoardProps) {
  const nowMs = now.getTime();
  const horizonMs = 30 * 60 * 1000;

  const cells = useMemo(() => {
    const result: Record<string, Record<number, CellInfo | null>> = {};
    stations.forEach((st) => {
      result[st.id] = {};
      for (let p = 1; p <= st.platforms; p++) result[st.id][p] = null;
    });

    schedule.forEach((entry) => {
      const arr = new Date(entry.actual_arrival).getTime();
      const dep = new Date(entry.actual_departure).getTime();
      const st = entry.station_id;
      const p = entry.assigned_platform;
      if (!result[st]?.[p]) return;

      const train = getTrainById(trains, entry.train_id);
      const dMin = delayMinutes(entry, train);
      const fmt = (t: number) =>
        new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (arr <= nowMs && dep >= nowMs) {
        result[st][p] = {
          trainId: entry.train_id,
          entry,
          arr: fmt(arr),
          dep: fmt(dep),
          delayMin: dMin,
          kind: 'now',
        };
      } else if (arr > nowMs && arr <= nowMs + horizonMs) {
        const existing = result[st][p];
        if (!existing || existing.kind !== 'now') {
          if (!existing || arr < new Date(existing.entry.actual_arrival).getTime()) {
            result[st][p] = {
              trainId: entry.train_id,
              entry,
              arr: fmt(arr),
              dep: fmt(dep),
              delayMin: dMin,
              kind: 'next',
            };
          }
        }
      }
    });
    return result;
  }, [stations, schedule, trains, nowMs]);

  const maxPlatforms = Math.max(...stations.map((s) => s.platforms), 1);

  return (
    <div className="mt-4 border-t border-slate-700/80 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Platform board</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2 pr-2 font-medium">Station</th>
              {Array.from({ length: maxPlatforms }).map((_, i) => (
                <th key={i} className="pb-2 px-1 font-mono font-medium">
                  P{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stations.map((st) => (
              <tr key={st.id} className="border-t border-slate-700/60">
                <td className="py-2 pr-2 font-mono font-medium text-slate-300">{st.id}</td>
                {Array.from({ length: maxPlatforms }).map((_, i) => {
                  const p = i + 1;
                  if (p > st.platforms) {
                    return (
                      <td key={p} className="px-1 py-2 text-slate-600">
                        —
                      </td>
                    );
                  }
                  const cell = cells[st.id]?.[p];
                  if (!cell) {
                    return (
                      <td key={p} className="px-1 py-2 text-slate-600">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={p} className="px-1 py-2">
                      <button
                        type="button"
                        className={`w-full rounded border p-1.5 text-left transition-colors hover:border-primary/50 ${
                          cell.kind === 'now'
                            ? 'border-success/40 bg-success/10'
                            : 'border-slate-600 bg-slate-800/50'
                        }`}
                        onClick={() => onSelectTrain?.(cell.trainId, cell.entry)}
                      >
                        <div className="font-mono font-semibold text-white">{cell.trainId}</div>
                        <div className="text-slate-400">
                          {cell.kind === 'now' ? 'NOW' : 'NEXT'} {cell.arr}
                          {cell.delayMin > 2 && (
                            <span className="ml-1 text-warning">+{Math.round(cell.delayMin)}m</span>
                          )}
                        </div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
