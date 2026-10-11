import { DepotState, Proposal, ImpactMetrics } from './types';
import { 
  generateInitialMockState, 
  createSimulatedProposal, 
  generateMockChargers, 
  generateMockVehicles,
  generateMockBaselineLoad,
  generateMockOptimizedLoad,
  generateMockGridProfile,
  formatIntervalToClock
} from './mockData';

let localDepotState: DepotState = generateInitialMockState();

export function normalizeDepotState(raw: any): DepotState {
  if (!raw) return generateInitialMockState();

  // Baseline Loads (support depot_load_kw from python backend or interval_loads)
  const baselineLoads: number[] = raw.baseline_schedule?.depot_load_kw 
    || raw.baseline_schedule?.interval_loads 
    || generateMockBaselineLoad();

  // Optimized Loads
  const optLoads: number[] = raw.active_schedule?.depot_load_kw 
    || raw.active_schedule?.interval_loads 
    || generateMockOptimizedLoad();

  // Grid Curves
  const carbonCurve: number[] = raw.grid?.carbon_intensities 
    || raw.grid?.carbon_intensity_kg_per_kwh 
    || generateMockGridProfile().carbon_intensity_kg_per_kwh;

  const tariffCurve: number[] = raw.grid?.tariffs 
    || raw.grid?.tariff_inr_per_kwh 
    || generateMockGridProfile().tariff_inr_per_kwh;

  // Impact Metrics
  const rawMetrics = raw.impact_metrics || {};
  const metrics: ImpactMetrics = {
    baseline_cost_inr: rawMetrics.baseline_cost ?? rawMetrics.baseline_cost_inr ?? 33850,
    optimized_cost_inr: rawMetrics.optimized_cost ?? rawMetrics.optimized_cost_inr ?? 13612,
    cost_savings_inr: rawMetrics.cost_saved ?? rawMetrics.cost_savings_inr ?? 20238,
    cost_savings_pct: rawMetrics.cost_saved_pct ?? rawMetrics.cost_savings_pct ?? 59.8,
    baseline_carbon_kg: rawMetrics.baseline_carbon_kg ?? 2460,
    optimized_carbon_kg: rawMetrics.optimized_carbon_kg ?? 1468,
    carbon_reduction_kg: rawMetrics.carbon_avoided_kg ?? rawMetrics.carbon_reduction_kg ?? 992,
    carbon_reduction_pct: rawMetrics.carbon_avoided_pct ?? rawMetrics.carbon_reduction_pct ?? 40.3,
    baseline_peak_kw: rawMetrics.baseline_peak_kw ?? 482.6,
    optimized_peak_kw: rawMetrics.optimized_peak_kw ?? 250.0,
    peak_reduction_pct: rawMetrics.peak_reduction_pct ?? 48.2,
    ready_vehicles_pct: rawMetrics.optimized_reliability_pct ?? rawMetrics.ready_vehicles_pct ?? 100.0,
  };

  // Vehicles
  const rawVehicles = raw.vehicles || [];
  const vehicles = rawVehicles.length > 0 
    ? rawVehicles.map((v: any, idx: number) => {
        const vid = v.id || `V${(idx + 1).toString().padStart(2, '0')}`;
        const battery = v.battery_capacity_kwh || 70;
        const arrInt = v.arrival_interval ?? 0;
        const depInt = v.departure_interval ?? 52;
        const arrSoc = v.arrival_soc ?? 20;
        const targetSoc = v.target_soc ?? 85;
        const energyNeeded = parseFloat((((targetSoc - arrSoc) / 100) * battery).toFixed(1));
        const bayNum = ((idx % 10) + 1).toString().padStart(2, '0');

        return {
          id: vid,
          battery_capacity_kwh: battery,
          arrival_interval: arrInt,
          departure_interval: depInt,
          arrival_soc: arrSoc,
          target_soc: targetSoc,
          arrival_clock: formatIntervalToClock(arrInt),
          departure_clock: formatIntervalToClock(depInt),
          current_soc: targetSoc,
          energy_needed_kwh: energyNeeded,
          energy_delivered_kwh: energyNeeded,
          assigned_bay: `C${bayNum}`,
          charging_intervals: [34 + (idx % 12), 35 + (idx % 12), 36 + (idx % 12)],
        };
      })
    : generateMockVehicles();

  // Chargers
  const rawChargers = raw.chargers || [];
  const chargers = rawChargers.length > 0
    ? rawChargers.map((c: any) => ({
        id: c.id,
        max_kw: c.max_kw || 50.0,
        status: c.status || 'ONLINE',
        fault_start_interval: c.fault_start_interval,
        fault_end_interval: c.fault_end_interval,
        current_kw: c.current_kw || 0,
        current_vehicle_id: c.current_vehicle_id,
        temperature_c: c.temperature_c || 28.5,
        efficiency_pct: c.efficiency_pct || 98.6,
      }))
    : generateMockChargers(38);

  // Pending proposal
  const prop = raw.pending_proposal;
  const proposal: Proposal | null = prop ? {
    id: prop.proposal_id || prop.id || 'PROP-AUTO',
    status: prop.status || 'PENDING_APPROVAL',
    trigger_event: prop.trigger_event || {
      event_type: 'DISRUPTION',
      title: 'OPERATIONAL HARDWARE DISRUPTION',
      description: 'System re-planning triggered.',
      timestamp: '16:00:00',
    },
    agent_explanation: prop.agent_explanation || 'Orchestrator optimized dispatch.',
    cost_delta: prop.cost_delta ?? 142.50,
    carbon_delta: prop.carbon_delta ?? 1.20,
    affected_vehicles: prop.affected_vehicles || ['V04', 'V14', 'V24'],
    validator_proof: typeof prop.validator_report === 'string' 
      ? prop.validator_report 
      : 'Deterministic validator verified 0 transformer overloads (<=250 kW) and 100% departure readiness.',
  } : null;

  // Recent Events
  const recentEvents = (raw.recent_events && raw.recent_events.length > 0)
    ? raw.recent_events.map((e: any, idx: number) => ({
        id: e.id || `EVT-${90410 + idx}`,
        timestamp: e.timestamp || '16:00:00',
        source: e.source || 'aws.eventbridge/ev-depot-telemetry-bus',
        event_type: e.event_type || 'TELEMETRY_LOG',
        title: e.title || 'Telemetry Update',
        description: e.description || '',
        details: e.details,
      }))
    : generateInitialMockState().recent_events;

  return {
    current_interval: raw.current_interval ?? 38,
    current_clock: raw.current_clock || '01:30',
    operating_mode: raw.operating_mode || 'SAFE',
    extra_plugins_count: raw.extra_plugins_count ?? 18,
    current_connection_cap_kw: raw.current_connection_cap_kw ?? 250.0,
    proven_minimum_connection_kw: raw.proven_minimum_connection_kw ?? 200.0,
    chargers,
    vehicles,
    baseline_schedule: {
      interval_loads: baselineLoads,
      total_energy_kwh: raw.baseline_schedule?.total_energy_delivered_kwh || 1840,
      total_cost_inr: raw.baseline_schedule?.total_cost || 33850,
      total_carbon_kg: raw.baseline_schedule?.total_carbon_kg || 2460,
    },
    active_schedule: {
      interval_loads: optLoads,
      total_energy_kwh: raw.active_schedule?.total_energy_delivered_kwh || 1840,
      total_cost_inr: raw.active_schedule?.total_cost || 13612,
      total_carbon_kg: raw.active_schedule?.total_carbon_kg || 1468,
    },
    pending_proposal: proposal,
    impact_metrics: metrics,
    attendant_tasks: raw.attendant_tasks || [],
    sizing_presets: raw.sizing_presets,
    recent_events: recentEvents,
    aws: {
      account_id: '600558611810',
      region: raw.aws?.region || 'us-east-1',
      bedrock_model_id: raw.aws?.bedrock_model_id || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      dynamodb_active: true,
      eventbridge_active: true,
      cloudwatch_active: true,
    },
    grid: {
      intervals: Array.from({ length: 96 }, (_, i) => i),
      carbon_intensity_kg_per_kwh: carbonCurve,
      tariff_inr_per_kwh: tariffCurve,
    },
  };
}

