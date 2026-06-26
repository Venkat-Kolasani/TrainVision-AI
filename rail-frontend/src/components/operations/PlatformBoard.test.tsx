import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformBoard } from './PlatformBoard';

describe('PlatformBoard', () => {
  it('renders station rows', () => {
    render(
      <PlatformBoard
        stations={[{ id: 'HYB', platforms: 2 }]}
        schedule={[]}
        trains={[]}
        now={new Date('2025-09-22T09:00:00')}
      />
    );
    expect(screen.getByText('Platform board')).toBeInTheDocument();
    expect(screen.getByText('HYB')).toBeInTheDocument();
  });
});
