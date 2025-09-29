from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
import json
import asyncio
from typing import List, Dict, Optional
from models import Train, Station, ScheduleEntry, OverrideRequest, LogEntry, TrainDataset, ScheduleWithBaseline, BaseModel, FeasibilityRequest, FeasibilityResponse, Conflict, Recommendation, SimulationRequest, SimulationResponse, OptimizerSettings
from optimizer import greedy_optimizer, greedy_optimizer_with_delays
from ilp_optimizer import ilp_optimizer
from conflict_detector import detect_conflicts
from recommendations import generate_recommendations
import copy
import threading
import time
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

app = FastAPI(title="Rail Optimizer API", version="0.1.0")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(GEMINI_MODEL)
else:
    gemini_model = None
    print("Warning: GEMINI_API_KEY not found in environment variables")

# Load dataset
with open("data/prototype_trains.json") as f:
    dataset = json.load(f)

stations: Dict[str, Station] = {s["id"]: Station(**s) for s in dataset["stations"]}
trains: List[Train] = [Train(**t) for t in dataset["trains"]]

schedule: List[ScheduleEntry] = []
baseline_schedule: List[ScheduleEntry] = []
logs: List[LogEntry] = []
fixed_overrides: Dict[str, int] = {}
optimization_history: List[Dict] = []
current_conflicts: List[Conflict] = []
current_recommendations: List[Recommendation] = []
optimizer_settings = OptimizerSettings()
simulation_scenarios: Dict[str, Dict] = {}

@app.get("/trains")
def get_trains():
    return trains

@app.post("/trains")
def post_trains(payload: TrainDataset):
    global trains, schedule, baseline_schedule, fixed_overrides
    trains = payload.trains
    schedule = []
    baseline_schedule = []
    fixed_overrides = {}
    logs.append(LogEntry(timestamp=datetime.now(), action="dataset_loaded", details=f"Loaded {len(trains)} trains"))
    return {"message": "Dataset loaded", "train_count": len(trains)}

