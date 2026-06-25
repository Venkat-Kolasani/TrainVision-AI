export interface Train {
  id: string;
  type?: string;
  priority?: number;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  origin?: string;
  destination?: string;
  platform_pref?: number;
}

export interface ScheduleEntry {
  train_id: string;
  station_id: string;
  assigned_platform: number;
  actual_arrival: string;
  actual_departure: string;
  reason?: string;
}

export interface Station {
  id: string;
  platforms: number;
  station_code?: string;
  station_name?: string;
  latitude?: number;
  longitude?: number;
  is_junction?: boolean;
}

export interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

export type TrainStatus = 'on-time' | 'delayed' | 'overridden' | 'conflict';

export interface ActiveDelay {
  train_id: string;
  type: string;
  minutes: number;
  reason?: string;
}

export interface ConflictItem {
  id?: string;
  type?: string;
  station_id?: string;
  platform?: number;
  trains_involved?: string[];
  root_cause?: string;
  severity?: string;
  description?: string;
}

export interface ConflictsResponse {
  active_conflicts?: number;
  total_count?: number;
  conflicts?: ConflictItem[];
  conflict_log?: Array<{ type?: string; track?: string; trains?: string[]; timestamp?: string }>;
}

export interface Recommendation {
  id: string;
  action_type: string;
  description: string;
  train_id: string;
  station_id?: string;
  new_platform?: number;
  delay_minutes?: number;
  cost_benefit: {
    delay_reduction: number;
    conflicts_resolved: number;
    cost_score: number;
  };
  impact: {
    affected_trains: string[];
    total_delay_change: number;
  };
}
