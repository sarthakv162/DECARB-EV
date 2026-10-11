"""
Synthetic realistic data generator for the EV depot, vehicles, chargers,
and 24-hour grid carbon & time-of-use tariffs.
"""

import math
from typing import List, Tuple
from backend.config import (
    TOTAL_INTERVALS,
    NUM_VEHICLES,
    NUM_CHARGERS,
    CHARGER_MAX_KW,
    START_HOUR_OF_DAY,
)
from backend.models import Vehicle, Charger, GridEnvironment, interval_to_clock


def generate_grid_environment() -> GridEnvironment:
    """
    Generate realistic 24-hour profiles for:
    1. Grid Carbon Intensity (kg CO2e / kWh)
    2. Time-of-Use Electricity Tariff (₹ / kWh)
    Starting at 16:00 (Interval 0) to 16:00 next day (Interval 95).
    """
    intervals = list(range(TOTAL_INTERVALS))
    timestamps = [interval_to_clock(i) for i in intervals]
    tariffs: List[float] = []
    carbon_intensities: List[float] = []

    for i in intervals:
        # Calculate actual hour of day (0.0 to 24.0)
        hour = (START_HOUR_OF_DAY + i * 0.25) % 24.0

        # Tariff Structure (Time-of-Use Indian Commercial / EV Tariff Model)
        # Peak (18:00 - 22:00): ₹11.50 / kWh
        # Morning Ramp (06:00 - 10:00): ₹8.50 / kWh
        # Normal Day (10:00 - 18:00): ₹6.80 / kWh
        # Off-Peak Night (22:00 - 06:00): ₹4.20 / kWh
        if 18.0 <= hour < 22.0:
            tariff = 11.50
        elif 6.0 <= hour < 10.0:
            tariff = 8.50
        elif 22.0 <= hour or hour < 6.0:
            tariff = 4.20
        else:
            tariff = 6.80
        tariffs.append(round(tariff, 2))

        # Carbon Intensity Curve (Diurnal mix with solar dip & evening thermal peak)
        # Deep night (01:00 - 05:00): ~0.38 - 0.44 kg/kWh (wind baseload)
        # Morning rise (06:00 - 09:00): ~0.65 - 0.72 kg/kWh
        # Afternoon solar peak (11:00 - 15:00): ~0.48 - 0.54 kg/kWh (solar generation)
        # Evening peak (18:00 - 22:00): ~0.78 - 0.86 kg/kWh (coal/gas peakers)
        if 18.0 <= hour < 22.0:
            # Evening fossil peak
            carbon = 0.82 + 0.04 * math.sin((hour - 18.0) / 4.0 * math.pi)
        elif 1.0 <= hour < 5.0:
            # Clean night window
            carbon = 0.38 + 0.03 * math.cos((hour - 1.0) / 4.0 * math.pi)
        elif 11.0 <= hour < 15.0:
            # Daytime solar dip
            carbon = 0.48 - 0.04 * math.sin((hour - 11.0) / 4.0 * math.pi)
        elif 5.0 <= hour < 10.0:
            # Morning ramp
            carbon = 0.65 + 0.06 * ((hour - 5.0) / 5.0)
        else:
            carbon = 0.60 + 0.05 * math.sin(hour * 0.5)

        carbon_intensities.append(round(carbon, 3))

    return GridEnvironment(
        intervals=intervals,
        timestamps=timestamps,
        tariffs=tariffs,
        carbon_intensities=carbon_intensities,
    )


def generate_chargers() -> List[Charger]:
    """Generate 10 DC fast chargers (50 kW each)."""
    return [
        Charger(id=f"C{i+1:02d}", max_kw=CHARGER_MAX_KW, status="ONLINE")
        for i in range(NUM_CHARGERS)
    ]


