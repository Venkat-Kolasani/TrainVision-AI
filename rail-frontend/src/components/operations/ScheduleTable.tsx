import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import type { ScheduleEntry, Train } from '../../types/railway';
import { getTrainById, getTrainStatus } from '../../lib/scheduleUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type SortKey = 'train_id' | 'station_id' | 'assigned_platform' | 'actual_arrival';
type StatusFilter = 'all' | 'on-time' | 'delayed' | 'overridden';

interface ScheduleTableProps {
  schedule: ScheduleEntry[];
  trains: Train[];
  loading?: boolean;
  onOverride: (trainId: string) => void;
}

const statusBadge = {
  'on-time': { label: 'On-time', variant: 'success' as const },
  delayed: { label: 'Delayed', variant: 'danger' as const },
  overridden: { label: 'Overridden', variant: 'warning' as const },
  conflict: { label: 'Conflict', variant: 'danger' as const },
};

export function ScheduleTable({ schedule, trains, loading, onOverride }: ScheduleTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('actual_arrival');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const trainTypes = useMemo(
    () => [...new Set(trains.map((t) => t.type).filter(Boolean))] as string[],
    [trains]
  );

  const rows = useMemo(() => {
    let filtered = [...schedule];

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((s) => {
        const t = getTrainById(trains, s.train_id);
        return (
          s.train_id.toLowerCase().includes(q) ||
          s.station_id.toLowerCase().includes(q) ||
          (t?.type?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((s) => getTrainById(trains, s.train_id)?.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => getTrainStatus(s, trains) === statusFilter);
    }

    filtered.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'actual_arrival') {
        av = new Date(a.actual_arrival).getTime();
        bv = new Date(b.actual_arrival).getTime();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [schedule, trains, search, typeFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 hover:text-slate-200"
    >
      {label}
      {sortKey === col && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="search"
            placeholder="Search trains, stations… (press /)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 py-2 pl-8 pr-3 text-sm text-slate-100"
            aria-label="Search schedule"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
          aria-label="Filter by train type"
        >
          <option value="all">All types</option>
          {trainTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="on-time">On-time</option>
          <option value="delayed">Delayed</option>
          <option value="overridden">Overridden</option>
        </select>
      </div>

      <div className="max-h-[420px] overflow-auto rounded border border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-3 text-slate-400">
            <tr className="border-b border-slate-600">
              <th className="px-3 py-2 text-left"><SortHeader label="Train" col="train_id" /></th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left"><SortHeader label="Station" col="station_id" /></th>
              <th className="px-3 py-2 text-left"><SortHeader label="Platform" col="assigned_platform" /></th>
              <th className="px-3 py-2 text-left"><SortHeader label="Arr" col="actual_arrival" /></th>
              <th className="px-3 py-2 text-left">Dep</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, idx) => {
              const t = getTrainById(trains, s.train_id);
              const status = getTrainStatus(s, trains);
              const badge = statusBadge[status];
              return (
                <tr
                  key={`${s.train_id}-${s.station_id}`}
                  className={`border-b border-slate-800 transition-colors hover:bg-slate-700/40 ${idx % 2 === 0 ? 'bg-slate-900/20' : ''}`}
                >
                  <td className="px-3 py-2 font-medium text-slate-100">{s.train_id}</td>
                  <td className="px-3 py-2 text-slate-300">{t?.type || '-'}</td>
                  <td className="px-3 py-2"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                  <td className="px-3 py-2 text-slate-300">{s.station_id}</td>
                  <td className="px-3 py-2 text-slate-300">P{s.assigned_platform}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {new Date(s.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {new Date(s.actual_departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="warning"
                      className="px-2 py-1 text-xs"
                      onClick={() => onOverride(s.train_id)}
                      disabled={loading}
                      aria-label={`Override ${s.train_id}`}
                    >
                      Override
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">No schedule entries match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{rows.length} of {schedule.length} entries shown</p>
    </div>
  );
}
