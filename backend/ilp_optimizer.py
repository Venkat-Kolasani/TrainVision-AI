"""
ILP-based optimizer using PuLP for optimal train scheduling
"""
import pulp
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from models import Train, Station, ScheduleEntry, OptimizerSettings
import logging

logger = logging.getLogger(__name__)

class ILPOptimizer:
    def __init__(self, trains: List[Train], stations: Dict[str, Station], settings: OptimizerSettings):
        self.trains = trains
        self.stations = stations
        self.settings = settings
        self.min_headway = 5  # minimum minutes between trains on same platform
        
    def optimize(self, fixed_platforms: Optional[Dict[str, int]] = None, 
                 active_delays: Optional[Dict[str, Dict]] = None) -> List[ScheduleEntry]:
        """
        Solve the train scheduling problem using Integer Linear Programming
        """
        try:
            return self._solve_ilp(fixed_platforms or {}, active_delays or {})
        except Exception as e:
            logger.error(f"ILP optimization failed: {e}")
            # Fallback to greedy optimizer
            from optimizer import greedy_optimizer
            return greedy_optimizer(self.trains, self.stations, fixed_platforms)
    
    def _solve_ilp(self, fixed_platforms: Dict[str, int], active_delays: Dict[str, Dict]) -> List[ScheduleEntry]:
        """
        Core ILP solver implementation
        """
        # Create the problem
        prob = pulp.LpProblem("TrainScheduling", pulp.LpMinimize)
        
        # Apply delays to trains
        modified_trains = self._apply_delays(active_delays)
        
        # Decision variables
        # x[t,s,p,slot] = 1 if train t is assigned to platform p at station s in time slot
        time_slots = self._generate_time_slots()
        
        x = {}  # (train_id, station_id, platform, slot) -> binary variable
        delay_vars = {}  # train_id -> continuous variable for delay
        
        # Create variables
        for train in modified_trains:
            station_id = train.origin
            if station_id not in self.stations:
                continue
                
            station = self.stations[station_id]
            delay_vars[train.id] = pulp.LpVariable(f"delay_{train.id}", lowBound=0, cat='Continuous')
            
            for platform in range(1, station.platforms + 1):
                for slot in time_slots:
                    var_name = f"x_{train.id}_{station_id}_{platform}_{slot}"
                    x[(train.id, station_id, platform, slot)] = pulp.LpVariable(var_name, cat='Binary')
        
        # Objective function: minimize total delays + conflict penalties
        delay_weight = 1.0
        conflict_weight = 10.0
        
        objective = pulp.lpSum([delay_weight * delay_vars[train.id] for train in modified_trains 
                               if train.id in delay_vars])
        
        # Add conflict penalties
        for station_id, station in self.stations.items():
            for platform in range(1, station.platforms + 1):
                for slot in range(len(time_slots) - 1):
                    # Penalty for overlapping assignments
                    overlapping_trains = []
                    for train in modified_trains:
                        if train.origin == station_id:
                            key = (train.id, station_id, platform, slot)
                            if key in x:
                                overlapping_trains.append(x[key])
                    
                    if len(overlapping_trains) > 1:
                        # Add penalty for multiple trains on same platform/slot
                        objective += conflict_weight * pulp.lpSum(overlapping_trains)
        
        prob += objective
        
        # Constraints
        
        # 1. Each train must be assigned to exactly one platform and time slot
        for train in modified_trains:
            station_id = train.origin
            if station_id not in self.stations:
                continue
                
            station = self.stations[station_id]
            assignment_vars = []
            
            for platform in range(1, station.platforms + 1):
                for slot in time_slots:
                    key = (train.id, station_id, platform, slot)
                    if key in x:
                        assignment_vars.append(x[key])
            
            if assignment_vars:
                prob += pulp.lpSum(assignment_vars) == 1, f"assign_{train.id}"
        
        # 2. Platform capacity constraints (no overlapping assignments)
        for station_id, station in self.stations.items():
            for platform in range(1, station.platforms + 1):
                for slot in time_slots:
                    platform_vars = []
                    for train in modified_trains:
                        if train.origin == station_id:
                            key = (train.id, station_id, platform, slot)
                            if key in x:
                                platform_vars.append(x[key])
                    
                    if platform_vars:
                        prob += pulp.lpSum(platform_vars) <= 1, f"capacity_{station_id}_{platform}_{slot}"
        
        # 3. Fixed platform constraints (overrides)
        for train_id, fixed_platform in fixed_platforms.items():
            train = next((t for t in modified_trains if t.id == train_id), None)
            if not train:
                continue
                
            station_id = train.origin
            if station_id not in self.stations:
                continue
            
            # Force assignment to fixed platform only
            for platform in range(1, self.stations[station_id].platforms + 1):
                if platform != fixed_platform:
                    for slot in time_slots:
                        key = (train_id, station_id, platform, slot)
                        if key in x:
                            prob += x[key] == 0, f"fixed_{train_id}_{platform}_{slot}"
        
        # 4. Delay calculation constraints
        for train in modified_trains:
            if train.id not in delay_vars:
                continue
                
            station_id = train.origin
            if station_id not in self.stations:
                continue
            
            station = self.stations[station_id]
            scheduled_slot = self._time_to_slot(train.scheduled_arrival)
            
            for platform in range(1, station.platforms + 1):
                for slot_idx, slot in enumerate(time_slots):
                    key = (train.id, station_id, platform, slot)
                    if key in x:
                        # If assigned to this slot, delay >= (slot - scheduled_slot) * slot_duration
                        slot_delay = max(0, (slot_idx - scheduled_slot) * 5)  # 5 min slots
                        prob += delay_vars[train.id] >= slot_delay * x[key], f"delay_{train.id}_{slot}"
        
        # 5. Minimum headway constraints
        for station_id, station in self.stations.items():
            for platform in range(1, station.platforms + 1):
                for slot in range(len(time_slots) - 1):
                    current_slot_vars = []
                    next_slot_vars = []
                    
                    for train in modified_trains:
                        if train.origin == station_id:
                            current_key = (train.id, station_id, platform, slot)
                            next_key = (train.id, station_id, platform, slot + 1)
                            
                            if current_key in x:
                                current_slot_vars.append(x[current_key])
                            if next_key in x:
                                next_slot_vars.append(x[next_key])
                    
                    # Ensure minimum headway between consecutive assignments
                    if current_slot_vars and next_slot_vars:
                        prob += pulp.lpSum(current_slot_vars) + pulp.lpSum(next_slot_vars) <= 1, \
                               f"headway_{station_id}_{platform}_{slot}"
        
        # Solve the problem
        solver = pulp.PULP_CBC_CMD(timeLimit=self.settings.time_limit_seconds, msg=0)
        prob.solve(solver)
        
        # Extract solution
        if prob.status == pulp.LpStatusOptimal:
            return self._extract_solution(x, delay_vars, modified_trains, time_slots)
        else:
            logger.warning(f"ILP solver status: {pulp.LpStatus[prob.status]}")
            # Fallback to greedy
            from optimizer import greedy_optimizer
            return greedy_optimizer(self.trains, self.stations, fixed_platforms)
    
    def _apply_delays(self, active_delays: Dict[str, Dict]) -> List[Train]:
        """Apply active delays to trains"""
        modified_trains = []
        for train in self.trains:
            modified_train = train.model_copy()
            
            if train.id in active_delays:
                delay_info = active_delays[train.id]
                delay_minutes = delay_info.get('delay_minutes', 0)
                
                modified_train.scheduled_arrival += timedelta(minutes=delay_minutes)
                modified_train.scheduled_departure += timedelta(minutes=delay_minutes)
            
            modified_trains.append(modified_train)
        
        return modified_trains
    
    def _generate_time_slots(self) -> List[int]:
        """Generate time slots for the optimization horizon"""
        # Create 5-minute time slots for 24 hours
        return list(range(0, 288))  # 24 * 60 / 5 = 288 slots
    
    def _time_to_slot(self, dt: datetime) -> int:
        """Convert datetime to time slot index"""
        # Convert to minutes from midnight
        minutes = dt.hour * 60 + dt.minute
        return minutes // 5  # 5-minute slots
    
    def _slot_to_time(self, slot: int, base_date: datetime) -> datetime:
        """Convert slot index to datetime"""
        minutes = slot * 5
        hours = minutes // 60
        mins = minutes % 60
        return base_date.replace(hour=hours, minute=mins, second=0, microsecond=0)
    
    def _extract_solution(self, x: Dict, delay_vars: Dict, trains: List[Train], 
                         time_slots: List[int]) -> List[ScheduleEntry]:
        """Extract the solution from the solved ILP"""
        schedule = []
        
        for train in trains:
            station_id = train.origin
            if station_id not in self.stations:
                continue
            
            # Find the assigned platform and time slot
            assigned_platform = None
            assigned_slot = None
            
            for platform in range(1, self.stations[station_id].platforms + 1):
                for slot in time_slots:
                    key = (train.id, station_id, platform, slot)
                    if key in x and x[key].varValue == 1:
                        assigned_platform = platform
                        assigned_slot = slot
                        break
                if assigned_platform:
                    break
            
            if assigned_platform and assigned_slot is not None:
                # Calculate actual arrival/departure times
                base_date = train.scheduled_arrival.replace(hour=0, minute=0, second=0, microsecond=0)
                actual_arrival = self._slot_to_time(assigned_slot, base_date)
                
                # Ensure arrival is not before scheduled
                if actual_arrival < train.scheduled_arrival:
                    actual_arrival = train.scheduled_arrival
                
                duration = train.scheduled_departure - train.scheduled_arrival
                actual_departure = actual_arrival + duration
                
                # Calculate delay
                delay_minutes = (actual_arrival - train.scheduled_arrival).total_seconds() / 60
                
                # Generate reason
                reason_parts = [f"ILP optimized to P{assigned_platform}"]
                if delay_minutes > 0:
                    reason_parts.append(f"delayed {delay_minutes:.1f}min")
                
                reason = ", ".join(reason_parts)
                
                schedule.append(ScheduleEntry(
                    train_id=train.id,
                    station_id=station_id,
                    assigned_platform=assigned_platform,
                    actual_arrival=actual_arrival,
                    actual_departure=actual_departure,
                    reason=reason
                ))
        
        return schedule


def ilp_optimizer(trains: List[Train], stations: Dict[str, Station], 
                  fixed_platforms: Optional[Dict[str, int]] = None,
                  active_delays: Optional[Dict[str, Dict]] = None,
                  settings: Optional[OptimizerSettings] = None) -> List[ScheduleEntry]:
    """
    Main entry point for ILP optimization
    """
    if settings is None:
        settings = OptimizerSettings(mode="ilp")
    
    optimizer = ILPOptimizer(trains, stations, settings)
    return optimizer.optimize(fixed_platforms, active_delays)
