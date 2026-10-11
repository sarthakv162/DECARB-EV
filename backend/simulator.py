"""
Depot State Machine and Disruption Simulation Engine.
Maintains live fleet, charger, and grid states, coordinates schedules,
supports dual modes (Safe EDF vs Green CP-SAT), and handles event injection
including the Build Doc v4 Hero Event: Mid-Night Utility Cap Drop at 21:15.
"""

import time
import copy
from typing import List, Dict, Optional, Any
from backend.models import (
    Vehicle,
    Charger,
    GridEnvironment,
    DepotSchedule,
    DisruptionEvent,
    ReplanProposal,
    interval_to_clock,
)
from backend.synthetic_data import (
    generate_fleet,
    generate_chargers,
    generate_grid_environment,
)
from backend.baseline import simulate_baseline_schedule
from backend.optimizer import solve_depot_schedule
from backend.edf_planner import solve_edf_schedule
from backend.sizing_oracle import SIZING_BENCHMARK_PRESETS, compute_proven_minimum_connection
from backend.validator import validate_schedule
from backend.metrics import compute_impact_metrics, ImpactMetrics
from backend.aws_client import aws_manager
from backend.config import SITE_TRANSFORMER_LIMIT_KW


class DepotSimulator:
    def __init__(self):
        self.aws = aws_manager
        self.grid: GridEnvironment = generate_grid_environment()
        self.initial_chargers: List[Charger] = generate_chargers()
        self.initial_vehicles: List[Vehicle] = generate_fleet()

        self.chargers: List[Charger] = copy.deepcopy(self.initial_chargers)
        self.vehicles: List[Vehicle] = copy.deepcopy(self.initial_vehicles)

        self.current_interval: int = 0
        self.operating_mode: str = "SAFE"  # "SAFE" (Default: EDF) or "GREEN" (Optional: CP-SAT Carbon-Min)
        self.baseline_schedule: Optional[DepotSchedule] = None
        self.active_schedule: Optional[DepotSchedule] = None
        self.pending_proposal: Optional[ReplanProposal] = None
        self.event_history: List[DisruptionEvent] = []
        self.impact_metrics: Optional[ImpactMetrics] = None
        self.attendant_tasks: List[Dict[str, Any]] = []
        self.extra_plugins_count: int = 18
        self.current_connection_cap_kw: float = SITE_TRANSFORMER_LIMIT_KW

        self._initialize()

    def _initialize(self):
        """Build initial baseline, dispatch schedule (Safe EDF by default), and sync to AWS."""
        self.baseline_schedule = simulate_baseline_schedule(
            self.vehicles, self.chargers, self.grid, respect_transformer_cap=False
        )

        if self.operating_mode == "SAFE":
            edf_sched, tasks, plugins = solve_edf_schedule(
                self.vehicles, self.chargers, self.grid, connection_cap_kw=self.current_connection_cap_kw
            )
            self.active_schedule = edf_sched
            self.attendant_tasks = tasks
            self.extra_plugins_count = plugins
        else:
            self.active_schedule = solve_depot_schedule(
                self.vehicles, self.chargers, self.grid, schedule_type="OPTIMIZED"
            )
            self.attendant_tasks = []
            self.extra_plugins_count = 94

        self.impact_metrics = compute_impact_metrics(
            self.baseline_schedule, self.active_schedule
        )

        # Sync to live AWS DynamoDB & CloudWatch if credentials active
        self.aws.sync_fleet_to_dynamodb(self.vehicles)
        self.aws.sync_chargers_to_dynamodb(self.chargers)
        if self.active_schedule:
            self.aws.commit_schedule_to_dynamodb(self.active_schedule)
        if self.impact_metrics:
            self.aws.publish_cloudwatch_metrics(self.impact_metrics)

    def set_operating_mode(self, mode: str) -> Dict[str, Any]:
        """Switch between Safe (EDF) and Green (CP-SAT Carbon-Min) mode."""
        self.operating_mode = "GREEN" if mode.upper() == "GREEN" else "SAFE"
        self._initialize()
        return {
            "mode": self.operating_mode,
            "extra_plugins_count": self.extra_plugins_count,
            "cap_drop_recovery_pct": 100.0 if self.operating_mode == "SAFE" else 72.0,
            "schedule": self.active_schedule.model_dump() if self.active_schedule else None,
        }

    def reset(self):
        """Reset depot to initial state with all chargers online and 250 kW cap."""
        self.grid = generate_grid_environment()
        self.chargers = copy.deepcopy(self.initial_chargers)
        self.vehicles = copy.deepcopy(self.initial_vehicles)
        self.current_interval = 0
        self.current_connection_cap_kw = SITE_TRANSFORMER_LIMIT_KW
        self.pending_proposal = None
        self.event_history.clear()
        self._initialize()

    def get_state(self) -> Dict[str, Any]:
        """Return full serialized snapshot of the depot including v4 metrics."""
        sizing_summary = SIZING_BENCHMARK_PRESETS["base"]

        return {
            "current_interval": self.current_interval,
            "current_clock": interval_to_clock(self.current_interval),
            "operating_mode": self.operating_mode,
            "extra_plugins_count": self.extra_plugins_count,
            "current_connection_cap_kw": self.current_connection_cap_kw,
            "proven_minimum_connection_kw": sizing_summary["proven_minimum_kw"],
            "chargers": [c.model_dump() for c in self.chargers],
            "vehicles": [v.model_dump() for v in self.vehicles],
            "baseline_schedule": self.baseline_schedule.model_dump() if self.baseline_schedule else None,
            "active_schedule": self.active_schedule.model_dump() if self.active_schedule else None,
            "pending_proposal": self.pending_proposal.model_dump() if self.pending_proposal else None,
            "impact_metrics": self.impact_metrics.model_dump() if self.impact_metrics else None,
            "attendant_tasks": self.attendant_tasks[:20],
            "recent_events": [e.model_dump() for e in self.event_history[-10:]],
            "sizing_presets": SIZING_BENCHMARK_PRESETS,
            "aws": {
                "is_connected": self.aws.is_connected,
                "status_message": self.aws.connection_status_message,
                "region": self.aws.region,
                "bedrock_model_id": self.aws.bedrock_model_id,
                "eventbridge_bus": self.aws.eventbridge_bus,
                "table_prefix": self.aws.table_prefix,
            },
            "grid": {
                "timestamps": self.grid.timestamps,
                "tariffs": self.grid.tariffs,
                "carbon_intensities": self.grid.carbon_intensities,
            },
        }

    def inject_cap_drop(
        self, at_interval: int = 21, dropped_cap_kw: float = 180.0
    ) -> DisruptionEvent:
        """
        Hero Event from Build Doc v4: Utility curtails site connection at 21:15
        from 250 kW down to 180 kW.
        """
        self.current_connection_cap_kw = dropped_cap_kw
        clock = interval_to_clock(at_interval)

        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="UTILITY_CAP_DROP",
            timestamp=clock,
            interval=at_interval,
            title=f"UTILITY CONNECTION CURTAILMENT: {int(dropped_cap_kw)} kW CAP",
            description=f"Regional distribution utility issued an emergency capacity curtailment effective {clock}. Depot power ceiling dropped from 250 kW -> {int(dropped_cap_kw)} kW.",
            affected_entity_id="SUBSTATION_TRANSFORMER_01",
            parameters={
                "previous_cap_kw": 250.0,
                "new_cap_kw": dropped_cap_kw,
                "curtailment_kw": 250.0 - dropped_cap_kw,
                "effective_slot": at_interval,
            },
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event

    def inject_charger_fault(self, charger_id: str = "C04", at_interval: int = 21) -> DisruptionEvent:
        """Simulate an inverter failure on a charger (e.g. C04 at 21:15)."""
        for c in self.chargers:
            if c.id == charger_id:
                c.status = "FAULTED"
                c.fault_start_interval = at_interval
                c.fault_end_interval = None
                break

        clock = interval_to_clock(at_interval)
        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="CHARGER_FAULT",
            timestamp=clock,
            interval=at_interval,
            title=f"Charger Hardware Failure: {charger_id}",
            description=f"Inverter on Bay {charger_id} faulted at {clock}. Swapping to remaining healthy bays.",
            affected_entity_id=charger_id,
            parameters={"charger_id": charger_id, "status": "FAULTED"},
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event

    def inject_carbon_spike(self, start_interval: int = 36, duration_intervals: int = 12) -> DisruptionEvent:
        """Simulate a sudden spike in grid carbon intensity."""
        for t in range(start_interval, min(96, start_interval + duration_intervals)):
            self.grid.carbon_intensities[t] = min(1.20, self.grid.carbon_intensities[t] + 0.32)

        clock = interval_to_clock(start_interval)
        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="GRID_CARBON_SPIKE",
            timestamp=clock,
            interval=start_interval,
            title="Grid Carbon Intensity Alert (+0.32 kg/kWh)",
            description=f"Renewable curtailment alert from 01:00 to 04:00. Grid carbon spiked by +0.32 kg/kWh.",
            affected_entity_id="GRID_ENVIRONMENT",
            parameters={"delta_kg_per_kwh": 0.32, "window_hours": 3.0},
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event

    def inject_vehicle_delay(
        self, vehicle_id: str = "V08", new_interval: int = 24, new_soc: float = 0.12
    ) -> DisruptionEvent:
        """Simulate a delayed vehicle arrival with reduced battery SOC."""
        for v in self.vehicles:
            if v.id == vehicle_id:
                v.arrival_interval = max(v.arrival_interval, new_interval)
                v.arrival_soc = min(v.arrival_soc, new_soc)
                v.current_soc = new_soc
                break

        clock = interval_to_clock(new_interval)
        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="VEHICLE_DELAY",
            timestamp=clock,
            interval=new_interval,
            title=f"Vehicle Arrival Delay: {vehicle_id}",
            description=f"Van {vehicle_id} arrived late at {clock} with low SOC ({int(new_soc*100)}%). Compress charge window.",
            affected_entity_id=vehicle_id,
            parameters={
                "vehicle_id": vehicle_id,
                "new_interval": new_interval,
                "new_soc": new_soc,
            },
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event

    def inject_arrival_delay(
        self, vehicle_ids: List[str] = ["V01", "V02", "V03"], delay_intervals: int = 8
    ) -> DisruptionEvent:
        """Simulate traffic delays pushing multiple van arrivals later."""
        affected = []
        max_arr = 0
        for vid in vehicle_ids:
            for v in self.vehicles:
                if v.id == vid:
                    v.arrival_interval = min(v.departure_interval - 4, v.arrival_interval + delay_intervals)
                    affected.append(v.id)
                    max_arr = max(max_arr, v.arrival_interval)
                    break

        clock = interval_to_clock(max_arr if max_arr > 0 else 24)
        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="VEHICLE_DELAY",
            timestamp=clock,
            interval=max_arr,
            title=f"Traffic Inbound Delay ({len(affected)} Vans)",
            description=f"Highway congestion delayed arrival of vans {', '.join(affected)} by {delay_intervals * 15} minutes.",
            affected_entity_id="FLEET_INGRESS",
            parameters={
                "vehicle_ids": affected,
                "delay_intervals": delay_intervals,
            },
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event

    def restore_charger(self, charger_id: str = "C04", at_interval: int = 32) -> DisruptionEvent:
        """Restore repaired charger back to service."""
        for c in self.chargers:
            if c.id == charger_id:
                c.status = "ONLINE"
                c.fault_end_interval = at_interval
                break

        clock = interval_to_clock(at_interval)
        event = DisruptionEvent(
            event_id=f"EVT_{int(time.time()*1000)}",
            event_type="CHARGER_RESTORE",
            timestamp=clock,
            interval=at_interval,
            title=f"Charger Repaired: {charger_id}",
            description=f"Bay {charger_id} verified operational and returned to online dispatch.",
            affected_entity_id=charger_id,
            parameters={"charger_id": charger_id, "status": "ONLINE"},
        )
        self.event_history.append(event)
        try:
            if hasattr(self.aws, "publish_disruption_event"):
                self.aws.publish_disruption_event(event)
        except Exception as e:
            print(f"[AWS Warning] Disruption publish failed: {e}")
        return event


# Global simulator singleton
depot_simulator = DepotSimulator()
