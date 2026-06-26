import type { TrackStatusResponse } from '../../context/OperationsFeedContext';
import { Badge } from '../ui/Badge';

interface TrackOccupancyPanelProps {
  trackStatus: TrackStatusResponse | null;
  isStale?: boolean;
}

export function TrackOccupancyPanel({ trackStatus, isStale }: TrackOccupancyPanelProps) {
  const occupancy = trackStatus?.track_occupancy;
  const entries = occupancy && typeof occupancy === 'object' ? Object.entries(occupancy) : [];

  return (
    <div className="mt-4 border-t border-slate-700/80 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Track occupancy</h3>
        {isStale && (
          <Badge variant="warning" className="text-[10px]">
            Stale
          </Badge>
        )}
      </div>
      {!trackStatus ? (
        <p className="text-xs text-slate-500">Loading track status…</p>
      ) : (
        <>
          <div className="mb-2 flex gap-3 text-xs text-slate-400">
            <span>Movements: {trackStatus.active_movements ?? 0}</span>
            <span>Conflicts: {trackStatus.conflicts_detected ?? 0}</span>
          </div>
          {entries.length === 0 ? (
            <p className="text-xs text-slate-500">All blocks clear.</p>
          ) : (
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
              {entries.slice(0, 12).map(([track, info]) => (
                <li
                  key={track}
                  className="flex items-center justify-between rounded border border-slate-700/60 bg-slate-800/40 px-2 py-1"
                >
                  <span className="font-mono text-slate-300">{track}</span>
                  <span className="text-slate-400">
                    {typeof info === 'object' && info !== null
                      ? JSON.stringify(info).slice(0, 40)
                      : String(info)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
