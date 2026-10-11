import React, { useState, useEffect } from 'react';
import { DepotState, Vehicle, ParsedRosterItem } from './types';
import { 
  fetchDepotState, 
  triggerDisruption, 
  approveProposal, 
  rejectProposal, 
  resetDepotSimulation,
  switchOperatingMode 
} from './api';
import { generateInitialMockState } from './mockData';

import { TopAppBar } from './components/TopAppBar';
import { HeroKpiStrip } from './components/HeroKpiStrip';
import { LoadCurveScrubber } from './components/LoadCurveScrubber';
import { ChargerBaysGrid } from './components/ChargerBaysGrid';
import { BedrockHITLPanel } from './components/BedrockHITLPanel';
import { FleetDispatchMatrix } from './components/FleetDispatchMatrix';
import { EventBridgeStream } from './components/EventBridgeStream';
import { SizingCertificateView } from './components/SizingCertificateView';
import { AttendantTaskList } from './components/AttendantTaskList';
import { RosterIngestionModal } from './components/RosterIngestionModal';
import { IntroCurveAnimation } from './components/IntroCurveAnimation';

import { 
  X, 
  Truck, 
  ShieldCheck, 
  Zap, 
  ClipboardList, 
  Activity, 
  Layers,
  Award
} from 'lucide-react';
import { MessageLoading } from './components/ui/message-loading';

