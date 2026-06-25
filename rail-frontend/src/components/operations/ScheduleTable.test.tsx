import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { ScheduleTable } from './ScheduleTable';
import type { ScheduleEntry, Train } from '../../types/railway';

const trains: Train[] = [
  { id: 'T101', type: 'Express', scheduled_arrival: '2025-09-22T09:00:00' },
  { id: 'T102', type: 'Local', scheduled_arrival: '2025-09-22T10:00:00' },
];

const schedule: ScheduleEntry[] = [
  {
    train_id: 'T101',
    station_id: 'HYB',
    assigned_platform: 1,
    actual_arrival: '2025-09-22T09:01:00',
    actual_departure: '2025-09-22T09:15:00',
  },
  {
    train_id: 'T102',
    station_id: 'SC',
    assigned_platform: 2,
    actual_arrival: '2025-09-22T10:20:00',
    actual_departure: '2025-09-22T10:30:00',
  },
];

describe('ScheduleTable', () => {
  afterEach(() => cleanup());

  it('renders schedule rows and filters by search', () => {
    const onOverride = vi.fn();

    render(<ScheduleTable schedule={schedule} trains={trains} onOverride={onOverride} />);

    expect(screen.getByText('T101')).toBeInTheDocument();
    expect(screen.getByText('T102')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search schedule'), { target: { value: 'T101' } });
    expect(screen.getByText('T101')).toBeInTheDocument();
    expect(screen.queryByText('T102')).not.toBeInTheDocument();
  });

  it('calls onOverride when override clicked', () => {
    const onOverride = vi.fn();

    render(<ScheduleTable schedule={schedule} trains={trains} onOverride={onOverride} />);

    const row = screen.getByText('T101').closest('tr');
    expect(row).toBeTruthy();
    const overrideBtn = within(row as HTMLElement).getByRole('button', { name: 'Override T101' });
    fireEvent.click(overrideBtn);
    expect(onOverride).toHaveBeenCalledWith('T101');
  });
});