@app.get("/schedule", response_model=ScheduleWithBaseline)
def get_schedule():
    global schedule, baseline_schedule, optimization_history, current_conflicts
    
    # Generate baseline schedule (no overrides, simple assignment)
    if not baseline_schedule:
        baseline_schedule = greedy_optimizer(trains, stations, {})
        logs.append(LogEntry(
            timestamp=datetime.now(), 
            action="baseline_created", 
            details=f"Generated baseline schedule with {len(baseline_schedule)} train assignments"
        ))
        
        # Log baseline assignments
        for s in baseline_schedule:
            train = next((t for t in trains if t.id == s.train_id), None)
            if train:
                delay = (s.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0
                logs.append(LogEntry(
                    timestamp=datetime.now(),
                    action="baseline_assign",
                    details=f"Baseline: {s.train_id} → {s.station_id} P{s.assigned_platform}, delay {delay:.1f}min, reason: {s.reason}"
                ))
    
    # Generate optimized schedule with current overrides
    old_schedule = copy.deepcopy(schedule)
    
    # Use ILP optimizer if enabled, otherwise use greedy
    if optimizer_settings.mode == "ilp":
        schedule = ilp_optimizer(trains, stations, fixed_overrides, active_delays, optimizer_settings)
    else:
        schedule = greedy_optimizer(trains, stations, fixed_overrides)
    
    # Detect conflicts in the new schedule
    current_conflicts, conflict_impact = detect_conflicts(trains, stations, schedule)
    
    # Track optimization changes
    optimization_step = {
        "timestamp": datetime.now().isoformat(),
        "overrides_applied": len(fixed_overrides),
        "schedule_changes": [],
        "conflicts_resolved": 0
    }
    
    # Compare with previous schedule to detect changes
    if old_schedule:
        for new_entry in schedule:
            old_entry = next((s for s in old_schedule if s.train_id == new_entry.train_id), None)
            if not old_entry or old_entry.assigned_platform != new_entry.assigned_platform or old_entry.actual_arrival != new_entry.actual_arrival:
                optimization_step["schedule_changes"].append({
                    "train_id": new_entry.train_id,
                    "old_platform": old_entry.assigned_platform if old_entry else "none",
                    "new_platform": new_entry.assigned_platform,
                    "reason": new_entry.reason
                })
    
    optimization_history.append(optimization_step)
    
    logs.append(LogEntry(
        timestamp=datetime.now(), 
        action="schedule_optimized", 
        details=f"Generated optimized schedule with {len(fixed_overrides)} overrides, {len(optimization_step['schedule_changes'])} changes"
    ))

    # Compute delays for before/after comparison
    delays_after = []
    delays_before = []
    reasons = []
    
    for s in schedule:
        train = next((t for t in trains if t.id == s.train_id), None)
        if train:
            # After optimization delay
            delay_after = max(0.0, (s.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
            delays_after.append(delay_after)
            
            # Before optimization delay (from baseline)
            baseline_entry = next((b for b in baseline_schedule if b.train_id == s.train_id), None)
            if baseline_entry:
                delay_before = max(0.0, (baseline_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
                delays_before.append(delay_before)
            else:
                delays_before.append(0.0)
            
            reasons.append(s.reason)
            
            # Enhanced audit logging
            conflict_info = ""
            if "delayed" in s.reason:
                conflict_info = " [CONFLICT RESOLVED]"
            elif s.train_id in fixed_overrides:
                conflict_info = " [MANUAL OVERRIDE]"
            
            logs.append(LogEntry(
                timestamp=datetime.now(),
                action="final_assignment",
                details=f"✓ {s.train_id} ({train.type}, P{train.priority}) → {s.station_id} P{s.assigned_platform}, "
                       f"scheduled: {train.scheduled_arrival.strftime('%H:%M')}, "
                       f"actual: {s.actual_arrival.strftime('%H:%M')}, "
                       f"delay: {delay_after:.1f}min, reason: {s.reason}{conflict_info}"
            ))

    return {
        "schedule": schedule, 
        "delays_after_min": delays_after, 
        "delays_before_min": delays_before, 
        "reasons": reasons,
        "conflicts": [conflict.dict() for conflict in current_conflicts]
    }


@app.post("/override")
def override_schedule(req: OverrideRequest):
    global fixed_overrides, schedule, optimization_history
    
    # Log override request
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="override_requested",
        details=f"Controller requests: Move {req.train_id} to Platform {req.new_platform} at {req.station_id}"
    ))
    
    # ensure schedule exists or recompute baseline first
    if not schedule:
        schedule = greedy_optimizer(trains, stations)

    # Validate platform exists
    station = stations.get(req.station_id)
    if not station:
        logs.append(LogEntry(
            timestamp=datetime.now(),
            action="override_failed",
            details=f"❌ Override FAILED: Station {req.station_id} not found"
        ))
        raise HTTPException(status_code=404, detail="Station not found")
        
    if req.new_platform < 1 or req.new_platform > station.platforms:
        logs.append(LogEntry(
            timestamp=datetime.now(),
            action="override_failed",
            details=f"❌ Override FAILED: Platform {req.new_platform} invalid at {req.station_id} (only {station.platforms} platforms available)"
        ))
        raise HTTPException(status_code=400, detail="Invalid platform")

    # Store old assignment for comparison
    old_assignment = next((s for s in schedule if s.train_id == req.train_id), None)
    old_platform = old_assignment.assigned_platform if old_assignment else "none"
    
    # Apply the override immediately (controller decision is final)
    fixed_overrides[req.train_id] = req.new_platform
    
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="override_applied",
        details=f"🔧 Override APPLIED: {req.train_id} forced to P{req.new_platform} (was P{old_platform})"
    ))
    
    # Re-optimize with the forced override - optimizer will delay other trains if needed
    old_schedule = copy.deepcopy(schedule)
    new_schedule = greedy_optimizer(trains, stations, fixed_overrides)
    
    # Track conflicts caused by override
    conflicts_caused = []
    for new_entry in new_schedule:
        old_entry = next((s for s in old_schedule if s.train_id == new_entry.train_id), None)
        if old_entry and new_entry.train_id != req.train_id:
            # Check if this train was affected by the override
            if (old_entry.assigned_platform != new_entry.assigned_platform or 
                old_entry.actual_arrival != new_entry.actual_arrival):
                train = next((t for t in trains if t.id == new_entry.train_id), None)
                if train:
                    old_delay = (old_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0
                    new_delay = (new_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0
                    conflicts_caused.append({
                        "train_id": new_entry.train_id,
                        "old_platform": old_entry.assigned_platform,
                        "new_platform": new_entry.assigned_platform,
                        "delay_change": new_delay - old_delay
                    })
    
    # Log conflicts caused
    for conflict in conflicts_caused:
        if conflict["delay_change"] > 0:
            logs.append(LogEntry(
                timestamp=datetime.now(),
                action="conflict_resolution",
                details=f"⚠️  CONFLICT: {conflict['train_id']} moved P{conflict['old_platform']}→P{conflict['new_platform']}, +{conflict['delay_change']:.1f}min delay due to override"
            ))
        else:
            logs.append(LogEntry(
                timestamp=datetime.now(),
                action="conflict_resolution",
                details=f"🔄 REBALANCE: {conflict['train_id']} moved P{conflict['old_platform']}→P{conflict['new_platform']} due to override"
            ))
    
    # Commit the new schedule
    schedule = new_schedule
    reason_for_train = next((s.reason for s in schedule if s.train_id == req.train_id), "re-optimized")
    
    # Final success log
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="override_completed",
        details=f"✅ Override COMPLETED: {req.train_id} successfully assigned to P{req.new_platform}, {len(conflicts_caused)} other trains affected"
    ))
    
    return {
        "status": "success", 
        "message": "Override applied, schedule updated", 
        "reason": reason_for_train, 
        "conflicts_caused": len(conflicts_caused),
        "affected_trains": [c["train_id"] for c in conflicts_caused],
        "updated_schedule": schedule
    }

@app.get("/log")
def get_logs():
    return logs

@app.get("/optimization-history")
def get_optimization_history():
    """Get detailed optimization history for analysis"""
    return optimization_history

@app.get("/baseline")
def get_baseline():
    """Get the baseline schedule for comparison"""
    global baseline_schedule
    if not baseline_schedule:
        baseline_schedule = greedy_optimizer(trains, stations, {})
    return baseline_schedule

@app.post("/reset")
def reset_system():
    """Reset all overrides and regenerate baseline"""
    global schedule, baseline_schedule, fixed_overrides, logs, optimization_history
    
    # Clear all overrides
    old_overrides = len(fixed_overrides)
    fixed_overrides = {}
    
    # Clear schedules to force regeneration
    schedule = []
    baseline_schedule = []
    
    # Clear optimization history
    optimization_history = []
    
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="system_reset",
        details=f"🔄 SYSTEM RESET: Cleared {old_overrides} overrides, regenerating baseline schedule"
    ))
    
    return {"status": "success", "message": "System reset, all overrides cleared"}

