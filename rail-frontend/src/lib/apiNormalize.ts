import type { ActiveDelay, ConflictsResponse } from '../types/railway';

export function normalizeActiveDelays(
  data: Record<string, { delay_type?: string; delay_minutes?: number; reason?: string }>
): ActiveDelay[] {
  return Object.entries(data).map(([train_id, entry]) => ({
    train_id,
    type: entry.delay_type || 'delay',
    minutes: entry.delay_minutes ?? 0,
    reason: entry.reason,
  }));
}

export function getConflictCount(data: ConflictsResponse): number {
  if (typeof data.total_count === 'number' && data.total_count > 0) return data.total_count;
  if (data.conflicts?.length) return data.conflicts.length;
  if (typeof data.active_conflicts === 'number' && data.active_conflicts > 0) return data.active_conflicts;
  return data.conflict_log?.length ?? 0;
}
