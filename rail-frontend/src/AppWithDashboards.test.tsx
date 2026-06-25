import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DashboardShellProvider } from './context/DashboardShellContext';
import AppWithDashboards from './AppWithDashboards';

describe('AppWithDashboards', () => {
  afterEach(() => cleanup());

  it('renders unified navigation shell', () => {
    render(
      <DashboardShellProvider>
        <AppWithDashboards />
      </DashboardShellProvider>
    );

    expect(screen.getByText('TrainVision AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI Assistant' })).toBeInTheDocument();
  });

  it('includes skip link and command center control', () => {
    render(
      <DashboardShellProvider>
        <AppWithDashboards />
      </DashboardShellProvider>
    );

    expect(screen.getAllByRole('link', { name: /skip to main content/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /command center/i })).toBeInTheDocument();
  });
});
