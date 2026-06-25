import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandCenter } from './useCommandCenter';

describe('useCommandCenter', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles open state', () => {
    const { result } = renderHook(() => useCommandCenter());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('persists pause refresh in session storage', () => {
    const { result } = renderHook(() => useCommandCenter());
    act(() => result.current.setPause(true));
    expect(sessionStorage.getItem('trainvision_cc_pause_refresh')).toBe('1');
    expect(result.current.pauseRefresh).toBe(true);
  });

  it('closes on Escape when open', () => {
    const { result } = renderHook(() => useCommandCenter());
    act(() => result.current.open());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
