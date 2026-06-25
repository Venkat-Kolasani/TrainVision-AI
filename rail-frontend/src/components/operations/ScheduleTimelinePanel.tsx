import type { ScheduleEntry, Station, Train } from '../../types/railway';
import { GanttChart } from './GanttChart';
import { SectionCard } from '../layout/SectionCard';
import { PRODUCT_COPY } from '../../lib/productCopy';

interface ScheduleTimelinePanelProps {
  beforeEntries: ScheduleEntry[];
  afterEntries: ScheduleEntry[];
  stations: Station[];
  trains: Train[];
  animTick: number;
  onEntryClick: (entry: ScheduleEntry) => void;
}

function getTimeWindow(entries: ScheduleEntry[]) {
  if (entries.length === 0) {
    return { min: Date.now() - 30 * 60 * 1000, max: Date.now() + 30 * 60 * 1000 };
  }
  const times = entries.flatMap((e) => [
    new Date(e.actual_arrival).getTime(),
    new Date(e.actual_departure).getTime(),
  ]);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = maxTime - minTime;
  const padding = Math.max(30 * 60 * 1000, Math.min(2 * 60 * 60 * 1000, timeSpan * 0.1));
  return { min: minTime - padding, max: maxTime + padding };
}

export function ScheduleTimelinePanel({
  beforeEntries,
  afterEntries,
  stations,
  trains,
  animTick,
  onEntryClick,
}: ScheduleTimelinePanelProps) {
  const beforeWindow = getTimeWindow(beforeEntries);
  const afterWindow = getTimeWindow(afterEntries);
  const sharedWindow = {
    min: Math.min(beforeWindow.min, afterWindow.min),
    max: Math.max(beforeWindow.max, afterWindow.max),
  };

  const changedTrains = new Set<string>();
  afterEntries.forEach((after) => {
    const before = beforeEntries.find((b) => b.train_id === after.train_id);
    if (
      before &&
      (before.assigned_platform !== after.assigned_platform ||
        before.actual_arrival !== after.actual_arrival ||
        before.actual_departure !== after.actual_departure)
    ) {
      changedTrains.add(after.train_id);
    }
  });

  return (
    <SectionCard title="Schedule timeline" subtitle={PRODUCT_COPY.timelineTab}>
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-slate-700 bg-surface-3/40 p-3">
          <div className="text-xs uppercase text-slate-500">Changes</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">{changedTrains.size}</div>
        </div>
        <div className="rounded border border-slate-700 bg-surface-3/40 p-3">
          <div className="text-xs uppercase text-slate-500">Baseline</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">{beforeEntries.length}</div>
        </div>
        <div className="rounded border border-slate-700 bg-surface-3/40 p-3">
          <div className="text-xs uppercase text-slate-500">Optimized</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">{afterEntries.length}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GanttChart
          entries={beforeEntries}
          title="Before optimization"
          timeWindow={sharedWindow}
          stations={stations}
          trains={trains}
          animTick={animTick}
          onEntryClick={onEntryClick}
        />
        <GanttChart
          entries={afterEntries}
          title="After optimization"
          timeWindow={sharedWindow}
          stations={stations}
          trains={trains}
          animTick={animTick}
          onEntryClick={onEntryClick}
        />
      </div>
      {changedTrains.size > 0 && (
        <p className="mt-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Changed trains:{' '}
          <span className="font-mono text-slate-200">{Array.from(changedTrains).join(', ')}</span>
        </p>
      )}
    </SectionCard>
  );
}
