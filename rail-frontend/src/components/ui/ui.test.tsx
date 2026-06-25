import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardShellProvider } from '../../context/DashboardShellContext';
import { Skeleton } from './Skeleton';

describe('DashboardShellProvider', () => {
  it('renders children', () => {
    render(
      <DashboardShellProvider>
        <div>TrainVision shell</div>
      </DashboardShellProvider>
    );
    expect(screen.getByText('TrainVision shell')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-8" />);
    expect(container.firstChild).toHaveClass('h-4', 'w-8');
  });
});