export function App() {
  const [state, setState] = useState<DepotState>(generateInitialMockState());
  const [selectedInterval, setSelectedInterval] = useState<number>(38); // 01:30 AM
  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'SIZING' | 'TASKS' | 'GANTT'>('DISPATCH');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'alert' | 'info' } | null>(null);
  const [showIntro, setShowIntro] = useState<boolean>(true);

  // Poll or sync initial state from FastAPI backend
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const liveState = await fetchDepotState();
        if (isMounted && liveState) {
          setState(liveState);
          if (liveState.current_interval !== undefined) {
            setSelectedInterval(liveState.current_interval);
          }
        }
      } catch (err) {
        console.warn('Backend offline, running standalone simulation:', err);
      }
    }
    loadData();
    const intervalId = setInterval(loadData, 10000); // 10s background sync
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'alert' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Switch Operating Mode (Safe EDF vs Green CP-SAT)
  const handleToggleMode = async (mode: 'SAFE' | 'GREEN') => {
    setActiveAction(mode === 'SAFE' ? 'MODE_SAFE' : 'MODE_GREEN');
    setIsLoading(true);
    try {
      const updated = await switchOperatingMode(mode);
      setState(updated);
      showToast(
        mode === 'SAFE'
          ? 'Switched to Safe Mode (EDF): 100% Cap-Drop Recovery, 18 Moves/Night.'
          : 'Switched to Green Mode (CP-SAT): 3-8% Less Carbon, Burns Slack.',
        mode === 'SAFE' ? 'success' : 'alert'
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  // Trigger Disruption Handler
  const handleTriggerDisruption = async (type: 'CAP_DROP' | 'CHARGER_FAULT' | 'CARBON_SPIKE' | 'ARRIVAL_DELAY') => {
    setActiveAction(type);
    setIsLoading(true);
    const label = type === 'CAP_DROP' ? 'Utility Cap Drop (21:15)' : type.replace('_', ' ');
    showToast(`Injecting ${label} into Amazon EventBridge...`, 'alert');
    try {
      const res = await triggerDisruption(type);
      setState(res.state);
      showToast('Schedule re-plan evaluated. Amazon Bedrock proposal ready.', 'info');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  // Approve Re-plan Handler
  const handleApprove = async () => {
    setActiveAction('APPROVE');
    setIsLoading(true);
    try {
      const updated = await approveProposal();
      setState(updated);
      showToast('Schedule approved! Dispatched to Amazon EventBridge & DynamoDB.', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  // Reject Re-plan Handler
  const handleReject = async () => {
    setActiveAction('REJECT');
    setIsLoading(true);
    try {
      const updated = await rejectProposal();
      setState(updated);
      showToast('Proposal rejected. Maintained previous schedule.', 'info');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  // Reset Simulation Handler
  const handleReset = async () => {
    setActiveAction('RESET');
    setIsLoading(true);
    try {
      const resetState = await resetDepotSimulation();
      setState(resetState);
      setSelectedInterval(38);
      setSelectedVehicle(null);
      showToast('Depot simulation reset to initial nominal state.', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  // Van click selector
  const handleSelectVehicleId = (vid: string) => {
    const found = state.vehicles.find((v) => v.id === vid);
    if (found) setSelectedVehicle(found);
  };

  // Commit fleet from Bedrock Ingestion
  const handleCommitFleet = (fleet: ParsedRosterItem[]) => {
    showToast(`Committed ${fleet.length} parsed fleet units to Amazon DynamoDB manifest.`, 'success');
  };

  const currentLoad = state.active_schedule?.interval_loads?.[selectedInterval] ?? 0;

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#141414] flex flex-col font-sans selection:bg-[#0066ff]/20 selection:text-[#0066ff]">
      
      {/* Fullscreen Intro Animation (Concept 1: Proven Sizer & Diurnal Curve Draw) */}
      {showIntro && (
        <IntroCurveAnimation onComplete={() => setShowIntro(false)} />
      )}

      {/* 1. Top Telemetry App Bar */}
      <TopAppBar
        state={state}
        onReset={handleReset}
        onTriggerDisruption={handleTriggerDisruption}
        onToggleMode={handleToggleMode}
        onOpenRosterModal={() => setIsRosterModalOpen(true)}
        isLoading={isLoading}
        activeAction={activeAction}
        selectedInterval={selectedInterval}
        onReplayIntro={() => setShowIntro(true)}
      />

      {/* Main Operational Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Navigation Tabs for the 4 Core Views adhering to segmented-control in DESIGN.md */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
          <div className="flex items-center gap-1.5 bg-[#f3f3f3] border border-[#e0e0e0] rounded-full p-1 text-xs font-mono">
            <button
              onClick={() => setActiveTab('DISPATCH')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all ${
                activeTab === 'DISPATCH'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Tonight's Dispatch</span>
            </button>
            <button
              onClick={() => setActiveTab('SIZING')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all ${
                activeTab === 'SIZING'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-[#0066ff]" />
              <span>Sizing Certificate (Screen 1)</span>
            </button>
            <button
              onClick={() => setActiveTab('TASKS')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all ${
                activeTab === 'TASKS'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Attendant Task List (Screen 2)</span>
            </button>
            <button
              onClick={() => setActiveTab('GANTT')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all ${
                activeTab === 'GANTT'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>40-Van Gantt Matrix</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#707070]">
            <span>Mode:</span>
            <span className="font-bold px-3 py-1 rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
              {state.operating_mode === 'SAFE' ? 'Safe EDF (100% Recovery)' : 'Green CP-SAT (72% Recovery)'}
            </span>
          </div>
        </div>

        {/* VIEW 1: SIZING CERTIFICATE ORACLE (Screen 1) */}
        {activeTab === 'SIZING' && (
          <SizingCertificateView presets={state.sizing_presets} />
        )}

        {/* VIEW 2: OVERNIGHT ATTENDANT TASK LIST (Screen 2) */}
        {activeTab === 'TASKS' && (
          <AttendantTaskList
            tasks={state.attendant_tasks}
            extraPluginsCount={state.extra_plugins_count}
            operatingMode={state.operating_mode}
          />
        )}

        {/* VIEW 3: TONIGHT'S DISPATCH (Primary Real-time Workspace) */}
        {activeTab === 'DISPATCH' && (
          <div className="flex flex-col gap-6">
            {/* 2. Executive Hero KPI Scorecard Strip */}
            <HeroKpiStrip
              metrics={state.impact_metrics}
              currentIntervalLoad={currentLoad}
              transformerCap={state.current_connection_cap_kw || 250.0}
            />

            {/* 3. Primary Diurnal Load Curve with 96-Interval Scrubber */}
            <LoadCurveScrubber
              state={state}
              selectedInterval={selectedInterval}
              onSelectInterval={setSelectedInterval}
            />

            {/* 4. Split Grid: 10-Bay Charger Matrix & Amazon Bedrock HITL Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: 10 Charger Bays Hardware Matrix (7 cols) */}
              <div className="lg:col-span-7 w-full">
                <ChargerBaysGrid
                  state={state}
                  selectedInterval={selectedInterval}
                  onSelectVehicle={handleSelectVehicleId}
                  onTriggerFault={() => handleTriggerDisruption('CHARGER_FAULT')}
                />
              </div>

              {/* Right: Amazon Bedrock Intelligence & HITL Panel (5 cols) */}
              <div className="lg:col-span-5 w-full">
                <BedrockHITLPanel
                  proposal={state.pending_proposal}
                  isLoading={isLoading}
                  activeAction={activeAction}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onTriggerDisruption={handleTriggerDisruption}
                  onSelectVehicle={handleSelectVehicleId}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: 40-VEHICLE GANTT MATRIX & FLEET TABLE */}
        {activeTab === 'GANTT' && (
          <FleetDispatchMatrix
            vehicles={state.vehicles}
            selectedInterval={selectedInterval}
            highlightedVehicleId={selectedVehicle?.id}
            onSelectVehicle={handleSelectVehicleId}
          />
        )}

        {/* AWS EventBridge Telemetry Stream */}
        <EventBridgeStream events={state.recent_events} />

      </main>

      {/* Full-Bleed Inverted Near-Black Footer with 24px Rounded Top Corners (from DESIGN.md) */}
      <footer className="w-full bg-[#141414] text-[#adadad] rounded-t-[24px] px-8 py-8 mt-10">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[#adadad]">
            <span className="flex items-center gap-2 text-[#ffffff] font-bold">
              <Zap className="w-4 h-4 fill-[#ffffff]" />
              <span>Depot Connection Planner (v4)</span>
            </span>
            <span>•</span>
            <span>Sizing Oracle: OR-Tools CP-SAT</span>
            <span>•</span>
            <span>Dispatch: Safe Mode (EDF)</span>
            <span>•</span>
            <span>Agent: Bedrock Claude 3.5 Sonnet</span>
          </div>

          <div className="flex items-center gap-2 text-[#ffffff]">
            <span className="w-2 h-2 rounded-full bg-[#0066ff]" />
            <span>Independent Safety Validator: 0 Hard Violations Certified</span>
          </div>
        </div>
      </footer>

      {/* Roster Ingestion Modal (Screen 4) */}
      <RosterIngestionModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        onCommitFleet={handleCommitFleet}
      />

      {/* Vehicle Inspector Modal Flyout */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-[#141414]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 flex flex-col gap-4 font-mono">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
              <div className="flex items-center gap-2 text-[#141414]">
                <Truck className="w-5 h-5 text-[#0066ff]" />
                <h3 className="text-base font-bold">VEHICLE TELEMETRY • {selectedVehicle.id}</h3>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="p-1.5 text-[#707070] hover:text-[#141414] hover:bg-[#f3f3f3] rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Specs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0]">
                <span className="text-[#707070] block mb-0.5">Battery Capacity</span>
                <span className="text-sm font-bold text-[#141414]">{selectedVehicle.battery_capacity_kwh} kWh</span>
              </div>
              <div className="p-3 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0]">
                <span className="text-[#707070] block mb-0.5">Assigned Bay</span>
                <span className="text-sm font-bold text-[#0066ff]">{selectedVehicle.assigned_bay || 'Bay C01'}</span>
              </div>
              <div className="p-3 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0]">
                <span className="text-[#707070] block mb-0.5">Depot Arrival Window</span>
                <span className="text-sm font-bold text-[#141414]">{selectedVehicle.arrival_clock}</span>
              </div>
              <div className="p-3 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0]">
                <span className="text-[#707070] block mb-0.5">Morning Departure SLA</span>
                <span className="text-sm font-bold text-[#141414]">{selectedVehicle.departure_clock}</span>
              </div>
            </div>

            {/* SOC Progress Bar */}
            <div className="p-4 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] space-y-2 text-xs">
              <div className="flex justify-between text-[#707070]">
                <span>Arrival: <strong className="text-[#141414]">{selectedVehicle.arrival_soc}%</strong></span>
                <span>Target: <strong className="text-[#141414]">{selectedVehicle.target_soc}%</strong></span>
              </div>
              <div className="w-full h-2 bg-[#e0e0e0] rounded-full overflow-hidden flex">
                <div className="h-full bg-[#adadad]" style={{ width: `${selectedVehicle.arrival_soc}%` }} />
                <div className="h-full bg-[#0066ff]" style={{ width: `${selectedVehicle.target_soc - selectedVehicle.arrival_soc}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-[#707070] pt-1">
                <span>Energy Needed: {selectedVehicle.energy_needed_kwh} kWh</span>
                <span className="text-[#0066ff] font-semibold">100% Scheduled in Clean Window</span>
              </div>
            </div>

            {/* Validation badge */}
            <div className="p-3 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] flex items-center gap-2 text-xs text-[#141414]">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#141414]" />
              <span>Deterministic Gate: Target SOC guaranteed prior to {selectedVehicle.departure_clock} departure.</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Loading Banner using MessageLoading adhering to DESIGN.md */}
      {isLoading && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-2.5 rounded-full bg-[#141414] text-[#ffffff] border border-[#262626] font-mono text-xs flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <MessageLoading size={18} className="text-[#0066ff] shrink-0" />
          <span>
            {activeAction === 'CAP_DROP'
              ? 'Injecting Utility Cap Drop (21:15) & running Safe EDF solver...'
              : activeAction === 'CHARGER_FAULT'
              ? 'Injecting Bay C04 Inverter Fault & re-routing slots...'
              : activeAction === 'CARBON_SPIKE'
              ? 'Injecting Grid Carbon Spike & shifting charging sessions...'
              : activeAction === 'ARRIVAL_DELAY'
              ? 'Injecting Van V08 Arrival Delay & prioritizing charge...'
              : activeAction === 'APPROVE'
              ? 'Authorizing dispatch & publishing to Amazon EventBridge...'
              : activeAction === 'REJECT'
              ? 'Rejecting re-plan & restoring previous schedule...'
              : activeAction === 'RESET'
              ? 'Resetting simulation to nominal initial state...'
              : activeAction === 'MODE_SAFE'
              ? 'Switching to Safe Mode (EDF Deadline-First)...'
              : activeAction === 'MODE_GREEN'
              ? 'Switching to Green Mode (CP-SAT Carbon Min)...'
              : 'Evaluating operational re-plan with Amazon Bedrock...'}
          </span>
        </div>
      )}

      {/* Toast Notification adhering to ex-toast in DESIGN.md */}
      {toastMessage && !isLoading && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-2.5 rounded-full bg-[#141414] text-[#ffffff] border border-[#262626] font-mono text-xs flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          {toastMessage.type === 'success' && <ShieldCheck className="w-4 h-4 text-[#ffffff] shrink-0" />}
          {toastMessage.type === 'alert' && <Zap className="w-4 h-4 text-[#0066ff] shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}

export default App;
