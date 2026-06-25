import { useCallback, useEffect, useState } from 'react';
import { ALERT_SOUND_KEY } from '../lib/productCopy';

const PAUSE_KEY = 'trainvision_cc_pause_refresh';

export function useCommandCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [pauseRefresh, setPauseRefresh] = useState(() => sessionStorage.getItem(PAUSE_KEY) === '1');
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(
    () => localStorage.getItem(ALERT_SOUND_KEY) === '1'
  );

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const setPause = useCallback((paused: boolean) => {
    setPauseRefresh(paused);
    sessionStorage.setItem(PAUSE_KEY, paused ? '1' : '0');
  }, []);

  const toggleAlertSound = useCallback(() => {
    setAlertSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(ALERT_SOUND_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return {
    isOpen,
    toggle,
    open,
    close,
    pauseRefresh,
    setPause,
    alertSoundEnabled,
    toggleAlertSound,
  };
}

export function playAlertTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    void ctx.close();
  } catch {
    // Audio not available
  }
}
