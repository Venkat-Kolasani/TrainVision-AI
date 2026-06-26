import { useMemo, type ReactNode } from 'react';
import { notify } from '../../lib/notify';
import {
  COLOR_BY_TYPE,
  colorForEntry,
  getTrainById,
  isDelayedEntry,
} from '../../lib/scheduleUtils';
import type { ScheduleEntry, Station, Train } from '../../types/railway';
import type { TrackStatusResponse } from '../../context/OperationsFeedContext';

export interface TrainPosition {
  train_id: string;
  from_station: string;
  to_station: string;
  current_position?: string;
  progress?: number;
  status: 'waiting' | 'moving' | 'arrived';
  delay_minutes?: number;
}

export interface NetworkMapProps {
  stations: Station[];
  schedule: ScheduleEntry[];
  trains: Train[];
  trainPositions: TrainPosition[];
  animTick: number;
  trackStatus?: TrackStatusResponse | null;
  onTrainClick?: (trainId: string) => void;
  compact?: boolean;
  className?: string;
}

type TrainDotStatus = 'moving' | 'waiting' | 'delayed' | 'stopped';

interface TrainDot {
  id: string;
  x: number;
  y: number;
  fill: string;
  title: string;
  status: TrainDotStatus;
  trackNumber?: number;
  waitReason?: string;
  progress?: number;
}

interface MapNode {
  id: string;
  x: number;
  y: number;
  platforms?: number;
}

interface RouteDef {
  from: string;
  to: string;
  tracks: number;
  color: string;
  distance: number;
  capacity: string;
}

const ROUTES: RouteDef[] = [
  { from: 'HYB', to: 'SC', tracks: 2, color: '#3b82f6', distance: 8, capacity: 'High' },
  { from: 'SC', to: 'KCG', tracks: 1, color: '#3b82f6', distance: 5, capacity: 'Medium' },
  { from: 'HYB', to: 'KCG', tracks: 2, color: '#22c55e', distance: 12, capacity: 'High' },
];

const STATION_POSITIONS: Record<string, { x: number; y: number; platforms: number }> = {
  HYB: { x: 200, y: 160, platforms: 4 },
  SC: { x: 500, y: 100, platforms: 6 },
  KCG: { x: 350, y: 220, platforms: 3 },
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 320;

export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-300">
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
        Junction Station
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
        Regular Station
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-6 h-1 bg-red-500" />
        Single Line Track
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-6 h-1 bg-blue-500" />
        Double Line Track
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-6 h-1 bg-green-600" />
        High Capacity Track
      </div>
      <div className="flex items-center gap-1">
        <span
          className="inline-block w-3 h-3 bg-transparent border border-green-500 rotate-180"
          style={{ borderWidth: '6px 3px 0 3px', width: 0, height: 0 }}
        />
        Running Train
      </div>
      <div className="flex items-center gap-1">
        <span
          className="inline-block w-3 h-3 bg-transparent border border-yellow-400 rotate-180"
          style={{ borderWidth: '6px 3px 0 3px', width: 0, height: 0 }}
        />
        Delayed Train
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 bg-red-500" />
        Stopped Train
      </div>
    </div>
  );
}

