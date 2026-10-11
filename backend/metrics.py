"""
Operational & Environmental Impact Accounting Metrics.
Computes precise deltas between Baseline (unmanaged) and Optimized/Replanned schedules.
"""

from typing import Dict, Any
from pydantic import BaseModel
from backend.models import DepotSchedule
from backend.config import DELTA_T, CURRENCY_SYMBOL


class ImpactMetrics(BaseModel):
    baseline_cost: float
    optimized_cost: float
    cost_saved: float
    cost_saved_pct: float

    baseline_carbon_kg: float
    optimized_carbon_kg: float
    carbon_avoided_kg: float
    carbon_avoided_pct: float

    baseline_peak_kw: float
    optimized_peak_kw: float
    peak_shaved_kw: float
    peak_reduction_pct: float

    energy_shifted_kwh: float
    total_energy_kwh: float

    baseline_reliability_pct: float
    optimized_reliability_pct: float

    summary_text: str


def compute_impact_metrics(
    baseline: DepotSchedule,
    optimized: DepotSchedule,
) -> ImpactMetrics:
    """
    Computes comparative metrics between baseline and optimized schedule.
    """
    cost_saved = max(0.0, baseline.total_cost - optimized.total_cost)
    cost_saved_pct = (cost_saved / baseline.total_cost * 100.0) if baseline.total_cost > 0 else 0.0

    carbon_avoided = max(0.0, baseline.total_carbon_kg - optimized.total_carbon_kg)
    carbon_avoided_pct = (carbon_avoided / baseline.total_carbon_kg * 100.0) if baseline.total_carbon_kg > 0 else 0.0

    peak_shaved = max(0.0, baseline.peak_load_kw - optimized.peak_load_kw)
    peak_pct = (peak_shaved / baseline.peak_load_kw * 100.0) if baseline.peak_load_kw > 0 else 0.0

    # Calculate energy shifted: sum of positive differences where baseline > optimized
    energy_shifted = 0.0
    for b_kw, o_kw in zip(baseline.depot_load_kw, optimized.depot_load_kw):
        if b_kw > o_kw:
            energy_shifted += (b_kw - o_kw) * DELTA_T

    summary = (
        f"Avoided {carbon_avoided:.1f} kg CO₂e ({carbon_avoided_pct:.1f}% reduction), "
        f"saved {CURRENCY_SYMBOL}{cost_saved:.0f} ({cost_saved_pct:.1f}% cost reduction), "
        f"and shaved {peak_shaved:.0f} kW ({peak_pct:.1f}%) off peak transformer load "
        f"while maintaining {optimized.departure_reliability_pct:.1f}% on-time departure readiness."
    )

    return ImpactMetrics(
        baseline_cost=round(baseline.total_cost, 2),
        optimized_cost=round(optimized.total_cost, 2),
        cost_saved=round(cost_saved, 2),
        cost_saved_pct=round(cost_saved_pct, 1),
        baseline_carbon_kg=round(baseline.total_carbon_kg, 2),
        optimized_carbon_kg=round(optimized.total_carbon_kg, 2),
        carbon_avoided_kg=round(carbon_avoided, 2),
        carbon_avoided_pct=round(carbon_avoided_pct, 1),
        baseline_peak_kw=round(baseline.peak_load_kw, 2),
        optimized_peak_kw=round(optimized.peak_load_kw, 2),
        peak_shaved_kw=round(peak_shaved, 2),
        peak_reduction_pct=round(peak_pct, 1),
        energy_shifted_kwh=round(energy_shifted, 2),
        total_energy_kwh=round(optimized.total_energy_delivered_kwh, 2),
        baseline_reliability_pct=round(baseline.departure_reliability_pct, 1),
        optimized_reliability_pct=round(optimized.departure_reliability_pct, 1),
        summary_text=summary,
    )
