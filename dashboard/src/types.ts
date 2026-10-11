export interface Charger {
  id: string;
  max_kw: number;
  status: 'ONLINE' | 'FAULTED';
  fault_start_interval?: number | null;
  fault_end_interval?: number | null;
  current_vehicle_id?: string | null;
  current_kw?: number;
  temperature_c?: number;
  efficiency_pct?: number;
}

export interface Vehicle {
  id: string;
  battery_capacity_kwh: number;
  arrival_interval: number;
  departure_interval: number;
  arrival_soc: number;
  target_soc: number;
  arrival_clock: string;
  departure_clock: string;
  current_soc: number;
  energy_needed_kwh?: number;
  energy_delivered_kwh?: number;
  assigned_bay?: string;
  charging_intervals?: number[];
}

export interface GridProfile {
  intervals: number[];
  carbon_intensity_kg_per_kwh: number[];
  tariff_inr_per_kwh: number[];
}

export interface Schedule {
  interval_loads: number[];
  total_energy_kwh: number;
  total_cost_inr: number;
  total_carbon_kg: number;
  charger_assignments?: Record<string, string>; // "V01_interval": "C01"
  vehicle_sessions?: Record<string, number[]>; // vehicle_id: [interval_indices]
}

export interface TriggerEvent {
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface Proposal {
  id?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  trigger_event: TriggerEvent;
  agent_explanation: string;
  cost_delta: number;
  carbon_delta: number;
  peak_delta?: number;
  affected_vehicles: string[];
  new_schedule?: Schedule;
  validator_proof?: string;
  explanation?: string;
  impact_deltas?: {
    cost_delta_inr: number;
    carbon_delta_kg: number;
    peak_delta_kw: number;
  };
}

export interface ImpactMetrics {
  baseline_cost_inr: number;
  optimized_cost_inr: number;
  cost_savings_inr: number;
  cost_savings_pct: number;
  baseline_carbon_kg: number;
  optimized_carbon_kg: number;
  carbon_reduction_kg: number;
  carbon_reduction_pct: number;
  baseline_peak_kw: number;
  optimized_peak_kw: number;
  peak_reduction_pct: number;
  ready_vehicles_pct: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  source: string;
  event_type: string;
  title: string;
  description: string;
  details?: Record<string, any>;
}

export interface AttendantTask {
  interval: number;
  clock: string;
  task_type: 'PLUG_IN' | 'UNPLUG' | 'BAY_SWAP';
  van_id: string;
  bay_id: string;
  details: string;
}

export interface SizingPoint {
  connection_kw: number;
  fifo_reliability_pct: number;
  edf_reliability_pct: number;
}

export interface SizingPreset {
  name: string;
  arrival_window: string;
  departure_window: string;
  proven_minimum_kw: number;
  oracle_proven_connection: string;
  operating_connection_kw: number;
  step_kw: number;
  curve: SizingPoint[];
  key_finding: string;
}

export interface ParsedRosterItem {
  id: string;
  raw_text: string;
  battery_capacity_kwh: number;
  arrival_soc_pct: number;
  target_soc_pct: number;
  arrival_time: string;
  departure_time: string;
  confidence_score: number;
  requires_manager_check: boolean;
  arrival_clock?: string;
  departure_clock?: string;
  arrival_soc?: number;
  target_soc?: number;
}

export interface AWSMeta {
  account_id: string;
  region: string;
  bedrock_model_id: string;
  dynamodb_active: boolean;
  eventbridge_active: boolean;
  cloudwatch_active: boolean;
}

export interface DepotState {
  current_interval: number;
  current_clock: string;
  operating_mode?: 'SAFE' | 'GREEN';
  extra_plugins_count?: number;
  current_connection_cap_kw?: number;
  proven_minimum_connection_kw?: number;
  chargers: Charger[];
  vehicles: Vehicle[];
  baseline_schedule: Schedule;
  active_schedule: Schedule;
  pending_proposal: Proposal | null;
  impact_metrics: ImpactMetrics;
  attendant_tasks?: AttendantTask[];
  recent_events: AuditEvent[];
  sizing_presets?: Record<string, SizingPreset>;
  aws: AWSMeta;
  grid: GridProfile;
}