@app.get("/stats")
def get_system_stats():
    """Get system statistics and KPIs"""
    total_trains = len(trains)
    active_overrides = len(fixed_overrides)
    total_logs = len(logs)
    
    # Calculate delays if schedule exists
    avg_delay = 0
    on_time_trains = 0
    if schedule:
        delays = []
        for s in schedule:
            train = next((t for t in trains if t.id == s.train_id), None)
            if train:
                delay = max(0.0, (s.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
                delays.append(delay)
                if delay == 0:
                    on_time_trains += 1
        avg_delay = sum(delays) / len(delays) if delays else 0
    
    return {
        "total_trains": total_trains,
        "active_overrides": active_overrides,
        "total_logs": total_logs,
        "avg_delay_minutes": round(avg_delay, 2),
        "on_time_percentage": round((on_time_trains / total_trains * 100), 1) if total_trains > 0 else 0,
        "optimization_runs": len(optimization_history)
    }

@app.get("/stations")
def get_stations():
    return list(stations.values())

@app.post("/simulate-override")
def simulate_override(req: OverrideRequest):
    """Simulate an override to predict its impact without applying it"""
    global schedule
    
    # Ensure schedule exists
    if not schedule:
        schedule = greedy_optimizer(trains, stations, {})
    
    # Validate platform exists
    station = stations.get(req.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
        
    if req.new_platform < 1 or req.new_platform > station.platforms:
        raise HTTPException(status_code=400, detail="Invalid platform")
    
    # Create a temporary override set including the simulation
    temp_overrides = copy.deepcopy(fixed_overrides)
    temp_overrides[req.train_id] = req.new_platform
    
    # Generate simulated schedule
    simulated_schedule = greedy_optimizer(trains, stations, temp_overrides)
    
    # Calculate impact metrics
    conflicts_predicted = []
    for sim_entry in simulated_schedule:
        current_entry = next((s for s in schedule if s.train_id == sim_entry.train_id), None)
        if current_entry and sim_entry.train_id != req.train_id:
            # Check if this train would be affected
            if (current_entry.assigned_platform != sim_entry.assigned_platform or 
                current_entry.actual_arrival != sim_entry.actual_arrival):
                train = next((t for t in trains if t.id == sim_entry.train_id), None)
                if train:
                    current_delay = max(0.0, (current_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
                    sim_delay = max(0.0, (sim_entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
                    conflicts_predicted.append({
                        "train_id": sim_entry.train_id,
                        "current_platform": current_entry.assigned_platform,
                        "predicted_platform": sim_entry.assigned_platform,
                        "current_delay": current_delay,
                        "predicted_delay": sim_delay,
                        "delay_change": sim_delay - current_delay
                    })
    
    # Calculate total delay impact
    total_current_delay = sum(c["current_delay"] for c in conflicts_predicted)
    total_predicted_delay = sum(c["predicted_delay"] for c in conflicts_predicted)
    
    # Get the specific train's impact
    target_train_current = next((s for s in schedule if s.train_id == req.train_id), None)
    target_train_simulated = next((s for s in simulated_schedule if s.train_id == req.train_id), None)
    
    target_impact = None
    if target_train_current and target_train_simulated:
        train = next((t for t in trains if t.id == req.train_id), None)
        if train:
            current_delay = max(0.0, (target_train_current.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
            predicted_delay = max(0.0, (target_train_simulated.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
            target_impact = {
                "current_delay": current_delay,
                "predicted_delay": predicted_delay,
                "delay_change": predicted_delay - current_delay
            }
    
    return {
        "status": "simulation_complete",
        "schedule": simulated_schedule,
        "target_train_impact": target_impact,
        "conflicts_predicted": conflicts_predicted,
        "total_delay_impact": total_predicted_delay - total_current_delay,
        "affected_trains_count": len(conflicts_predicted)
    }

# Delay injection models
class DelayInjectionRequest(BaseModel):
    train_id: str
    delay_type: str  # "breakdown", "weather", "signal", "passenger", "maintenance"
    delay_minutes: int
    reason: Optional[str] = None

class DelayInjectionResponse(BaseModel):
    status: str
    message: str
    applied_delay: int
    affected_trains: List[str]
    total_delay_impact: float

# Global delay tracking
active_delays: Dict[str, Dict] = {}

# WebSocket connection management
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove broken connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

# Train movement tracking
class TrainMovement:
    def __init__(self, train_id: str, from_station: str, to_station: str, 
                 start_time: datetime, end_time: datetime, status: str = "waiting"):
        self.train_id = train_id
        self.from_station = from_station
        self.to_station = to_station
        self.start_time = start_time
        self.end_time = end_time
        self.status = status  # "waiting", "moving", "arrived", "delayed"
        self.progress = 0.0  # 0.0 to 1.0
        self.current_position = from_station
        self.delay_minutes = 0

# Global train movements tracking
train_movements: Dict[str, TrainMovement] = {}
movement_thread = None
movement_running = False

# Track occupancy tracking
track_occupancy: Dict[str, Dict] = {}  # track_id -> {train_id, start_time, end_time}
conflict_log: List[Dict] = []

@app.post("/inject-delay", response_model=DelayInjectionResponse)
def inject_delay(req: DelayInjectionRequest):
    """Inject a delay into the system and re-optimize"""
    global schedule, active_delays
    
    # Validate train exists
    train = next((t for t in trains if t.id == req.train_id), None)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    
    # Store the delay
    active_delays[req.train_id] = {
        "delay_type": req.delay_type,
        "delay_minutes": req.delay_minutes,
        "reason": req.reason or f"{req.delay_type} delay",
        "timestamp": datetime.now()
    }
    
    # Log the delay injection
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="delay_injected",
        details=f"🚨 DELAY INJECTED: {req.train_id} - {req.delay_type} delay of {req.delay_minutes} minutes. Reason: {req.reason or 'System delay'}"
    ))
    
    # Re-optimize with delays
    old_schedule = copy.deepcopy(schedule)
    schedule = greedy_optimizer_with_delays(trains, stations, fixed_overrides, active_delays)
    
    # Calculate affected trains
    affected_trains = []
    total_delay_impact = 0
    
    for new_entry in schedule:
        old_entry = next((s for s in old_schedule if s.train_id == new_entry.train_id), None)
        if old_entry and new_entry.train_id != req.train_id:
            if (old_entry.actual_arrival != new_entry.actual_arrival or 
                old_entry.assigned_platform != new_entry.assigned_platform):
                affected_trains.append(new_entry.train_id)
                
                # Calculate delay impact
                train_obj = next((t for t in trains if t.id == new_entry.train_id), None)
                if train_obj:
                    old_delay = max(0.0, (old_entry.actual_arrival - train_obj.scheduled_arrival).total_seconds() / 60.0)
                    new_delay = max(0.0, (new_entry.actual_arrival - train_obj.scheduled_arrival).total_seconds() / 60.0)
                    total_delay_impact += (new_delay - old_delay)
    
    # Log optimization results
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="delay_optimization",
        details=f"🔄 DELAY OPTIMIZATION: {req.train_id} delay caused {len(affected_trains)} trains to be re-optimized. Total delay impact: +{total_delay_impact:.1f} minutes"
    ))
    
    return DelayInjectionResponse(
        status="success",
        message=f"Delay injected successfully. {len(affected_trains)} trains affected.",
        applied_delay=req.delay_minutes,
        affected_trains=affected_trains,
        total_delay_impact=total_delay_impact
    )

@app.get("/active-delays")
def get_active_delays():
    """Get all currently active delays"""
    return active_delays

@app.delete("/clear-delays")
def clear_all_delays():
    """Clear all active delays and re-optimize"""
    global active_delays, schedule
    
    old_delay_count = len(active_delays)
    active_delays = {}
    
    # Re-optimize without delays
    schedule = greedy_optimizer(trains, stations, fixed_overrides)
    
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="delays_cleared",
        details=f"🧹 DELAYS CLEARED: Removed {old_delay_count} active delays. System re-optimized to baseline."
    ))
    
    return {"status": "success", "message": f"Cleared {old_delay_count} delays", "cleared_count": old_delay_count}

# Conflict injection endpoint
@app.post("/inject-conflict")
def inject_conflict():
    """Inject a conflict by forcing two trains to the same platform"""
    global schedule, fixed_overrides
    
    # Find two trains that can be forced to the same platform
    available_trains = [t for t in trains if t.id not in fixed_overrides]
    if len(available_trains) < 2:
        return {
            "status": "conflict_rejected",
            "reason": "Not enough trains available for conflict injection"
        }
    
    # Select two trains with overlapping times
    train1 = available_trains[0]
    train2 = available_trains[1] if len(available_trains) > 1 else available_trains[0]
    
    # Force both to platform 1 at the same station
    station_id = train1.origin
    platform = 1
    
    # Store the conflict
    old_overrides = copy.deepcopy(fixed_overrides)
    fixed_overrides[train1.id] = platform
    fixed_overrides[train2.id] = platform
    
    # Log the conflict injection
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="conflict_injected",
        details=f"⚠️ CONFLICT INJECTED: Forced {train1.id} and {train2.id} to Platform {platform} at {station_id}"
    ))
    
    # Re-optimize with the conflict
    old_schedule = copy.deepcopy(schedule)
    schedule = greedy_optimizer(trains, stations, fixed_overrides)
    
    # Calculate impact
    affected_trains = []
    total_delay_impact = 0
    
    for new_entry in schedule:
        old_entry = next((s for s in old_schedule if s.train_id == new_entry.train_id), None)
        if old_entry and new_entry.train_id in [train1.id, train2.id]:
            if (old_entry.actual_arrival != new_entry.actual_arrival or 
                old_entry.assigned_platform != new_entry.assigned_platform):
                affected_trains.append(new_entry.train_id)
                
                # Calculate delay impact
                train_obj = next((t for t in trains if t.id == new_entry.train_id), None)
                if train_obj:
                    old_delay = max(0.0, (old_entry.actual_arrival - train_obj.scheduled_arrival).total_seconds() / 60.0)
                    new_delay = max(0.0, (new_entry.actual_arrival - train_obj.scheduled_arrival).total_seconds() / 60.0)
                    total_delay_impact += (new_delay - old_delay)
    
    # Log optimization results
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="conflict_optimization",
        details=f"🔄 CONFLICT OPTIMIZATION: {train1.id} and {train2.id} conflict caused {len(affected_trains)} trains to be re-optimized. Total delay impact: +{total_delay_impact:.1f} minutes"
    ))
    
    return {
        "status": "conflict_injected",
        "message": f"Conflict injected successfully. {len(affected_trains)} trains affected.",
        "applied_change": {
            "train_id": f"{train1.id}, {train2.id}",
            "station_id": station_id,
            "new_platform": platform
        },
        "optimization_result": {
            "affected_trains": len(affected_trains),
            "delay_increase": total_delay_impact
        }
    }

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"🔌 WebSocket connected: {len(manager.active_connections)} connections")
    try:
        while True:
            # Send current train positions
            positions = get_current_train_positions()
            message = json.dumps({
                "type": "train_positions",
                "data": positions,
                "timestamp": datetime.now().isoformat()
            })
            await manager.send_personal_message(message, websocket)
            await asyncio.sleep(1)  # Update every second
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"🔌 WebSocket disconnected: {len(manager.active_connections)} connections")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        manager.disconnect(websocket)

