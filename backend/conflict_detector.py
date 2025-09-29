"""
Conflict detection and analysis system for train scheduling
"""
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from models import Train, Station, ScheduleEntry, Conflict
import uuid
import logging

logger = logging.getLogger(__name__)

class ConflictDetector:
    def __init__(self, trains: List[Train], stations: Dict[str, Station]):
        self.trains = trains
        self.stations = stations
        self.min_headway = 5  # minimum minutes between trains
        self.platform_buffer = 2  # minutes buffer for platform changes
        
    def detect_conflicts(self, schedule: List[ScheduleEntry]) -> List[Conflict]:
        """
        Detect all types of conflicts in the given schedule
        """
        conflicts = []
        
        # Group schedule entries by station
        by_station = {}
        for entry in schedule:
            if entry.station_id not in by_station:
                by_station[entry.station_id] = []
            by_station[entry.station_id].append(entry)
        
        # Detect conflicts for each station
        for station_id, entries in by_station.items():
            if station_id not in self.stations:
                continue
                
            station = self.stations[station_id]
            
            # Sort by arrival time
            entries.sort(key=lambda x: x.actual_arrival)
            
            # Detect platform overlap conflicts
            platform_conflicts = self._detect_platform_overlaps(station_id, entries)
            conflicts.extend(platform_conflicts)
            
            # Detect headway violations
            headway_conflicts = self._detect_headway_violations(station_id, entries)
            conflicts.extend(headway_conflicts)
            
            # Detect priority conflicts
            priority_conflicts = self._detect_priority_conflicts(station_id, entries)
            conflicts.extend(priority_conflicts)
        
        return conflicts
    
    def _detect_platform_overlaps(self, station_id: str, entries: List[ScheduleEntry]) -> List[Conflict]:
        """Detect trains assigned to same platform with overlapping times"""
        conflicts = []
        
        # Group by platform
        by_platform = {}
        for entry in entries:
            platform = entry.assigned_platform
            if platform not in by_platform:
                by_platform[platform] = []
            by_platform[platform].append(entry)
        
        # Check each platform for overlaps
        for platform, platform_entries in by_platform.items():
            if len(platform_entries) < 2:
                continue
            
            # Sort by arrival time
            platform_entries.sort(key=lambda x: x.actual_arrival)
            
            for i in range(len(platform_entries) - 1):
                current = platform_entries[i]
                next_entry = platform_entries[i + 1]
                
                # Check if current departure overlaps with next arrival
                if current.actual_departure > next_entry.actual_arrival:
                    overlap_minutes = (current.actual_departure - next_entry.actual_arrival).total_seconds() / 60
                    
                    # Get train priorities for severity assessment
                    current_train = self._get_train(current.train_id)
                    next_train = self._get_train(next_entry.train_id)
                    
                    severity = self._assess_overlap_severity(overlap_minutes, current_train, next_train)
                    
                    conflicts.append(Conflict(
                        id=str(uuid.uuid4()),
                        type="platform_overlap",
                        station_id=station_id,
                        platform=platform,
                        trains_involved=[current.train_id, next_entry.train_id],
                        root_cause=f"Platform {platform} double-booked: {current.train_id} departure ({current.actual_departure.strftime('%H:%M')}) overlaps with {next_entry.train_id} arrival ({next_entry.actual_arrival.strftime('%H:%M')}) by {overlap_minutes:.1f} minutes",
                        severity=severity,
                        suggested_actions=[
                            f"Move {next_entry.train_id} to available platform",
                            f"Delay {next_entry.train_id} by {overlap_minutes + self.platform_buffer:.0f} minutes",
                            f"Expedite {current.train_id} departure"
                        ]
                    ))
        
        return conflicts
    
    def _detect_headway_violations(self, station_id: str, entries: List[ScheduleEntry]) -> List[Conflict]:
        """Detect insufficient headway between consecutive trains"""
        conflicts = []
        
        # Group by platform and sort by time
        by_platform = {}
        for entry in entries:
            platform = entry.assigned_platform
            if platform not in by_platform:
                by_platform[platform] = []
            by_platform[platform].append(entry)
        
        for platform, platform_entries in by_platform.items():
            if len(platform_entries) < 2:
                continue
            
            platform_entries.sort(key=lambda x: x.actual_arrival)
            
            for i in range(len(platform_entries) - 1):
                current = platform_entries[i]
                next_entry = platform_entries[i + 1]
                
                # Calculate headway (time between current departure and next arrival)
                headway_minutes = (next_entry.actual_arrival - current.actual_departure).total_seconds() / 60
                
                if headway_minutes < self.min_headway:
                    current_train = self._get_train(current.train_id)
                    next_train = self._get_train(next_entry.train_id)
                    
                    severity = "high" if headway_minutes < 2 else "medium"
                    
                    conflicts.append(Conflict(
                        id=str(uuid.uuid4()),
                        type="headway_violation",
                        station_id=station_id,
                        platform=platform,
                        trains_involved=[current.train_id, next_entry.train_id],
                        root_cause=f"Insufficient headway on Platform {platform}: only {headway_minutes:.1f} minutes between {current.train_id} departure and {next_entry.train_id} arrival (minimum {self.min_headway} minutes required)",
                        severity=severity,
                        suggested_actions=[
                            f"Delay {next_entry.train_id} by {self.min_headway - headway_minutes + 1:.0f} minutes",
                            f"Move {next_entry.train_id} to different platform",
                            f"Expedite {current.train_id} departure by {self.min_headway - headway_minutes:.0f} minutes"
                        ]
                    ))
        
        return conflicts
    
    def _detect_priority_conflicts(self, station_id: str, entries: List[ScheduleEntry]) -> List[Conflict]:
        """Detect cases where lower priority trains are scheduled before higher priority ones"""
        conflicts = []
        
        # Sort by actual arrival time
        entries.sort(key=lambda x: x.actual_arrival)
        
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            
            current_train = self._get_train(current.train_id)
            next_train = self._get_train(next_entry.train_id)
            
            if not current_train or not next_train:
                continue
            
            # Check if lower priority train is scheduled before higher priority
            if (current_train.priority < next_train.priority and 
                current.actual_arrival < next_entry.actual_arrival):
                
                # Only flag if they're close in time (within 30 minutes)
                time_diff = (next_entry.actual_arrival - current.actual_arrival).total_seconds() / 60
                if time_diff <= 30:
                    conflicts.append(Conflict(
                        id=str(uuid.uuid4()),
                        type="priority_conflict",
                        station_id=station_id,
                        trains_involved=[current.train_id, next_entry.train_id],
                        root_cause=f"Priority inversion: {current.train_id} (priority {current_train.priority}) scheduled before {next_entry.train_id} (priority {next_train.priority}) with only {time_diff:.1f} minutes separation",
                        severity="medium" if time_diff > 15 else "high",
                        suggested_actions=[
                            f"Swap arrival order of {current.train_id} and {next_entry.train_id}",
                            f"Delay {current.train_id} to after {next_entry.train_id}",
                            f"Move {current.train_id} to different platform to allow {next_entry.train_id} priority"
                        ]
                    ))
        
        return conflicts
    
    def _assess_overlap_severity(self, overlap_minutes: float, train1: Optional[Train], train2: Optional[Train]) -> str:
        """Assess the severity of a platform overlap conflict"""
        if overlap_minutes > 10:
            return "critical"
        elif overlap_minutes > 5:
            return "high"
        elif overlap_minutes > 2:
            return "medium"
        else:
            return "low"
    
    def _get_train(self, train_id: str) -> Optional[Train]:
        """Get train object by ID"""
        return next((t for t in self.trains if t.id == train_id), None)
    
    def analyze_conflict_impact(self, conflicts: List[Conflict], schedule: List[ScheduleEntry]) -> Dict:
        """Analyze the overall impact of conflicts on the schedule"""
        total_conflicts = len(conflicts)
        critical_conflicts = len([c for c in conflicts if c.severity == "critical"])
        high_conflicts = len([c for c in conflicts if c.severity == "high"])
        
        # Calculate affected trains
        affected_trains = set()
        for conflict in conflicts:
            affected_trains.update(conflict.trains_involved)
        
        # Calculate potential delay impact
        total_delay_risk = 0
        for conflict in conflicts:
            if conflict.type == "platform_overlap":
                # Estimate delay needed to resolve overlap
                total_delay_risk += 10 if conflict.severity == "critical" else 5
            elif conflict.type == "headway_violation":
                total_delay_risk += self.min_headway
            elif conflict.type == "priority_conflict":
                total_delay_risk += 3
        
        return {
            "total_conflicts": total_conflicts,
            "by_severity": {
                "critical": critical_conflicts,
                "high": high_conflicts,
                "medium": len([c for c in conflicts if c.severity == "medium"]),
                "low": len([c for c in conflicts if c.severity == "low"])
            },
            "by_type": {
                "platform_overlap": len([c for c in conflicts if c.type == "platform_overlap"]),
                "headway_violation": len([c for c in conflicts if c.type == "headway_violation"]),
                "priority_conflict": len([c for c in conflicts if c.type == "priority_conflict"])
            },
            "affected_trains": list(affected_trains),
            "affected_train_count": len(affected_trains),
            "estimated_delay_risk_minutes": total_delay_risk,
            "safety_score": max(0, 1.0 - (critical_conflicts * 0.3 + high_conflicts * 0.2)),
            "efficiency_score": max(0, 1.0 - (total_conflicts * 0.1))
        }


def detect_conflicts(trains: List[Train], stations: Dict[str, Station], 
                    schedule: List[ScheduleEntry]) -> Tuple[List[Conflict], Dict]:
    """
    Main entry point for conflict detection
    Returns conflicts and impact analysis
    """
    detector = ConflictDetector(trains, stations)
    conflicts = detector.detect_conflicts(schedule)
    impact = detector.analyze_conflict_impact(conflicts, schedule)
    
    return conflicts, impact
