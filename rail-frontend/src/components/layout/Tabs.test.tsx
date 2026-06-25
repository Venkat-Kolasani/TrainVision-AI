import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'a', label: 'Schedule', content: <div>Schedule panel</div> },
  { id: 'b', label: 'Timeline', content: <div>Timeline panel</div> },
];

describe('Tabs', () => {
  afterEach(() => cleanup());

  it('marks active tab with aria-selected', () => {
    render(<Tabs tabs={tabs} activeId="a" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'false');
  });

  it('navigates with arrow keys', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeId="a" onChange={onChange} />);
    const scheduleTab = screen.getByRole('tab', { name: 'Schedule' });
    fireEvent.keyDown(scheduleTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
