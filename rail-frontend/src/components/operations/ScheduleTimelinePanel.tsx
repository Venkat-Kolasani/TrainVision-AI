import type { TrainPosition } from './NetworkMap';
import type { ConflictItem, ScheduleEntry, Station, Train } from '../../types/railway';
import { TrainGraph } from './TrainGraph';
import { SectionCard } from '../layout/SectionCard';
import { PRODUCT_COPY } from '../../lib/productCopy';

interface ScheduleTimelinePanelProps {
  beforeEntries: ScheduleEntry[];
  afterEntries: ScheduleEntry[];
  stations: Station[];
  trains: Train[];
  conflicts: ConflictItem[];
  trainPositions?: TrainPosition[];
  now: Date;
  animTick: number;
  onEntryClick: (entry: ScheduleEntry) => void;
}

export function ScheduleTimelinePanel({
  beforeEntries,
  afterEntries,
  stations,
  trains,
  conflicts,
  trainPositions = [],
  now,
  animTick,
  onEntryClick,
}: ScheduleTimelinePanelProps) {
  const changedTrains = new Set<string>();
  afterEntries.forEach((after) => {
    const before = beforeEntries.find(
      (b) => b.train_id === after.train_id && b.station_id === after.station_id
    );
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
          <div className="text-xs uppercase text-slate-500">Baseline legs</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">{beforeEntries.length}</div>
        </div>
        <div className="rounded border border-slate-700 bg-surface-3/40 p-3">
          <div className="text-xs uppercase text-slate-500">Optimized legs</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">{afterEntries.length}</div>
        </div>
      </div>

      <TrainGraph
        baselineEntries={beforeEntries}
        actualEntries={afterEntries}
        stations={stations}
        trains={trains}
        conflicts={conflicts}
        trainPositions={trainPositions}
        now={now}
        animTick={animTick}
        onEntryClick={onEntryClick}
      />

      {changedTrains.size > 0 && (
        <p className="mt-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Changed trains:{' '}
          <span className="font-mono text-slate-200">{Array.from(changedTrains).join(', ')}</span>
        </p>
      )}
    </SectionCard>
  );
}
