import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ScheduleEntry } from '../types/railway';

interface SelectionState {
  selectedTrainId: string | null;
  selectedEntry: ScheduleEntry | null;
  selectTrain: (trainId: string, entry?: ScheduleEntry | null) => void;
  selectEntry: (entry: ScheduleEntry) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);

  const selectTrain = useCallback((trainId: string, entry?: ScheduleEntry | null) => {
    setSelectedTrainId(trainId);
    setSelectedEntry(entry ?? null);
  }, []);

  const selectEntry = useCallback((entry: ScheduleEntry) => {
    setSelectedTrainId(entry.train_id);
    setSelectedEntry(entry);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTrainId(null);
    setSelectedEntry(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedTrainId,
      selectedEntry,
      selectTrain,
      selectEntry,
      clearSelection,
    }),
    [selectedTrainId, selectedEntry, selectTrain, selectEntry, clearSelection]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
