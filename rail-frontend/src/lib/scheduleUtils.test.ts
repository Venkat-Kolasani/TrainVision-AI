import { describe, expect, it } from 'vitest';
import {
  computeKPIs,
  getTrainStatus,
  isDelayedEntry,
  isOverriddenEntry,
} from './scheduleUtils';
import type { ScheduleEntry, Train } from '../types/railway';

const trains: Train[] = [
  {
    id: 'T101',
    type: 'Express',
    scheduled_arrival: '2025-09-22T09:00:00',
    origin: 'HYB',
    destination: 'SC',
  },
];

const onTimeEntry: ScheduleEntry = {
  train_id: 'T101',
  station_id: 'HYB',
  assigned_platform: 1,
  actual_arrival: '2025-09-22T09:01:00',
  actual_departure: '2025-09-22T09:15:00',
};

const delayedEntry: ScheduleEntry = {
  ...onTimeEntry,
  actual_arrival: '2025-09-22T09:10:00',
};

const overriddenEntry: ScheduleEntry = {
  ...onTimeEntry,
  reason: 'fixed to p2',
};

describe('scheduleUtils', () => {
  it('detects delayed entries', () => {
    expect(isDelayedEntry(onTimeEntry, trains)).toBe(false);
    expect(isDelayedEntry(delayedEntry, trains)).toBe(true);
  });

  it('detects overridden entries', () => {
    expect(isOverriddenEntry(overriddenEntry)).toBe(true);
    expect(isOverriddenEntry(onTimeEntry)).toBe(false);
  });

  it('returns train status', () => {
    expect(getTrainStatus(onTimeEntry, trains)).toBe('on-time');
    expect(getTrainStatus(delayedEntry, trains)).toBe('delayed');
    expect(getTrainStatus(overriddenEntry, trains)).toBe('overridden');
  });

  it('computes KPIs by unique train', () => {
    const kpis = computeKPIs([onTimeEntry, delayedEntry], trains);
    expect(kpis.total).toBe(1);
    expect(kpis.ontimePct).toBe(0);
    expect(Number(kpis.avgDelay)).toBeGreaterThan(2);
  });
});
