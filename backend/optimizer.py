from datetime import timedelta
from typing import List, Dict, Optional, Tuple
from models import Train, Station, ScheduleEntry
import logging
import copy

MAX_DELAY = 10  # minutes, after which we increase priority
logger = logging.getLogger(__name__)

def greedy_optimizer(trains: List[Train], stations: Dict[str, Station], fixed_platforms: Optional[Dict[str, int]] = None) -> List[ScheduleEntry]:
    schedule = []
    platform_usage = {st.id: {} for st in stations.values()}

    # Sort trains: Fixed overrides first (regardless of priority), then by priority and arrival time
    def sort_key(train):
        is_fixed = fixed_platforms and train.id in fixed_platforms
        if is_fixed:
            return (0, train.scheduled_arrival)  # Process fixed overrides first
        else:
            return (1, -train.priority, train.scheduled_arrival)  # Then normal priority order
    
    trains_sorted = sorted(trains, key=sort_key)

    for train in trains_sorted:
        station_id = train.origin
        
        # Skip if station doesn't exist in our stations dict
        if station_id not in stations:
            logger.warning(f"Station {station_id} not found for train {train.id}")
            continue
            
        # respect fixed platform override if provided
        is_override = fixed_platforms and train.id in fixed_platforms
        platform = (fixed_platforms or {}).get(train.id, train.platform_pref or 1)
        original_platform = train.platform_pref or 1
        arrival, departure = train.scheduled_arrival, train.scheduled_departure
        delay = 0
        attempts = 0
        conflicts_encountered = []

        assigned = False
        while not assigned and attempts < 50:  # Prevent infinite loops
            attempts += 1
            conflict = False
            conflict_with: Optional[str] = None
            conflicting_train = None
            
            # Initialize platform usage for this station if not exists
            if station_id not in platform_usage:
                platform_usage[station_id] = {}
                
            # check if platform free
            if platform in platform_usage[station_id]:
                for used_slot in platform_usage[station_id][platform]:
                    if not (departure <= used_slot[0] or arrival >= used_slot[1]):
                        conflict = True
                        # Find which train is using this slot
                        for existing in schedule:
                            if (existing.station_id == station_id and 
                                existing.assigned_platform == platform and
                                existing.actual_arrival == used_slot[0]):
                                conflicting_train = existing.train_id
                                break
                        conflict_with = f"conflicts with {conflicting_train or 'another train'}"
                        if conflicting_train:
                            conflicts_encountered.append(conflicting_train)
                        break

            if not conflict:
                # Assign here
                if platform not in platform_usage[station_id]:
                    platform_usage[station_id][platform] = []
                platform_usage[station_id][platform].append((arrival, departure))
                
                reason_bits = []
                if is_override:
                    reason_bits.append(f"OVERRIDE: fixed to P{platform} by controller")
                elif train.platform_pref and platform == train.platform_pref:
                    reason_bits.append(f"assigned to preferred P{platform}")
                elif train.platform_pref and platform != train.platform_pref:
                    reason_bits.append(f"moved from P{train.platform_pref} to P{platform}")
                else:
                    reason_bits.append(f"assigned to P{platform}")
                    
                if delay > 0:
                    reason_bits.append(f"delayed {delay} min")
                    if conflicts_encountered:
                        unique_conflicts = list(set(conflicts_encountered))
                        reason_bits.append(f"resolved conflicts with {', '.join(unique_conflicts)}")
                        
                if attempts > 1:
                    reason_bits.append(f"{attempts} attempts")
                    
                reason_text = ", ".join(reason_bits) or "assigned to earliest available slot"

                schedule.append(ScheduleEntry(
                    train_id=train.id,
                    station_id=station_id,
                    assigned_platform=platform,
                    actual_arrival=arrival,
                    actual_departure=departure,
                    reason=reason_text
                ))
                
                logger.info(f"Assigned {train.id} to {station_id} P{platform}, delay: {delay}min")
                assigned = True
            else:
                # Try next platform
                platform += 1
                if platform > stations[station_id].platforms:
                    # No platform free → delay
                    arrival += timedelta(minutes=2)
                    departure += timedelta(minutes=2)
                    platform = 1
                    delay += 2

                    # If delay > MAX_DELAY → increase effective priority
                    if delay >= MAX_DELAY:
                        # bump priority artificially
                        trains_sorted.sort(key=lambda t: (-(t.priority + 1), t.scheduled_arrival))
                        break  # restart loop for this train
    return schedule