def get_current_train_positions():
    """Get current positions of all trains"""
    positions = []
    current_time = datetime.now()
    
    # Debug: Print movement count
    if len(train_movements) > 0:
        print(f"🚂 Active movements: {len(train_movements)}")
    
    for train_id, movement in train_movements.items():
        # Calculate progress based on current time
        if movement.status == "waiting":
            progress = 0.0
            position = movement.from_station
        elif movement.status == "moving":
            total_duration = (movement.end_time - movement.start_time).total_seconds()
            elapsed = (current_time - movement.start_time).total_seconds()
            progress = min(1.0, max(0.0, elapsed / total_duration)) if total_duration > 0 else 0.0
            
            if progress >= 1.0:
                movement.status = "arrived"
                movement.progress = 1.0
                position = movement.to_station
            else:
                position = f"{movement.from_station}→{movement.to_station}"
        else:  # arrived
            progress = 1.0
            position = movement.to_station
        
        positions.append({
            "train_id": train_id,
            "from_station": movement.from_station,
            "to_station": movement.to_station,
            "current_position": position,
            "progress": progress,
            "status": movement.status,
            "delay_minutes": movement.delay_minutes
        })
    
    return positions

def start_train_movement_simulation():
    """Start the train movement simulation thread"""
    global movement_running, movement_thread
    
    if movement_running:
        return
    
    movement_running = True
    
    def movement_loop():
        while movement_running:
            try:
                # Update train movements based on schedule
                update_train_movements()
                time.sleep(1)  # Update every second
            except Exception as e:
                print(f"Movement simulation error: {e}")
                time.sleep(1)
    
    movement_thread = threading.Thread(target=movement_loop, daemon=True)
    movement_thread.start()

def detect_track_conflicts():
    """Detect conflicts between trains on the same track"""
    global track_occupancy, conflict_log, train_movements
    
    conflicts = []
    current_time = datetime.now()
    
    # Clear old track occupancy
    for track_id in list(track_occupancy.keys()):
        if current_time > track_occupancy[track_id]['end_time']:
            del track_occupancy[track_id]
    
    # Check for conflicts in moving trains
    moving_trains = {tid: movement for tid, movement in train_movements.items() 
                    if movement.status == "moving"}
    
    for train_id, movement in moving_trains.items():
        # Create track identifier (from_station -> to_station)
        track_id = f"{movement.from_station}->{movement.to_station}"
        
        if track_id in track_occupancy:
            # Conflict detected!
            conflicting_train = track_occupancy[track_id]['train_id']
            conflicts.append({
                'track_id': track_id,
                'train1': train_id,
                'train2': conflicting_train,
                'timestamp': current_time.isoformat()
            })
            
            # Log the conflict
            conflict_log.append({
                'type': 'track_conflict',
                'track': track_id,
                'trains': [train_id, conflicting_train],
                'timestamp': current_time.isoformat(),
                'resolved': False
            })
            
            print(f"🚨 CONFLICT DETECTED: {train_id} and {conflicting_train} on track {track_id}")
        else:
            # Assign track to this train
            track_occupancy[track_id] = {
                'train_id': train_id,
                'start_time': movement.start_time,
                'end_time': movement.end_time
            }
    
    return conflicts

