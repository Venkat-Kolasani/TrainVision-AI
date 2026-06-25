import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SystemHealth = 'OPTIMAL' | 'DELAYS' | 'CONFLICTS';

export interface DashboardStatus {
  websocketConnected: boolean;
  lastSync: Date | null;
  systemHealth: SystemHealth;
  conflictCount: number;
  activeDelayCount: number;
  trainCount: number;
  onTimePct: number;
  isInitialLoadComplete: boolean;
}

export interface DashboardShellActions {
  refreshAll: () => Promise<void>;
  resetSystem: () => Promise<void>;
  openAuditLogs: () => void;
}

interface DashboardShellContextValue {
  status: DashboardStatus;
  actions: DashboardShellActions | null;
  updateStatus: (partial: Partial<DashboardStatus>) => void;
  registerActions: (actions: DashboardShellActions) => void;
  unregisterActions: () => void;
}

const defaultStatus: DashboardStatus = {
  websocketConnected: false,
  lastSync: null,
  systemHealth: 'OPTIMAL',
  conflictCount: 0,
  activeDelayCount: 0,
  trainCount: 0,
  onTimePct: 0,
  isInitialLoadComplete: false,
};

const DashboardShellContext = createContext<DashboardShellContextValue | null>(null);

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DashboardStatus>(defaultStatus);
  const [actions, setActions] = useState<DashboardShellActions | null>(null);

  const updateStatus = useCallback((partial: Partial<DashboardStatus>) => {
    setStatus((prev) => ({ ...prev, ...partial }));
  }, []);

  const registerActions = useCallback((next: DashboardShellActions) => {
    setActions(next);
  }, []);

  const unregisterActions = useCallback(() => {
    setActions(null);
  }, []);

  const value = useMemo(
    () => ({
      status,
      actions,
      updateStatus,
      registerActions,
      unregisterActions,
    }),
    [status, actions, updateStatus, registerActions, unregisterActions]
  );

  return (
    <DashboardShellContext.Provider value={value}>{children}</DashboardShellContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboardShell() {
  const ctx = useContext(DashboardShellContext);
  if (!ctx) {
    return {
      status: defaultStatus,
      actions: null,
      updateStatus: () => undefined,
      registerActions: () => undefined,
      unregisterActions: () => undefined,
      isEmbedded: false,
    };
  }
  return { ...ctx, isEmbedded: true };
}
