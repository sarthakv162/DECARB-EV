"""
Configuration and constants for the Carbon-Aware EV Depot Orchestrator.
"""

from typing import Dict, Any

# Simulation Horizon
HORIZON_HOURS = 24
INTERVAL_MINUTES = 15
INTERVALS_PER_HOUR = 60 // INTERVAL_MINUTES  # 4
TOTAL_INTERVALS = HORIZON_HOURS * INTERVALS_PER_HOUR  # 96
DELTA_T = INTERVAL_MINUTES / 60.0  # 0.25 hours

# Simulation Start Time: 16:00 (4:00 PM) Day 1 to 16:00 Day 2
START_HOUR_OF_DAY = 16  # 16:00

# Depot Physical Constraints
TRANSFORMER_MAX_KW = 250.0  # Site power limit
SITE_TRANSFORMER_LIMIT_KW = TRANSFORMER_MAX_KW
NUM_CHARGERS = 10
CHARGER_MAX_KW = 50.0       # Each charger max power
CHARGER_EFFICIENCY = 0.92   # AC to DC & battery charging roundtrip efficiency

# Fleet Parameters
NUM_VEHICLES = 40

# Optimization Weights (Default)
DEFAULT_WEIGHT_COST = 1.0     # Alpha: electricity bill minimization
DEFAULT_WEIGHT_CARBON = 2.5   # Beta: kg CO2e avoidance weight
DEFAULT_WEIGHT_PEAK = 0.5     # Gamma: peak shaving / infrastructure smoothing penalty

# Currency & Metric Units
CURRENCY_SYMBOL = "₹"
CARBON_UNIT = "kg CO₂e"
