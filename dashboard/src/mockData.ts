import { DepotState, Vehicle, Charger, Schedule, GridProfile, AuditEvent, Proposal } from './types';

export function formatIntervalToClock(interval: number): string {
  // Interval 0 corresponds to 16:00
  const totalMinutes = (16 * 60 + interval * 15) % 1440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function generateMockGridProfile(): GridProfile {
  const intervals: number[] = [];
  const carbon_intensity_kg_per_kwh: number[] = [];
  const tariff_inr_per_kwh: number[] = [];

  for (let t = 0; t < 96; t++) {
    intervals.push(t);
    const clock = formatIntervalToClock(t);
    const hour = parseInt(clock.split(':')[0], 10);

    // Diurnal Carbon Intensity (kg/kWh)
    let carbon = 0.55;
    if (hour >= 18 && hour < 22) {
      carbon = 0.76 + Math.sin(t * 0.1) * 0.06; // evening thermal peak 0.72 - 0.82
    } else if (hour >= 1 && hour < 5) {
      carbon = 0.39 + Math.cos(t * 0.1) * 0.03; // clean wind valley 0.38 - 0.42
    } else if (hour >= 11 && hour < 14) {
      carbon = 0.44 + Math.sin(t * 0.2) * 0.02; // solar valley
    } else {
      carbon = 0.58 + Math.sin(t * 0.15) * 0.04;
    }
    carbon_intensity_kg_per_kwh.push(parseFloat(carbon.toFixed(3)));

    // Time-of-Use Tariff (₹/kWh)
    let tariff = 7.80;
    if (hour >= 18 && hour < 22) {
      tariff = 11.50; // Evening Peak
    } else if (hour >= 0 && hour < 6) {
      tariff = 4.20; // Night Off-Peak
    } else {
      tariff = 7.80; // Standard Day
    }
    tariff_inr_per_kwh.push(tariff);
  }

  return { intervals, carbon_intensity_kg_per_kwh, tariff_inr_per_kwh };
}

export function generateMockBaselineLoad(): number[] {
  const loads: number[] = new Array(96).fill(0);
  // Unmanaged plug-and-charge spikes to 482.6 kW between intervals 4 and 24 (17:00 - 22:00)
  for (let t = 0; t < 96; t++) {
    if (t >= 3 && t <= 24) {
      const peakFactor = Math.sin(((t - 3) / 21) * Math.PI);
      loads[t] = parseFloat((220 + peakFactor * 262.6).toFixed(1));
    } else if (t > 24 && t <= 32) {
      loads[t] = parseFloat((120 - (t - 24) * 12).toFixed(1));
    } else {
      loads[t] = 0;
    }
  }
  return loads;
}

export function generateMockOptimizedLoad(): number[] {
  const loads: number[] = new Array(96).fill(0);
  // Managed schedule strictly caps at 250 kW, shifting load to clean intervals 34 to 52 (00:30 - 05:00)
  for (let t = 0; t < 96; t++) {
    if (t >= 36 && t <= 50) {
      // Clean off-peak window flatlined at 250 kW transformer ceiling
      loads[t] = 250.0;
    } else if (t === 34 || t === 35 || t === 51) {
      loads[t] = 200.0;
    } else if (t >= 8 && t <= 12) {
      // Trickle charge for critical urgent vans needing immediate range
      loads[t] = 50.0;
    } else {
      loads[t] = 0.0;
    }
  }
  return loads;
}

export function generateMockVehicles(): Vehicle[] {
  const vehicles: Vehicle[] = [];
  const capacities = [60, 70, 80];

  for (let i = 1; i <= 40; i++) {
    const id = `V${i.toString().padStart(2, '0')}`;
    const battery = capacities[(i - 1) % capacities.length];
    
    // Arrival between 16:00 and 19:30 (intervals 0 to 14)
    const arrInterval = (i * 2) % 14;
    // Departure between 05:00 and 07:00 (intervals 52 to 60)
    const depInterval = 52 + ((i * 3) % 9);

    const arrSoc = 20 + ((i * 7) % 25); // 20% to 44%
    const targetSoc = 85 + ((i % 2) * 5); // 85% or 90%
    
    const energyNeeded = ((targetSoc - arrSoc) / 100) * battery;

    // Assigned charging intervals during 00:30 - 05:00 (intervals 34 to 51)
    const sessionLength = Math.ceil(energyNeeded / 12.5); // 12.5 kWh per 15-min at 50 kW
    const startShift = 34 + ((i - 1) % 12);
    const chargingIntervals: number[] = [];
    for (let s = 0; s < sessionLength; s++) {
      chargingIntervals.push(startShift + s);
    }

    const bayNum = ((i - 1) % 10) + 1;

    vehicles.push({
      id,
      battery_capacity_kwh: battery,
      arrival_interval: arrInterval,
      departure_interval: depInterval,
      arrival_soc: arrSoc,
      target_soc: targetSoc,
      arrival_clock: formatIntervalToClock(arrInterval),
      departure_clock: formatIntervalToClock(depInterval),
      current_soc: targetSoc, // scheduled to reach target
      energy_needed_kwh: parseFloat(energyNeeded.toFixed(1)),
      energy_delivered_kwh: parseFloat(energyNeeded.toFixed(1)),
      assigned_bay: `C${bayNum.toString().padStart(2, '0')}`,
      charging_intervals: chargingIntervals,
    });
  }

  return vehicles;
}

export function generateMockChargers(interval: number = 38): Charger[] {
  const chargers: Charger[] = [];
  // At interval 38 (01:30 clean window), exactly 5 chargers are active (250 kW ceiling)
  const activeBays = [1, 2, 3, 4, 5];

  for (let i = 1; i <= 10; i++) {
    const id = `C${i.toString().padStart(2, '0')}`;
    const isActive = activeBays.includes(i) && interval >= 34 && interval <= 50;
    
    chargers.push({
      id,
      max_kw: 50.0,
      status: 'ONLINE',
      fault_start_interval: null,
      fault_end_interval: null,
      current_kw: isActive ? 50.0 : 0.0,
      current_vehicle_id: isActive ? `V${(i * 3).toString().padStart(2, '0')}` : null,
      temperature_c: isActive ? 41.2 : 24.5,
      efficiency_pct: 98.6,
    });
  }

  return chargers;
}

export function generateInitialMockState(): DepotState {
  const grid = generateMockGridProfile();
  const baselineLoads = generateMockBaselineLoad();
  const optLoads = generateMockOptimizedLoad();
  const vehicles = generateMockVehicles();
  const chargers = generateMockChargers(38);

  const recentEvents: AuditEvent[] = [
    {
      id: 'EVT-90412',
      timestamp: '16:00:00',
      source: 'aws.eventbridge/ev-depot-telemetry-bus',
      event_type: 'DEPOT_DISPATCH_INITIALIZED',
      title: 'Global Dispatch Schedule Initialized',
      description: 'OR-Tools CP-SAT generated nominal dispatch. 40 vans mapped to 10 chargers with 0 transformer limit breaches.',
      details: { solver_time_ms: 780, peak_kw: 250.0, ready_pct: 100 },
    },
    {
      id: 'EVT-90413',
      timestamp: '16:15:22',
      source: 'validator.service/hard-constraints',
      event_type: 'VALIDATOR_GATE_PASSED',
      title: 'Deterministic Safety Verification: PASSED',
      description: 'Zero hard constraint violations: Peak Load <= 250 kW, max chargers <= 10, all 40 departure deadlines met.',
      details: { violations: 0, checked_intervals: 96 },
    },
    {
      id: 'EVT-90414',
      timestamp: '16:30:00',
      source: 'aws.cloudwatch/metrics',
      event_type: 'CLOUDWATCH_METRICS_SYNC',
      title: 'CloudWatch Telemetry Synchronized',
      description: 'DepotLoadKW, TransformerHeadroomKW, and CarbonEmissionsKG published to AWS CloudWatch.',
      details: { namespace: 'EVDepot/Operations', region: 'us-east-1' },
    },
  ];

  return {
    current_interval: 38, // 01:30 AM (in the peak clean charging window)
    current_clock: '01:30',
    chargers,
    vehicles,
    baseline_schedule: {
      interval_loads: baselineLoads,
      total_energy_kwh: 1840.0,
      total_cost_inr: 33850.0,
      total_carbon_kg: 2460.0,
    },
    active_schedule: {
      interval_loads: optLoads,
      total_energy_kwh: 1840.0,
      total_cost_inr: 13612.0,
      total_carbon_kg: 1468.0,
    },
    pending_proposal: null,
    impact_metrics: {
      baseline_cost_inr: 33850.0,
      optimized_cost_inr: 13612.0,
      cost_savings_inr: 20238.0,
      cost_savings_pct: 59.8,
      baseline_carbon_kg: 2460.0,
      optimized_carbon_kg: 1468.0,
      carbon_reduction_kg: 992.0,
      carbon_reduction_pct: 40.3,
      baseline_peak_kw: 482.6,
      optimized_peak_kw: 250.0,
      peak_reduction_pct: 48.2,
      ready_vehicles_pct: 100.0,
    },
    recent_events: recentEvents,
    aws: {
      account_id: '600558611810',
      region: 'us-east-1',
      bedrock_model_id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      dynamodb_active: true,
      eventbridge_active: true,
      cloudwatch_active: true,
    },
    grid,
  };
}

export function createSimulatedProposal(type: 'CAP_DROP' | 'CHARGER_FAULT' | 'CARBON_SPIKE' | 'ARRIVAL_DELAY'): Proposal {
  if (type === 'CAP_DROP') {
    return {
      id: 'PROP-CD-2115',
      status: 'PENDING_APPROVAL',
      trigger_event: {
        event_type: 'UTILITY_CAP_DROP',
        title: 'UTILITY CAPACITY CURTAILMENT: 180 kW CAP',
        description: 'Regional utility curtailed site interconnect at 21:15 from 250 kW -> 180 kW due to local grid substation thermal alert.',
        timestamp: '21:15:00',
        details: { previous_cap_kw: 250.0, new_cap_kw: 180.0, curtailment_kw: 70.0 },
      },
      agent_explanation: 'Distribution utility curtailed site power from 250 kW to 180 kW effective 21:15. Safe Mode (Deadline-First EDF with Bay Swaps) absorbed the curtailment immediately: reallocated active sessions within the tighter 180 kW budget. 100% departure readiness is preserved across all 40 delivery vans. Over-night attendant task list updated.',
      cost_delta: 62.00,
      carbon_delta: 0.80,
      affected_vehicles: ['V04', 'V09', 'V15', 'V22', 'V28'],
      validator_proof: 'Deterministic validator verified 0 transformer overloads (<=180 kW ceiling) and 100% departure readiness.',
    };
  }

  if (type === 'CHARGER_FAULT') {
    return {
      id: 'PROP-CF-8821',
      status: 'PENDING_APPROVAL',
      trigger_event: {
        event_type: 'CHARGER_HARDWARE_FAULT',
        title: 'CHARGER BAY C04 OVERCURRENT TRIP',
        description: 'Hardware breaker tripped on Bay C04 at interval 21 (21:15). Bay rendered offline until morning maintenance shift.',
        timestamp: '21:15:00',
        details: { charger_id: 'C04', fault_type: 'OVERCURRENT_PROTECTION' },
      },
      agent_explanation: 'Charger Bay C04 tripped offline due to an overcurrent fault at 21:15. Claude 3.5 Sonnet orchestrated an immediate CP-SAT re-solve reallocating 4 affected vehicles (V04, V14, V24, V34) to remaining 9 healthy bays during clean off-peak intervals (01:00–04:30). Peak transformer load remains strictly capped at 250.0 kW. All 40 departure deadlines are guaranteed.',
      cost_delta: 142.50,
      carbon_delta: 1.20,
      affected_vehicles: ['V04', 'V14', 'V24', 'V34'],
      validator_proof: 'Deterministic validator verified 0 transformer overloads (max 250 kW), max concurrent chargers <= 9, 100% departure readiness.',
    };
  }

  if (type === 'CARBON_SPIKE') {
    return {
      id: 'PROP-CS-9943',
      status: 'PENDING_APPROVAL',
      trigger_event: {
        event_type: 'GRID_CARBON_INTENSITY_SPIKE',
        title: 'GRID OPERATOR RENEWABLE CURTAILMENT ALERT',
        description: 'Regional transmission operator curtailed offshore wind generation between 01:00 and 04:00. Grid carbon factor increased by +0.32 kg/kWh (+42%).',
        timestamp: '00:45:00',
        details: { delta_carbon: '+0.32 kg/kWh', window: '01:00 - 04:00' },
      },
      agent_explanation: 'Grid carbon factor spiked unexpectedly by +0.32 kg/kWh due to wind curtailment between 01:00 and 04:00. The orchestrator re-scheduled 32 flexible charging sessions forward into the early morning solar/hydro recovery hours (04:15–06:30) while strictly protecting all 07:00 morning route departure deadlines and preserving the 250 kW transformer ceiling.',
      cost_delta: 310.00,
      carbon_delta: 18.40,
      affected_vehicles: ['V01', 'V03', 'V05', 'V07', 'V09', 'V11', 'V13', 'V15'],
      validator_proof: 'Zero violations: all 40 vehicles achieve target SOC before morning departure, peak load never breaches 250 kW.',
    };
  }

  return {
    id: 'PROP-AD-7731',
    status: 'PENDING_APPROVAL',
    trigger_event: {
      event_type: 'FLEET_INBOUND_DELAY',
      title: 'HIGHWAY LOGISTICS INBOUND TRAFFIC DELAY',
      description: 'Severe traffic corridor delay delayed return of Vans V01, V02, V03 by 2 hours (inbound arrival pushed to 18:30).',
      timestamp: '17:00:00',
      details: { delayed_vans: ['V01', 'V02', 'V03'], delay_hours: 2 },
    },
    agent_explanation: 'Vans V01, V02, and V03 experienced an inbound traffic delay of 120 minutes. The agent dynamically compressed the charging dwell window, scheduling these high-priority delivery vans on higher priority slots at 50 kW between 02:00 and 05:00. No departure SLA compromised.',
    cost_delta: 85.00,
    carbon_delta: 0.60,
    affected_vehicles: ['V01', 'V02', 'V03'],
    validator_proof: 'Zero violations: validated departure readiness 100% across all 40 vehicles.',
  };
}
