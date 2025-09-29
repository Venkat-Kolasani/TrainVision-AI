"""
Intelligent recommendations engine for train scheduling decisions
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from models import Train, Station, ScheduleEntry, Conflict, Recommendation
from conflict_detector import detect_conflicts
import uuid
import logging

logger = logging.getLogger(__name__)

class RecommendationsEngine:
    def __init__(self, trains: List[Train], stations: Dict[str, Station]):
        self.trains = trains
        self.stations = stations
        
    def generate_recommendations(self, schedule: List[ScheduleEntry], 
                               conflicts: Optional[List[Conflict]] = None,
                               max_recommendations: int = 10) -> List[Recommendation]:
        """
        Generate actionable recommendations to improve the schedule
        """
        if conflicts is None:
            conflicts, _ = detect_conflicts(self.trains, self.stations, schedule)
        
        recommendations = []
        
        # Generate conflict resolution recommendations
        conflict_recs = self._generate_conflict_resolutions(schedule, conflicts)
        recommendations.extend(conflict_recs)
        
        # Generate optimization recommendations
        optimization_recs = self._generate_optimization_recommendations(schedule)
        recommendations.extend(optimization_recs)
        
        # Generate proactive recommendations
        proactive_recs = self._generate_proactive_recommendations(schedule)
        recommendations.extend(proactive_recs)
        
        # Score and rank recommendations
        scored_recs = self._score_recommendations(recommendations, schedule)
        
        # Return top N recommendations
        return sorted(scored_recs, key=lambda x: x.cost_benefit["cost_score"], reverse=True)[:max_recommendations]
    
    def _generate_conflict_resolutions(self, schedule: List[ScheduleEntry], 
                                     conflicts: List[Conflict]) -> List[Recommendation]:
        """Generate recommendations to resolve specific conflicts"""
        recommendations = []
        
        for conflict in conflicts:
            if conflict.type == "platform_overlap":
                recs = self._resolve_platform_overlap(schedule, conflict)
                recommendations.extend(recs)
            elif conflict.type == "headway_violation":
                recs = self._resolve_headway_violation(schedule, conflict)
                recommendations.extend(recs)
            elif conflict.type == "priority_conflict":
                recs = self._resolve_priority_conflict(schedule, conflict)
                recommendations.extend(recs)
        
        return recommendations
    
    def _resolve_platform_overlap(self, schedule: List[ScheduleEntry], 
                                conflict: Conflict) -> List[Recommendation]:
        """Generate recommendations to resolve platform overlap conflicts"""
        recommendations = []
        
        if len(conflict.trains_involved) != 2:
            return recommendations
        
        train1_id, train2_id = conflict.trains_involved
        train1_entry = next((e for e in schedule if e.train_id == train1_id), None)
        train2_entry = next((e for e in schedule if e.train_id == train2_id), None)
        
        if not train1_entry or not train2_entry:
            return recommendations
        
        station = self.stations.get(conflict.station_id)
        if not station:
            return recommendations
        
        # Option 1: Move second train to different platform
        available_platforms = self._find_available_platforms(
            schedule, conflict.station_id, train2_entry.actual_arrival, train2_entry.actual_departure
        )
        
        for platform in available_platforms:
            if platform != conflict.platform:
                recommendations.append(Recommendation(
                    id=str(uuid.uuid4()),
                    action_type="change_platform",
                    description=f"Move {train2_id} from Platform {conflict.platform} to Platform {platform}",
                    train_id=train2_id,
                    station_id=conflict.station_id,
                    new_platform=platform,
                    cost_benefit={
                        "delay_reduction": 0,
                        "conflicts_resolved": 1,
                        "cost_score": 0.8
                    },
                    impact={
                        "affected_trains": [train2_id],
                        "total_delay_change": 0
                    }
                ))
        
        # Option 2: Delay second train
        overlap_minutes = (train1_entry.actual_departure - train2_entry.actual_arrival).total_seconds() / 60
        delay_needed = int(overlap_minutes + 5)  # Add 5 min buffer
        
        recommendations.append(Recommendation(
            id=str(uuid.uuid4()),
            action_type="delay_train",
            description=f"Delay {train2_id} by {delay_needed} minutes to avoid platform conflict",
            train_id=train2_id,
            station_id=conflict.station_id,
            delay_minutes=delay_needed,
            cost_benefit={
                "delay_reduction": -delay_needed,
                "conflicts_resolved": 1,
                "cost_score": 0.6
            },
            impact={
                "affected_trains": [train2_id],
                "total_delay_change": delay_needed
            }
        ))
        
        return recommendations
    
    def _resolve_headway_violation(self, schedule: List[ScheduleEntry], 
                                 conflict: Conflict) -> List[Recommendation]:
        """Generate recommendations to resolve headway violations"""
        recommendations = []
        
        if len(conflict.trains_involved) != 2:
            return recommendations
        
        train1_id, train2_id = conflict.trains_involved
        train1_entry = next((e for e in schedule if e.train_id == train1_id), None)
        train2_entry = next((e for e in schedule if e.train_id == train2_id), None)
        
        if not train1_entry or not train2_entry:
            return recommendations
        
        # Calculate current headway
        current_headway = (train2_entry.actual_arrival - train1_entry.actual_departure).total_seconds() / 60
        min_headway = 5  # minutes
        delay_needed = int(min_headway - current_headway + 2)  # Add 2 min buffer
        
        # Option 1: Delay second train
        recommendations.append(Recommendation(
            id=str(uuid.uuid4()),
            action_type="delay_train",
            description=f"Delay {train2_id} by {delay_needed} minutes to ensure safe headway",
            train_id=train2_id,
            station_id=conflict.station_id,
            delay_minutes=delay_needed,
            cost_benefit={
                "delay_reduction": -delay_needed,
                "conflicts_resolved": 1,
                "cost_score": 0.7
            },
            impact={
                "affected_trains": [train2_id],
                "total_delay_change": delay_needed
            }
        ))
        
        # Option 2: Move second train to different platform
        available_platforms = self._find_available_platforms(
            schedule, conflict.station_id, train2_entry.actual_arrival, train2_entry.actual_departure
        )
        
        for platform in available_platforms:
            if platform != conflict.platform:
                recommendations.append(Recommendation(
                    id=str(uuid.uuid4()),
                    action_type="change_platform",
                    description=f"Move {train2_id} to Platform {platform} to avoid headway conflict",
                    train_id=train2_id,
                    station_id=conflict.station_id,
                    new_platform=platform,
                    cost_benefit={
                        "delay_reduction": 0,
                        "conflicts_resolved": 1,
                        "cost_score": 0.9
                    },
                    impact={
                        "affected_trains": [train2_id],
                        "total_delay_change": 0
                    }
                ))
        
        return recommendations
    
    def _resolve_priority_conflict(self, schedule: List[ScheduleEntry], 
                                 conflict: Conflict) -> List[Recommendation]:
        """Generate recommendations to resolve priority conflicts"""
        recommendations = []
        
        if len(conflict.trains_involved) != 2:
            return recommendations
        
        train1_id, train2_id = conflict.trains_involved
        train1 = self._get_train(train1_id)
        train2 = self._get_train(train2_id)
        
        if not train1 or not train2:
            return recommendations
        
        # Determine which train has higher priority
        if train1.priority > train2.priority:
            high_priority_train = train1_id
            low_priority_train = train2_id
        else:
            high_priority_train = train2_id
            low_priority_train = train1_id
        
        # Option 1: Swap priorities by delaying low priority train
        recommendations.append(Recommendation(
            id=str(uuid.uuid4()),
            action_type="swap_priority",
            description=f"Give priority to {high_priority_train} by delaying {low_priority_train}",
            train_id=low_priority_train,
            station_id=conflict.station_id,
            delay_minutes=10,
            cost_benefit={
                "delay_reduction": 0,
                "conflicts_resolved": 1,
                "cost_score": 0.8
            },
            impact={
                "affected_trains": [low_priority_train],
                "total_delay_change": 10
            }
        ))
        
        return recommendations
    
    def _generate_optimization_recommendations(self, schedule: List[ScheduleEntry]) -> List[Recommendation]:
        """Generate recommendations for general schedule optimization"""
        recommendations = []
        
        # Find trains with excessive delays
        for entry in schedule:
            train = self._get_train(entry.train_id)
            if not train:
                continue
            
            delay_minutes = (entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60
            
            if delay_minutes > 15:  # Significant delay
                # Look for better platform options
                available_platforms = self._find_available_platforms(
                    schedule, entry.station_id, train.scheduled_arrival, train.scheduled_departure
                )
                
                for platform in available_platforms:
                    if platform != entry.assigned_platform:
                        potential_delay_reduction = min(delay_minutes, 10)  # Estimate improvement
                        
                        recommendations.append(Recommendation(
                            id=str(uuid.uuid4()),
                            action_type="move_train",
                            description=f"Move {entry.train_id} to Platform {platform} to reduce delay",
                            train_id=entry.train_id,
                            station_id=entry.station_id,
                            new_platform=platform,
                            cost_benefit={
                                "delay_reduction": potential_delay_reduction,
                                "conflicts_resolved": 0,
                                "cost_score": 0.6
                            },
                            impact={
                                "affected_trains": [entry.train_id],
                                "total_delay_change": -potential_delay_reduction
                            }
                        ))
                        break  # Only suggest one alternative platform
        
        return recommendations
    
    def _generate_proactive_recommendations(self, schedule: List[ScheduleEntry]) -> List[Recommendation]:
        """Generate proactive recommendations to prevent future issues"""
        recommendations = []
        
        # Analyze platform utilization
        platform_usage = self._analyze_platform_utilization(schedule)
        
        for station_id, usage in platform_usage.items():
            station = self.stations.get(station_id)
            if not station:
                continue
            
            # Find overutilized platforms
            for platform, utilization in usage.items():
                if utilization > 0.8:  # Over 80% utilization
                    # Find trains that could be moved to less utilized platforms
                    station_entries = [e for e in schedule if e.station_id == station_id and e.assigned_platform == platform]
                    
                    for entry in station_entries[:2]:  # Limit to 2 suggestions per platform
                        # Find less utilized platforms
                        for alt_platform, alt_util in usage.items():
                            if alt_platform != platform and alt_util < 0.6:
                                recommendations.append(Recommendation(
                                    id=str(uuid.uuid4()),
                                    action_type="move_train",
                                    description=f"Move {entry.train_id} from overloaded Platform {platform} to Platform {alt_platform}",
                                    train_id=entry.train_id,
                                    station_id=station_id,
                                    new_platform=alt_platform,
                                    cost_benefit={
                                        "delay_reduction": 5,  # Estimated improvement
                                        "conflicts_resolved": 0,
                                        "cost_score": 0.5
                                    },
                                    impact={
                                        "affected_trains": [entry.train_id],
                                        "total_delay_change": 0
                                    }
                                ))
                                break
        
        return recommendations
    
    def _find_available_platforms(self, schedule: List[ScheduleEntry], station_id: str, 
                                arrival: datetime, departure: datetime) -> List[int]:
        """Find platforms available during the specified time window"""
        station = self.stations.get(station_id)
        if not station:
            return []
        
        available = []
        station_entries = [e for e in schedule if e.station_id == station_id]
        
        for platform in range(1, station.platforms + 1):
            platform_entries = [e for e in station_entries if e.assigned_platform == platform]
            
            # Check if platform is free during the time window
            is_available = True
            for entry in platform_entries:
                if not (departure <= entry.actual_arrival or arrival >= entry.actual_departure):
                    is_available = False
                    break
            
            if is_available:
                available.append(platform)
        
        return available
    
    def _analyze_platform_utilization(self, schedule: List[ScheduleEntry]) -> Dict[str, Dict[int, float]]:
        """Analyze platform utilization across all stations"""
        utilization = {}
        
        for station_id, station in self.stations.items():
            utilization[station_id] = {}
            station_entries = [e for e in schedule if e.station_id == station_id]
            
            for platform in range(1, station.platforms + 1):
                platform_entries = [e for e in station_entries if e.assigned_platform == platform]
                
                if not platform_entries:
                    utilization[station_id][platform] = 0.0
                    continue
                
                # Calculate total occupied time
                total_occupied_minutes = 0
                for entry in platform_entries:
                    duration = (entry.actual_departure - entry.actual_arrival).total_seconds() / 60
                    total_occupied_minutes += duration
                
                # Assume 24-hour operational window
                utilization[station_id][platform] = min(1.0, total_occupied_minutes / (24 * 60))
        
        return utilization
    
    def _score_recommendations(self, recommendations: List[Recommendation], 
                             schedule: List[ScheduleEntry]) -> List[Recommendation]:
        """Score recommendations based on impact and feasibility"""
        for rec in recommendations:
            # Base score from cost_benefit
            base_score = rec.cost_benefit.get("cost_score", 0.5)
            
            # Adjust based on delay impact
            delay_change = rec.impact.get("total_delay_change", 0)
            if delay_change < 0:  # Reduces delay
                base_score += 0.2
            elif delay_change > 10:  # Adds significant delay
                base_score -= 0.3
            
            # Adjust based on conflicts resolved
            conflicts_resolved = rec.cost_benefit.get("conflicts_resolved", 0)
            base_score += conflicts_resolved * 0.1
            
            # Adjust based on number of affected trains
            affected_count = len(rec.impact.get("affected_trains", []))
            if affected_count == 1:
                base_score += 0.1  # Prefer localized changes
            elif affected_count > 3:
                base_score -= 0.2  # Penalize wide-reaching changes
            
            # Update the cost_benefit score
            rec.cost_benefit["cost_score"] = max(0.0, min(1.0, base_score))
        
        return recommendations
    
    def _get_train(self, train_id: str) -> Optional[Train]:
        """Get train object by ID"""
        return next((t for t in self.trains if t.id == train_id), None)


def generate_recommendations(trains: List[Train], stations: Dict[str, Station], 
                           schedule: List[ScheduleEntry], conflicts: Optional[List[Conflict]] = None,
                           max_recommendations: int = 10) -> List[Recommendation]:
    """
    Main entry point for generating recommendations
    """
    engine = RecommendationsEngine(trains, stations)
    return engine.generate_recommendations(schedule, conflicts, max_recommendations)