export function NetworkMap({
  stations,
  schedule,
  trains,
  trainPositions,
  animTick,
  trackStatus,
  onTrainClick,
  compact = false,
  className = '',
}: NetworkMapProps) {
  const getTrain = (id: string) => getTrainById(trains, id);

  const trackOccupancy = useMemo(() => {
    const occupancy: Record<string, { trains: string[]; conflicts: boolean }> = {};
    ROUTES.forEach((route) => {
      const routeKey = `${route.from}-${route.to}`;
      occupancy[routeKey] = { trains: [], conflicts: false };

      schedule.forEach((entry) => {
        const train = getTrain(entry.train_id);
        if (
          train &&
          ((train.origin === route.from && train.destination === route.to) ||
            (train.origin === route.to && train.destination === route.from))
        ) {
          occupancy[routeKey].trains.push(entry.train_id);
        }
      });

      occupancy[routeKey].conflicts = occupancy[routeKey].trains.length > route.tracks;
    });

    const apiOccupancy = trackStatus?.track_occupancy;
    if (apiOccupancy && typeof apiOccupancy === 'object') {
      Object.entries(apiOccupancy).forEach(([trackId, info]) => {
        const normalized = trackId.replace('->', '-');
        const [from, to] = trackId.includes('->') ? trackId.split('->') : trackId.split('-');
        const routeKey = from && to ? `${from}-${to}` : normalized;
        if (!occupancy[routeKey]) {
          occupancy[routeKey] = { trains: [], conflicts: false };
        }
        const trainId =
          typeof info === 'object' && info !== null && 'train_id' in info
            ? String((info as { train_id: string }).train_id)
            : null;
        if (trainId && !occupancy[routeKey].trains.includes(trainId)) {
          occupancy[routeKey].trains.push(trainId);
        }
        occupancy[routeKey].conflicts =
          occupancy[routeKey].conflicts || occupancy[routeKey].trains.length > 1;
      });
    }

    return occupancy;
  }, [schedule, trains, trackStatus]);

  const nodes = useMemo((): MapNode[] => {
    const padding = 40;
    const hasGeo = stations.some(
      (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
    );
    if (hasGeo) {
      const lats = stations.map((s) => s.latitude as number);
      const lons = stations.map((s) => s.longitude as number);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const sx = (lon: number) =>
        padding +
        ((lon - minLon) / Math.max(1e-6, maxLon - minLon)) * (MAP_WIDTH - 2 * padding);
      const sy = (lat: number) =>
        padding +
        (1 - (lat - minLat) / Math.max(1e-6, maxLat - minLat)) * (MAP_HEIGHT - 2 * padding);
      return stations.map((st) => ({
        id: st.id,
        x: sx(st.longitude as number),
        y: sy(st.latitude as number),
      }));
    }
    return stations.map((st) => {
      const pos = STATION_POSITIONS[st.id];
      if (pos) return { id: st.id, x: pos.x, y: pos.y, platforms: pos.platforms };
      const hash = st.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const fallbackX = padding + ((hash % 70) / 100) * (MAP_WIDTH - 2 * padding);
      const fallbackY = padding + (((hash * 3) % 70) / 100) * (MAP_HEIGHT - 2 * padding);
      return { id: st.id, x: fallbackX, y: fallbackY, platforms: st.platforms || 2 };
    });
  }, [stations]);

  const nodeFor = (id: string) => nodes.find((n) => n.id === id);

  const trainSegments = useMemo(() => {
    const byTrain: Record<string, ScheduleEntry[]> = {};
    schedule.forEach((e) => {
      if (!byTrain[e.train_id]) byTrain[e.train_id] = [];
      byTrain[e.train_id].push(e);
    });
    Object.values(byTrain).forEach((arr) =>
      arr.sort(
        (a, b) => new Date(a.actual_arrival).getTime() - new Date(b.actual_arrival).getTime(),
      ),
    );
    return byTrain;
  }, [schedule]);

  const nowMs = Date.now();

  const trainDots = useMemo(() => {
    const dots: TrainDot[] = [];

    if (trainPositions.length > 0) {
      for (const position of trainPositions) {
        const train = getTrain(position.train_id);
        if (!train) continue;

        let x: number | undefined;
        let y: number | undefined;
        let status: TrainDotStatus = 'stopped';
        let waitReason = '';

        if (position.status === 'waiting') {
          const n = nodeFor(position.from_station);
          if (n) {
            x = n.x;
            y = n.y;
            status = 'waiting';
            waitReason = 'Awaiting departure time';
          }
        } else if (position.status === 'moving') {
          const fromNode = nodeFor(position.from_station);
          const toNode = nodeFor(position.to_station);
          if (fromNode && toNode) {
            const progress = position.progress || 0;
            x = fromNode.x + (toNode.x - fromNode.x) * progress;
            y = fromNode.y + (toNode.y - fromNode.y) * progress;
            status = 'moving';
            waitReason = `Moving ${position.from_station} → ${position.to_station} (${Math.round(progress * 100)}%)`;
          }
        } else if (position.status === 'arrived') {
          const n = nodeFor(position.to_station);
          if (n) {
            x = n.x;
            y = n.y;
            status = 'stopped';
            waitReason = 'Arrived at destination';
          }
        }

        if (x !== undefined && y !== undefined) {
          const fill = train?.type ? COLOR_BY_TYPE[train.type] || '#64748b' : '#64748b';
          const heading = `${train?.origin || '-'} → ${train?.destination || '-'}`;

          dots.push({
            id: position.train_id,
            x,
            y,
            fill,
            title: `${position.train_id} • ${heading} • ${waitReason}`,
            status,
            waitReason,
            progress: position.progress,
          });
        }
      }
    } else {
      for (const [tid, entries] of Object.entries(trainSegments)) {
        if (entries.length === 0) continue;
        let placed = false;
        for (let i = 0; i < entries.length; i++) {
          const cur = entries[i];
          const next = entries[i + 1];
          const curDep = new Date(cur.actual_departure).getTime();
          if (nowMs <= curDep || !next) {
            const n = nodeFor(cur.station_id);
            if (n) {
              const fill = colorForEntry(cur, trains);
              const t = getTrain(tid);
              const heading = `${t?.origin || '-'} → ${t?.destination || '-'}`;
              const trainIsDelayed = isDelayedEntry(cur, trains);
              const status: TrainDotStatus = trainIsDelayed
                ? 'delayed'
                : nowMs < curDep - 300000
                  ? 'waiting'
                  : 'stopped';
              const waitReason =
                status === 'waiting'
                  ? 'Awaiting departure time'
                  : status === 'delayed'
                    ? 'Platform conflict resolved'
                    : 'At platform';

              dots.push({
                id: tid,
                x: n.x,
                y: n.y,
                fill,
                title: `${tid} • ${heading} @ ${cur.station_id} P${cur.assigned_platform}`,
                status,
                waitReason,
              });
              placed = true;
              break;
            }
          }
          if (next) {
            const segStart = curDep;
            const segEnd = new Date(next.actual_arrival).getTime();
            if (nowMs >= segStart && nowMs <= segEnd) {
              const a = nodeFor(cur.station_id);
              const b = nodeFor(next.station_id);
              if (a && b) {
                const r = Math.max(0, Math.min(1, (nowMs - segStart) / Math.max(1, segEnd - segStart)));
                const x = a.x + (b.x - a.x) * r;
                const y = a.y + (b.y - a.y) * r;
                const fill = colorForEntry(cur, trains);
                const tinfo = getTrain(tid);
                const heading = `${tinfo?.origin || '-'} → ${tinfo?.destination || '-'}`;

                const route = ROUTES.find(
                  (rt) =>
                    (rt.from === cur.station_id && rt.to === next.station_id) ||
                    (rt.to === cur.station_id && rt.from === next.station_id),
                );
                const trackNumber = route
                  ? ((tid.charCodeAt(tid.length - 1) || 1) % route.tracks) + 1
                  : 1;

                dots.push({
                  id: tid,
                  x,
                  y,
                  fill,
                  title: `${tid} • ${heading} (${cur.station_id}→${next.station_id}) Track ${trackNumber}`,
                  status: 'moving',
                  trackNumber,
                });
                placed = true;
                break;
              }
            }
          }
        }
        if (!placed) {
          const last = entries[entries.length - 1];
          const n = nodeFor(last.station_id);
          if (n) {
            const fill = colorForEntry(last, trains);
            dots.push({
              id: last.train_id,
              x: n.x,
              y: n.y,
              fill,
              title: `${tid} @ ${last.station_id}`,
              status: 'stopped',
            });
          }
        }
      }
    }
    return dots;
  }, [trainSegments, nowMs, nodes, trainPositions, trains]);

  const heightClass = compact ? 'h-[240px]' : 'h-[320px]';

  return (
    <div
      className={`relative w-full rounded border border-slate-700 bg-slate-900 overflow-hidden ${heightClass} ${className}`.trim()}
      style={{
        backgroundImage: [
          'linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '24px 24px',
      }}
    >
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="relative z-[1] w-full h-full">
        {ROUTES.map((route) => {
          const fromNode = nodeFor(route.from);
          const toNode = nodeFor(route.to);
          if (!fromNode || !toNode) return null;

          const mx = (fromNode.x + toNode.x) / 2;
          const my = (fromNode.y + toNode.y) / 2;
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const tracks: ReactNode[] = [];
          const routeKey = `${route.from}-${route.to}`;
          const occupancy = trackOccupancy[routeKey];

          for (let t = 0; t < route.tracks; t++) {
            const offset = (t - (route.tracks - 1) / 2) * 12;
            const off = 25;
            const cx = mx + nx * off;
            const cy = my + ny * off;
            const startX = fromNode.x + nx * offset;
            const startY = fromNode.y + ny * offset;
            const endX = toNode.x + nx * offset;
            const endY = toNode.y + ny * offset;
            const ctrlX = cx + nx * offset;
            const ctrlY = cy + ny * offset;
            const path = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY}, ${endX} ${endY}`;
            const dashOffset = (animTick * 3) % 24;

            const trackColor = occupancy?.conflicts ? '#ef4444' : route.color;
            const trackOpacity = occupancy?.trains.length > 0 ? 1.0 : 0.6;

            tracks.push(
              <g key={`${route.from}-${route.to}-track-${t}`}>
                <path
                  d={path}
                  stroke="#374151"
                  strokeWidth={10}
                  strokeLinecap="round"
                  fill="none"
                  strokeOpacity={0.8}
                />
                <path
                  d={path}
                  stroke={trackColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  fill="none"
                  strokeOpacity={trackOpacity}
                />
                <path
                  d={path}
                  stroke={trackColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="none"
                  strokeOpacity={trackOpacity * 0.7}
                />
                {occupancy?.trains.length > 0 && (
                  <path
                    d={path}
                    stroke="#fbbf24"
                    strokeWidth={1}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="4 12"
                    strokeDashoffset={dashOffset}
                    strokeOpacity={0.8}
                  />
                )}
                {occupancy?.conflicts && (
                  <path
                    d={path}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="6 6"
                    strokeDashoffset={-dashOffset}
                    strokeOpacity={0.9}
                    className="animate-pulse"
                  />
                )}
              </g>,
            );
          }

          tracks.push(
            <g key={`${route.from}-${route.to}-info`}>
              <text
                x={mx}
                y={my - 15}
                fontSize={10}
                fill="#94a3b8"
                textAnchor="middle"
                fontWeight="bold"
              >
                {route.from}→{route.to}
              </text>
              <text x={mx} y={my - 5} fontSize={8} fill="#6b7280" textAnchor="middle">
                {route.tracks}T • {route.distance}km • {route.capacity}
              </text>
              {occupancy?.conflicts && (
                <text
                  x={mx}
                  y={my + 8}
                  fontSize={7}
                  fill="#ef4444"
                  textAnchor="middle"
                  className="animate-pulse"
                >
                  CONFLICT: {occupancy.trains.length} trains on {route.tracks} tracks
                </text>
              )}
            </g>,
          );

          return tracks;
        })}

        {nodes.map((n) => {
          const st = stations.find((s) => s.id === n.id);
          const isJunction = (st?.platforms || 1) >= 3 || /central/i.test(n.id);
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={isJunction ? 10.5 : 8.5}
                fill={isJunction ? '#ef4444' : '#3b82f6'}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text x={n.x + 12} y={n.y + 4} fontSize={12} fill="#e5e7eb">
                {n.id}
              </text>
            </g>
          );
        })}

        {trainDots.map((t) => {
          const isDelayed = t.fill === '#ef4444';
          const isMoving = t.status === 'moving';
          const isWaiting = t.status === 'waiting';

          return (
            <g
              key={t.id}
              transform={`translate(${t.x}, ${t.y})`}
              style={{ transition: 'transform 0.5s ease-in-out', cursor: onTrainClick ? 'pointer' : undefined }}
              onClick={() => onTrainClick?.(t.id)}
              role={onTrainClick ? 'button' : undefined}
              tabIndex={onTrainClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (onTrainClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onTrainClick(t.id);
                }
              }}
            >
              <g className={isMoving ? 'animate-pulse' : ''}>
                <ellipse cx={0} cy={2} rx={10} ry={4} fill="black" opacity={0.2} />
                <rect
                  x={-10}
                  y={-5}
                  width={20}
                  height={10}
                  rx={4}
                  fill={t.fill}
                  stroke="#1f293b"
                  strokeWidth={1.5}
                />
                <rect x={-7} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                <rect x={-2} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                <rect x={3} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                <circle cx={isMoving ? 10 : -10} cy={0} r={1.5} fill="#fbbf24" opacity={0.8} />

                {isDelayed && (
                  <circle
                    cx={0}
                    cy={-10}
                    r={4}
                    fill="#ef4444"
                    className="animate-pulse cursor-pointer"
                    onClick={() => {
                      notify.warning(`Delayed train: ${t.id}`, t.waitReason || 'Platform conflict');
                    }}
                  >
                    <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {isWaiting && (
                  <circle
                    cx={0}
                    cy={-10}
                    r={3}
                    fill="#fbbf24"
                    className="animate-bounce cursor-pointer"
                    onClick={() => {
                      notify.info(
                        `Waiting: ${t.id}`,
                        `${t.waitReason || 'Awaiting departure'} • Track ${t.trackNumber || 'N/A'}`,
                      );
                    }}
                  />
                )}

                {isMoving && (
                  <circle
                    cx={0}
                    cy={-10}
                    r={2}
                    fill="#22c55e"
                    className="cursor-pointer"
                    onClick={() => {
                      notify.info(
                        `Moving: ${t.id}`,
                        `Track ${t.trackNumber || 'N/A'} • En route between stations`,
                      );
                    }}
                  />
                )}

                <text
                  x={0}
                  y={15}
                  fontSize={9}
                  fill="#e2e8f0"
                  textAnchor="middle"
                  fontWeight="bold"
                  className="font-mono"
                >
                  {t.id}
                </text>

                {isMoving && t.trackNumber && (
                  <text x={0} y={-15} fontSize={7} fill="#94a3b8" textAnchor="middle">
                    T{t.trackNumber}
                  </text>
                )}
              </g>
              <title>{t.title}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
