import { useEffect } from 'react';

interface ShortcutHandlers {
  onRefresh?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onCommandCenter?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handlers.onRefresh?.();
        }
      }
      if (e.key === '/') {
        e.preventDefault();
        handlers.onSearch?.();
      }
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        handlers.onHelp?.();
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handlers.onCommandCenter?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