def resolve_conflicts(conflicts):
    """Resolve conflicts by re-optimizing and reassigning tracks"""
    global schedule, train_movements
    
    if not conflicts:
        return
    
    print(f"🔧 Resolving {len(conflicts)} conflicts...")
    
    for conflict in conflicts:
        train1_id = conflict['train1']
        train2_id = conflict['train2']
        track_id = conflict['track']
        
        # Get the movements
        movement1 = train_movements.get(train1_id)
        movement2 = train_movements.get(train2_id)
        
        if not movement1 or not movement2:
            continue
        
        # Determine which train has higher priority (earlier start time)
        if movement1.start_time < movement2.start_time:
            # Train1 has priority, delay Train2
            delay_minutes = 5  # 5 minute delay
            movement2.start_time += timedelta(minutes=delay_minutes)
            movement2.end_time += timedelta(minutes=delay_minutes)
            movement2.delay_minutes += delay_minutes
            
            print(f"⏰ Delayed {train2_id} by {delay_minutes} minutes due to conflict with {train1_id}")
            
            # Log the resolution
            conflict_log.append({
                'type': 'conflict_resolved',
                'track': track_id,
                'delayed_train': train2_id,
                'priority_train': train1_id,
                'delay_minutes': delay_minutes,
                'timestamp': datetime.now().isoformat()
            })
        else:
            # Train2 has priority, delay Train1
            delay_minutes = 5
            movement1.start_time += timedelta(minutes=delay_minutes)
            movement1.end_time += timedelta(minutes=delay_minutes)
            movement1.delay_minutes += delay_minutes
            
            print(f"⏰ Delayed {train1_id} by {delay_minutes} minutes due to conflict with {train2_id}")
            
            # Log the resolution
            conflict_log.append({
                'type': 'conflict_resolved',
                'track': track_id,
                'delayed_train': train1_id,
                'priority_train': train2_id,
                'delay_minutes': delay_minutes,
                'timestamp': datetime.now().isoformat()
            })

def update_train_movements():
    """Update train movements based on current schedule"""
    global train_movements, schedule, trains
    
    current_time = datetime.now()
    
    # Clear old movements
    to_remove = []
    for train_id, movement in train_movements.items():
        if movement.status == "arrived" and (current_time - movement.end_time).total_seconds() > 300:  # 5 minutes
            to_remove.append(train_id)
    
    for train_id in to_remove:
        del train_movements[train_id]
    
    # Create movements for all trains in schedule
    for entry in schedule:
        train_id = entry.train_id
        train = next((t for t in trains if t.id == train_id), None)
        if not train:
            continue
        
        arrival_time = entry.actual_arrival
        departure_time = entry.actual_departure
        
        # Create or update movement for this train
        if train_id not in train_movements:
            # Create new movement
            if current_time < arrival_time:
                # Train hasn't arrived yet
                train_movements[train_id] = TrainMovement(
                    train_id=train_id,
                    from_station=train.origin,
                    to_station=entry.station_id,
                    start_time=arrival_time - timedelta(minutes=15),  # 15 min journey
                    end_time=arrival_time,
                    status="moving"
                )
            elif current_time >= arrival_time and current_time <= departure_time:
                # Train is at station
                train_movements[train_id] = TrainMovement(
                    train_id=train_id,
                    from_station=entry.station_id,
                    to_station=train.destination,
                    start_time=departure_time,
                    end_time=departure_time + timedelta(minutes=15),
                    status="waiting"
                )
            else:
                # Train should be moving to next station
                train_movements[train_id] = TrainMovement(
                    train_id=train_id,
                    from_station=entry.station_id,
                    to_station=train.destination,
                    start_time=departure_time,
                    end_time=departure_time + timedelta(minutes=15),
                    status="moving"
                )
        else:
            # Update existing movement
            movement = train_movements[train_id]
            
            if movement.status == "waiting" and current_time >= departure_time:
                movement.status = "moving"
                movement.start_time = departure_time
                movement.end_time = departure_time + timedelta(minutes=15)
            elif movement.status == "moving":
                # Check if journey is complete
                if current_time >= movement.end_time:
                    movement.status = "arrived"
                    movement.progress = 1.0
    
    # Detect and resolve conflicts
    conflicts = detect_track_conflicts()
    if conflicts:
        resolve_conflicts(conflicts)

@app.get("/train-positions")
def get_train_positions():
    """Get current train positions for REST API"""
    return get_current_train_positions()

@app.post("/start-movement-simulation")
def start_simulation():
    """Start the train movement simulation"""
    global movement_running
    if not movement_running:
        start_train_movement_simulation()
        print("🚂 Train movement simulation started")
    return {"status": "success", "message": "Train movement simulation started"}

@app.post("/stop-movement-simulation")
def stop_simulation():
    """Stop the train movement simulation"""
    global movement_running
    movement_running = False
    return {"status": "success", "message": "Train movement simulation stopped"}

@app.post("/create-test-movements")
def create_test_movements():
    """Create some test train movements for demonstration"""
    global train_movements
    current_time = datetime.now()
    
    # Create test movements for all trains in schedule
    for entry in schedule[:3]:  # Only first 3 trains for demo
        train_id = entry.train_id
        train = next((t for t in trains if t.id == train_id), None)
        if train:
            # Create a movement that starts now and ends in 2 minutes
            train_movements[train_id] = TrainMovement(
                train_id=train_id,
                from_station=entry.station_id,
                to_station=train.destination,
                start_time=current_time,
                end_time=current_time + timedelta(minutes=2),
                status="moving"
            )
    
    return {"status": "success", "message": f"Created {len(train_movements)} test movements"}

