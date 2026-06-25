import { describe, expect, it } from 'vitest';
import { getConflictCount, normalizeActiveDelays } from './apiNormalize';

describe('apiNormalize', () => {
  it('normalizes active delays from backend map', () => {
    const result = normalizeActiveDelays({
      T101: { delay_type: 'breakdown', delay_minutes: 15, reason: 'Engine fault' },
    });
    expect(result).toEqual([
      { train_id: 'T101', type: 'breakdown', minutes: 15, reason: 'Engine fault' },
    ]);
  });

  it('reads conflict count from merged response', () => {
    expect(getConflictCount({ total_count: 3 })).toBe(3);
    expect(getConflictCount({ active_conflicts: 2 })).toBe(2);
    expect(getConflictCount({ conflicts: [{}, {}] })).toBe(2);
  });
});
