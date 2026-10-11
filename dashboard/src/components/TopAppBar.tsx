import React from 'react';
import { 
  Zap, 
  ShieldCheck, 
  RotateCcw, 
  Radio, 
  AlertTriangle,
  Cloud,
  FileSpreadsheet,
  Award
} from 'lucide-react';
import { DepotState } from '../types';
import { MessageLoading } from './ui/message-loading';

interface TopAppBarProps {
  state: DepotState;
  onReset: () => void;
  onTriggerDisruption: (type: 'CAP_DROP' | 'CHARGER_FAULT' | 'CARBON_SPIKE' | 'ARRIVAL_DELAY') => void;
  onToggleMode: (mode: 'SAFE' | 'GREEN') => void;
  onOpenRosterModal: () => void;
  isLoading: boolean;
  activeAction?: string | null;
  selectedInterval: number;
  onReplayIntro?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  state,
  onReset,
  onTriggerDisruption,
  onToggleMode,
  onOpenRosterModal,
  isLoading,
  activeAction,
  onReplayIntro,
}) => {
  const hasPending = !!state.pending_proposal;
  const currentMode = state.operating_mode || 'SAFE';

  return (
    <header className="sticky top-0 z-50 w-full px-4 lg:px-8 py-3 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#f0f0f0]">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        
        {/* Left: Brand Identity & Proven Connection Stamp */}
        <div className="flex items-center gap-3">
          {/* iOS-style 30% squircle icon tile from DESIGN.md */}
          <div className="w-10 h-10 rounded-[30%] bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 fill-[#ffffff]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-[#141414]">
                Depot Connection Planner
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
                PROD v4.0
              </span>
            </div>
            <p className="text-xs text-[#707070] font-mono flex items-center gap-2 mt-0.5">
              <span className="text-[#141414] font-medium">BLR-EAST-DEPOT-01</span>
              <span className="text-[#adadad]">•</span>
              <span>Proven Min: <strong className="text-[#141414]">{state.proven_minimum_connection_kw || 200} kW</strong></span>
              <span className="text-[#adadad]">•</span>
              <span>Interconnect Cap: <strong className="text-[#141414]">{state.current_connection_cap_kw || 250} kW</strong></span>
            </p>
          </div>
        </div>

        {/* Center: Segmented Billing / Mode Toggle & Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          
          {/* Segmented Control Track adhering to DESIGN.md */}
          <div className="flex items-center bg-[#f3f3f3] rounded-full p-1 border border-[#e0e0e0] font-mono">
            <button
              onClick={() => onToggleMode('SAFE')}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${
                currentMode === 'SAFE'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
              title="Safe Mode: Deadline-First (EDF) with Bay Swaps. 100% Cap-Drop Recovery, 18 Moves/Night."
            >
              {isLoading && activeAction === 'MODE_SAFE' ? (
                <MessageLoading size={14} className="text-[#0066ff]" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>Safe Mode (EDF)</span>
            </button>
            <button
              onClick={() => onToggleMode('GREEN')}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${
                currentMode === 'GREEN'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
              title="Green Mode: CP-SAT Carbon-Min. 3-8% Less Carbon, Burns Slack."
            >
              {isLoading && activeAction === 'MODE_GREEN' ? (
                <MessageLoading size={14} className="text-[#0066ff]" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>Green Mode (CP-SAT)</span>
            </button>
          </div>

          {/* Operational Status Pill */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs border ${
            isLoading
              ? 'bg-[#141414] text-[#ffffff] border-[#141414]'
              : hasPending
              ? 'bg-[#0066ff] text-[#ffffff] border-[#0066ff]'
              : 'bg-[#f3f3f3] text-[#141414] border-[#e0e0e0]'
          }`}>
            {isLoading ? (
              <>
                <MessageLoading size={16} className="text-[#0066ff]" />
                <span className="font-semibold tracking-wide">
                  OPTIMIZING DISPATCH...
                </span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5" />
                <span className="font-semibold tracking-wide">
                  {hasPending ? 'ACTION REQUIRED' : 'NOMINAL DISPATCH'}
                </span>
              </>
            )}
          </div>

          {/* Oracle Sizing Proof Badge */}
          <button
            onClick={onReplayIntro}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3f3f3] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-[#141414] font-mono transition-colors cursor-pointer"
            title="Replay 200 kW Sizing Proof Intro Animation"
          >
            <Award className="w-3.5 h-3.5 text-[#0066ff]" />
            <span className="text-[#707070]">Sizing Floor:</span>
            <span className="font-bold">{state.proven_minimum_connection_kw || 200} kW</span>
            <span className="text-[10px] text-[#adadad] ml-0.5">↗</span>
          </button>

          {/* AWS Cloud Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3f3f3] border border-[#e0e0e0] text-[#707070] text-[11px] font-mono">
            <Cloud className="w-3 h-3 text-[#141414]" />
            <span>us-east-1</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#141414]" />
          </div>
        </div>

        {/* Right: Operational Actions & Disruption Controls */}
        <div className="flex items-center gap-2">
          
          {/* Roster Ingestion Agent Button */}
          <button
            onClick={onOpenRosterModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[#ffffff] text-[#141414] border border-[#e0e0e0] hover:bg-[#f3f3f3] transition-colors"
            title="Paste unstructured driver roster for Bedrock Claude 3.5 ingestion"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#707070]" />
            <span className="hidden sm:inline">Ingest Roster</span>
          </button>

          {/* Primary Incident: Cap Drop */}
          <div className="flex items-center bg-[#f3f3f3] border border-[#e0e0e0] rounded-full p-0.5">
            <button
              onClick={() => onTriggerDisruption('CAP_DROP')}
              disabled={isLoading}
              title="Hero Event: Regional utility cuts interconnect capacity at 21:15 (250 kW -> 180 kW)"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#141414] hover:bg-[#ffffff] rounded-full transition-colors disabled:opacity-50"
            >
              {isLoading && activeAction === 'CAP_DROP' ? (
                <MessageLoading size={14} className="text-[#0066ff]" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-[#0066ff]" />
              )}
              <span>Cap Drop (21:15)</span>
            </button>
            <div className="w-px h-3.5 bg-[#e0e0e0]" />
            <button
              onClick={() => onTriggerDisruption('CHARGER_FAULT')}
              disabled={isLoading}
              title="Simulate Bay C04 Overcurrent Trip"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#707070] hover:text-[#141414] hover:bg-[#ffffff] rounded-full transition-colors disabled:opacity-50"
            >
              {isLoading && activeAction === 'CHARGER_FAULT' ? (
                <MessageLoading size={14} className="text-[#0066ff]" />
              ) : null}
              <span>Fault C04</span>
            </button>
          </div>

          {/* Reset Simulation Button */}
          <button
            onClick={onReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#141414] hover:bg-[#262626] text-[#ffffff] rounded-full transition-colors disabled:opacity-50"
            title="Reset simulation to initial nominal dispatch"
          >
            {isLoading && activeAction === 'RESET' ? (
              <MessageLoading size={16} className="text-[#ffffff]" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isLoading && activeAction === 'RESET' ? 'Resetting...' : 'Reset'}
            </span>
          </button>
        </div>

      </div>
    </header>
  );
};
