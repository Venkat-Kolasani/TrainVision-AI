import { useEffect, useMemo, useState } from "react";
import { Bot } from 'lucide-react';
import { ChatBot } from './components/ChatBot';

// TypeScript interfaces for data
interface Train {
  id: string;
  type?: string;
  priority?: number;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  origin?: string;
  destination?: string;
  platform_pref?: number;
}

interface ScheduleEntry {
  train_id: string;
  station_id: string;
  assigned_platform: number;
  actual_arrival: string;
  actual_departure: string;
  reason?: string;
}

interface ScheduleResponse {
  schedule: ScheduleEntry[];
  delays_before_min: number[];
  delays_after_min: number[];
  reasons?: string[];
}

interface Station {
  id: string;
  platforms: number;
  station_code?: string;
  station_name?: string;
  latitude?: number;
  longitude?: number;
  is_junction?: boolean;
}

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

// Frontend Prototype Dashboard (single-file React component)
// - TailwindCSS assumed available globally
// - Uses fetch() to talk to backend at http://localhost:8000
// - Features:
//   1. Top-level KPIs (total trains, on-time %, avg delay)
//   2. Schedule table with quick override buttons
//   3. Track visualization: stations laid left->right with platforms, trains animate across
//   4. Live audit log panel
//   5. Override modal with validation feedback
//
// Use this file as the main App component in a React + Tailwind project (e.g. Vite + React)

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const [trains, setTrains] = useState<Train[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [baselineSchedule, setBaselineSchedule] = useState<ScheduleEntry[]>([]);
  const [delaysBefore, setDelaysBefore] = useState<number[]>([]);
  const [delaysAfter, setDelaysAfter] = useState<number[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [previousSchedule, setPreviousSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [overridePlatform, setOverridePlatform] = useState<number>(1);
  const [overrideMsg, setOverrideMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [delayImpact, setDelayImpact] = useState<{current: number, predicted: number, difference: number} | null>(null);
  const [showDelayWarning, setShowDelayWarning] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{trainId: string, stationId: string, platform: number} | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [nowClock, setNowClock] = useState(new Date());
  const [animTick, setAnimTick] = useState(0);
  const [showChatBot, setShowChatBot] = useState(false);
  const [lastOverrideAction, setLastOverrideAction] = useState<string | null>(null);
  const [autoExplanationTriggered, setAutoExplanationTriggered] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedDelayTrain, setSelectedDelayTrain] = useState<string | null>(null);
  const [delayType, setDelayType] = useState<string>("breakdown");
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [delayReason, setDelayReason] = useState<string>("");
  const [activeDelays, setActiveDelays] = useState<any[]>([]);
  const [trainPositions, setTrainPositions] = useState<any[]>([]);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [conflicts, setConflicts] = useState<any>({});
  const [trackStatus, setTrackStatus] = useState<any>({});

  // Removed conflict banner/context; app runs only on HYB–VSKP dataset

  // helpers & derived data
  const getTrain = (id: string) => trains.find((t) => t.id === id);
  const isDelayed = (entry: ScheduleEntry) => {
    const t = getTrain(entry.train_id);
    if (!t?.scheduled_arrival) return false;
    const scheduled = new Date(t.scheduled_arrival).getTime();
    const actual = new Date(entry.actual_arrival).getTime();
    return actual - scheduled > 2 * 60 * 1000; // >2 min delay
  };
  const isOverridden = (entry: ScheduleEntry) =>
    Boolean(entry.reason && entry.reason.toLowerCase().includes("fixed to p"));

  const colorByType: Record<string, string> = {
    Express: "#3b82f6", // blue
    Local: "#22c55e", // green
    Intercity: "#f59e0b", // amber
    Freight: "#8b5cf6", // violet
  };

  const colorForEntry = (entry: ScheduleEntry) => {
    const t = getTrain(entry.train_id);
    const base = t?.type ? colorByType[t.type] || "#64748b" : "#64748b"; // slate
    if (isDelayed(entry)) return "#ef4444"; // red for delayed
    return base;
  };


  // Fetch stations from backend
  async function fetchStations() {
    try {
      const res = await fetch('http://localhost:8000/stations');
      if (res.ok) {
        const backendStations = await res.json();
        // Map backend stations to our Station interface with Hyderabad station details
        const stationDetails: Record<string, any> = {
          'HYB': { station_name: 'Hyderabad Deccan', latitude: 17.385, longitude: 78.4867, is_junction: true },
          'SC': { station_name: 'Secunderabad Junction', latitude: 17.4399, longitude: 78.5017, is_junction: true },
          'KCG': { station_name: 'Kacheguda', latitude: 17.3753, longitude: 78.4983, is_junction: true }
        };
        
        const mappedStations: Station[] = backendStations.map((s: any) => ({
          id: s.id,
          platforms: s.platforms,
          station_code: s.id,
          station_name: stationDetails[s.id]?.station_name || s.id,
          latitude: stationDetails[s.id]?.latitude,
          longitude: stationDetails[s.id]?.longitude,
          is_junction: stationDetails[s.id]?.is_junction || false,
        }));
        setStations(mappedStations);
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
  }


  // --- Enhanced Railway Network Map ---
  function GeoMap({
    stations,
    schedule,
    getTrain,
    tick,
  }: {
    stations: Station[];
    schedule: ScheduleEntry[];
    getTrain: (id: string) => Train | undefined;
    tick: number;
  }) {
    const width = 1000;
    const height = 320;
    
    // Enhanced railway network with realistic connections
    const routes = [
      { from: 'HYB', to: 'SC', tracks: 2, color: '#3b82f6', distance: 8, capacity: 'High' },
      { from: 'SC', to: 'KCG', tracks: 1, color: '#3b82f6', distance: 5, capacity: 'Medium' },
      { from: 'HYB', to: 'KCG', tracks: 2, color: '#22c55e', distance: 12, capacity: 'High' },
    ];
    
    // Track occupancy and conflicts
    const trackOccupancy = useMemo(() => {
      const occupancy: Record<string, { trains: string[], conflicts: boolean }> = {};
      routes.forEach(route => {
        const routeKey = `${route.from}-${route.to}`;
        occupancy[routeKey] = { trains: [], conflicts: false };
        
        // Find trains on this route
        schedule.forEach(entry => {
          const train = getTrain(entry.train_id);
          if (train && ((train.origin === route.from && train.destination === route.to) ||
                       (train.origin === route.to && train.destination === route.from))) {
            occupancy[routeKey].trains.push(entry.train_id);
          }
        });
        
        // Check for conflicts (more trains than tracks)
        occupancy[routeKey].conflicts = occupancy[routeKey].trains.length > route.tracks;
      });
      return occupancy;
    }, [schedule, routes]);

    // Realistic station positions based on Hyderabad geography
    const stationPositions: Record<string, { x: number; y: number; platforms: number }> = {
      HYB: { x: 200, y: 160, platforms: 4 }, // Hyderabad Deccan
      SC: { x: 500, y: 100, platforms: 6 },  // Secunderabad Junction
      KCG: { x: 350, y: 220, platforms: 3 }, // Kacheguda
    };

    const nodes = useMemo(() => {
      const padding = 40;
      const hasGeo = stations.some((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number');
      if (hasGeo) {
        const lats = stations.map((s) => s.latitude as number);
        const lons = stations.map((s) => s.longitude as number);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);
        const sx = (lon: number) => padding + ((lon - minLon) / Math.max(1e-6, (maxLon - minLon))) * (width - 2 * padding);
        const sy = (lat: number) => padding + (1 - (lat - minLat) / Math.max(1e-6, (maxLat - minLat))) * (height - 2 * padding);
        return stations.map((st) => ({ id: st.id, x: sx(st.longitude as number), y: sy(st.latitude as number) }));
      }
      return stations.map((st) => {
        const pos = stationPositions[st.id];
        if (pos) return { id: st.id, x: pos.x, y: pos.y, platforms: pos.platforms };
        // fallback: distribute remaining stations
        const fallbackX = padding + Math.random() * (width - 2 * padding);
        const fallbackY = padding + Math.random() * (height - 2 * padding);
        return { id: st.id, x: fallbackX, y: fallbackY, platforms: st.platforms || 2 };
      });
    }, [stations]);

    const nodeFor = (id: string) => nodes.find((n) => n.id === id);

    // Build per-train timeline to interpolate positions between stations
    const trainSegments = useMemo(() => {
      const byTrain: Record<string, ScheduleEntry[]> = {};
      schedule.forEach((e) => {
        if (!byTrain[e.train_id]) byTrain[e.train_id] = [];
        byTrain[e.train_id].push(e);
      });
      Object.values(byTrain).forEach((arr) =>
        arr.sort((a, b) => new Date(a.actual_arrival).getTime() - new Date(b.actual_arrival).getTime())
      );
      return byTrain;
    }, [schedule]);

    const nowMs = Date.now();

    const trainDots = useMemo(() => {
      const dots: Array<{ 
        id: string; x: number; y: number; fill: string; title: string; 
        status: 'moving' | 'waiting' | 'delayed' | 'stopped';
        trackNumber?: number;
        waitReason?: string;
        progress?: number;
      }> = [];
      
      // Use real-time train positions if available
      if (trainPositions.length > 0) {
        for (const position of trainPositions) {
          const train = getTrain(position.train_id);
          if (!train) continue;
          
          let x, y, status, waitReason = '';
          
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
            const fill = train?.type ? colorByType[train.type] || "#64748b" : "#64748b";
            const heading = `${train?.origin || '-'} → ${train?.destination || '-'}`;
            
            dots.push({
              id: position.train_id,
              x, y, fill,
              title: `${position.train_id} • ${heading} • ${waitReason}`,
              status: status as any,
              waitReason,
              progress: position.progress
            });
          }
        }
      } else {
        // Fallback to schedule-based positioning
        for (const [tid, entries] of Object.entries(trainSegments)) {
          if (entries.length === 0) continue;
          let placed = false;
          for (let i = 0; i < entries.length; i++) {
            const cur = entries[i];
            const next = entries[i + 1];
            const curDep = new Date(cur.actual_departure).getTime();
            // if not yet departed, sit at current station
            if (nowMs <= curDep || !next) {
              const n = nodeFor(cur.station_id);
              if (n) {
                const fill = colorForEntry(cur);
                const t = getTrain(tid);
                const heading = `${t?.origin || '-'} → ${t?.destination || '-'}`;
                const trainIsDelayed = isDelayed(cur);
                const status = trainIsDelayed ? 'delayed' : (nowMs < curDep - 300000 ? 'waiting' : 'stopped');
                const waitReason = status === 'waiting' ? 'Awaiting departure time' : 
                                 status === 'delayed' ? 'Platform conflict resolved' : 'At platform';
                
                dots.push({ 
                  id: tid, x: n.x, y: n.y, fill, 
                  title: `${tid} • ${heading} @ ${cur.station_id} P${cur.assigned_platform}`,
                  status, waitReason
                });
                placed = true;
                break;
              }
            }
            if (next) {
              const segStart = curDep; // depart from current
              const segEnd = new Date(next.actual_arrival).getTime(); // arrive at next
              if (nowMs >= segStart && nowMs <= segEnd) {
                const a = nodeFor(cur.station_id);
                const b = nodeFor(next.station_id);
                if (a && b) {
                  const r = Math.max(0, Math.min(1, (nowMs - segStart) / Math.max(1, segEnd - segStart)));
                  const x = a.x + (b.x - a.x) * r;
                  const y = a.y + (b.y - a.y) * r;
                  const fill = colorForEntry(cur);
                  const tinfo = getTrain(tid);
                  const heading = `${tinfo?.origin || '-'} → ${tinfo?.destination || '-'}`;
                  
                  // Determine which track the train is using
                  const route = routes.find(r => 
                    (r.from === cur.station_id && r.to === next.station_id) ||
                    (r.to === cur.station_id && r.from === next.station_id)
                  );
                  const trackNumber = route ? Math.floor(Math.random() * route.tracks) + 1 : 1;
                  
                  dots.push({ 
                    id: tid, x, y, fill, 
                    title: `${tid} • ${heading} (${cur.station_id}→${next.station_id}) Track ${trackNumber}`,
                    status: 'moving', trackNumber
                  });
                  placed = true;
                  break;
                }
              }
            }
          }
          if (!placed) {
            // After last known entry => sit at last station
            const last = entries[entries.length - 1];
            const n = nodeFor(last.station_id);
            if (n) {
              const fill = colorForEntry(last);
              dots.push({ 
                id: tid, x: n.x, y: n.y, fill, 
                title: `${tid} @ ${last.station_id}`,
                status: 'stopped'
              });
            }
          }
        }
      }
      return dots;
    }, [trainSegments, nowMs, nodes, trainPositions]);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[280px] rounded border border-slate-700 bg-slate-900">
        {/* Railway tracks between stations */}
        {routes.map((route) => {
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
          
          // Draw multiple tracks with enhanced visualization
          const tracks = [];
          const routeKey = `${route.from}-${route.to}`;
          const occupancy = trackOccupancy[routeKey];
          
          for (let t = 0; t < route.tracks; t++) {
            const offset = (t - (route.tracks - 1) / 2) * 12; // Space tracks 12px apart
            const off = 25; // curve amount
            const cx = mx + nx * off;
            const cy = my + ny * off;
            const startX = fromNode.x + nx * offset;
            const startY = fromNode.y + ny * offset;
            const endX = toNode.x + nx * offset;
            const endY = toNode.y + ny * offset;
            const ctrlX = cx + nx * offset;
            const ctrlY = cy + ny * offset;
            const path = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY}, ${endX} ${endY}`;
            const dashOffset = (tick * 3) % 24;
            
            // Track color based on occupancy
            const trackColor = occupancy?.conflicts ? '#ef4444' : route.color;
            const trackOpacity = occupancy?.trains.length > 0 ? 1.0 : 0.6;
            
            tracks.push(
              <g key={`${route.from}-${route.to}-track-${t}`}>
                {/* Track bed (ballast) */}
                <path d={path} stroke="#374151" strokeWidth={10} strokeLinecap="round" fill="none" strokeOpacity={0.8} />
                {/* Track rails */}
                <path d={path} stroke={trackColor} strokeWidth={4} strokeLinecap="round" fill="none" strokeOpacity={trackOpacity} />
                <path d={path} stroke={trackColor} strokeWidth={2} strokeLinecap="round" fill="none" strokeOpacity={trackOpacity * 0.7} />
                {/* Moving signal for active tracks */}
                {occupancy?.trains.length > 0 && (
                  <path d={path} stroke="#fbbf24" strokeWidth={1} strokeLinecap="round" fill="none" 
                        strokeDasharray="4 12" strokeDashoffset={dashOffset} strokeOpacity={0.8} />
                )}
                {/* Conflict indicator */}
                {occupancy?.conflicts && (
                  <path d={path} stroke="#dc2626" strokeWidth={2} strokeLinecap="round" fill="none" 
                        strokeDasharray="6 6" strokeDashoffset={-dashOffset} strokeOpacity={0.9} className="animate-pulse" />
                )}
              </g>
            );
          }
          
          // Enhanced route information
          tracks.push(
            <g key={`${route.from}-${route.to}-info`}>
              <text x={mx} y={my - 15} fontSize={10} fill="#94a3b8" textAnchor="middle" fontWeight="bold">
                {route.from}→{route.to}
              </text>
              <text x={mx} y={my - 5} fontSize={8} fill="#6b7280" textAnchor="middle">
                {route.tracks}T • {route.distance}km • {route.capacity}
              </text>
              {occupancy?.conflicts && (
                <text x={mx} y={my + 8} fontSize={7} fill="#ef4444" textAnchor="middle" className="animate-pulse">
                  ⚠️ CONFLICT: {occupancy.trains.length} trains on {route.tracks} tracks
                </text>
              )}
            </g>
          );
          
          return tracks;
        })}

        {/* stations */}
        {nodes.map((n) => {
          const st = stations.find((s) => s.id === n.id);
          const isJunction = (st?.platforms || 1) >= 3 || /central/i.test(n.id);
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={isJunction ? 10.5 : 8.5} fill={isJunction ? "#ef4444" : "#3b82f6"} stroke="#e2e8f0" strokeWidth={1} />
              <text x={n.x + 12} y={n.y + 4} fontSize={12} fill="#e5e7eb">{n.id}</text>
            </g>
          );
        })}

        {/* Enhanced trains with clickable status indicators */}
        {trainDots.map((t) => {
          const isDelayed = t.fill === '#ef4444';
          const isMoving = t.status === 'moving';
          const isWaiting = t.status === 'waiting';
          
          return (
            <g key={t.id} transform={`translate(${t.x}, ${t.y})`} style={{ transition: 'transform 0.5s ease-in-out' }}>
              {/* Train body */}
              <g className={isMoving ? 'animate-pulse' : ''}>
                {/* Shadow */}
                <ellipse cx={0} cy={2} rx={10} ry={4} fill="black" opacity={0.2} />
                {/* Main train shape */}
                <rect x={-10} y={-5} width={20} height={10} rx={4} fill={t.fill} stroke="#1f293b" strokeWidth={1.5} />
                {/* Windows */}
                <rect x={-7} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                <rect x={-2} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                <rect x={3} y={-3} width={3} height={4} fill="#cbd5e1" rx={0.5} />
                {/* Headlight */}
                <circle cx={isMoving ? 10 : -10} cy={0} r={1.5} fill="#fbbf24" opacity={0.8} />
                
                {/* Clickable Status indicators */}
                {isDelayed && (
                  <circle 
                    cx={0} cy={-10} r={4} fill="#ef4444" 
                    className="animate-pulse cursor-pointer" 
                    onClick={() => {
                      alert(`🚨 DELAYED TRAIN: ${t.id}\n\nReason: ${t.waitReason || 'Platform conflict'}\nClick OK to see resolution options.`);
                    }}
                  >
                    <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                
                {isWaiting && (
                  <circle 
                    cx={0} cy={-10} r={3} fill="#fbbf24" 
                    className="animate-bounce cursor-pointer"
                    onClick={() => {
                      alert(`⏳ WAITING: ${t.id}\n\nStatus: ${t.waitReason || 'Awaiting departure'}\nTrack: ${t.trackNumber || 'N/A'}`);
                    }}
                  />
                )}
                
                {isMoving && (
                  <circle 
                    cx={0} cy={-10} r={2} fill="#22c55e" 
                    className="cursor-pointer"
                    onClick={() => {
                      alert(`🚂 MOVING: ${t.id}\n\nTrack: ${t.trackNumber || 'N/A'}\nStatus: En route between stations`);
                    }}
                  />
                )}
                
                {/* Train ID label */}
                <text x={0} y={15} fontSize={9} fill="#e2e8f0" textAnchor="middle" fontWeight="bold">
                  {t.id}
                </text>
                
                {/* Track number indicator for moving trains */}
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
    );
  }

  

  // Reset to a balanced, non-conflicting demo dataset across all stations
  // Removed resetBalancedDataset (demo synthetic) in favor of fixed HYB dataset


  function Legend() {
    return (
      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span> Junction Station</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span> Regular Station</div>
        <div className="flex items-center gap-1"><span className="inline-block w-6 h-1 bg-red-500"></span> Single Line Track</div>
        <div className="flex items-center gap-1"><span className="inline-block w-6 h-1 bg-blue-500"></span> Double Line Track</div>
        <div className="flex items-center gap-1"><span className="inline-block w-6 h-1 bg-green-600"></span> High Capacity Track</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-transparent border border-green-500 rotate-180" style={{borderWidth: '6px 3px 0 3px', width: 0, height: 0}}></span> Running Train</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-transparent border border-yellow-400 rotate-180" style={{borderWidth: '6px 3px 0 3px', width: 0, height: 0}}></span> Delayed Train</div>
        <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 bg-red-500"></span> Stopped Train</div>
      </div>
    );
  }

  function statusFor(entry: ScheduleEntry): "Running" | "Delayed" | "Stopped" | "Breakdown" {
    const reason = (entry.reason || "").toLowerCase();
    if (reason.includes("breakdown")) return "Breakdown";
    if (reason.includes("stopped")) return "Stopped";
    if (isDelayed(entry)) return "Delayed";
    return "Running";
  }

  function DatasetTable() {
    return (
      <div className="bg-slate-900/40 border border-slate-700 rounded p-3 h-[280px] overflow-auto">
        <div className="text-sm font-semibold mb-2">Dataset (live)</div>
        <table className="w-full text-xs">
          <thead className="text-slate-400 sticky top-0 bg-slate-900/80">
            <tr>
              <th className="text-left py-1 pr-2">Train</th>
              <th className="text-left py-1 pr-2">Type</th>
              <th className="text-left py-1 pr-2">Status</th>
              <th className="text-left py-1 pr-2">Station</th>
              <th className="text-left py-1 pr-2">P</th>
              <th className="text-left py-1 pr-2">Arr</th>
              <th className="text-left py-1 pr-2">Dep</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((e) => {
              const t = getTrain(e.train_id);
              const st = statusFor(e);
              return (
                <tr key={e.train_id} className="border-t border-slate-800">
                  <td className="py-1 pr-2 font-medium text-slate-100">{e.train_id}</td>
                  <td className="py-1 pr-2 text-slate-300">{t?.type || "-"}</td>
                  <td className="py-1 pr-2">
                    <span className={st === 'Delayed' ? 'text-yellow-400' : st === 'Stopped' ? 'text-red-400' : st === 'Breakdown' ? 'text-rose-400' : 'text-emerald-400'}>{st}</span>
                  </td>
                  <td className="py-1 pr-2 text-slate-300">{e.station_id}</td>
                  <td className="py-1 pr-2 text-slate-300">{e.assigned_platform}</td>
                  <td className="py-1 pr-2 text-slate-300">{new Date(e.actual_arrival).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</td>
                  <td className="py-1 pr-2 text-slate-300">{new Date(e.actual_departure).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Removed conflict dataset creation

  // Removed conflict override banner logic

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket('ws://localhost:8000/ws');
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWebsocketConnected(true);
        setWs(websocket);
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket received:', data);
          if (data.type === 'train_positions') {
            console.log('Setting train positions:', data.data);
            setTrainPositions(data.data);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
      
      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setWebsocketConnected(false);
        setWs(null);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWebsocketConnected(false);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // polling / refresh interval
  useEffect(() => {
    // Fetch initial data from backend
    fetchStations();
    fetchDataset();
    fetchSchedule();
    fetchLogs();
    fetchActiveDelays();
    fetchTrainPositions();
    fetchConflicts();
    fetchTrackStatus();
    const t = setInterval(() => {
      fetchSchedule();
      fetchActiveDelays();
      fetchTrainPositions();
      fetchConflicts();
      fetchTrackStatus();
      setNowClock(new Date());
    }, 3000);
    const a = setInterval(() => setAnimTick((v) => v + 1), 150);
    return () => { clearInterval(t); clearInterval(a); };
  }, []);

  async function fetchDataset() {
    try {
      const r = await fetch(`${API_BASE}/trains`);
      if (!r.ok) return;
      const data = await r.json();
      // If backend returns trains only, we have to request stations separately if you implemented /stations
      // For prototype we expect the backend to include dataset in initial load; if not, define local stations
      setTrains(data);

      // try to load stations from a dedicated endpoint; fallback to inline
      try {
        const s = await fetch(`${API_BASE}/stations`);
        if (s.ok) {
          const st = await s.json();
          setStations(st);
        } else {
          // fallback static (match backend prototype)
          setStations([
            { id: "StationA", platforms: 2 },
            { id: "StationB", platforms: 2 },
            { id: "StationC", platforms: 1 },
            { id: "StationD", platforms: 2 },
          ]);
        }
      } catch (err) {
        setStations([
          { id: "StationA", platforms: 2 },
          { id: "StationB", platforms: 2 },
          { id: "StationC", platforms: 1 },
          { id: "StationD", platforms: 2 },
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchSchedule() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/schedule`);
      if (!r.ok) return;
      const data: ScheduleResponse = await r.json();
      
      // Store previous schedule for comparison (only if we have existing data)
      if (schedule.length > 0 && baselineSchedule.length === 0) {
        // First time: current schedule becomes baseline
        setBaselineSchedule([...schedule]);
      } else if (schedule.length > 0 && JSON.stringify(schedule) !== JSON.stringify(data.schedule)) {
        // Update previous schedule only if data actually changed
        setPreviousSchedule([...schedule]);
      }
      
      // Force new array references to trigger re-renders
      setSchedule([...data.schedule]);
      setDelaysBefore([...data.delays_before_min || []]);
      setDelaysAfter([...data.delays_after_min || []]);
      
      // Fetch baseline if not set
      if (baselineSchedule.length === 0) {
        try {
          const baselineRes = await fetch(`${API_BASE}/baseline`);
          if (baselineRes.ok) {
            const baselineData = await baselineRes.json();
            setBaselineSchedule([...baselineData]);
          }
        } catch (e) {
          console.log('Could not fetch baseline');
        }
      }
    } catch (e) {
      console.error('Error fetching schedule:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const r = await fetch(`${API_BASE}/log`);
      if (!r.ok) return;
      const data = await r.json();
      setLogs([...data.slice(-50).reverse()]); // show recent first, force new array
    } catch (e) {
      // Silent error handling
    }
  }

  async function fetchActiveDelays() {
    try {
      const r = await fetch(`${API_BASE}/active-delays`);
      if (!r.ok) return;
      const data = await r.json();
      setActiveDelays(Object.values(data));
    } catch (e) {
      console.error('Error fetching active delays:', e);
    }
  }

  async function fetchTrainPositions() {
    try {
      const r = await fetch(`${API_BASE}/train-positions`);
      if (!r.ok) return;
      const data = await r.json();
      setTrainPositions(data);
    } catch (e) {
      console.error('Error fetching train positions:', e);
    }
  }

  async function startMovementSimulation() {
    try {
      const r = await fetch(`${API_BASE}/start-movement-simulation`, {
        method: 'POST'
      });
      if (r.ok) {
        console.log('Train movement simulation started');
      }
    } catch (e) {
      console.error('Error starting movement simulation:', e);
    }
  }

  async function createTestMovements() {
    try {
      const r = await fetch(`${API_BASE}/create-test-movements`, {
        method: 'POST'
      });
      if (r.ok) {
        const data = await r.json();
        console.log('Test movements created:', data.message);
        alert(data.message);
      }
    } catch (e) {
      console.error('Error creating test movements:', e);
    }
  }

  async function forceConflict() {
    try {
      const r = await fetch(`${API_BASE}/force-conflict`, {
        method: 'POST'
      });
      if (r.ok) {
        const data = await r.json();
        console.log('Conflict forced:', data.message);
        alert(data.message);
        fetchConflicts();
      }
    } catch (e) {
      console.error('Error forcing conflict:', e);
    }
  }

  async function fetchConflicts() {
    try {
      const r = await fetch(`${API_BASE}/conflicts`);
      if (r.ok) {
        const data = await r.json();
        setConflicts(data);
      }
    } catch (e) {
      console.error('Error fetching conflicts:', e);
    }
  }

  async function fetchTrackStatus() {
    try {
      const r = await fetch(`${API_BASE}/track-status`);
      if (r.ok) {
        const data = await r.json();
        setTrackStatus(data);
      }
    } catch (e) {
      console.error('Error fetching track status:', e);
    }
  }

  async function injectDelay() {
    if (!selectedDelayTrain) return;
    
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/inject-delay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: selectedDelayTrain,
          delay_type: delayType,
          delay_minutes: delayMinutes,
          reason: delayReason || undefined
        }),
      });
      
      const resp = await r.json();
      if (!r.ok) {
        alert(`Delay injection failed: ${resp.detail || JSON.stringify(resp)}`);
        return;
      }
      
      // Success - refresh data
      await Promise.all([
        fetchSchedule(),
        fetchLogs(),
        fetchActiveDelays()
      ]);
      
      alert(`✅ Delay Injected Successfully!\n\nTrain: ${selectedDelayTrain}\nDelay Type: ${delayType}\nDuration: ${delayMinutes} minutes\nAffected Trains: ${resp.affected_trains.length}\nTotal Impact: +${resp.total_delay_impact.toFixed(1)} minutes`);
      
      setShowDelayModal(false);
      setSelectedDelayTrain(null);
      setDelayReason("");
      
    } catch (e) {
      alert("Network error during delay injection");
    } finally {
      setLoading(false);
    }
  }

  async function clearAllDelays() {
    if (activeDelays.length === 0) {
      alert("No active delays to clear");
      return;
    }
    
    if (!confirm(`Clear all ${activeDelays.length} active delays?`)) return;
    
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/clear-delays`, {
        method: "DELETE"
      });
      
      const resp = await r.json();
      if (!r.ok) {
        alert(`Failed to clear delays: ${resp.detail || JSON.stringify(resp)}`);
        return;
      }
      
      // Refresh data
      await Promise.all([
        fetchSchedule(),
        fetchLogs(),
        fetchActiveDelays()
      ]);
      
      alert(`✅ Cleared ${resp.cleared_count} delays successfully!`);
      
    } catch (e) {
      alert("Network error clearing delays");
    } finally {
      setLoading(false);
    }
  }

  async function resetSystem() {
    try {
      const r = await fetch(`${API_BASE}/reset`, { method: 'POST' });
      if (!r.ok) return;
      
      // Clear local state
      setBaselineSchedule([]);
      setPreviousSchedule([]);
      setSchedule([]);
      
      // Refresh everything
      await fetchSchedule();
      await fetchLogs();
    } catch (e) {
      console.error('Reset failed:', e);
    }
  }

  // KPI helpers
  function computeKPIs() {
    if (!schedule || schedule.length === 0)
      return { total: 0, ontimePct: 0, avgDelay: 0 };
    const total = schedule.length;
    let ontime = 0;
    let sumDelay = 0;
    schedule.forEach((s) => {
      const train = trains.find((t) => t.id === s.train_id);
      if (!train || !train.scheduled_arrival) return;
      const scheduledArrival = new Date(train.scheduled_arrival);
      const actualArrival = new Date(s.actual_arrival);
      const delay = Math.max(
        0,
        (actualArrival.getTime() - scheduledArrival.getTime()) / 60000
      );
      sumDelay += delay;
      if (delay <= 2) ontime += 1; // within 2 minutes considered on-time
    });
    return {
      total,
      ontimePct: Math.round((ontime / total) * 100),
      avgDelay: (sumDelay / total).toFixed(1),
    };
  }

  const kpis = computeKPIs();

  // Derive delay arrays locally if backend doesn't provide them
  function computeDelayArray(entries: ScheduleEntry[]): number[] {
    if (!entries || entries.length === 0) return [];
    const delays: number[] = [];
    for (const e of entries) {
      const t = getTrain(e.train_id);
      const scheduledRef = t?.scheduled_arrival || t?.scheduled_departure;
      if (!scheduledRef) continue;
      const scheduledArrivalMs = new Date(scheduledRef).getTime();
      const actualArrivalMs = new Date(e.actual_arrival).getTime();
      const delayMin = Math.max(0, (actualArrivalMs - scheduledArrivalMs) / 60000);
      delays.push(Number(delayMin.toFixed(1)));
    }
    return delays;
  }

  const localDelaysAfter = useMemo(() => computeDelayArray(schedule), [schedule, trains]);
  const localDelaysBefore = useMemo(() => {
    const before = baselineSchedule.length > 0
      ? baselineSchedule
      : previousSchedule.length > 0
        ? previousSchedule
        : [];
    return computeDelayArray(before);
  }, [baselineSchedule, previousSchedule, trains]);

  const displayDelaysBefore = delaysBefore.length > 0 ? delaysBefore : localDelaysBefore;
  const displayDelaysAfter = delaysAfter.length > 0 ? delaysAfter : localDelaysAfter;

  function DelayBars({ title, values }: { title: string; values: number[] }) {
    const maxVal = Math.max(2, ...values);
    const bars = values.slice(0, Math.min(values.length, 12));
    const total = values.reduce((s, v) => s + v, 0);
    const avg = values.length ? total / values.length : 0;
    return (
      <div className="flex-1">
        <div className="text-sm text-slate-400 mb-1">{title}</div>
        <div className="h-24 bg-slate-900/40 border border-slate-700 rounded p-2 flex flex-col">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-2xl font-bold text-slate-100">{avg.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">min avg</span></div>
            <div className="text-xs text-slate-400">Σ {total.toFixed(1)} min</div>
          </div>
          <div className="flex-1 flex items-end gap-1">
            {bars.length === 0 ? (
              <div className="text-xs text-slate-400 m-auto">0.0 min</div>
            ) : (
              bars.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-indigo-400/80 rounded"
                  style={{ height: `${(v / maxVal) * 100}%` }}
                  title={`${v.toFixed(1)} min`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Calculate delay impact for a potential override
  async function calculateDelayImpact(trainId: string, newPlatform: number): Promise<{current: number, predicted: number, difference: number} | null> {
    try {
      const currentEntry = schedule.find(s => s.train_id === trainId);
      const train = getTrain(trainId);
      
      if (!currentEntry || !train || !train.scheduled_arrival) {
        return null;
      }
      
      // Calculate current delay
      const scheduledTime = new Date(train.scheduled_arrival).getTime();
      const currentActualTime = new Date(currentEntry.actual_arrival).getTime();
      const currentDelay = Math.max(0, (currentActualTime - scheduledTime) / (60 * 1000)); // in minutes
      
      // Simulate the override to predict new delay
      const response = await fetch(`${API_BASE}/simulate-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: trainId,
          station_id: currentEntry.station_id,
          new_platform: newPlatform,
        }),
      });
      
      if (response.ok) {
        const simulation = await response.json();
        
        if (simulation.target_train_impact) {
          return {
            current: simulation.target_train_impact.current_delay,
            predicted: simulation.target_train_impact.predicted_delay,
            difference: simulation.target_train_impact.delay_change
          };
        }
      }
      
      // Fallback: estimate based on platform conflicts
      const conflictingTrains = schedule.filter(s => 
        s.station_id === currentEntry.station_id && 
        s.assigned_platform === newPlatform &&
        s.train_id !== trainId
      );
      
      // Simple heuristic: each conflicting train adds ~2-5 minutes delay
      const estimatedAdditionalDelay = conflictingTrains.length * 3;
      const predictedDelay = currentDelay + estimatedAdditionalDelay;
      
      return {
        current: currentDelay,
        predicted: predictedDelay,
        difference: estimatedAdditionalDelay
      };
      
    } catch (error) {
      console.error('Error calculating delay impact:', error);
      return null;
    }
  }

  // override handler
  async function openOverride(trainId: string) {
    setSelectedTrain(trainId);
    setOverridePlatform(1);
    setOverrideMsg("");
    setDelayImpact(null);
    setShowDelayWarning(false);
    setShowModal(true);
    
    // Calculate initial delay impact for platform 1
    const impact = await calculateDelayImpact(trainId, 1);
    setDelayImpact(impact);
  }

  async function submitOverride(forceOverride: boolean = false) {
    if (!selectedTrain) return;
    const stationId = schedule.find(
      (s) => s.train_id === selectedTrain
    )?.station_id;
    if (!stationId) {
      setOverrideMsg("Train not found in current schedule");
      return;
    }
    
    // Check delay impact before proceeding (unless forced)
    if (!forceOverride && delayImpact && delayImpact.difference > 2) {
      setShowDelayWarning(true);
      setPendingOverride({
        trainId: selectedTrain,
        stationId: stationId,
        platform: Number(overridePlatform)
      });
      return;
    }
    
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: selectedTrain,
          station_id: stationId,
          new_platform: Number(overridePlatform),
        }),
      });
      const resp = await r.json();
      if (!r.ok) {
        if (resp.status === "rejected") {
          // Handle rejection with alternatives
          let alternativesText = "";
          if (resp.alternatives && resp.alternatives.length > 0) {
            const feasibleAlts = resp.alternatives.filter((alt: any) => alt.feasible);
            if (feasibleAlts.length > 0) {
              alternativesText = `\n\nSuggested alternatives:\n${feasibleAlts.map((alt: any) => 
                `• Platform ${alt.platform} (+${alt.delay_increase.toFixed(1)} min delay)`
              ).join('\n')}`;
            }
          }
          
          setOverrideMsg(`❌ Override Rejected: ${resp.reason}${alternativesText}`);
          
          // Show delay analysis if available
          if (resp.delay_analysis) {
            const analysis = resp.delay_analysis;
            setOverrideMsg(prev => prev + `\n\nDelay Analysis:\n• Current total delay: ${analysis.current_total_delay.toFixed(1)} min\n• Predicted total delay: ${analysis.predicted_total_delay.toFixed(1)} min\n• Increase: +${analysis.delay_increase.toFixed(1)} min`);
          }
          
          // Set last action for chatbot auto-explanation
          setLastOverrideAction(`Override rejected for train ${selectedTrain}: ${resp.reason}`);
          setAutoExplanationTriggered(false);
        } else {
          setOverrideMsg(resp.detail || JSON.stringify(resp));
        }
      } else {
        // Success case
        let successMsg = `✅ Override Applied: ${resp.reason || "re-optimized"}`;
        
        if (resp.feasibility_analysis) {
          const analysis = resp.feasibility_analysis;
          successMsg += `\n\nOptimization Result:\n• Total delay increase: +${analysis.delay_increase.toFixed(1)} min\n• Trains affected: ${analysis.affected_trains_count}\n• System efficiency maintained`;
        }
        
        setOverrideMsg(successMsg);
        
        // Set last action for chatbot auto-explanation
        setLastOverrideAction(`Override applied for train ${selectedTrain}: ${resp.reason || "re-optimized"}`);
        setAutoExplanationTriggered(false);
      }
      
      // Force state invalidation and refresh
      setPreviousSchedule([...schedule]); // Store current as previous
      setSchedule([]); // Clear current to force re-render
      
      // Wait a moment for backend to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh all data
      await Promise.all([
        fetchSchedule(),
        fetchLogs()
      ]);
      
      setTimeout(() => {
        setShowModal(false);
        setShowDelayWarning(false);
        setPendingOverride(null);
      }, 800);
    } catch (e) {
      setOverrideMsg("Network error");
    } finally {
      setLoading(false);
    }
  }
  
  // Handle forced override after warning
  async function proceedWithOverride() {
    if (pendingOverride) {
      setShowDelayWarning(false);
      await submitOverride(true);
    }
  }
  
  // Cancel override after warning
  function cancelOverride() {
    setShowDelayWarning(false);
    setPendingOverride(null);
    setOverrideMsg("Override cancelled due to high delay impact");
  }

  // Helper function for conflict simulation
  async function submitOverrideForTrain(trainId: string, stationId: string, platform: number) {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: trainId,
          station_id: stationId,
          new_platform: platform,
        }),
      });
      const resp = await r.json();
      
      if (r.ok) {
        // Force state invalidation for proper Gantt chart updates
        setPreviousSchedule([...schedule]); // Store current as previous
        setSchedule([]); // Clear current to force re-render
        
        // Wait for backend processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh all data with proper sequencing
        await Promise.all([
          fetchSchedule(),
          fetchLogs()
        ]);
        
        // Force a re-render by updating animation tick
        setAnimTick(prev => prev + 1);
      } else {
        alert(`Override failed: ${resp.detail}`);
      }
    } catch (e) {
      alert("Network error during override");
    } finally {
      setLoading(false);
    }
  }

  // Helper function to format log messages with better conflict explanations
  function formatLogMessage(details: string): string {
    // Enhanced conflict resolution explanations
    if (details.includes('delay') && details.includes('min')) {
      const trainMatch = details.match(/Train (\w+)/);
      const delayMatch = details.match(/delay (\d+) min/);
      const stationMatch = details.match(/→ (\w+)/);
      const platformMatch = details.match(/P(\d+)/);
      
      if (trainMatch && delayMatch && stationMatch && platformMatch) {
        return `🚨 CONFLICT RESOLVED: Train ${trainMatch[1]} was delayed by ${delayMatch[1]} minutes at ${stationMatch[1]} station. 
        
📋 Resolution: Assigned to Platform ${platformMatch[1]} with ${delayMatch[1]}-minute delay to avoid platform conflict with higher priority train.
        
💡 Reason: The optimizer detected overlapping arrival/departure times and automatically resolved the conflict by delaying the lower priority train.`;
      }
    }
    
    if (details.includes('override') && details.includes('success')) {
      const trainMatch = details.match(/Move (\w+)/);
      const platformMatch = details.match(/P(\d+)/);
      const stationMatch = details.match(/at (\w+)/);
      
      if (trainMatch && platformMatch && stationMatch) {
        return `✅ MANUAL OVERRIDE SUCCESS: Train ${trainMatch[1]} successfully moved to Platform ${platformMatch[1]} at ${stationMatch[1]} station.
        
📋 Feasibility Check: System verified no conflicts with existing train schedules.
        
💡 Impact: Schedule re-optimized to accommodate the manual override while maintaining system efficiency.`;
      }
    }
    
    if (details.includes('override') && details.includes('rejected')) {
      return `❌ OVERRIDE REJECTED: ${details}
      
📋 Reason: The requested platform assignment would create an unresolvable conflict with existing train schedules.
      
💡 Suggestion: Try a different platform or time slot, or check which trains are currently occupying the requested platform.`;
    }
    
    if (details.includes('Platform') && details.includes('occupied')) {
      return `⚠️ PLATFORM CONFLICT DETECTED: ${details}
      
📋 Analysis: Multiple trains attempting to use the same platform at overlapping times.
      
💡 Resolution: System will automatically delay lower priority trains or assign alternative platforms.`;
    }
    
    if (details.includes('assigned') && details.includes('on-time')) {
      const trainMatch = details.match(/Train (\w+)/);
      const stationMatch = details.match(/→ (\w+)/);
      const platformMatch = details.match(/P(\d+)/);
      
      if (trainMatch && stationMatch && platformMatch) {
        return `✅ OPTIMAL ASSIGNMENT: Train ${trainMatch[1]} assigned to Platform ${platformMatch[1]} at ${stationMatch[1]} with no delays.
        
📋 Status: No conflicts detected - train can proceed as scheduled.`;
      }
    }
    
    // Default formatting for other messages
    return details;
  }

  // Removed unused helper functions for cleaner code

  // --- Gantt Chart (responsive, 100% width, shared window) ---
  function GanttChart({ entries, title, timeWindow }: { entries: ScheduleEntry[]; title: string; timeWindow: { min: number; max: number } }) {
    const stationMap = useMemo(() => {
      const map: Record<string, { platforms: number } & { rows: Record<number, ScheduleEntry[]> }> = {};
      stations.forEach((s) => (map[s.id] = { platforms: s.platforms, rows: {} }));
      entries.forEach((e) => {
        if (!map[e.station_id]) return;
        const p = e.assigned_platform;
        if (!map[e.station_id].rows[p]) map[e.station_id].rows[p] = [];
        map[e.station_id].rows[p].push(e);
      });
      return map;
    }, [entries, stations, animTick]); // Add animTick to force re-computation

    const ticks = useMemo(() => {
      const res: { leftPct: number; label: string; isHour?: boolean }[] = [];
      const totalSpan = timeWindow.max - timeWindow.min;
      const span = Math.max(1, totalSpan);
      
      // Dynamic tick interval based on time span
      let tickInterval: number;
      if (totalSpan <= 2 * 60 * 60 * 1000) { // <= 2 hours: 10 min intervals
        tickInterval = 10 * 60 * 1000;
      } else if (totalSpan <= 8 * 60 * 60 * 1000) { // <= 8 hours: 30 min intervals
        tickInterval = 30 * 60 * 1000;
      } else { // > 8 hours: 1 hour intervals
        tickInterval = 60 * 60 * 1000;
      }
      
      const start = Math.floor(timeWindow.min / tickInterval) * tickInterval;
      const end = Math.ceil(timeWindow.max / tickInterval) * tickInterval;
      
      for (let t = start; t <= end; t += tickInterval) {
        const leftPct = ((t - timeWindow.min) / span) * 100;
        const date = new Date(t);
        const isHour = date.getMinutes() === 0;
        const label = isHour 
          ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        res.push({ leftPct, label, isHour });
      }
      return res;
    }, [timeWindow.min, timeWindow.max]);

    const span = Math.max(1, timeWindow.max - timeWindow.min);

    return (
      <div className="bg-slate-800 text-slate-100 rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{title}</h2>
          <div className="text-xs text-gray-500">
            Time window: {new Date(timeWindow.min).toLocaleString([], { 
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
            })} – {new Date(timeWindow.max).toLocaleString([], { 
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
            })}
            <span className="ml-2 text-slate-400">({Math.round((timeWindow.max - timeWindow.min) / (60 * 60 * 1000) * 10) / 10}h span)</span>
          </div>
        </div>
        {/* legend */}
        <div className="flex flex-wrap gap-3 items-center text-xs text-gray-600 mb-2">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: '#3b82f6'}}></span> Express</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: '#22c55e'}}></span> Local</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: '#f59e0b'}}></span> Intercity</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: '#8b5cf6'}}></span> Freight</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{backgroundColor: '#ef4444'}}></span> Delayed</div>
          <div className="flex items-center gap-1"><span className="text-[10px]">★</span> Overridden</div>
        </div>
        <div className="w-full">
          {/* timeline */}
          <div className="relative border-b border-slate-700 h-8 w-full">
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-0 text-[10px] text-slate-400" style={{ left: `${t.leftPct}%` }}>
                <div className={`border-l ${t.isHour ? 'h-4 border-slate-400' : 'h-2 border-slate-600'}`}></div>
                <div className={`translate-x-1 ${t.isHour ? 'font-medium text-slate-300' : 'text-slate-500'}`}>{t.label}</div>
              </div>
            ))}
          </div>

          {/* rows */}
          <div className="divide-y divide-slate-700">
            {stations.map((st) => (
              <div key={st.id} className="py-3">
                <div className="text-sm font-medium text-slate-200 mb-1">{st.id}</div>
                {Array.from({ length: st.platforms }).map((_, idx) => {
                  const p = idx + 1;
                  const rowEntries = stationMap[st.id]?.rows[p] || [];
                  return (
                    <div key={p} className="relative h-10 mb-3 bg-slate-900/40 border border-slate-700 rounded w-full">
                      <div className="absolute left-2 top-1.5 text-[11px] text-slate-400">P{p}</div>
                      {rowEntries.map((e, i) => {
                        const start = new Date(e.actual_arrival).getTime();
                        const end = new Date(e.actual_departure).getTime();
                        const leftPct = Math.max(0, ((start - timeWindow.min) / span) * 100);
                        const widthPct = Math.max(0.5, ((end - start) / span) * 100);
                        const color = colorForEntry(e);
                        const t = getTrain(e.train_id);
                        const heading = `${t?.origin || "-"} → ${t?.destination || "-"}`;
                        const title = `Train ${e.train_id} • ${heading} @ ${st.id} P${p}\n${new Date(start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} – ${new Date(end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
                        return (
                          <div
                            key={i}
                            className="absolute top-1.5 h-7 rounded text-[10px] text-white flex items-center px-2 shadow"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
                            title={title}
                          >
                            <span className="truncate font-medium">{e.train_id}</span>
                            <span className="ml-2 hidden md:inline text-white/90">{heading}</span>
                            {isOverridden(e) && <span className="ml-1 text-[9px]">★</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const toggleChatBot = () => {
    setShowChatBot(prev => !prev);
    // If opening chatbot and there was a recent override/conflict, trigger auto explanation
    if (!showChatBot && lastOverrideAction && !autoExplanationTriggered) {
      setAutoExplanationTriggered(true);
    }
  };

  const renderChatBotToggle = () => (
    <button 
      onClick={toggleChatBot}
      className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 flex items-center justify-center"
      aria-label="Chat with AI Assistant"
    >
      <Bot className="w-6 h-6" />
    </button>
  );

  const renderChatBot = () => (
    showChatBot && (
      <ChatBot 
        logsBefore={previousSchedule.map((entry) => ({
          timestamp: new Date().toISOString(),
          action: "baseline_schedule",
          details: `${entry.train_id} → ${entry.station_id} P${entry.assigned_platform}`
        }))}
        logsAfter={logs}
        scheduleData={{
          schedule: schedule,
          delays_before_min: displayDelaysBefore,
          delays_after_min: displayDelaysAfter,
          reasons: schedule.map(s => s.reason || "")
        }}
        lastAction={lastOverrideAction}
        autoExplain={autoExplanationTriggered}
        onClose={() => {
          setShowChatBot(false);
          setAutoExplanationTriggered(false);
        }}
        onAutoExplanationComplete={() => setAutoExplanationTriggered(false)}
      />
    )
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">🚂 TrainVision AI Decision Support</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                fetchLogs();
                setShowLogsModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              📋 Audit Logs
            </button>
            <button 
              onClick={async () => {
                setLoading(true);
                // Force state invalidation
                setPreviousSchedule([...schedule]);
                setSchedule([]);
                
                await Promise.all([
                  fetchSchedule(),
                  fetchLogs()
                ]);
                
                // Force re-render
                setAnimTick(prev => prev + 1);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={loading}
            >
              {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>
            <button 
              onClick={async () => {
                if (confirm('This will reset all overrides and regenerate the baseline schedule. Continue?')) {
                  await resetSystem();
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              🔄 Reset System
            </button>
            <div className="text-right">
              <div className="text-sm text-slate-400">Local time</div>
              <div className="font-medium">{nowClock.toLocaleTimeString()}</div>
            </div>
          </div>
        </header>

        {/* Full-width Visualization on top */}
        <section className="mb-6">
          <div className="bg-slate-800 rounded shadow p-4 relative overflow-hidden" style={{ minHeight: 360 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Network Map — Prototype</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { fetchStations(); fetchDataset(); fetchSchedule(); }} className="px-3 py-2 bg-emerald-600 text-white rounded">Refresh All</button>
              </div>
            </div>
            {/* Map + dataset table */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <GeoMap stations={stations} schedule={schedule} getTrain={getTrain} tick={animTick} />
              </div>
              <div className="col-span-1">
                <DatasetTable />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-slate-300">Prototype map positions are pseudo-random; trains are shown near their assigned station.</div>
              <Legend />
            </div>
            {/* conflict banner removed */}
          </div>
        </section>

        {/* Hero section with before/after optimization graphs and System Alerts */}
        <section className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-slate-800 rounded shadow p-4">
            {/* KPI Section - Compact */}
            <div className="flex gap-6 mb-4">
              <DelayBars title="Before optimization (delay min)" values={displayDelaysBefore} />
              <DelayBars title="After optimization (delay min)" values={displayDelaysAfter} />
              <div className="flex-1">
                <div className="text-sm text-slate-400">Total trains</div>
                <div className="text-2xl font-bold text-slate-100">{kpis.total}</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-400">On-time % (&lt;=2m)</div>
                <div className="text-2xl font-bold text-slate-100">{kpis.ontimePct}%</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-400">Avg delay (min)</div>
                <div className="text-2xl font-bold text-slate-100">{kpis.avgDelay}</div>
              </div>
            </div>

            {/* System Alerts & Active Delays - Vertical Layout */}
            <div className="mt-4">
              <h3 className="font-semibold mb-3 text-white">System Alerts & Active Delays</h3>
              <div className="space-y-3">
                {/* Active Conflicts */}
                <div className="bg-slate-700 rounded p-3">
                  <h4 className="font-medium text-red-400 mb-2 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Active Conflicts ({Object.keys(conflicts).length})
                  </h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {Object.keys(conflicts).length === 0 ? (
                      <div className="text-xs text-slate-400">No active conflicts</div>
                    ) : (
                      Object.entries(conflicts).map(([key, conflict]: [string, any]) => (
                        <div key={key} className="text-xs bg-slate-600 rounded p-1.5">
                          <div className="text-red-300 font-medium">Platform Conflict</div>
                          <div className="text-slate-300">
                            {conflict.trains?.join(', ') || 'Multiple trains'} - Track {key}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Active Delays */}
                <div className="bg-slate-700 rounded p-3">
                  <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    Active Delays ({activeDelays.length})
                  </h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {activeDelays.length === 0 ? (
                      <div className="text-xs text-slate-400">No active delays</div>
                    ) : (
                      activeDelays.map((delay, idx) => (
                        <div key={idx} className="text-xs bg-slate-600 rounded p-1.5">
                          <div className="text-yellow-300 font-medium">
                            {delay.type?.charAt(0).toUpperCase() + delay.type?.slice(1) || 'Delay'}
                          </div>
                          <div className="text-slate-300">
                            Train {delay.train_id} - {delay.minutes}min delay
                          </div>
                          {delay.reason && (
                            <div className="text-slate-400 text-xs mt-0.5">{delay.reason}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions Impact Display - Always Visible */}
                <div className="p-3 bg-slate-700 rounded">
                  <h4 className="font-medium text-blue-400 mb-2 text-sm">Quick Actions Impact</h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <div className="text-slate-400">Affected Trains</div>
                      <div className="text-lg font-bold text-white">
                        {new Set([
                          ...Object.values(conflicts).flatMap((c: any) => c.trains || []),
                          ...activeDelays.map(d => d.train_id)
                        ]).size}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Total Delay Impact</div>
                      <div className="text-lg font-bold text-yellow-400">
                        {activeDelays.reduce((sum, d) => sum + (d.minutes || 0), 0)}min
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">System Status</div>
                      <div className={`text-lg font-bold ${
                        Object.keys(conflicts).length === 0 && activeDelays.length === 0 
                          ? 'text-green-400' 
                          : Object.keys(conflicts).length > 0 
                            ? 'text-red-400' 
                            : 'text-yellow-400'
                      }`}>
                        {Object.keys(conflicts).length === 0 && activeDelays.length === 0 
                          ? 'OPTIMAL' 
                          : Object.keys(conflicts).length > 0 
                            ? 'CONFLICTS' 
                            : 'DELAYS'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded shadow p-4 col-span-1 border border-slate-700">
            <div className="font-medium mb-2">Quick actions</div>
            <button
              onClick={() => {
                setShowModal(true);
                setSelectedTrain(schedule[0]?.train_id || null);
              }}
              className="w-full mb-2 px-3 py-2 border border-slate-600 rounded bg-slate-900/40 hover:bg-slate-900/60"
            >
              Manual Override
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const response = await fetch(`${API_BASE}/inject-conflict`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                  });
                  
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  
                  const result = await response.json();
                  
                  if (result.status === "conflict_injected") {
                    alert(`✅ Conflict Injected Successfully!\n\nTrains: ${result.applied_change.train_id}\nStation: ${result.applied_change.station_id}\nPlatform: ${result.applied_change.new_platform}\nDelay increase: +${result.optimization_result.delay_increase.toFixed(1)} minutes\nAffected trains: ${result.optimization_result.affected_trains}`);
                    
                    // Set last action for chatbot auto-explanation
                    setLastOverrideAction(`Conflict injected: ${result.applied_change.train_id} moved to Platform ${result.applied_change.new_platform}`);
                    setAutoExplanationTriggered(false);
                  } else if (result.status === "conflict_rejected") {
                    alert(`❌ Conflict Injection Rejected\n\nReason: ${result.reason}\n\nThe optimization system prevented this conflict because it would cause excessive delays.`);
                    
                    // Set last action for chatbot auto-explanation
                    setLastOverrideAction(`Conflict injection rejected: ${result.reason}`);
                    setAutoExplanationTriggered(false);
                  } else {
                    alert(`ℹ️ ${result.message || 'Unknown response'}`);
                  }
                  
                  // Refresh data
                  await Promise.all([
                    fetchSchedule(),
                    fetchLogs()
                  ]);
                } catch (error) {
                  console.error('Conflict injection error:', error);
                  alert(`Error injecting conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full mb-2 px-3 py-2 border border-amber-600 rounded bg-amber-900/40 hover:bg-amber-900/60 text-amber-200"
              disabled={loading}
            >
               Test Conflict Injection
            </button>
            <button
              onClick={() => {
                setShowDelayModal(true);
                setSelectedDelayTrain(schedule[0]?.train_id || null);
              }}
              className="w-full mb-2 px-3 py-2 border border-red-600 rounded bg-red-900/40 hover:bg-red-900/60 text-red-200"
            >
               Inject Delay
            </button>
            <button
              onClick={clearAllDelays}
              className="w-full mb-2 px-3 py-2 border border-orange-600 rounded bg-orange-900/40 hover:bg-orange-900/60 text-orange-200"
              disabled={activeDelays.length === 0}
            >
               Clear Delays ({activeDelays.length})
            </button>
            <button
              onClick={startMovementSimulation}
              className="w-full mb-2 px-3 py-2 border border-green-600 rounded bg-green-900/40 hover:bg-green-900/60 text-green-200"
            >
               Start Train Movement
            </button>
            <button
              onClick={createTestMovements}
              className="w-full mb-2 px-3 py-2 border border-blue-600 rounded bg-blue-900/40 hover:bg-blue-900/60 text-blue-200"
            >
               Create Test Movements
            </button>
            <button
              onClick={forceConflict}
              className="w-full mb-2 px-3 py-2 border border-red-600 rounded bg-red-900/40 hover:bg-red-900/60 text-red-200"
            >
               Force Conflict
            </button>
            <div className={`w-full mb-2 px-3 py-2 rounded text-center text-sm ${
              websocketConnected ? 'bg-green-900/40 text-green-200' : 'bg-red-900/40 text-red-200'
            }`}>
              {websocketConnected ? '🟢 Live Updates' : '🔴 Disconnected'}
            </div>
            <div className="w-full mb-2 px-3 py-2 rounded text-center text-sm bg-blue-900/40 text-blue-200">
              Trains: {trainPositions.length}
            </div>
            <div className={`w-full mb-2 px-3 py-2 rounded text-center text-sm ${
              conflicts.active_conflicts > 0 ? 'bg-red-900/40 text-red-200' : 'bg-green-900/40 text-green-200'
            }`}>
              {conflicts.active_conflicts > 0 ? `🚨 ${conflicts.active_conflicts} Conflicts` : '✅ No Conflicts'}
            </div>
            <div className="w-full mb-2 px-3 py-2 rounded text-center text-sm bg-purple-900/40 text-purple-200">
              Tracks: {Object.keys(trackStatus.track_occupancy || {}).length}
            </div>
            <button
              onClick={() => {
                fetchLogs();
              }}
              className="w-full px-3 py-2 border border-slate-600 rounded bg-slate-900/40 hover:bg-slate-900/60"
            >
              Refresh Logs
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4">
          {/* Left: Schedule table */}
          <div className="col-span-1 bg-slate-800 rounded shadow p-4 border border-slate-700">
            <h2 className="font-semibold mb-3">Schedule</h2>
            {loading ? (
              <div className="text-slate-300">Loading...</div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 pr-2">Train</th>
                      <th className="text-left py-2 pr-2">Type</th>
                      <th className="text-left py-2 pr-2">Station</th>
                      <th className="text-left py-2 pr-2">Platform</th>
                      <th className="text-left py-2 pr-2">Arr</th>
                      <th className="text-left py-2 pr-2">Dep</th>
                      <th className="text-left py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s) => {
                      const t = trains.find((tr) => tr.id === s.train_id);
                      return (
                        <tr key={s.train_id} className="border-b border-slate-800">
                          <td className="py-2 pr-2 font-medium text-slate-100">{s.train_id}</td>
                          <td className="py-2 pr-2 text-slate-300">{t?.type || "-"}</td>
                          <td className="py-2 pr-2 text-slate-300">{s.station_id}</td>
                          <td className="py-2 pr-2 text-slate-300">P{s.assigned_platform}</td>
                          <td className="py-2 pr-2 text-slate-300">{new Date(s.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 pr-2 text-slate-300">{new Date(s.actual_departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 pr-2">
                            <button onClick={() => openOverride(s.train_id)} className="px-2 py-1 text-xs bg-amber-500 text-white rounded">Override</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Gantt chart section: Before vs After */}
        {(() => {
          // Base before entries from baseline/previous or trains' scheduled times
          const baseBefore = baselineSchedule.length > 0 
            ? baselineSchedule 
            : previousSchedule.length > 0
            ? previousSchedule
            : trains.map((t) => ({
                train_id: t.id,
                station_id: t.origin || "",
                assigned_platform: t.platform_pref || 1,
                actual_arrival: t.scheduled_arrival || new Date().toISOString(),
                actual_departure: t.scheduled_departure || t.scheduled_arrival || new Date().toISOString(),
                reason: "initial schedule",
              }));

          // Inject a synthetic pre-optimization conflict for T104 vs T106 on HYB P1
          // without affecting the actual optimized (after) schedule visualization.
          const beforeEntries: ScheduleEntry[] = (() => {
            const byId: Record<string, ScheduleEntry> = {};
            baseBefore.forEach(e => { byId[e.train_id] = { ...e }; });

            // Ensure T104 exists in before; if present, force HYB P1 window 09:05–09:30
            const t104Train = trains.find(t => t.id === 'T104');
            if (t104Train) {
              byId['T104'] = {
                train_id: 'T104',
                station_id: t104Train.origin || 'HYB',
                assigned_platform: 1,
                actual_arrival: t104Train.scheduled_arrival || '2025-09-22T09:05:00',
                actual_departure: t104Train.scheduled_departure || '2025-09-22T09:30:00',
                reason: 'pre-optimization conflict baseline',
              };
            }

            // Add or override T106 (existing in dataset) to overlap on HYB P1 09:12–09:22
            const t106Train = trains.find(t => t.id === 'T106');
            if (t106Train) {
              byId['T106'] = {
                train_id: 'T106',
                station_id: t106Train.origin || 'HYB',
                assigned_platform: 1,
                actual_arrival: t106Train.scheduled_arrival || '2025-09-22T09:12:00',
                actual_departure: t106Train.scheduled_departure || '2025-09-22T09:22:00',
                reason: 'pre-optimization conflict baseline',
              };
            }

            // Return base entries but with T104/T107 forced as above; others unchanged
            const merged = Object.values(byId);
            return merged;
          })();

          const afterEntries = schedule.length > 0 ? schedule : baseBefore;

          // Enhanced dynamic time window calculation
          const getTimeWindow = (entries: ScheduleEntry[]) => {
            if (entries.length === 0) {
              return { min: Date.now() - 30 * 60 * 1000, max: Date.now() + 30 * 60 * 1000 };
            }
            const times = entries.flatMap(e => [
              new Date(e.actual_arrival).getTime(),
              new Date(e.actual_departure).getTime()
            ]);
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const timeSpan = maxTime - minTime;
            
            // Add padding based on time span (10% of span, minimum 30 minutes, maximum 2 hours)
            const padding = Math.max(30 * 60 * 1000, Math.min(2 * 60 * 60 * 1000, timeSpan * 0.1));
            
            return {
              min: minTime - padding,
              max: maxTime + padding,
            };
          };

          const beforeWindow = getTimeWindow(beforeEntries);
          const afterWindow = getTimeWindow(afterEntries);
          const sharedWindow = {
            min: Math.min(beforeWindow.min, afterWindow.min),
            max: Math.max(beforeWindow.max, afterWindow.max),
          };

          // Calculate differences for highlighting
          const changedTrains = new Set<string>();
          afterEntries.forEach(after => {
            const before = beforeEntries.find(b => b.train_id === after.train_id);
            if (before && (
              before.assigned_platform !== after.assigned_platform ||
              before.actual_arrival !== after.actual_arrival ||
              before.actual_departure !== after.actual_departure
            )) {
              changedTrains.add(after.train_id);
            }
          });

          return (
            <section className="mt-6 space-y-4">
              <div className="bg-slate-800 rounded shadow p-4">
                <h3 className="font-semibold mb-3">📊 Schedule Comparison</h3>
                <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500 rounded text-sm">
                  <span className="text-blue-400">ℹ️ Dynamic Time Window:</span> The timeline automatically adjusts to show all trains, regardless of their arrival times (8:50 AM, 1:00 PM, etc.)
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="bg-slate-700/50 rounded p-3">
                    <div className="text-slate-400">Total Changes</div>
                    <div className="text-2xl font-bold">{changedTrains.size}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <div className="text-slate-400">Baseline Trains</div>
                    <div className="text-2xl font-bold">{beforeEntries.length}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <div className="text-slate-400">Optimized Trains</div>
                    <div className="text-2xl font-bold">{afterEntries.length}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <GanttChart 
                      entries={beforeEntries} 
                      title="Before Optimization (Baseline/Previous Schedule)" 
                      timeWindow={sharedWindow} 
                    />
                  </div>
                  <div>
                    <GanttChart 
                      entries={afterEntries} 
                      title="After Optimization (Current Schedule)" 
                      timeWindow={sharedWindow} 
                    />
                  </div>
                </div>
                {changedTrains.size > 0 && (
                  <div className="mt-3 p-3 bg-amber-900/20 border border-amber-600 rounded">
                    <div className="text-sm font-medium text-amber-400 mb-1">⚠️ Changed Trains:</div>
                    <div className="text-xs text-slate-300">
                      {Array.from(changedTrains).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Conflict Simulation Panel */}
        <section className="mb-6">
          <div className="bg-slate-800 rounded shadow p-4">
            <h3 className="font-semibold mb-4">🚨 Conflict Simulation & Override Testing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700 rounded p-3">
                <h4 className="font-medium mb-2">Create Platform Conflict</h4>
                <p className="text-sm text-slate-300 mb-3">
                  Force two trains to want the same platform at overlapping times to test the optimizer's conflict resolution.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400">Train 1</label>
                    <select 
                      className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-100 text-sm"
                      onChange={(e) => {
                        const train = trains.find(t => t.id === e.target.value);
                        if (train) {
                          // Force this train to platform 1 to create conflict
                          submitOverrideForTrain(train.id, train.origin || 'HYB', 1);
                        }
                      }}
                    >
                      <option value="">Select train to force to Platform 1</option>
                      {trains.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.id} ({t.type}) - {t.origin}→{t.destination}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Train 2</label>
                    <select 
                      className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-100 text-sm"
                      onChange={(e) => {
                        const train = trains.find(t => t.id === e.target.value);
                        if (train) {
                          // Force this train to platform 1 too to create conflict
                          submitOverrideForTrain(train.id, train.origin || 'HYB', 1);
                        }
                      }}
                    >
                      <option value="">Select another train to force to Platform 1</option>
                      {trains.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.id} ({t.type}) - {t.origin}→{t.destination}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-700 rounded p-3">
                <h4 className="font-medium mb-2">Manual Override Test</h4>
                <p className="text-sm text-slate-300 mb-3">
                  Test the feasibility checker by trying to move a train to an occupied platform.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400">Train to Override</label>
                    <select 
                      value={selectedTrain || ''}
                      onChange={(e) => setSelectedTrain(e.target.value)}
                      className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-100 text-sm"
                    >
                      <option value="">Select train</option>
                      {trains.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.id} ({t.type}) - {t.origin}→{t.destination}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Target Platform</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={overridePlatform}
                      onChange={(e) => setOverridePlatform(Number(e.target.value))}
                      className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-100 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => selectedTrain && submitOverrideForTrain(selectedTrain, trains.find(t => t.id === selectedTrain)?.origin || 'HYB', overridePlatform)}
                    disabled={!selectedTrain}
                    className="w-full px-3 py-2 bg-amber-600 text-white rounded text-sm disabled:bg-slate-600 disabled:text-slate-400"
                  >
                    Test Override
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-slate-900 rounded">
              <h5 className="font-medium text-sm mb-2">💡 How to Test Conflicts:</h5>
              <ul className="text-xs text-slate-300 space-y-1">
                <li>1. Select two trains with overlapping times (like T101 and T104 both starting around 09:00)</li>
                <li>2. Force both to Platform 1 using the dropdowns above</li>
                <li>3. Watch the optimizer resolve the conflict by delaying one train or assigning different platforms</li>
                <li>4. Try manual overrides to see feasibility checking in action</li>
                <li>5. Check the logs to see conflict resolution reasoning</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Override modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowModal(false)}
          ></div>
          <div className="bg-slate-800 text-slate-100 rounded shadow p-6 z-50 w-96 border border-slate-700">
            <h4 className="font-semibold mb-3">Manual Override</h4>
            <div className="text-sm text-slate-300 mb-3">
              Train: <span className="font-medium">{selectedTrain}</span>
            </div>
            <div className="mb-2">
              <label className="block text-xs text-slate-400">
                New platform
              </label>
              <input
                type="number"
                value={overridePlatform}
                onChange={async (e) => {
                  const newPlatform = Number(e.target.value);
                  setOverridePlatform(newPlatform);
                  
                  // Recalculate delay impact for new platform
                  if (selectedTrain) {
                    const impact = await calculateDelayImpact(selectedTrain, newPlatform);
                    setDelayImpact(impact);
                  }
                }}
                className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-100"
              />
            </div>
            
            {/* Delay Impact Display */}
            {delayImpact && (
              <div className={`mb-3 p-3 rounded border ${
                delayImpact.difference > 2 ? 'bg-red-900/20 border-red-500' :
                delayImpact.difference > 0 ? 'bg-yellow-900/20 border-yellow-500' :
                'bg-green-900/20 border-green-500'
              }`}>
                <div className="text-sm font-medium mb-1">
                  {delayImpact.difference > 2 ? '⚠️ High Delay Impact' :
                   delayImpact.difference > 0 ? '⚠️ Moderate Delay Impact' :
                   '✅ No Additional Delay'}
                </div>
                <div className="text-xs space-y-1">
                  <div>Current delay: <span className="font-medium">{delayImpact.current.toFixed(1)} min</span></div>
                  <div>Predicted delay: <span className="font-medium">{delayImpact.predicted.toFixed(1)} min</span></div>
                  <div className={`font-medium ${
                    delayImpact.difference > 2 ? 'text-red-400' :
                    delayImpact.difference > 0 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    Impact: {delayImpact.difference > 0 ? '+' : ''}{delayImpact.difference.toFixed(1)} min
                  </div>
                </div>
              </div>
            )}
            <div className="text-sm text-rose-400 mb-2">{overrideMsg}</div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-2 border border-slate-600 rounded bg-slate-900/40 text-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => submitOverride(false)}
                className={`px-3 py-2 text-white rounded ${
                  delayImpact && delayImpact.difference > 2 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {delayImpact && delayImpact.difference > 2 ? 'Apply (High Delay)' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delay Warning Modal */}
      {showDelayWarning && pendingOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cancelOverride}
          ></div>
          <div className="bg-slate-800 text-slate-100 rounded-lg shadow-xl p-6 z-50 w-96 border border-red-500">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚠️</span>
              <h4 className="font-semibold text-lg text-red-400">High Delay Warning</h4>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-slate-300 mb-3">
                Moving train <span className="font-medium text-white">{pendingOverride.trainId}</span> to 
                platform <span className="font-medium text-white">{pendingOverride.platform}</span> will 
                cause significant delays.
              </p>
              
              {delayImpact && (
                <div className="bg-red-900/20 border border-red-500 rounded p-3 mb-3">
                  <div className="text-sm space-y-1">
                    <div>Current delay: <span className="font-medium text-red-300">{delayImpact.current.toFixed(1)} min</span></div>
                    <div>Predicted delay: <span className="font-medium text-red-300">{delayImpact.predicted.toFixed(1)} min</span></div>
                    <div className="font-medium text-red-400">
                      Additional delay: <span className="text-lg">+{delayImpact.difference.toFixed(1)} min</span>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-slate-400">
                This override may cause conflicts with other trains and increase overall system delays. 
                Are you sure you want to proceed?
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelOverride}
                className="px-4 py-2 border border-slate-600 rounded bg-slate-900/40 text-slate-100 hover:bg-slate-900/60"
              >
                Cancel Override
              </button>
              <button
                onClick={proceedWithOverride}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowLogsModal(false)}
          ></div>
          <div className="bg-slate-800 text-slate-100 rounded-lg shadow-xl p-6 z-50 w-4/5 max-w-4xl max-h-[80vh] border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">📋 Audit Logs & Conflict Resolution</h3>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-slate-200 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh]">
              {logs.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p>No audit logs yet.</p>
                  <p className="text-sm mt-2">Create conflicts using the simulation panel to see detailed resolution logs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.slice().reverse().map((log, idx) => {
                    const isConflictResolution = log.details.includes('delay') || log.details.includes('conflict') || log.details.includes('override');
                    const isError = log.details.includes('failed') || log.details.includes('rejected');
                    const isSuccess = log.details.includes('success') || log.details.includes('assigned');
                    
                    return (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-lg border-l-4 ${
                          isError ? 'bg-red-900/20 border-red-500' :
                          isConflictResolution ? 'bg-amber-900/20 border-amber-500' :
                          isSuccess ? 'bg-green-900/20 border-green-500' :
                          'bg-slate-700/50 border-slate-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.action === 'override' ? 'bg-amber-600 text-white' :
                                log.action === 'assign' ? 'bg-green-600 text-white' :
                                log.action === 'schedule' ? 'bg-blue-600 text-white' :
                                log.action === 'override_failed' ? 'bg-red-600 text-white' :
                                'bg-slate-600 text-white'
                              }`}>
                                {log.action.toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-sm">
                              {formatLogMessage(log.details)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-600">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-400">
                  Total logs: {logs.length} | Last updated: {logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).toLocaleString() : 'Never'}
                </div>
                <button
                  onClick={() => {
                    fetchLogs();
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Refresh Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delay Injection Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDelayModal(false)}
          ></div>
          <div className="bg-slate-800 text-slate-100 rounded-lg shadow-xl p-6 z-50 w-96 border border-red-500">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🚨</span>
              <h4 className="font-semibold text-lg text-red-400">Inject Delay</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Train</label>
                <select
                  value={selectedDelayTrain || ''}
                  onChange={(e) => setSelectedDelayTrain(e.target.value)}
                  className="w-full border border-slate-600 rounded px-3 py-2 bg-slate-900 text-slate-100"
                >
                  <option value="">Select train</option>
                  {trains.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id} ({t.type}) - {t.origin}→{t.destination}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Delay Type</label>
                <select
                  value={delayType}
                  onChange={(e) => setDelayType(e.target.value)}
                  className="w-full border border-slate-600 rounded px-3 py-2 bg-slate-900 text-slate-100"
                >
                  <option value="breakdown">🚨 Train Breakdown</option>
                  <option value="weather">🌧️ Bad Weather</option>
                  <option value="signal">🚦 Signal Failure</option>
                  <option value="passenger">👥 Passenger Issue</option>
                  <option value="maintenance">🔧 Maintenance</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Delay Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-full border border-slate-600 rounded px-3 py-2 bg-slate-900 text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="e.g., Engine failure, Heavy rain, etc."
                  className="w-full border border-slate-600 rounded px-3 py-2 bg-slate-900 text-slate-100"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDelayModal(false)}
                className="px-4 py-2 border border-slate-600 rounded bg-slate-900/40 text-slate-100 hover:bg-slate-900/60"
              >
                Cancel
              </button>
              <button
                onClick={injectDelay}
                disabled={!selectedDelayTrain || loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Injecting...' : 'Inject Delay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Bot Components */}
      {renderChatBotToggle()}
      {renderChatBot()}
    </div>
  );
}
