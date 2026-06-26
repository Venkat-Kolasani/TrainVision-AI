import type { ScheduleEntry, Train, TrainStatus } from '../types/railway';

export const COLOR_BY_TYPE: Record<string, string> = {
  Express: '#3b82f6',
  Local: '#22c55e',
  Intercity: '#f59e0b',
  Freight: '#8b5cf6',
};

export function getTrainById(trains: Train[], id: string) {
  return trains.find((t) => t.id === id);
}

export function isDelayedEntry(entry: ScheduleEntry, trains: Train[]) {
  const t = getTrainById(trains, entry.train_id);
  if (!t?.scheduled_arrival) return false;
  const scheduled = new Date(t.scheduled_arrival).getTime();
  const actual = new Date(entry.actual_arrival).getTime();
  return actual - scheduled > 2 * 60 * 1000;
}

export function isOverriddenEntry(entry: ScheduleEntry) {
  const reason = entry.reason?.toLowerCase() ?? '';
  return reason.includes('fixed to p') || reason.includes('override');
}

export function getTrainStatus(
  entry: ScheduleEntry,
  trains: Train[],
  conflictTrainIds?: Set<string>
): TrainStatus {
  if (conflictTrainIds?.has(entry.train_id)) return 'conflict';
  if (isOverriddenEntry(entry)) return 'overridden';
  if (isDelayedEntry(entry, trains)) return 'delayed';
  return 'on-time';
}

export function colorForEntry(entry: ScheduleEntry, trains: Train[]) {
  const t = getTrainById(trains, entry.train_id);
  const base = t?.type ? COLOR_BY_TYPE[t.type] || '#64748b' : '#64748b';
  if (isDelayedEntry(entry, trains)) return '#ef4444';
  return base;
}

export function computeKPIs(schedule: ScheduleEntry[], trains: Train[]) {
  if (!schedule.length) return { total: 0, ontimePct: 0, avgDelay: '0' };
  const uniqueIds = [...new Set(schedule.map((s) => s.train_id))];
  let ontime = 0;
  let sumDelay = 0;
  uniqueIds.forEach((trainId) => {
    const entries = schedule.filter((s) => s.train_id === trainId);
    const worst = entries.reduce((max, s) => {
      const train = getTrainById(trains, s.train_id);
      if (!train?.scheduled_arrival) return max;
      const delay = Math.max(
        0,
        (new Date(s.actual_arrival).getTime() - new Date(train.scheduled_arrival).getTime()) / 60000
      );
      return Math.max(max, delay);
    }, 0);
    sumDelay += worst;
    if (worst <= 2) ontime += 1;
  });
  return {
    total: uniqueIds.length,
    ontimePct: Math.round((ontime / uniqueIds.length) * 100),
    avgDelay: (sumDelay / uniqueIds.length).toFixed(1),
  };
}

export function computeDelayArray(entries: ScheduleEntry[], trains: Train[]): number[] {
  if (!entries.length) return [];
  return entries.map((e) => {
    const t = getTrainById(trains, e.train_id);
    const scheduledRef = t?.scheduled_arrival || t?.scheduled_departure;
    if (!scheduledRef) return 0;
    const delayMin = Math.max(
      0,
      (new Date(e.actual_arrival).getTime() - new Date(scheduledRef).getTime()) / 60000
    );
    return Number(delayMin.toFixed(1));
  });
}
