import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardShellProvider } from './context/DashboardShellContext';
import AppWithDashboards from './AppWithDashboards';

describe('AppWithDashboards', () => {
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
});