@app.post("/force-conflict")
def force_conflict():
    """Force a conflict by putting two trains on the same track"""
    global train_movements
    current_time = datetime.now()
    
    # Get first two trains from schedule
    if len(schedule) < 2:
        return {"status": "error", "message": "Need at least 2 trains to create conflict"}
    
    train1_entry = schedule[0]
    train2_entry = schedule[1]
    
    # Create movements for both trains on the same track
    train_movements[train1_entry.train_id] = TrainMovement(
        train_id=train1_entry.train_id,
        from_station=train1_entry.station_id,
        to_station="SC",  # Force same destination
        start_time=current_time,
        end_time=current_time + timedelta(minutes=2),
        status="moving"
    )
    
    train_movements[train2_entry.train_id] = TrainMovement(
        train_id=train2_entry.train_id,
        from_station=train2_entry.station_id,
        to_station="SC",  # Force same destination
        start_time=current_time,
        end_time=current_time + timedelta(minutes=2),
        status="moving"
    )
    
    return {"status": "success", "message": f"Forced conflict between {train1_entry.train_id} and {train2_entry.train_id}"}

@app.get("/conflicts")
def get_conflicts():
    """Get current conflicts and conflict log"""
    return {
        "active_conflicts": len(detect_track_conflicts()),
        "conflict_log": conflict_log[-10:],  # Last 10 conflicts
        "track_occupancy": track_occupancy
    }

@app.get("/track-status")
def get_track_status():
    """Get current track status and occupancy"""
    return {
        "track_occupancy": track_occupancy,
        "active_movements": len(train_movements),
        "conflicts_detected": len(detect_track_conflicts())
    }

# ==================== ADVANCED FEATURES ====================