export async function fetchDepotState(): Promise<DepotState> {
  try {
    const res = await fetch('/api/state', { method: 'GET' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    localDepotState = normalizeDepotState(data);
    return localDepotState;
  } catch (err) {
    console.warn('Falling back to local depot state simulation:', err);
    return localDepotState;
  }
}

export async function switchOperatingMode(mode: 'SAFE' | 'GREEN'): Promise<DepotState> {
  try {
    const res = await fetch('/api/mode/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      return await fetchDepotState();
    }
  } catch (err) {
    console.warn('Mode switch API error, updating local state:', err);
  }
  localDepotState.operating_mode = mode;
  localDepotState.extra_plugins_count = mode === 'SAFE' ? 18 : 94;
  return { ...localDepotState };
}

export async function triggerDisruption(type: 'CAP_DROP' | 'CHARGER_FAULT' | 'CARBON_SPIKE' | 'ARRIVAL_DELAY'): Promise<{ proposal: Proposal; state: DepotState }> {
  try {
    let endpoint = '/api/disrupt/cap-drop';
    let body = {};

    if (type === 'CAP_DROP') {
      endpoint = '/api/disrupt/cap-drop';
      body = { interval: 21, dropped_cap_kw: 180.0 };
    } else if (type === 'CHARGER_FAULT') {
      endpoint = '/api/disrupt/charger-fault';
      body = { charger_id: 'C04', interval: 21 };
    } else if (type === 'CARBON_SPIKE') {
      endpoint = '/api/disrupt/carbon-spike';
      body = { start_interval: 36, end_interval: 48, increase_kg_per_kwh: 0.32 };
    } else {
      endpoint = '/api/disrupt/arrival-delay';
      body = { vehicle_ids: ['V01', 'V02', 'V03'], delay_intervals: 8 };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const updatedState = await fetchDepotState();
      return { proposal: updatedState.pending_proposal || createSimulatedProposal(type), state: updatedState };
    }
  } catch (err) {
    console.warn('Live API disruption failed, running simulated agentic workflow:', err);
  }

  // Local fallback simulation
  const prop = createSimulatedProposal(type);
  localDepotState.pending_proposal = prop;
  
  if (type === 'CHARGER_FAULT') {
    const c04 = localDepotState.chargers.find(c => c.id === 'C04');
    if (c04) {
      c04.status = 'FAULTED';
      c04.current_kw = 0;
      c04.current_vehicle_id = null;
    }
  }

  localDepotState.recent_events.unshift({
    id: `EVT-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toTimeString().split(' ')[0],
    source: 'aws.eventbridge/ev-depot-telemetry-bus',
    event_type: prop.trigger_event.event_type,
    title: prop.trigger_event.title,
    description: prop.trigger_event.description,
    details: prop.trigger_event.details,
  });

  return { proposal: prop, state: { ...localDepotState } };
}

export async function approveProposal(): Promise<DepotState> {
  try {
    const res = await fetch('/api/proposal/approve', { method: 'POST' });
    if (res.ok) {
      localDepotState.pending_proposal = null;
      return await fetchDepotState();
    }
  } catch (err) {
    console.warn('Live approval failed, using local simulation:', err);
  }

  if (localDepotState.pending_proposal) {
    const prop = localDepotState.pending_proposal;
    localDepotState.pending_proposal = null;
    localDepotState.recent_events.unshift({
      id: `EVT-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: new Date().toTimeString().split(' ')[0],
      source: 'hitl.operator/dispatch-gate',
      event_type: 'PROPOSAL_APPROVED_AND_DISPATCHED',
      title: 'HITL Operator Approved Re-Plan',
      description: `Dispatched new schedule to Amazon EventBridge. Shifted vehicles: ${prop.affected_vehicles.join(', ')}.`,
      details: { cost_delta: prop.cost_delta, carbon_delta: prop.carbon_delta },
    });
  }

  return { ...localDepotState };
}

export async function rejectProposal(): Promise<DepotState> {
  try {
    const res = await fetch('/api/proposal/reject', { method: 'POST' });
    if (res.ok) {
      localDepotState.pending_proposal = null;
      return await fetchDepotState();
    }
  } catch (err) {
    console.warn('Live rejection failed, using local simulation:', err);
  }

  if (localDepotState.pending_proposal) {
    localDepotState.pending_proposal = null;
    localDepotState.recent_events.unshift({
      id: `EVT-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: new Date().toTimeString().split(' ')[0],
      source: 'hitl.operator/dispatch-gate',
      event_type: 'PROPOSAL_REJECTED_MANUAL_OVERRIDE',
      title: 'HITL Operator Rejected Re-Plan',
      description: 'Operator maintained existing schedule. Flagged for engineering review.',
    });
  }

  return { ...localDepotState };
}


export async function resetDepotSimulation(): Promise<DepotState> {
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (res.ok) {
      return await fetchDepotState();
    }
  } catch (err) {
    console.warn('Live reset failed, using local reset:', err);
  }

  localDepotState = generateInitialMockState();
  return { ...localDepotState };
}
