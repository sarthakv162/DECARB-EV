import React from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Radio
} from 'lucide-react';
import { Proposal } from '../types';
import { MessageLoading } from './ui/message-loading';

interface BedrockHITLPanelProps {
  proposal: Proposal | null;
  isLoading: boolean;
  activeAction?: string | null;
  onApprove: () => void;
  onReject: () => void;
  onTriggerDisruption: (type: 'CHARGER_FAULT' | 'CARBON_SPIKE' | 'ARRIVAL_DELAY') => void;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const BedrockHITLPanel: React.FC<BedrockHITLPanelProps> = ({
  proposal,
  isLoading,
  activeAction,
  onApprove,
  onReject,
  onTriggerDisruption,
  onSelectVehicle,
}) => {
  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[30%] bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141414] flex items-center gap-2">
              Amazon Bedrock Intelligence & HITL Decision Gate
            </h2>
            <p className="text-xs text-[#707070] font-mono">
              Claude 3.5 Sonnet • Closed-Loop Disruption Re-Planning Engine
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 text-xs font-mono font-semibold rounded-full border ${
          proposal
            ? 'bg-[#0066ff] text-[#ffffff] border-[#0066ff]'
            : 'bg-[#f3f3f3] text-[#707070] border-[#e0e0e0]'
        }`}>
          {proposal ? 'ACTION REQUIRED' : 'NOMINAL MONITORING'}
        </span>
      </div>

      {/* Disruption Active State */}
      {proposal ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          
          {/* Incident Alert Banner */}
          <div className="p-4 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[#141414] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-[#141414] uppercase tracking-wide">
                  {proposal.trigger_event.title}
                </span>
                <span className="text-xs font-mono text-[#707070]">
                  {proposal.trigger_event.timestamp}
                </span>
              </div>
              <p className="text-xs text-[#707070] leading-relaxed">
                {proposal.trigger_event.description}
              </p>
            </div>
          </div>

          {/* AI Explanation Box */}
          <div className="p-5 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-[#141414] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#0066ff]" />
                ORCHESTRATOR OPERATIONAL JUSTIFICATION
              </span>
              <span className="text-[11px] text-[#707070]">
                Proposal ID: {proposal.id}
              </span>
            </div>
            
            <p className="text-sm text-[#141414] font-sans leading-relaxed whitespace-pre-line">
              {proposal.explanation || proposal.agent_explanation || "Agent proposal formulated by operational reasoner."}
            </p>

            {/* Impact Deltas Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#e0e0e0] font-mono text-xs">
              <div className="px-3 py-1 rounded-full bg-[#ffffff] border border-[#e0e0e0] text-[#141414]">
                Cost Delta: <strong className="text-[#141414]">{((proposal.impact_deltas?.cost_delta_inr ?? proposal.cost_delta ?? 0) >= 0 ? '+' : '')}₹{(proposal.impact_deltas?.cost_delta_inr ?? proposal.cost_delta ?? 0).toFixed(0)}</strong>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#0066ff] text-[#ffffff] font-semibold">
                Carbon Delta: {((proposal.impact_deltas?.carbon_delta_kg ?? proposal.carbon_delta ?? 0) >= 0 ? '+' : '')}{(proposal.impact_deltas?.carbon_delta_kg ?? proposal.carbon_delta ?? 0).toFixed(1)} kg CO₂
              </div>
              <div className="px-3 py-1 rounded-full bg-[#ffffff] border border-[#e0e0e0] text-[#141414]">
                Peak Delta: {((proposal.impact_deltas?.peak_delta_kw ?? proposal.peak_delta ?? 0) >= 0 ? '+' : '')}{(proposal.impact_deltas?.peak_delta_kw ?? proposal.peak_delta ?? 0).toFixed(1)} kW
              </div>
            </div>
          </div>

          {/* Affected Vehicles Chips */}
          {proposal.affected_vehicles && proposal.affected_vehicles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-[#707070] font-medium flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#141414]" />
                Affected Vans ({proposal.affected_vehicles.length}):
              </span>
              {proposal.affected_vehicles.map((vid) => (
                <button
                  key={vid}
                  onClick={() => onSelectVehicle?.(vid)}
                  className="px-2.5 py-0.5 rounded-full bg-[#f3f3f3] hover:bg-[#e0e0e0] text-[#141414] border border-[#e0e0e0] font-semibold transition-colors"
                >
                  {vid}
                </button>
              ))}
            </div>
          )}

          {/* Decision Gate Actions adhering to button-primary & button-outline in DESIGN.md */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#141414] hover:bg-[#262626] text-[#ffffff] font-semibold text-sm transition-all disabled:opacity-50"
            >
              {isLoading && activeAction === 'APPROVE' ? (
                <>
                  <MessageLoading size={18} className="text-[#ffffff]" />
                  <span>Committing to EventBridge...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Commit Schedule</span>
                </>
              )}
            </button>

            <button
              onClick={onReject}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#ffffff] hover:bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0] font-semibold text-sm transition-all disabled:opacity-50"
            >
              {isLoading && activeAction === 'REJECT' ? (
                <>
                  <MessageLoading size={18} className="text-[#141414]" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-[#707070]" />
                  <span>Reject</span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* Nominal State - Quick Disruption Trigger Pills */
        <div className="space-y-4">
          <p className="text-xs text-[#707070] font-mono leading-relaxed">
            All 40 delivery vans and 10 fast chargers operate nominal schedules. Inject operational incidents to trigger Bedrock reasoning:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onTriggerDisruption('CARBON_SPIKE')}
              disabled={isLoading}
              className="flex items-center gap-2 p-3.5 rounded-[16px] bg-[#f3f3f3] hover:bg-[#ffffff] border border-[#e0e0e0] text-left transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
                {isLoading && activeAction === 'CARBON_SPIKE' ? (
                  <MessageLoading size={16} className="text-[#ffffff]" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-[#141414] block">Carbon Spike</span>
                <span className="text-[11px] text-[#707070] block">
                  {isLoading && activeAction === 'CARBON_SPIKE' ? 'Simulating...' : '+0.32 kg/kWh (01:00)'}
                </span>
              </div>
            </button>

            <button
              onClick={() => onTriggerDisruption('CHARGER_FAULT')}
              disabled={isLoading}
              className="flex items-center gap-2 p-3.5 rounded-[16px] bg-[#f3f3f3] hover:bg-[#ffffff] border border-[#e0e0e0] text-left transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
                {isLoading && activeAction === 'CHARGER_FAULT' ? (
                  <MessageLoading size={16} className="text-[#ffffff]" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-[#141414] block">Charger Trip</span>
                <span className="text-[11px] text-[#707070] block">
                  {isLoading && activeAction === 'CHARGER_FAULT' ? 'Simulating...' : 'Bay C04 Inverter Trip'}
                </span>
              </div>
            </button>

            <button
              onClick={() => onTriggerDisruption('ARRIVAL_DELAY')}
              disabled={isLoading}
              className="flex items-center gap-2 p-3.5 rounded-[16px] bg-[#f3f3f3] hover:bg-[#ffffff] border border-[#e0e0e0] text-left transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
                {isLoading && activeAction === 'ARRIVAL_DELAY' ? (
                  <MessageLoading size={16} className="text-[#ffffff]" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-[#141414] block">Inbound Delays</span>
                <span className="text-[11px] text-[#707070] block">
                  {isLoading && activeAction === 'ARRIVAL_DELAY' ? 'Simulating...' : 'V08 Low SOC Arrival'}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Loading & Reasoning Status Indicator */}
      {isLoading && (
        <div className="p-3.5 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] flex items-center gap-3">
          <MessageLoading size={20} className="text-[#0066ff]" />
          <div className="text-xs font-mono">
            <span className="font-bold text-[#141414] block">
              AMAZON BEDROCK REASONING PIPELINE
            </span>
            <span className="text-[#707070] block">
              Synthesizing event parameters, solving EDF rotation, and compiling validation proof...
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