def greedy_optimizer_with_delays(trains: List[Train], stations: Dict[str, Station], fixed_platforms: Optional[Dict[str, int]] = None, active_delays: Optional[Dict[str, Dict]] = None) -> List[ScheduleEntry]:
    """Enhanced greedy optimizer that handles injected delays"""
    schedule = []
    platform_usage = {st.id: {} for st in stations.values()}
    
    # Apply delays to trains
    modified_trains = []
    for train in trains:
        modified_train = copy.deepcopy(train)
        
        # Apply delay if exists
        if active_delays and train.id in active_delays:
            delay_info = active_delays[train.id]
            delay_minutes = delay_info.get('delay_minutes', 0)
            delay_type = delay_info.get('delay_type', 'unknown')
            
            # Apply delay to arrival and departure times
            modified_train.scheduled_arrival += timedelta(minutes=delay_minutes)
            modified_train.scheduled_departure += timedelta(minutes=delay_minutes)
            
            logger.info(f"Applied {delay_minutes}min {delay_type} delay to {train.id}")
        
        modified_trains.append(modified_train)
    
    # Sort trains: Fixed overrides first, then by priority and arrival time
    def sort_key(train):
        is_fixed = fixed_platforms and train.id in fixed_platforms
        if is_fixed:
            return (0, train.scheduled_arrival)  # Process fixed overrides first
        else:
            return (1, -train.priority, train.scheduled_arrival)  # Then normal priority order
    
    trains_sorted = sorted(modified_trains, key=sort_key)

    for train in trains_sorted:
        station_id = train.origin
        
        # Skip if station doesn't exist
        if station_id not in stations:
            logger.warning(f"Station {station_id} not found for train {train.id}")
            continue
            
        # Respect fixed platform override if provided
        is_override = fixed_platforms and train.id in fixed_platforms
        platform = (fixed_platforms or {}).get(train.id, train.platform_pref or 1)
        original_platform = train.platform_pref or 1
        arrival, departure = train.scheduled_arrival, train.scheduled_departure
        delay = 0
        attempts = 0
        conflicts_encountered = []
        
        # Check if this train has an active delay
        has_delay = active_delays and train.id in active_delays
        delay_reason = ""
        if has_delay:
            delay_info = active_delays[train.id]
            delay_reason = f" ({delay_info.get('delay_type', 'unknown')} delay: {delay_info.get('delay_minutes', 0)}min)"

        assigned = False
        while not assigned and attempts < 50:  # Prevent infinite loops
            attempts += 1
            conflict = False
            conflict_with: Optional[str] = None
            conflicting_train = None
            
            # Initialize platform usage for this station if not exists
            if station_id not in platform_usage:
                platform_usage[station_id] = {}
                
            # Check if platform is free
            if platform in platform_usage[station_id]:
                for used_slot in platform_usage[station_id][platform]:
                    if not (departure <= used_slot[0] or arrival >= used_slot[1]):
                        conflict = True
                        # Find which train is using this slot
                        for existing in schedule:
                            if (existing.station_id == station_id and 
                                existing.assigned_platform == platform and
                                existing.actual_arrival == used_slot[0]):
                                conflicting_train = existing.train_id
                                break
                        conflict_with = f"conflicts with {conflicting_train or 'another train'}"
                        if conflicting_train:
                            conflicts_encountered.append(conflicting_train)
                        break

            if not conflict:
                # Assign here
                if platform not in platform_usage[station_id]:
                    platform_usage[station_id][platform] = []
                platform_usage[station_id][platform].append((arrival, departure))
                
                reason_bits = []
                if is_override:
                    reason_bits.append(f"OVERRIDE: fixed to P{platform} by controller")
                elif train.platform_pref and platform == train.platform_pref:
                    reason_bits.append(f"assigned to preferred P{platform}")
                elif train.platform_pref and platform != train.platform_pref:
                    reason_bits.append(f"moved from P{train.platform_pref} to P{platform}")
                else:
                    reason_bits.append(f"assigned to P{platform}")
                    
                if delay > 0:
                    reason_bits.append(f"delayed {delay} min")
                    if conflicts_encountered:
                        unique_conflicts = list(set(conflicts_encountered))
                        reason_bits.append(f"resolved conflicts with {', '.join(unique_conflicts)}")
                
                # Add delay information
                if has_delay:
                    delay_info = active_delays[train.id]
                    reason_bits.append(f"DELAY: {delay_info.get('delay_type', 'unknown')} delay applied{delay_reason}")
                        
                if attempts > 1:
                    reason_bits.append(f"{attempts} attempts")
                    
                reason_text = ", ".join(reason_bits) or "assigned to earliest available slot"

                schedule.append(ScheduleEntry(
                    train_id=train.id,
                    station_id=station_id,
                    assigned_platform=platform,
                    actual_arrival=arrival,
                    actual_departure=departure,
                    reason=reason_text
                ))
                
                logger.info(f"Assigned {train.id} to {station_id} P{platform}, delay: {delay}min{delay_reason}")
                assigned = True
            else:
                # Try next platform
                platform += 1
                if platform > stations[station_id].platforms:
                    # No platform free → delay
                    arrival += timedelta(minutes=2)
                    departure += timedelta(minutes=2)
                    platform = 1
                    delay += 2

                    # If delay > MAX_DELAY → increase effective priority
                    if delay >= MAX_DELAY:
                        # bump priority artificially
                        trains_sorted.sort(key=lambda t: (-(t.priority + 1), t.scheduled_arrival))
                        break  # restart loop for this train
    return schedule