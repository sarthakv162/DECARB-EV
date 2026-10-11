"""
Deterministic Safety & Constraint Validator.
Independently verifies that any generated schedule satisfies 100% of physical,
electrical, and operational constraints without relying on the optimizer's assertions.
"""

from typing import List, Dict, Tuple, Optional
from pydantic import BaseModel
from backend.config import (
    TOTAL_INTERVALS,
    CHARGER_MAX_KW,
    TRANSFORMER_MAX_KW,
    DELTA_T,
    CHARGER_EFFICIENCY,
)
from backend.models import Vehicle, Charger, DepotSchedule, interval_to_clock


class ValidationViolation(BaseModel):
    category: str  # "TRANSFORMER_OVERLOAD", "CHARGER_CONFLICT", "DEADLINE_MISSED", etc.
    severity: str  # "CRITICAL", "WARNING"
    interval: Optional[int] = None
    clock_time: Optional[str] = None
    entity_id: Optional[str] = None
    details: str


class ValidationResult(BaseModel):
    is_valid: bool
    violations: List[ValidationViolation]
    peak_transformer_utilization_pct: float
    departure_readiness_pct: float
    summary: str


def validate_schedule(
    schedule: DepotSchedule,
    vehicles: List[Vehicle],
    chargers: List[Charger],
) -> ValidationResult:
    """
    Rigorously verifies all hard physical constraints:
    1. Depot transformer capacity (<= 250 kW at all 96 intervals)
    2. Charger exclusivity (<= 1 vehicle per charger per interval)
    3. Vehicle exclusivity (<= 1 charger per vehicle per interval)
    4. Charger power rating (<= 50 kW per charger)
    5. Faulted charger compliance (0 kW on faulted chargers)
    6. Dwell time compliance (no charging before arrival or after departure)
    7. Departure readiness (every vehicle reaches target SOC on departure)
    """
    violations: List[ValidationViolation] = []
    veh_dict = {v.id: v for v in vehicles}
    charger_dict = {c.id: c for c in chargers}

    # Track usage per interval
    interval_load: Dict[int, float] = {t: 0.0 for t in range(TOTAL_INTERVALS)}
    charger_occupancy: Dict[Tuple[int, str], List[str]] = {}  # (t, c_id) -> [v_id]
    vehicle_occupancy: Dict[Tuple[int, str], List[str]] = {}  # (t, v_id) -> [c_id]
    vehicle_energy_battery: Dict[str, float] = {v.id: 0.0 for v in vehicles}

    # 1. Process all scheduled slots
    for slot in schedule.slots:
        t = slot.interval
        v_id = slot.vehicle_id
        c_id = slot.charger_id
        p_kw = slot.power_kw

        # Check dwell time validity
        veh = veh_dict.get(v_id)
        if veh:
            if t < veh.arrival_interval:
                violations.append(
                    ValidationViolation(
                        category="EARLY_CHARGING_VIOLATION",
                        severity="CRITICAL",
                        interval=t,
                        clock_time=interval_to_clock(t),
                        entity_id=v_id,
                        details=f"Vehicle {v_id} scheduled to charge at {interval_to_clock(t)} before its arrival at {veh.arrival_clock}.",
                    )
                )
            if t >= veh.departure_interval:
                violations.append(
                    ValidationViolation(
                        category="LATE_CHARGING_VIOLATION",
                        severity="CRITICAL",
                        interval=t,
                        clock_time=interval_to_clock(t),
                        entity_id=v_id,
                        details=f"Vehicle {v_id} scheduled to charge at {interval_to_clock(t)} after its departure at {veh.departure_clock}.",
                    )
                )

        # Check charger power limits
        chg = charger_dict.get(c_id)
        max_allowed = chg.max_kw if chg else CHARGER_MAX_KW
        if p_kw > max_allowed + 0.01:
            violations.append(
                ValidationViolation(
                    category="CHARGER_POWER_EXCEEDED",
                    severity="CRITICAL",
                    interval=t,
                    clock_time=interval_to_clock(t),
                    entity_id=c_id,
                    details=f"Charger {c_id} assigned {p_kw:.1f} kW exceeding max rating of {max_allowed:.1f} kW.",
                )
            )

        # Check charger operational status
        if chg and chg.status == "FAULTED":
            is_offline = True
            if chg.fault_start_interval is not None:
                if chg.fault_end_interval is not None:
                    is_offline = chg.fault_start_interval <= t <= chg.fault_end_interval
                else:
                    is_offline = t >= chg.fault_start_interval

            if is_offline and p_kw > 0.01:
                violations.append(
                    ValidationViolation(
                        category="FAULTED_CHARGER_ASSIGNED",
                        severity="CRITICAL",
                        interval=t,
                        clock_time=interval_to_clock(t),
                        entity_id=c_id,
                        details=f"Charger {c_id} is FAULTED at {interval_to_clock(t)} but assigned power {p_kw:.1f} kW to {v_id}.",
                    )
                )

        # Record occupancy
        charger_occupancy.setdefault((t, c_id), []).append(v_id)
        vehicle_occupancy.setdefault((t, v_id), []).append(c_id)
        interval_load[t] += p_kw
        vehicle_energy_battery[v_id] += p_kw * DELTA_T * CHARGER_EFFICIENCY

    # 2. Check transformer limits across all intervals
    peak_load = 0.0
    for t, load in interval_load.items():
        if load > peak_load:
            peak_load = load
        if load > TRANSFORMER_MAX_KW + 0.01:
            violations.append(
                ValidationViolation(
                    category="TRANSFORMER_OVERLOAD",
                    severity="CRITICAL",
                    interval=t,
                    clock_time=interval_to_clock(t),
                    entity_id="DEPOT_TRANSFORMER",
                    details=f"Depot transformer load ({load:.1f} kW) exceeded site limit ({TRANSFORMER_MAX_KW:.0f} kW) at {interval_to_clock(t)}.",
                )
            )

    # 3. Check exclusivity conflicts
    for (t, c_id), v_list in charger_occupancy.items():
        if len(v_list) > 1:
            violations.append(
                ValidationViolation(
                    category="CHARGER_COLLISION",
                    severity="CRITICAL",
                    interval=t,
                    clock_time=interval_to_clock(t),
                    entity_id=c_id,
                    details=f"Charger {c_id} simultaneously assigned to {len(v_list)} vehicles ({', '.join(v_list)}) at {interval_to_clock(t)}.",
                )
            )

    for (t, v_id), c_list in vehicle_occupancy.items():
        if len(c_list) > 1:
            violations.append(
                ValidationViolation(
                    category="VEHICLE_DOUBLE_PLUGGED",
                    severity="CRITICAL",
                    interval=t,
                    clock_time=interval_to_clock(t),
                    entity_id=v_id,
                    details=f"Vehicle {v_id} connected to multiple chargers ({', '.join(c_list)}) simultaneously at {interval_to_clock(t)}.",
                )
            )

    # 4. Check vehicle departure deadlines & target SOC
    ready_count = 0
    for v in vehicles:
        init_soc = v.current_soc if v.current_soc is not None else v.arrival_soc
        energy_added = vehicle_energy_battery.get(v.id, 0.0)
        soc_final = min(1.0, init_soc + (energy_added / v.battery_capacity_kwh))

        # Allow 0.5% floating tolerance
        if soc_final >= (v.target_soc - 0.005):
            ready_count += 1
        else:
            violations.append(
                ValidationViolation(
                    category="DEADLINE_SOC_SHORTFALL",
                    severity="CRITICAL",
                    interval=v.departure_interval,
                    clock_time=v.departure_clock,
                    entity_id=v.id,
                    details=(
                        f"Vehicle {v.id} scheduled to leave at {v.departure_clock} with SOC {soc_final*100:.1f}%, "
                        f"failing required target of {v.target_soc*100:.0f}%."
                    ),
                )
            )

    readiness_pct = (ready_count / len(vehicles)) * 100.0
    transformer_util_pct = (peak_load / TRANSFORMER_MAX_KW) * 100.0
    is_valid = len(violations) == 0

    summary = (
        f"Validation PASSED: 100% constraints satisfied. Peak load {peak_load:.1f} kW "
        f"({transformer_util_pct:.1f}% transformer headroom), {ready_count}/{len(vehicles)} vehicles ready on time."
        if is_valid else
        f"Validation FAILED: {len(violations)} safety/operational violations detected."
    )

    return ValidationResult(
        is_valid=is_valid,
        violations=violations,
        peak_transformer_utilization_pct=round(transformer_util_pct, 1),
        departure_readiness_pct=round(readiness_pct, 1),
        summary=summary,
    )
