import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DashboardShellProvider } from './context/DashboardShellContext';
import { OperationsFeedProvider } from './context/OperationsFeedContext';
import { SelectionProvider } from './context/SelectionContext';
import AppWithDashboards from './AppWithDashboards';

vi.stubGlobal(
  'fetch',
  vi.fn((url: string) => {
    const path = String(url);
    if (path.includes('/schedule')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ schedule: [] }),
      });
    }
    if (path.includes('/conflicts')) {
      return Promise.resolve({ ok: true, json: async () => ({ conflicts: [] }) });
    }
    if (path.includes('/track-status')) {
      return Promise.resolve({ ok: true, json: async () => ({ track_occupancy: {} }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as unknown as typeof fetch
);

function renderShell() {
  return render(
    <DashboardShellProvider>
      <OperationsFeedProvider>
        <SelectionProvider>
          <AppWithDashboards />
        </SelectionProvider>
      </OperationsFeedProvider>
    </DashboardShellProvider>
  );
}

describe('AppWithDashboards', () => {
  afterEach(() => cleanup());

  it('renders unified navigation shell', () => {
    renderShell();

    expect(screen.getByText('TrainVision AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeInTheDocument();
  });

  it('includes skip link and command center control', () => {
    renderShell();

    expect(screen.getAllByRole('link', { name: /skip to main content/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /command center/i })).toBeInTheDocument();
  });
});
