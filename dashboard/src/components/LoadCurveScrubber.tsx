import React, { useState, useRef } from 'react';
import { 
  Activity, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Clock
} from 'lucide-react';
import { DepotState } from '../types';
import { formatIntervalToClock } from '../mockData';

interface LoadCurveScrubberProps {
  state: DepotState;
  selectedInterval: number;
  onSelectInterval: (interval: number) => void;
}

export const LoadCurveScrubber: React.FC<LoadCurveScrubberProps> = ({
  state,
  selectedInterval,
  onSelectInterval,
}) => {
  const [showCarbon, setShowCarbon] = useState<boolean>(true);
  const [showTariff, setShowTariff] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  const baselineLoads = state.baseline_schedule?.interval_loads || [];
  const optLoads = state.active_schedule?.interval_loads || [];
  const carbonCurve = state.grid?.carbon_intensity_kg_per_kwh || [];
  const tariffCurve = state.grid?.tariff_inr_per_kwh || [];

  // Chart Dimensions
  const svgWidth = 1000;
  const svgHeight = 320;
  const paddingLeft = 55;
  const paddingRight = 55;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Y-Scale: 0 to 520 kW
  const maxKw = 520;
  const scaleY = (kw: number) => paddingTop + chartH - (kw / maxKw) * chartH;
  const scaleX = (interval: number) => paddingLeft + (interval / 95) * chartW;

  // Transformer ceiling line (250 kW)
  const y250 = scaleY(250);

  // Baseline Load Path
  let baselinePath = `M ${scaleX(0)} ${scaleY(baselineLoads[0] || 0)}`;
  for (let t = 1; t < 96; t++) {
    const x = scaleX(t);
    const y = scaleY(baselineLoads[t] || 0);
    baselinePath += ` L ${x} ${y}`;
  }

  // Optimized Load Path
  let optPath = `M ${scaleX(0)} ${scaleY(optLoads[0] || 0)}`;
  let optArea = `M ${scaleX(0)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(optLoads[0] || 0)}`;
  for (let t = 1; t < 96; t++) {
    const x = scaleX(t);
    const y = scaleY(optLoads[t] || 0);
    optPath += ` L ${x} ${y}`;
    optArea += ` L ${x} ${y}`;
  }
  optArea += ` L ${scaleX(95)} ${scaleY(0)} Z`;

  // Carbon Intensity Path (0 to 1.0 kg/kWh)
  const scaleYCarbon = (c: number) => paddingTop + chartH - ((c - 0.2) / 0.8) * chartH;
  let carbonPath = `M ${scaleX(0)} ${scaleYCarbon(carbonCurve[0] || 0.5)}`;
  for (let t = 1; t < 96; t++) {
    carbonPath += ` L ${scaleX(t)} ${scaleYCarbon(carbonCurve[t] || 0.5)}`;
  }

  // Tariff Path (0 to 14 ₹/kWh)
  const scaleYTariff = (tariff: number) => paddingTop + chartH - (tariff / 14) * chartH;
  let tariffPath = `M ${scaleX(0)} ${scaleYTariff(tariffCurve[0] || 7.8)}`;
  for (let t = 1; t < 96; t++) {
    const xCurr = scaleX(t);
    const yCurr = scaleYTariff(tariffCurve[t] || 7.8);
    tariffPath += ` L ${xCurr} ${yCurr}`;
  }

  // Current values at scrubber
  const currentClock = formatIntervalToClock(selectedInterval);
  const currentOptLoad = optLoads[selectedInterval] || 0;
  const currentHeadroom = Math.max(0, 250 - currentOptLoad);
  const currentCarbon = carbonCurve[selectedInterval] || 0.5;
  const currentTariff = tariffCurve[selectedInterval] || 7.8;

  // Toggle playback simulation loop
  const togglePlay = () => {
    if (isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playTimerRef.current = window.setInterval(() => {
        onSelectInterval((selectedInterval + 1) % 96);
      }, 500);
    }
  };

  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 flex flex-col gap-4">
      
      {/* Header and Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[30%] bg-[#f3f3f3] text-[#141414] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#141414]">
              24-Hour Depot Load Profile & Interconnect Scrubbing
            </h2>
            <p className="text-xs text-[#707070] font-mono">
              96 Intervals (15-min) • Synchronized against Tariffs and Grid Carbon
            </p>
          </div>
        </div>

        {/* Legend Pills conforming strictly to DESIGN.md */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3f3f3] border border-[#e0e0e0] text-[#707070]">
            <span className="w-2.5 h-0.5 bg-[#adadad] border-b border-dashed border-[#707070]" />
            <span>Unmanaged Spike (482 kW)</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066ff] text-[#ffffff] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#ffffff]" />
            <span>Co-Optimized Load</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141414] text-[#ffffff] font-semibold">
            <span className="w-2.5 h-0.5 bg-[#ffffff]" />
            <span>250 kW Limit</span>
          </div>

          {/* Toggle buttons */}
          <button
            onClick={() => setShowCarbon(!showCarbon)}
            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
              showCarbon
                ? 'bg-[#f3f3f3] text-[#141414] border-[#141414]'
                : 'bg-[#ffffff] text-[#adadad] border-[#e0e0e0]'
            }`}
          >
            Grid Carbon
          </button>
          
          <button
            onClick={() => setShowTariff(!showTariff)}
            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
              showTariff
                ? 'bg-[#f3f3f3] text-[#141414] border-[#141414]'
                : 'bg-[#ffffff] text-[#adadad] border-[#e0e0e0]'
            }`}
          >
            Tariff ₹
          </button>
        </div>
      </div>

      {/* Main SVG Load Chart */}
      <div className="relative w-full overflow-hidden bg-[#ffffff] border border-[#f0f0f0] rounded-[16px]">
        
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="w-full h-auto select-none"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const normX = (clickX / rect.width) * svgWidth;
            if (normX >= paddingLeft && normX <= svgWidth - paddingRight) {
              const intv = Math.round(((normX - paddingLeft) / chartW) * 95);
              onSelectInterval(Math.max(0, Math.min(95, intv)));
            }
          }}
        >
          {/* Subtle 6% tint fill under optimized load */}
          <defs>
            <linearGradient id="gradOptimized" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0066ff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0066ff" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines in #f0f0f0 */}
          {[0, 100, 200, 250, 350, 500].map((kw) => (
            <g key={kw}>
              <line 
                x1={paddingLeft} 
                y1={scaleY(kw)} 
                x2={svgWidth - paddingRight} 
                y2={scaleY(kw)} 
                stroke="#f0f0f0" 
                strokeWidth="1" 
              />
              <text 
                x={paddingLeft - 8} 
                y={scaleY(kw) + 3.5} 
                fill="#adadad" 
                fontSize="9" 
                fontFamily="JetBrains Mono, monospace" 
                textAnchor="end"
              >
                {kw} kW
              </text>
            </g>
          ))}

          {/* Time axis markers */}
          {[0, 16, 32, 48, 64, 80, 95].map((t) => (
            <g key={t}>
              <line 
                x1={scaleX(t)} 
                y1={paddingTop} 
                x2={scaleX(t)} 
                y2={paddingTop + chartH} 
                stroke="#f0f0f0" 
                strokeWidth="1" 
              />
              <text 
                x={scaleX(t)} 
                y={paddingTop + chartH + 18} 
                fill="#707070" 
                fontSize="10" 
                fontFamily="JetBrains Mono, monospace" 
                textAnchor="middle"
              >
                {formatIntervalToClock(t)}
              </text>
            </g>
          ))}

          {/* 1. Baseline Load Curve (Muted dashed line) */}
          <path 
            d={baselinePath} 
            fill="none" 
            stroke="#adadad" 
            strokeWidth="1.8" 
            strokeDasharray="4 4"
          />

          {/* Baseline Spike Label Stamp */}
          <g transform={`translate(${scaleX(14)}, ${scaleY(482.6) - 10})`}>
            <rect x="-85" y="-18" width="170" height="20" rx="10" fill="#141414" />
            <text x="0" y="-4" fill="#ffffff" fontSize="9.5" fontWeight="600" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
              UNMANAGED PEAK: 482.6 kW
            </text>
          </g>

          {/* 2. Secondary Overlays: Carbon & Tariff in neutral dark tones */}
          {showCarbon && (
            <path d={carbonPath} fill="none" stroke="#707070" strokeWidth="1.2" opacity="0.6" />
          )}

          {showTariff && (
            <path d={tariffPath} fill="none" stroke="#262626" strokeWidth="1.2" opacity="0.5" strokeDasharray="2 2" />
          )}

          {/* 3. Hard Transformer Ceiling (250 kW Limit in crisp near-black) */}
          <line 
            x1={paddingLeft} 
            y1={y250} 
            x2={svgWidth - paddingRight} 
            y2={y250} 
            stroke="#141414" 
            strokeWidth="1.8" 
          />
          <g transform={`translate(${svgWidth - paddingRight - 8}, ${y250 - 6})`}>
            <rect x="-142" y="-12" width="144" height="18" rx="9" fill="#141414" />
            <text x="-70" y="0" fill="#ffffff" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
              TRANSFORMER CAP: 250 kW
            </text>
          </g>

          {/* 4. Optimized Safe Dispatch Curve (Electric Blue Accent) */}
          <path d={optArea} fill="url(#gradOptimized)" />
          <path d={optPath} fill="none" stroke="#0066ff" strokeWidth="2.5" />

          {/* 5. Interactive Scrubber Bar & Head */}
          <line 
            x1={scaleX(selectedInterval)} 
            y1={paddingTop} 
            x2={scaleX(selectedInterval)} 
            y2={paddingTop + chartH} 
            stroke="#141414" 
            strokeWidth="1.5" 
          />
          <circle 
            cx={scaleX(selectedInterval)} 
            cy={scaleY(currentOptLoad)} 
            r="4.5" 
            fill="#0066ff" 
            stroke="#ffffff" 
            strokeWidth="2" 
          />
        </svg>

        {/* Floating Tooltip Indicator Pill */}
        <div className="absolute top-3 left-4 pointer-events-none bg-[#ffffff]/95 border border-[#e0e0e0] rounded-full px-4 py-1.5 text-xs font-mono flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#141414]">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-bold">{currentClock}</span>
            <span className="text-[#adadad]">({selectedInterval}/96)</span>
          </div>
          <div className="w-px h-3.5 bg-[#e0e0e0]" />
          <div>
            <span className="text-[#707070]">Site Load: </span>
            <span className="font-semibold text-[#141414]">
              {currentOptLoad.toFixed(1)} kW
            </span>
          </div>
          <div className="w-px h-3.5 bg-[#e0e0e0]" />
          <div>
            <span className="text-[#707070]">Headroom: </span>
            <span className="font-semibold text-[#0066ff]">
              +{currentHeadroom.toFixed(1)} kW
            </span>
          </div>
          <div className="w-px h-3.5 bg-[#e0e0e0]" />
          <div>
            <span className="text-[#707070]">Grid Carbon: </span>
            <span className="font-semibold text-[#141414]">
              {currentCarbon.toFixed(3)} kg/kWh
            </span>
          </div>
          <div className="w-px h-3.5 bg-[#e0e0e0]" />
          <div>
            <span className="text-[#707070]">Tariff: </span>
            <span className="font-semibold text-[#141414]">
              ₹{currentTariff.toFixed(2)}/kWh
            </span>
          </div>
        </div>

      </div>

      {/* Scrubber Slider Bar & Playback Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
        
        {/* Playback Controls Pill */}
        <div className="flex items-center gap-1 bg-[#f3f3f3] border border-[#e0e0e0] rounded-full p-1">
          <button
            onClick={() => onSelectInterval(Math.max(0, selectedInterval - 1))}
            className="p-1 text-[#707070] hover:text-[#141414] rounded-full transition-colors"
            title="Step Back 15 Min"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={togglePlay}
            className={`p-1.5 rounded-full transition-colors ${
              isPlaying 
                ? 'bg-[#141414] text-[#ffffff]' 
                : 'bg-[#ffffff] text-[#141414] border border-[#e0e0e0]'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Auto-Play Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
          <button
            onClick={() => onSelectInterval(Math.min(95, selectedInterval + 1))}
            className="p-1 text-[#707070] hover:text-[#141414] rounded-full transition-colors"
            title="Step Forward 15 Min"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrubber Range Slider */}
        <div className="flex-1 w-full flex items-center gap-3">
          <span className="text-xs font-mono text-[#707070] shrink-0">16:00</span>
          <input
            type="range"
            min="0"
            max="95"
            value={selectedInterval}
            onChange={(e) => onSelectInterval(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-[#f0f0f0] rounded-full appearance-none cursor-pointer accent-[#141414] focus:outline-none"
          />
          <span className="text-xs font-mono text-[#707070] shrink-0">15:45</span>
        </div>

        {/* Selected Time Stamp Pill */}
        <div className="px-3.5 py-1 rounded-full bg-[#141414] text-[#ffffff] font-mono text-xs font-semibold shrink-0">
          <span>{currentClock}</span>
          <span className="text-[#adadad] font-normal"> (Int {selectedInterval})</span>
        </div>

      </div>

    </div>
  );
};
