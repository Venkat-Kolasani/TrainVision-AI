"""Schedule recompute and read-only response building."""
from __future__ import annotations

import copy
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from conflict_detector import detect_conflicts
from ilp_optimizer import ilp_optimizer
from models import Conflict, LogEntry, OptimizerSettings, ScheduleEntry, Station, Train
from optimizer import greedy_optimizer, greedy_optimizer_with_delays


def ensure_baseline(
    trains: List[Train],
    stations: Dict[str, Station],
    baseline_schedule: List[ScheduleEntry],
    logs: List[LogEntry],
    legs_override: Optional[Dict[str, List[str]]] = None,
) -> List[ScheduleEntry]:
    if baseline_schedule:
        return baseline_schedule
    baseline = greedy_optimizer(trains, stations, {}, legs_override=legs_override)
    logs.append(
        LogEntry(
            timestamp=datetime.now(),
            action="baseline_created",
            details=f"Generated baseline schedule with {len(baseline)} assignments",
        )
    )
    return baseline


def recompute_schedule(
    trains: List[Train],
    stations: Dict[str, Station],
    fixed_overrides: Dict[str, int],
    active_delays: Dict[str, Dict],
    optimizer_settings: OptimizerSettings,
    old_schedule: List[ScheduleEntry],
    legs_override: Optional[Dict[str, List[str]]] = None,
) -> Tuple[List[ScheduleEntry], List[Conflict], dict]:
    if optimizer_settings.mode == "ilp":
        schedule = ilp_optimizer(
            trains, stations, fixed_overrides, active_delays, optimizer_settings, legs_override=legs_override
        )
    elif active_delays:
        schedule = greedy_optimizer_with_delays(
            trains, stations, fixed_overrides, active_delays, legs_override=legs_override
        )
    else:
        schedule = greedy_optimizer(trains, stations, fixed_overrides, legs_override=legs_override)

    conflicts, conflict_impact = detect_conflicts(trains, stations, schedule)

    changes = []
    if old_schedule:
        for new_entry in schedule:
            old_entry = next(
                (s for s in old_schedule if s.train_id == new_entry.train_id and s.station_id == new_entry.station_id),
                None,
            )
            if not old_entry or (
                old_entry.assigned_platform != new_entry.assigned_platform
                or old_entry.actual_arrival != new_entry.actual_arrival
            ):
                changes.append(
                    {
                        "train_id": new_entry.train_id,
                        "station_id": new_entry.station_id,
                        "old_platform": old_entry.assigned_platform if old_entry else "none",
                        "new_platform": new_entry.assigned_platform,
                        "reason": new_entry.reason,
                    }
                )

    step = {
        "timestamp": datetime.now().isoformat(),
        "overrides_applied": len(fixed_overrides),
        "schedule_changes": changes,
        "conflicts_resolved": 0,
        "conflict_impact": conflict_impact,
    }
    return schedule, conflicts, step


def build_schedule_payload(
    schedule: List[ScheduleEntry],
    baseline_schedule: List[ScheduleEntry],
    trains: List[Train],
    conflicts: List[Conflict],
) -> dict:
    delays_after: List[float] = []
    delays_before: List[float] = []
    reasons: List[str] = []

    for s in schedule:
        train = next((t for t in trains if t.id == s.train_id), None)
        if not train:
            continue
        delay_after = max(0.0, (s.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
        delays_after.append(delay_after)
        baseline_entry = next(
            (b for b in baseline_schedule if b.train_id == s.train_id and b.station_id == s.station_id),
            None,
        )
        if baseline_entry:
            delay_before = max(
                0.0, (baseline_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0
            )
        else:
            delay_before = 0.0
        delays_before.append(delay_before)
        reasons.append(s.reason)

    return {
        "schedule": schedule,
        "delays_after_min": delays_after,
        "delays_before_min": delays_before,
        "reasons": reasons,
        "conflicts": [c.dict() for c in conflicts],
    }
