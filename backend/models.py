"""
Pydantic and dataclass models for the Carbon-Aware EV Depot Orchestrator.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from backend.config import CHARGER_EFFICIENCY, DELTA_T, START_HOUR_OF_DAY


def interval_to_clock(interval: int) -> str:
    """Convert a 0..95 interval to clock time string HH:MM."""
    total_minutes = (START_HOUR_OF_DAY * 60 + interval * 15) % (24 * 60)
    hours = total_minutes // 60
    mins = total_minutes % 60
    return f"{hours:02d}:{mins:02d}"


def clock_to_interval(clock: str, is_day_2: bool = False) -> int:
    """Convert HH:MM to 0..95 interval relative to 16:00 start."""
    parts = clock.strip().split(":")
    hours = int(parts[0])
    mins = int(parts[1])
    minutes_from_midnight = hours * 60 + mins
    start_minutes = START_HOUR_OF_DAY * 60

    if minutes_from_midnight >= start_minutes and not is_day_2:
        return (minutes_from_midnight - start_minutes) // 15
    else:
        # Crosses midnight into next day
        return ((24 * 60 - start_minutes) + minutes_from_midnight) // 15


class Vehicle(BaseModel):
    id: str
    model_name: str = "Electric Delivery Van"
    battery_capacity_kwh: float = 70.0
    arrival_interval: int
    departure_interval: int
    arrival_soc: float
    target_soc: float = 0.90
    current_soc: Optional[float] = None
    priority: int = 1  # 1: Normal, 2: High priority route

    @property
    def arrival_clock(self) -> str:
        return interval_to_clock(self.arrival_interval)

    @property
    def departure_clock(self) -> str:
        return interval_to_clock(self.departure_interval)

    @property
    def energy_needed_kwh(self) -> float:
        curr = self.current_soc if self.current_soc is not None else self.arrival_soc
        needed_battery = max(0.0, (self.target_soc - curr) * self.battery_capacity_kwh)
        return needed_battery / CHARGER_EFFICIENCY


class Charger(BaseModel):
    id: str
    max_kw: float = 50.0
    status: str = "ONLINE"  # "ONLINE", "FAULTED", "MAINTENANCE"
    fault_start_interval: Optional[int] = None
    fault_end_interval: Optional[int] = None


class GridEnvironment(BaseModel):
    intervals: List[int]
    timestamps: List[str]
    tariffs: List[float]             # ₹/kWh or $/kWh
    carbon_intensities: List[float]  # kg CO2e/kWh


class ScheduledSlot(BaseModel):
    interval: int
    timestamp: str
    vehicle_id: str
    charger_id: str
    power_kw: float
    energy_kwh: float
    soc_after: float


class ScheduleVehicleSummary(BaseModel):
    vehicle_id: str
    arrival_clock: str
    departure_clock: str
    initial_soc: float
    final_soc: float
    target_soc: float
    energy_delivered_kwh: float
    is_ready_on_time: bool
    assigned_chargers: List[str]


class DepotSchedule(BaseModel):
    schedule_id: str
    schedule_type: str  # "BASELINE", "OPTIMIZED", "REPLANNED"
    is_feasible: bool = True
    infeasibility_reason: Optional[str] = None
    depot_load_kw: List[float] = Field(default_factory=list)  # length 96
    slots: List[ScheduledSlot] = Field(default_factory=list)
    vehicle_summaries: List[ScheduleVehicleSummary] = Field(default_factory=list)
    total_cost: float = 0.0
    total_carbon_kg: float = 0.0
    peak_load_kw: float = 0.0
    departure_reliability_pct: float = 100.0
    total_energy_delivered_kwh: float = 0.0


class DisruptionEvent(BaseModel):
    event_id: str
    event_type: str  # "CHARGER_FAULT", "VEHICLE_DELAY", "GRID_CARBON_SPIKE", "CHARGER_RESTORE"
    timestamp: str
    interval: int
    title: str
    description: str
    affected_entity_id: str
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ReplanProposal(BaseModel):
    proposal_id: str
    trigger_event: DisruptionEvent
    old_schedule_id: str
    new_schedule: DepotSchedule
    agent_explanation: str
    status: str = "PENDING_APPROVAL"  # "PENDING_APPROVAL", "APPROVED", "REJECTED"
    cost_delta: float
    carbon_delta: float
    peak_delta: float
    affected_vehicles: List[str]
