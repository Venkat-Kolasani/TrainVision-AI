from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

class Station(BaseModel):
    id: str
    platforms: int

class Train(BaseModel):
    id: str
    type: str
    priority: int
    origin: str
    destination: str
    scheduled_arrival: datetime
    scheduled_departure: datetime
    platform_pref: Optional[int] = None

class ScheduleEntry(BaseModel):
    train_id: str
    station_id: str
    assigned_platform: int
    actual_arrival: datetime
    actual_departure: datetime
    reason: str

class OverrideRequest(BaseModel):
    train_id: str
    station_id: str
    new_platform: int
    action: Optional[Literal["change_platform"]] = "change_platform"
    reason: Optional[str] = None

class LogEntry(BaseModel):
    timestamp: datetime
    action: str
    details: str

class TrainDataset(BaseModel):
    trains: List[Train]

class ScheduleWithBaseline(BaseModel):
    schedule: List[ScheduleEntry]
    # per-train delay minutes after optimization
    delays_after_min: List[float]
    # per-train scheduled baseline delay (always 0; included for frontend graphing symmetry)
    delays_before_min: List[float]
    reasons: List[str]
    conflicts: Optional[List[dict]] = []

class FeasibilityRequest(BaseModel):
    train_id: str
    station_id: str
    new_platform: int
    action: Optional[Literal["change_platform"]] = "change_platform"

class FeasibilityResponse(BaseModel):
    status: Literal["ok", "warning", "rejected"]
    safety_score: float  # 0.0 to 1.0
    impact_score: float  # 0.0 to 1.0 (higher = more impact)
    conflicts: List[dict]
    alternatives: List[dict]
    delay_impact_minutes: float
    affected_trains: List[str]
    reasons: List[str]

class Conflict(BaseModel):
    id: str
    type: Literal["platform_overlap", "headway_violation", "priority_conflict"]
    station_id: str
    platform: Optional[int] = None
    trains_involved: List[str]
    root_cause: str
    severity: Literal["low", "medium", "high", "critical"]
    suggested_actions: List[str]

class Recommendation(BaseModel):
    id: str
    action_type: Literal["move_train", "delay_train", "swap_priority", "change_platform"]
    description: str
    train_id: str
    station_id: Optional[str] = None
    new_platform: Optional[int] = None
    delay_minutes: Optional[int] = None
    cost_benefit: dict  # {"delay_reduction": float, "conflicts_resolved": int, "cost_score": float}
    impact: dict  # {"affected_trains": List[str], "total_delay_change": float}

class SimulationRequest(BaseModel):
    scenario_type: Literal["delay", "priority", "breakdown", "weather"]
    train_id: Optional[str] = None
    delay_minutes: Optional[int] = None
    station_id: Optional[str] = None
    parameters: Optional[dict] = {}

class SimulationResponse(BaseModel):
    scenario_id: str
    predicted_schedule: List[ScheduleEntry]
    kpi_delta: dict
    conflicts_before: List[Conflict]
    conflicts_after: List[Conflict]
    recommendations: List[Recommendation]

class OptimizerSettings(BaseModel):
    mode: Literal["greedy", "ilp"] = "greedy"
    objective: Literal["minimize_delays", "minimize_conflicts", "balanced"] = "balanced"
    time_limit_seconds: Optional[int] = 30
