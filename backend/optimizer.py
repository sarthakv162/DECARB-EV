"""
Deterministic Mathematical Optimization Engine using Google OR-Tools CP-SAT.
Formulates the EV depot charging schedule as a multi-objective constraint satisfaction
and optimization problem:
- Minimizes weighted sum of (electricity cost + grid carbon emissions + peak load penalty).
- Enforces strict hard physical constraints:
    * Charger availability and exclusivity.
    * Charger power limits.
    * Transformer total capacity (250 kW).
    * Vehicle arrival and departure windows.
    * 100% required energy before departure.
"""

import time
import math
from typing import List, Dict, Optional, Tuple
from ortools.sat.python import cp_model

from backend.config import (
    TOTAL_INTERVALS,
    DELTA_T,
    CHARGER_MAX_KW,
    TRANSFORMER_MAX_KW,
    CHARGER_EFFICIENCY,
    DEFAULT_WEIGHT_COST,
    DEFAULT_WEIGHT_CARBON,
    DEFAULT_WEIGHT_PEAK,
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


def solve_depot_schedule(
    vehicles: List[Vehicle],
    chargers: List[Charger],
    grid: GridEnvironment,
    schedule_type: str = "OPTIMIZED",
    weight_cost: float = DEFAULT_WEIGHT_COST,
    weight_carbon: float = DEFAULT_WEIGHT_CARBON,
    weight_peak: float = DEFAULT_WEIGHT_PEAK,
    time_limit_seconds: float = 5.0,
) -> DepotSchedule:
    """
    Solves the optimal charging schedule for all vehicles across the 24h horizon.
    Returns a DepotSchedule with complete slot allocations and operational metrics.
    """
    start_time = time.time()
    model = cp_model.CpModel()

    num_vehicles = len(vehicles)
    num_chargers = len(chargers)
    max_charger_kw = int(CHARGER_MAX_KW)
    transformer_max_kw = int(TRANSFORMER_MAX_KW)

    # 1. Identify active chargers and fault intervals
    active_chargers: Dict[int, Charger] = {idx: c for idx, c in enumerate(chargers)}
    is_charger_offline: Dict[Tuple[int, int], bool] = {}

    for c_idx, c in enumerate(chargers):
        for t in range(TOTAL_INTERVALS):
            offline = False
            if c.status == "FAULTED":
                if c.fault_start_interval is not None:
                    if c.fault_end_interval is not None:
                        offline = c.fault_start_interval <= t <= c.fault_end_interval
                    else:
                        offline = t >= c.fault_start_interval
                else:
                    offline = True
            is_charger_offline[(c_idx, t)] = offline

    # 2. Compute integer energy demand for each vehicle
    # Energy in battery needed = (target_soc - current_soc) * cap
    # Grid energy needed = Battery energy / CHARGER_EFFICIENCY
    # Power sum needed: Sum_t (P_kw * DELTA_T) >= Grid_energy
    # Sum_t P_kw >= ceil(Grid_energy / DELTA_T)
    veh_required_power_sum: Dict[int, int] = {}
    valid_intervals: Dict[int, List[int]] = {}

    for v_idx, v in enumerate(vehicles):
        curr_soc = v.current_soc if v.current_soc is not None else v.arrival_soc
        needed_bat_kwh = max(0.0, (v.target_soc - curr_soc) * v.battery_capacity_kwh)
        needed_grid_kwh = needed_bat_kwh / CHARGER_EFFICIENCY
        needed_power_sum = int(math.ceil(needed_grid_kwh / DELTA_T))
        veh_required_power_sum[v_idx] = needed_power_sum

        # Valid charging window: [arrival_interval, departure_interval - 1]
        valid_t = [
            t for t in range(TOTAL_INTERVALS)
            if v.arrival_interval <= t < v.departure_interval
        ]
        valid_intervals[v_idx] = valid_t

        # Pre-check feasibility: Can vehicle physically receive needed energy even at max charger power?
        max_possible_power_sum = len(valid_t) * max_charger_kw
        if needed_power_sum > max_possible_power_sum:
            return DepotSchedule(
                schedule_id=f"infeasible_{int(time.time())}",
                schedule_type=schedule_type,
                is_feasible=False,
                infeasibility_reason=(
                    f"Vehicle {v.id} physically cannot reach target SOC {v.target_soc*100:.0f}%: "
                    f"requires {needed_grid_kwh:.1f} kWh, but dwell time ({len(valid_t)*15} mins) "
                    f"allows max {max_possible_power_sum * DELTA_T:.1f} kWh at {max_charger_kw} kW."
                ),
            )

    # 3. Create CP-SAT Variables
    # x[v, c, t] in {0, 1}: 1 if vehicle v is plugged into charger c at interval t
    x: Dict[Tuple[int, int, int], cp_model.IntVar] = {}
    # p[v, t] in [0, max_charger_kw]: kW power delivered to vehicle v at interval t
    p: Dict[Tuple[int, int], cp_model.IntVar] = {}

    for v_idx in range(num_vehicles):
        for t in valid_intervals[v_idx]:
            p[(v_idx, t)] = model.NewIntVar(0, max_charger_kw, f"p_v{v_idx}_t{t}")
            for c_idx in range(num_chargers):
                if not is_charger_offline[(c_idx, t)]:
                    x[(v_idx, c_idx, t)] = model.NewBoolVar(f"x_v{v_idx}_c{c_idx}_t{t}")

    # 4. Constraints

    # (a) Vehicle can occupy at most 1 charger at interval t
    for v_idx in range(num_vehicles):
        for t in valid_intervals[v_idx]:
            charger_vars = [
                x[(v_idx, c_idx, t)]
                for c_idx in range(num_chargers)
                if (v_idx, c_idx, t) in x
            ]
            if charger_vars:
                model.Add(sum(charger_vars) <= 1)
                # Link power to connection: p[v, t] <= max_charger_kw * sum(x)
                model.Add(p[(v_idx, t)] <= max_charger_kw * sum(charger_vars))
                # Optional: when connected, deliver meaningful power (e.g. >= 10 kW)
                model.Add(p[(v_idx, t)] >= 10 * sum(charger_vars))
            else:
                model.Add(p[(v_idx, t)] == 0)

    # (b) Charger exclusivity: at most 1 vehicle per charger at interval t
    for c_idx in range(num_chargers):
        for t in range(TOTAL_INTERVALS):
            vehicles_at_c = [
                x[(v_idx, c_idx, t)]
                for v_idx in range(num_vehicles)
                if (v_idx, c_idx, t) in x
            ]
            if vehicles_at_c:
                model.Add(sum(vehicles_at_c) <= 1)

    # (c) Depot transformer limit at each interval t
    for t in range(TOTAL_INTERVALS):
        interval_powers = [
            p[(v_idx, t)]
            for v_idx in range(num_vehicles)
            if (v_idx, t) in p
        ]
        if interval_powers:
            model.Add(sum(interval_powers) <= transformer_max_kw)

    # (d) Energy target guarantee for each vehicle
    for v_idx in range(num_vehicles):
        req = veh_required_power_sum[v_idx]
        if req > 0:
            powers_for_v = [p[(v_idx, t)] for t in valid_intervals[v_idx]]
            model.Add(sum(powers_for_v) >= req)

    # 5. Objective Function Formulation
    # Cost + Carbon + Peak Penalty + Charger plug stability
    # Scale coefficients to integers for CP-SAT
    SCALE = 100
    objective_terms = []

    # Peak load variable
    peak_kw = model.NewIntVar(0, transformer_max_kw, "peak_kw")
    for t in range(TOTAL_INTERVALS):
        interval_powers = [
            p[(v_idx, t)]
            for v_idx in range(num_vehicles)
            if (v_idx, t) in p
        ]
        if interval_powers:
            model.Add(peak_kw >= sum(interval_powers))

    # Weight peak
    objective_terms.append(int(weight_peak * SCALE * 10) * peak_kw)

    # Interval unit costs
    for v_idx in range(num_vehicles):
        for t in valid_intervals[v_idx]:
            tariff_val = grid.tariffs[t]
            carbon_val = grid.carbon_intensities[t]

            # Weighted marginal cost per kW for this 15-min interval
            # DELTA_T = 0.25 hours
            # Cost = tariff * 0.25 * P
            # Carbon = carbon * 0.25 * P * 10 (scale carbon to comparable rupee scale)
            combined_cost_per_kw = (
                weight_cost * tariff_val * DELTA_T +
                weight_carbon * (carbon_val * 10.0) * DELTA_T
            )
            int_coeff = int(round(combined_cost_per_kw * SCALE))
            objective_terms.append(int_coeff * p[(v_idx, t)])

    # Session switching penalty (prevents unnecessary charger swapping)
    for v_idx in range(num_vehicles):
        t_list = valid_intervals[v_idx]
        for idx in range(len(t_list) - 1):
            t1 = t_list[idx]
            t2 = t_list[idx + 1]
            if t2 == t1 + 1:
                for c_idx in range(num_chargers):
                    if (v_idx, c_idx, t1) in x and (v_idx, c_idx, t2) in x:
                        # Favor keeping same charger
                        objective_terms.append(-int(0.2 * SCALE) * x[(v_idx, c_idx, t2)])

    model.Minimize(sum(objective_terms))

    # 6. Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 4
    solver.parameters.log_search_progress = False

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return DepotSchedule(
            schedule_id=f"infeasible_{int(time.time())}",
            schedule_type=schedule_type,
            is_feasible=False,
            infeasibility_reason=(
                "CP-SAT solver determined constraints cannot be satisfied. "
                "Depot transformer capacity or charger availability is insufficient "
                "for current fleet departure deadlines."
            ),
        )

    # 7. Extract Solution & Compile Metrics
    slots: List[ScheduledSlot] = []
    depot_load_kw = [0.0] * TOTAL_INTERVALS
    total_cost = 0.0
    total_carbon_kg = 0.0
    peak_observed = 0.0

    # Track per-vehicle delivered energy and SOC
    v_delivered_energy: Dict[str, float] = {v.id: 0.0 for v in vehicles}
    v_chargers_used: Dict[str, set] = {v.id: set() for v in vehicles}
    v_current_soc: Dict[str, float] = {
        v.id: (v.current_soc if v.current_soc is not None else v.arrival_soc)
        for v in vehicles
    }

    for t in range(TOTAL_INTERVALS):
        interval_kw_sum = 0.0

        for v_idx, v in enumerate(vehicles):
            if (v_idx, t) in p:
                kw_val = float(solver.Value(p[(v_idx, t)]))
                if kw_val > 0.01:
                    # Find which charger was assigned
                    assigned_c_id = "C01"
                    for c_idx, c in enumerate(chargers):
                        if (v_idx, c_idx, t) in x and solver.Value(x[(v_idx, c_idx, t)]) == 1:
                            assigned_c_id = c.id
                            break

                    v_chargers_used[v.id].add(assigned_c_id)
                    energy_grid = kw_val * DELTA_T
                    energy_battery = energy_grid * CHARGER_EFFICIENCY
                    v_delivered_energy[v.id] += energy_battery
                    soc_inc = energy_battery / v.battery_capacity_kwh
                    v_current_soc[v.id] = min(1.0, v_current_soc[v.id] + soc_inc)

                    slots.append(
                        ScheduledSlot(
                            interval=t,
                            timestamp=interval_to_clock(t),
                            vehicle_id=v.id,
                            charger_id=assigned_c_id,
                            power_kw=round(kw_val, 2),
                            energy_kwh=round(energy_grid, 2),
                            soc_after=round(v_current_soc[v.id], 4),
                        )
                    )
                    interval_kw_sum += kw_val

        depot_load_kw[t] = round(interval_kw_sum, 2)
        total_cost += interval_kw_sum * DELTA_T * grid.tariffs[t]
        total_carbon_kg += interval_kw_sum * DELTA_T * grid.carbon_intensities[t]
        if interval_kw_sum > peak_observed:
            peak_observed = interval_kw_sum

    # Compile vehicle summaries
    vehicle_summaries: List[ScheduleVehicleSummary] = []
    ready_count = 0
    total_energy_delivered = 0.0

    for v in vehicles:
        final_soc = v_current_soc[v.id]
        energy_deliv = v_delivered_energy[v.id]
        is_ready = final_soc >= (v.target_soc - 0.01)
        if is_ready:
            ready_count += 1
        total_energy_delivered += energy_deliv

        vehicle_summaries.append(
            ScheduleVehicleSummary(
                vehicle_id=v.id,
                arrival_clock=v.arrival_clock,
                departure_clock=v.departure_clock,
                initial_soc=round(v.current_soc or v.arrival_soc, 3),
                final_soc=round(final_soc, 3),
                target_soc=v.target_soc,
                energy_delivered_kwh=round(energy_deliv, 2),
                is_ready_on_time=is_ready,
                assigned_chargers=sorted(list(v_chargers_used[v.id])),
            )
        )

    reliability = (ready_count / len(vehicles)) * 100.0

    return DepotSchedule(
        schedule_id=f"{schedule_type.lower()}_{int(time.time())}",
        schedule_type=schedule_type,
        is_feasible=True,
        infeasibility_reason=None,
        depot_load_kw=depot_load_kw,
        slots=slots,
        vehicle_summaries=vehicle_summaries,
        total_cost=round(total_cost, 2),
        total_carbon_kg=round(total_carbon_kg, 2),
        peak_load_kw=round(peak_observed, 2),
        departure_reliability_pct=round(reliability, 1),
        total_energy_delivered_kwh=round(total_energy_delivered, 2),
    )
