"""
Unmanaged Baseline Charging Model (First-Come, First-Served / Plug-and-Charge).
Simulates what happens when a depot has no intelligent orchestration:
vehicles plug in upon arrival and charge at maximum rate until full.
"""

from typing import List, Dict, Set
from backend.config import (
    TOTAL_INTERVALS,
    DELTA_T,
    CHARGER_MAX_KW,
    TRANSFORMER_MAX_KW,
    CHARGER_EFFICIENCY,
)
from backend.models import (
    Vehicle,
    Charger,
    GridEnvironment,
    DepotSchedule,
    ScheduledSlot,
    ScheduleVehicleSummary,
    interval_to_clock,
)


def simulate_baseline_schedule(
    vehicles: List[Vehicle],
    chargers: List[Charger],
    grid: GridEnvironment,
    respect_transformer_cap: bool = False,
) -> DepotSchedule:
    """
    Simulates unmanaged immediate charging:
    1. When a van arrives, it enters the charging queue.
    2. Available chargers are assigned immediately.
    3. Each connected van charges at maximum rate (50 kW) until target SOC is reached.
    4. Once full, the van disconnects and frees the charger for queued vehicles.

    If respect_transformer_cap is False, it shows the true unmanaged load spike
    (which exposes severe transformer violations, e.g. up to 500 kW vs 250 kW limit).
    """
    # Clone vehicle states
    v_states: Dict[str, Dict] = {}
    for v in vehicles:
        curr_soc = v.current_soc if v.current_soc is not None else v.arrival_soc
        v_states[v.id] = {
            "vehicle": v,
            "soc": curr_soc,
            "target_soc": v.target_soc,
            "battery_kwh": v.battery_capacity_kwh,
            "energy_delivered": 0.0,
            "assigned_charger": None,
            "assigned_chargers_set": set(),
            "is_complete": curr_soc >= v.target_soc,
        }

    # Charger states
    c_states: Dict[str, Dict] = {
        c.id: {"charger": c, "occupied_by": None}
        for c in chargers
        if c.status == "ONLINE"
    }

    queue: List[str] = []
    slots: List[ScheduledSlot] = []
    depot_load_kw: List[float] = [0.0] * TOTAL_INTERVALS

    total_cost = 0.0
    total_carbon_kg = 0.0
    peak_load = 0.0

    for t in range(TOTAL_INTERVALS):
        # 1. Enqueue newly arrived vehicles
        for v in vehicles:
            if v.arrival_interval == t and not v_states[v.id]["is_complete"]:
                if v.id not in queue and v_states[v.id]["assigned_charger"] is None:
                    queue.append(v.id)

        # 2. Assign available chargers to queued vehicles
        for c_id, c_data in c_states.items():
            if c_data["occupied_by"] is None and queue:
                next_vid = queue.pop(0)
                c_data["occupied_by"] = next_vid
                v_states[next_vid]["assigned_charger"] = c_id
                v_states[next_vid]["assigned_chargers_set"].add(c_id)

        # 3. Simulate charging for this interval
        interval_power = 0.0

        for c_id, c_data in c_states.items():
            vid = c_data["occupied_by"]
            if vid is None:
                continue

            v_info = v_states[vid]
            veh = v_info["vehicle"]

            # Check if vehicle has departed
            if t >= veh.departure_interval:
                c_data["occupied_by"] = None
                v_info["assigned_charger"] = None
                continue

            # Calculate needed energy
            curr_soc = v_info["soc"]
            target_soc = v_info["target_soc"]
            bat_cap = v_info["battery_kwh"]

            needed_kwh = max(0.0, (target_soc - curr_soc) * bat_cap / CHARGER_EFFICIENCY)

            if needed_kwh <= 0.001:
                # Finished charging!
                v_info["is_complete"] = True
                c_data["occupied_by"] = None
                v_info["assigned_charger"] = None
                continue

            # Max power charger can supply this 15-min interval
            max_power_possible = min(c_data["charger"].max_kw, needed_kwh / DELTA_T)
            
            if respect_transformer_cap:
                remaining_headroom = max(0.0, TRANSFORMER_MAX_KW - interval_power)
                power_assigned = min(max_power_possible, remaining_headroom)
            else:
                power_assigned = max_power_possible

            if power_assigned > 0:
                energy_added_grid = power_assigned * DELTA_T
                energy_added_battery = energy_added_grid * CHARGER_EFFICIENCY
                soc_added = energy_added_battery / bat_cap

                v_info["soc"] = min(1.0, curr_soc + soc_added)
                v_info["energy_delivered"] += energy_added_battery
                interval_power += power_assigned

                # Record slot
                slots.append(
                    ScheduledSlot(
                        interval=t,
                        timestamp=interval_to_clock(t),
                        vehicle_id=vid,
                        charger_id=c_id,
                        power_kw=round(power_assigned, 2),
                        energy_kwh=round(energy_added_grid, 2),
                        soc_after=round(v_info["soc"], 4),
                    )
                )

                # Check if now complete
                if v_info["soc"] >= target_soc - 0.001:
                    v_info["is_complete"] = True
                    c_data["occupied_by"] = None
                    v_info["assigned_charger"] = None

        depot_load_kw[t] = round(interval_power, 2)
        interval_cost = interval_power * DELTA_T * grid.tariffs[t]
        interval_carbon = interval_power * DELTA_T * grid.carbon_intensities[t]

        total_cost += interval_cost
        total_carbon_kg += interval_carbon
        if interval_power > peak_load:
            peak_load = interval_power

    # Compile summaries
    summaries: List[ScheduleVehicleSummary] = []
    ready_count = 0
    total_energy = 0.0

    for v in vehicles:
        v_info = v_states[v.id]
        final_soc = v_info["soc"]
        is_ready = final_soc >= (v.target_soc - 0.01)
        if is_ready:
            ready_count += 1
        total_energy += v_info["energy_delivered"]

        summaries.append(
            ScheduleVehicleSummary(
                vehicle_id=v.id,
                arrival_clock=v.arrival_clock,
                departure_clock=v.departure_clock,
                initial_soc=round(v.current_soc or v.arrival_soc, 3),
                final_soc=round(final_soc, 3),
                target_soc=v.target_soc,
                energy_delivered_kwh=round(v_info["energy_delivered"], 2),
                is_ready_on_time=is_ready,
                assigned_chargers=sorted(list(v_info["assigned_chargers_set"])),
            )
        )

    reliability = (ready_count / len(vehicles)) * 100.0

    return DepotSchedule(
        schedule_id="baseline_unmanaged",
        schedule_type="BASELINE",
        is_feasible=peak_load <= TRANSFORMER_MAX_KW,
        infeasibility_reason=None if peak_load <= TRANSFORMER_MAX_KW else f"Peak power ({peak_load:.1f} kW) violates depot transformer limit ({TRANSFORMER_MAX_KW:.0f} kW)",
        depot_load_kw=depot_load_kw,
        slots=slots,
        vehicle_summaries=summaries,
        total_cost=round(total_cost, 2),
        total_carbon_kg=round(total_carbon_kg, 2),
        peak_load_kw=round(peak_load, 2),
        departure_reliability_pct=round(reliability, 1),
        total_energy_delivered_kwh=round(total_energy, 2),
    )