@app.post("/feasibility", response_model=FeasibilityResponse)
def check_feasibility(req: FeasibilityRequest):
    """
    Check feasibility of a proposed override before applying it
    Simulates the override and returns safety/impact assessment
    """
    global schedule, trains, stations, fixed_overrides, active_delays
    
    # Ensure schedule exists
    if not schedule:
        if optimizer_settings.mode == "ilp":
            schedule = ilp_optimizer(trains, stations, fixed_overrides, active_delays, optimizer_settings)
        else:
            schedule = greedy_optimizer(trains, stations, fixed_overrides)
    
    # Validate platform exists
    station = stations.get(req.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
        
    if req.new_platform < 1 or req.new_platform > station.platforms:
        raise HTTPException(status_code=400, detail="Invalid platform")
    
    # Create temporary override set including the proposed change
    temp_overrides = copy.deepcopy(fixed_overrides)
    temp_overrides[req.train_id] = req.new_platform
    
    # Generate simulated schedule
    if optimizer_settings.mode == "ilp":
        simulated_schedule = ilp_optimizer(trains, stations, temp_overrides, active_delays, optimizer_settings)
    else:
        simulated_schedule = greedy_optimizer(trains, stations, temp_overrides)
    
    # Detect conflicts in both current and simulated schedules
    current_conflicts_list, current_impact = detect_conflicts(trains, stations, schedule)
    simulated_conflicts, simulated_impact = detect_conflicts(trains, stations, simulated_schedule)
    
    # Calculate impact metrics
    conflicts_before = len(current_conflicts_list)
    conflicts_after = len(simulated_conflicts)
    safety_score = simulated_impact.get("safety_score", 0.8)
    
    # Calculate delay impact
    current_delays = {}
    simulated_delays = {}
    
    for entry in schedule:
        train = next((t for t in trains if t.id == entry.train_id), None)
        if train:
            delay = max(0.0, (entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
            current_delays[entry.train_id] = delay
    
    for entry in simulated_schedule:
        train = next((t for t in trains if t.id == entry.train_id), None)
        if train:
            delay = max(0.0, (entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
            simulated_delays[entry.train_id] = delay
    
    total_delay_change = sum(simulated_delays.values()) - sum(current_delays.values())
    
    # Find affected trains
    affected_trains = []
    for train_id in set(current_delays.keys()) | set(simulated_delays.keys()):
        current_delay = current_delays.get(train_id, 0)
        simulated_delay = simulated_delays.get(train_id, 0)
        if abs(simulated_delay - current_delay) > 1:  # More than 1 minute change
            affected_trains.append(train_id)
    
    # Generate alternatives
    alternatives = []
    for platform in range(1, station.platforms + 1):
        if platform != req.new_platform:
            # Check if this platform would be better
            alt_temp_overrides = copy.deepcopy(fixed_overrides)
            alt_temp_overrides[req.train_id] = platform
            
            try:
                if optimizer_settings.mode == "ilp":
                    alt_schedule = ilp_optimizer(trains, stations, alt_temp_overrides, active_delays, optimizer_settings)
                else:
                    alt_schedule = greedy_optimizer(trains, stations, alt_temp_overrides)
                
                alt_conflicts, alt_impact = detect_conflicts(trains, stations, alt_schedule)
                
                if len(alt_conflicts) <= conflicts_after:
                    alternatives.append({
                        "platform": platform,
                        "conflicts": len(alt_conflicts),
                        "safety_score": alt_impact.get("safety_score", 0.8),
                        "description": f"Alternative: Platform {platform} with {len(alt_conflicts)} conflicts"
                    })
            except Exception as e:
                logger.error(f"Error evaluating alternative platform {platform}: {e}")
    
    # Determine status
    if safety_score < 0.5 or conflicts_after > conflicts_before + 2:
        status = "rejected"
    elif safety_score < 0.7 or conflicts_after > conflicts_before:
        status = "warning"
    else:
        status = "ok"
    
    # Calculate impact score (0-1, higher = more impact)
    impact_score = min(1.0, (len(affected_trains) * 0.2) + (abs(total_delay_change) * 0.1))
    
    reasons = []
    if conflicts_after > conflicts_before:
        reasons.append(f"Would create {conflicts_after - conflicts_before} additional conflicts")
    if total_delay_change > 10:
        reasons.append(f"Would increase total delays by {total_delay_change:.1f} minutes")
    if safety_score < 0.7:
        reasons.append("Safety concerns due to platform conflicts")
    if len(affected_trains) > 3:
        reasons.append(f"Would affect {len(affected_trains)} other trains")
    
    if not reasons:
        reasons.append("Override appears feasible with minimal impact")
    
    return FeasibilityResponse(
        status=status,
        safety_score=safety_score,
        impact_score=impact_score,
        conflicts=[conflict.dict() for conflict in simulated_conflicts],
        alternatives=alternatives,
        delay_impact_minutes=total_delay_change,
        affected_trains=affected_trains,
        reasons=reasons
    )

@app.get("/conflicts")
def get_current_conflicts():
    """Get current conflicts with detailed explanations"""
    global current_conflicts, schedule
    
    if not schedule:
        return {"conflicts": [], "impact": {}}
    
    # Refresh conflicts
    conflicts, impact = detect_conflicts(trains, stations, schedule)
    
    return {
        "conflicts": [conflict.dict() for conflict in conflicts],
        "impact": impact,
        "total_count": len(conflicts),
        "by_severity": impact.get("by_severity", {}),
        "by_type": impact.get("by_type", {})
    }

@app.get("/recommendations", response_model=List[Recommendation])
def get_recommendations(max_recommendations: int = 10):
    """
    Get intelligent recommendations for improving the schedule
    """
    global schedule, current_conflicts
    
    if not schedule:
        return []
    
    # Generate recommendations
    recommendations = generate_recommendations(
        trains, stations, schedule, current_conflicts, max_recommendations
    )
    
    # Update global recommendations
    global current_recommendations
    current_recommendations = recommendations
    
    return recommendations

@app.post("/apply-recommendation")
def apply_recommendation(recommendation_id: str):
    """Apply a specific recommendation"""
    global current_recommendations, fixed_overrides, active_delays
    
    # Find the recommendation
    recommendation = next((r for r in current_recommendations if r.id == recommendation_id), None)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    try:
        if recommendation.action_type == "change_platform":
            # Apply platform change as override
            fixed_overrides[recommendation.train_id] = recommendation.new_platform
            
        elif recommendation.action_type == "delay_train":
            # Apply delay
            if recommendation.delay_minutes:
                if recommendation.train_id not in active_delays:
                    active_delays[recommendation.train_id] = {}
                active_delays[recommendation.train_id].update({
                    "delay_type": "recommendation",
                    "delay_minutes": recommendation.delay_minutes,
                    "reason": f"Applied recommendation: {recommendation.description}",
                    "timestamp": datetime.now()
                })
        
        elif recommendation.action_type == "move_train":
            # Apply platform move
            if recommendation.new_platform:
                fixed_overrides[recommendation.train_id] = recommendation.new_platform
        
        # Log the action
        logs.append(LogEntry(
            timestamp=datetime.now(),
            action="recommendation_applied",
            details=f"Applied recommendation: {recommendation.description}"
        ))
        
        return {
            "status": "success",
            "message": f"Applied recommendation: {recommendation.description}",
            "recommendation_id": recommendation_id
        }
        
    except Exception as e:
        logger.error(f"Error applying recommendation {recommendation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply recommendation: {str(e)}")

@app.post("/simulate/delay", response_model=SimulationResponse)
def simulate_delay_scenario(req: SimulationRequest):
    """Simulate a delay scenario and return predicted impact"""
    return _run_simulation(req)

@app.post("/simulate/priority", response_model=SimulationResponse)
def simulate_priority_scenario(req: SimulationRequest):
    """Simulate a priority change scenario"""
    return _run_simulation(req)

@app.post("/simulate/breakdown", response_model=SimulationResponse)
def simulate_breakdown_scenario(req: SimulationRequest):
    """Simulate a train breakdown scenario"""
    return _run_simulation(req)

@app.post("/simulate/weather", response_model=SimulationResponse)
def simulate_weather_scenario(req: SimulationRequest):
    """Simulate weather impact scenario"""
    return _run_simulation(req)

def _run_simulation(req: SimulationRequest) -> SimulationResponse:
    """Core simulation logic"""
    import uuid
    
    scenario_id = str(uuid.uuid4())
    
    # Store current state
    original_delays = copy.deepcopy(active_delays)
    original_overrides = copy.deepcopy(fixed_overrides)
    
    try:
        # Apply scenario parameters
        temp_delays = copy.deepcopy(active_delays)
        temp_overrides = copy.deepcopy(fixed_overrides)
        
        if req.scenario_type == "delay" and req.train_id and req.delay_minutes:
            temp_delays[req.train_id] = {
                "delay_type": req.scenario_type,
                "delay_minutes": req.delay_minutes,
                "reason": f"Simulated {req.scenario_type} scenario",
                "timestamp": datetime.now()
            }
        
        elif req.scenario_type == "breakdown" and req.train_id:
            # Simulate breakdown as significant delay
            breakdown_delay = req.delay_minutes or 60
            temp_delays[req.train_id] = {
                "delay_type": "breakdown",
                "delay_minutes": breakdown_delay,
                "reason": "Simulated train breakdown",
                "timestamp": datetime.now()
            }
        
        elif req.scenario_type == "weather":
            # Apply weather delays to multiple trains
            weather_delay = req.delay_minutes or 15
            for train in trains[:3]:  # Affect first 3 trains
                temp_delays[train.id] = {
                    "delay_type": "weather",
                    "delay_minutes": weather_delay,
                    "reason": "Simulated weather delay",
                    "timestamp": datetime.now()
                }
        
        # Generate predicted schedule
        if optimizer_settings.mode == "ilp":
            predicted_schedule = ilp_optimizer(trains, stations, temp_overrides, temp_delays, optimizer_settings)
        else:
            predicted_schedule = greedy_optimizer_with_delays(trains, stations, temp_overrides, temp_delays)
        
        # Detect conflicts before and after
        current_conflicts_list, current_impact = detect_conflicts(trains, stations, schedule)
        predicted_conflicts, predicted_impact = detect_conflicts(trains, stations, predicted_schedule)
        
        # Calculate KPI deltas
        kpi_delta = {
            "total_delay_change": predicted_impact.get("estimated_delay_risk_minutes", 0) - current_impact.get("estimated_delay_risk_minutes", 0),
            "conflicts_change": len(predicted_conflicts) - len(current_conflicts_list),
            "safety_score_change": predicted_impact.get("safety_score", 0.8) - current_impact.get("safety_score", 0.8),
            "affected_trains": predicted_impact.get("affected_train_count", 0)
        }
        
        # Generate recommendations for the scenario
        scenario_recommendations = generate_recommendations(
            trains, stations, predicted_schedule, predicted_conflicts, 5
        )
        
        # Store scenario
        simulation_scenarios[scenario_id] = {
            "request": req.dict(),
            "predicted_schedule": [entry.dict() for entry in predicted_schedule],
            "kpi_delta": kpi_delta,
            "timestamp": datetime.now().isoformat()
        }
        
        return SimulationResponse(
            scenario_id=scenario_id,
            predicted_schedule=predicted_schedule,
            kpi_delta=kpi_delta,
            conflicts_before=current_conflicts_list,
            conflicts_after=predicted_conflicts,
            recommendations=scenario_recommendations
        )
        
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

@app.get("/scenarios")
def get_simulation_scenarios():
    """Get all stored simulation scenarios"""
    return {
        "scenarios": simulation_scenarios,
        "count": len(simulation_scenarios)
    }

@app.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: str):
    """Delete a specific simulation scenario"""
    if scenario_id in simulation_scenarios:
        del simulation_scenarios[scenario_id]
        return {"status": "success", "message": "Scenario deleted"}
    else:
        raise HTTPException(status_code=404, detail="Scenario not found")

@app.get("/settings/optimizer")
def get_optimizer_settings():
    """Get current optimizer settings"""
    return optimizer_settings.dict()

@app.post("/settings/optimizer")
def update_optimizer_settings(settings: OptimizerSettings):
    """Update optimizer settings"""
    global optimizer_settings
    optimizer_settings = settings
    
    logs.append(LogEntry(
        timestamp=datetime.now(),
        action="optimizer_settings_updated",
        details=f"Updated optimizer: mode={settings.mode}, objective={settings.objective}, time_limit={settings.time_limit_seconds}s"
    ))
    
    return {"status": "success", "message": "Optimizer settings updated", "settings": settings.dict()}

@app.get("/analytics/summary")
def get_analytics_summary():
    """Get comprehensive analytics summary"""
    if not schedule:
        return {"error": "No schedule data available"}
    
    # Calculate various metrics
    total_trains = len(trains)
    total_delays = 0
    on_time_trains = 0
    delayed_trains = 0
    
    delays_by_station = {}
    delays_by_train_type = {}
    platform_utilization = {}
    
    for entry in schedule:
        train = next((t for t in trains if t.id == entry.train_id), None)
        if not train:
            continue
        
        delay_minutes = max(0.0, (entry.actual_arrival - train.scheduled_arrival).total_seconds() / 60.0)
        total_delays += delay_minutes
        
        if delay_minutes <= 2:  # On time if delay <= 2 minutes
            on_time_trains += 1
        else:
            delayed_trains += 1
        
        # By station
        if entry.station_id not in delays_by_station:
            delays_by_station[entry.station_id] = []
        delays_by_station[entry.station_id].append(delay_minutes)
        
        # By train type
        if train.type not in delays_by_train_type:
            delays_by_train_type[train.type] = []
        delays_by_train_type[train.type].append(delay_minutes)
        
        # Platform utilization
        station_key = f"{entry.station_id}_P{entry.assigned_platform}"
        if station_key not in platform_utilization:
            platform_utilization[station_key] = 0
        platform_utilization[station_key] += 1
    
    # Calculate averages
    avg_delays_by_station = {k: sum(v)/len(v) for k, v in delays_by_station.items()}
    avg_delays_by_type = {k: sum(v)/len(v) for k, v in delays_by_train_type.items()}
    
    # Conflict analysis
    conflicts_analysis = {
        "total_conflicts": len(current_conflicts),
        "by_type": {},
        "by_severity": {}
    }
    
    for conflict in current_conflicts:
        conflict_type = conflict.type
        severity = conflict.severity
        
        if conflict_type not in conflicts_analysis["by_type"]:
            conflicts_analysis["by_type"][conflict_type] = 0
        conflicts_analysis["by_type"][conflict_type] += 1
        
        if severity not in conflicts_analysis["by_severity"]:
            conflicts_analysis["by_severity"][severity] = 0
        conflicts_analysis["by_severity"][severity] += 1
    
    return {
        "summary": {
            "total_trains": total_trains,
            "on_time_trains": on_time_trains,
            "delayed_trains": delayed_trains,
            "on_time_percentage": round((on_time_trains / total_trains * 100), 1) if total_trains > 0 else 0,
            "average_delay_minutes": round(total_delays / total_trains, 2) if total_trains > 0 else 0,
            "total_delay_minutes": round(total_delays, 1)
        },
        "delays_by_station": avg_delays_by_station,
        "delays_by_train_type": avg_delays_by_type,
        "platform_utilization": platform_utilization,
        "conflicts_analysis": conflicts_analysis,
        "active_overrides": len(fixed_overrides),
        "active_delays": len(active_delays),
        "optimizer_mode": optimizer_settings.mode,
        "last_updated": datetime.now().isoformat()
    }

# Gemini AI Integration Endpoints
@app.post("/ai/analyze-schedule")
async def analyze_schedule_with_ai(query: str = "Analyze the current train schedule and provide optimization suggestions"):
    """Use Gemini AI to analyze the current schedule and provide insights"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini AI not configured. Please set GEMINI_API_KEY in .env file")
    
    try:
        # Prepare schedule data for AI analysis
        schedule_summary = {
            "total_trains": len(trains),
            "total_conflicts": len(current_conflicts),
            "stations": list(stations.keys()),
            "current_recommendations": len(current_recommendations)
        }
        
        prompt = f"""
        You are an AI assistant for a railway traffic management system. 
        
        Current Schedule Summary:
        - Total Trains: {schedule_summary['total_trains']}
        - Active Conflicts: {schedule_summary['total_conflicts']}
        - Stations: {', '.join(schedule_summary['stations'])}
        - Pending Recommendations: {schedule_summary['current_recommendations']}
        
        User Query: {query}
        
        Please provide actionable insights and recommendations for optimizing the railway schedule.
        """
        
        response = gemini_model.generate_content(prompt)
        
        return {
            "ai_response": response.text,
            "schedule_summary": schedule_summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@app.get("/ai/status")
def get_ai_status():
    """Check if Gemini AI is properly configured"""
    return {
        "gemini_configured": gemini_model is not None,
        "model": GEMINI_MODEL if gemini_model else None,
        "api_key_set": bool(GEMINI_API_KEY)
    }


if __name__ == "__main__":
    import uvicorn
    print("\n🚂 Rail Traffic Decision Support System - Backend")
    print("📊 API Documentation: http://localhost:8000/docs")
    print("🔧 Starting server on http://localhost:8000")
    
    # Start movement simulation automatically
    start_train_movement_simulation()
    print("🚂 Train movement simulation started automatically")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