def generate_fleet() -> List[Vehicle]:
    """
    Generate 40 electric delivery vans returning in the evening
    and departing the following morning.
    """
    vehicles: List[Vehicle] = []

    # Deterministic seed data with realistic operational variation
    # Vans return in 3 arrival waves:
    # Wave 1 (Early return): 17:00 - 18:00 (intervals 4 - 8)
    # Wave 2 (Main return):  18:15 - 19:45 (intervals 9 - 15)
    # Wave 3 (Late return):  20:00 - 21:00 (intervals 16 - 20)
    #
    # Morning dispatch waves:
    # Wave 1 (Early routes): 05:30 - 06:30 (intervals 54 - 58)
    # Wave 2 (Core routes):  06:45 - 07:30 (intervals 59 - 62)
    # Wave 3 (Late routes):  07:45 - 08:30 (intervals 63 - 66)

    spec_templates = [
        # (arr_interval, dep_interval, arr_soc, target_soc, cap_kwh, priority)
        # Wave 1: 17:00-18:00 arrivals (intervals 4..8)
        (4, 54, 0.28, 0.90, 70.0, 1),   # V01: Arr 17:00, Dep 05:30
        (4, 55, 0.35, 0.85, 68.0, 1),   # V02
        (5, 54, 0.20, 0.95, 75.0, 2),   # V03: High priority early departure
        (5, 56, 0.40, 0.90, 70.0, 1),   # V04
        (6, 55, 0.25, 0.90, 72.0, 1),   # V05
        (6, 58, 0.32, 0.88, 70.0, 1),   # V06
        (7, 57, 0.18, 0.92, 75.0, 1),   # V07
        (7, 60, 0.45, 0.85, 65.0, 1),   # V08
        (8, 56, 0.30, 0.90, 70.0, 1),   # V09
        (8, 59, 0.22, 0.95, 72.0, 2),   # V10: High priority

        # Wave 2: 18:15-19:45 arrivals (intervals 9..15)
        (9, 58, 0.35, 0.90, 70.0, 1),   # V11
        (9, 61, 0.24, 0.90, 75.0, 1),   # V12
        (10, 57, 0.40, 0.85, 68.0, 1),  # V13
        (10, 60, 0.29, 0.90, 70.0, 1),  # V14
        (11, 59, 0.15, 0.95, 76.0, 2),  # V15: Heavy drain
        (11, 62, 0.33, 0.90, 70.0, 1),  # V16
        (12, 58, 0.27, 0.90, 72.0, 1),  # V17 (Key scenario vehicle)
        (12, 61, 0.38, 0.88, 68.0, 1),  # V18
        (13, 60, 0.21, 0.92, 75.0, 1),  # V19
        (13, 63, 0.42, 0.85, 65.0, 1),  # V20
        (14, 59, 0.31, 0.90, 70.0, 1),  # V21
        (14, 62, 0.26, 0.90, 72.0, 1),  # V22
        (14, 64, 0.19, 0.95, 75.0, 2),  # V23
        (15, 61, 0.36, 0.88, 68.0, 1),  # V24
        (15, 63, 0.28, 0.90, 70.0, 1),  # V25

        # Wave 3: 20:00-21:00 arrivals (intervals 16..20)
        (16, 62, 0.25, 0.90, 72.0, 1),  # V26
        (16, 65, 0.34, 0.88, 70.0, 1),  # V27
        (17, 63, 0.18, 0.95, 75.0, 2),  # V28: Late arrival, needs big charge
        (17, 64, 0.39, 0.85, 65.0, 1),  # V29
        (18, 62, 0.30, 0.90, 70.0, 1),  # V30
        (18, 66, 0.22, 0.92, 75.0, 1),  # V31
        (19, 64, 0.27, 0.90, 72.0, 1),  # V32
        (19, 65, 0.33, 0.88, 70.0, 1),  # V33
        (20, 63, 0.16, 0.95, 78.0, 2),  # V34: Deep drain
        (20, 66, 0.41, 0.85, 65.0, 1),  # V35

        # Wave 3 extension: 20:45-21:15 arrivals (intervals 19..21)
        (19, 62, 0.29, 0.90, 70.0, 1),  # V36
        (20, 64, 0.35, 0.90, 70.0, 1),  # V37
        (20, 65, 0.23, 0.92, 72.0, 1),  # V38
        (21, 64, 0.31, 0.88, 68.0, 1),  # V39
        (21, 66, 0.26, 0.90, 72.0, 1),  # V40
    ]

    for idx, (arr, dep, arr_soc, tgt_soc, cap, prio) in enumerate(spec_templates):
        vid = f"V{idx+1:02d}"
        vehicles.append(
            Vehicle(
                id=vid,
                model_name="Fleet Delivery EV",
                battery_capacity_kwh=cap,
                arrival_interval=arr,
                departure_interval=dep,
                arrival_soc=arr_soc,
                target_soc=tgt_soc,
                current_soc=arr_soc,
                priority=prio,
            )
        )

    return vehicles
