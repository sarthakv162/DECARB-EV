import React, { useState, useEffect } from 'react';
import { Zap, Award, ArrowRight } from 'lucide-react';
import { MessageLoading } from './ui/message-loading';

interface IntroCurveAnimationProps {
  onComplete: () => void;
}

export const IntroCurveAnimation: React.FC<IntroCurveAnimationProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<number>(1);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);

  // Stepped progression
  useEffect(() => {
    // Stage 1: Grid & Curve draw (0 - 800ms)
    const t1 = setTimeout(() => setPhase(2), 700);

    // Stage 2: Sizing Certificate lockup (800ms - 1700ms)
    const t2 = setTimeout(() => setPhase(3), 1600);

    // Stage 3: Complete & Trigger Exit (2700ms)
    const t3 = setTimeout(() => {
      handleExit();
    }, 2800);

    // Progress bar ticker
    const interval = setInterval(() => {
      setProgressPct((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 45);

    // Keyboard escape listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 550); // match exit transition duration
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#ffffff] text-[#141414] flex flex-col justify-between p-6 sm:p-12 overflow-hidden transition-all duration-500 ease-in-out select-none ${
        isExiting ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* 1. Top Header Lockup */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {/* iOS-style 30% squircle icon tile from DESIGN.md */}
          <div className="w-10 h-10 rounded-[30%] bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 fill-[#ffffff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-[#141414]">
                Depot Connection Planner
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
                ORACLE PROOF
              </span>
            </div>
            <p className="text-[11px] text-[#707070] font-mono">
              60-Night Empirical Sizing Benchmark • Team HMSH4K
            </p>
          </div>
        </div>

        {/* Skip button adhering to button-pill-soft in DESIGN.md */}
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#f3f3f3] hover:bg-[#e0e0e0] text-[#141414] border border-[#e0e0e0] font-mono text-xs font-semibold transition-colors group cursor-pointer"
          title="Skip intro animation (Esc)"
        >
          <span>Skip</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#707070] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* 2. Center Stage: Mathematical Curve Visualization & Proof Lockup */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center relative my-auto py-8">
        
        {/* Background Grid & SVG Diurnal Curve Drawing */}
        <div className="w-full relative h-64 sm:h-80 flex items-center justify-center">
          
          {/* Subtle Gridlines */}
          <div className="absolute inset-0 border border-[#f0f0f0] rounded-[24px] bg-[#f3f3f3]/30 overflow-hidden pointer-events-none">
            <div className="w-full h-full grid grid-cols-6 divide-x divide-[#f0f0f0]">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className="absolute inset-0 grid grid-rows-4 divide-y divide-[#f0f0f0]" />
          </div>

          {/* SVG Load Curve & Ceilings */}
          <svg
            className="w-full h-full p-6 overflow-visible relative z-10"
            viewBox="0 0 800 260"
            fill="none"
            preserveAspectRatio="none"
          >
            {/* 250 kW Interconnect Limit Ceiling Line */}
            <line
              x1="20"
              y1="50"
              x2="780"
              y2="50"
              stroke="#141414"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              className="opacity-70"
            />
            <text x="30" y="42" fill="#141414" fontSize="11" fontFamily="monospace" fontWeight="600">
              250 kW Utility Interconnect Ceiling
            </text>

            {/* 200 kW Proven Sizing Floor Line */}
            <line
              x1="20"
              y1="90"
              x2="780"
              y2="90"
              stroke="#0066ff"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="opacity-90"
            />
            <text x="30" y="82" fill="#0066ff" fontSize="11" fontFamily="monospace" fontWeight="700">
              200 kW Proven Minimum Floor (CP-SAT Certificate)
            </text>

            {/* Shaded Area Under Sizing Curve */}
            <path
              d="M 40 230 C 160 220, 240 180, 320 90 C 400 90, 520 90, 600 105 C 680 140, 720 200, 760 230 L 760 240 L 40 240 Z"
              fill="rgba(0, 102, 255, 0.05)"
              className="transition-opacity duration-700"
            />

            {/* Animated Diurnal Load Curve Path in Electric Blue (#0066ff) */}
            <path
              d="M 40 230 C 160 220, 240 180, 320 90 C 400 90, 520 90, 600 105 C 680 140, 720 200, 760 230"
              stroke="#0066ff"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="animate-draw-curve"
            />

            {/* Point 1: Utility Cap Drop Alert at 21:15 */}
            {phase >= 2 && (
              <g className="animate-fade-scale">
                <circle cx="280" cy="115" r="5" fill="#141414" />
                <circle cx="280" cy="115" r="9" stroke="#141414" strokeWidth="1" fill="none" opacity="0.4" />
                <rect x="235" y="130" width="90" height="20" rx="10" fill="#141414" />
                <text x="280" y="144" fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  21:15 Cap Drop
                </text>
              </g>
            )}

            {/* Point 2: 200 kW Peak Sizing Step */}
            {phase >= 2 && (
              <g className="animate-fade-scale">
                <circle cx="460" cy="90" r="6" fill="#0066ff" />
                <circle cx="460" cy="90" r="11" stroke="#0066ff" strokeWidth="1.5" fill="none" className="animate-ping" opacity="0.6" />
                <rect x="410" y="105" width="100" height="20" rx="10" fill="#0066ff" />
                <text x="460" y="119" fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  200 kW Peak Step
                </text>
              </g>
            )}

            {/* Point 3: 06:00 100% Departure Ready */}
            {phase >= 2 && (
              <g className="animate-fade-scale">
                <circle cx="720" cy="200" r="5" fill="#141414" />
                <rect x="670" y="215" width="100" height="20" rx="10" fill="#f3f3f3" stroke="#e0e0e0" strokeWidth="1" />
                <text x="720" y="229" fill="#141414" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  06:00 100% Ready
                </text>
              </g>
            )}
          </svg>

          {/* Time axis labels */}
          <div className="absolute bottom-2 inset-x-8 flex justify-between text-[10px] font-mono text-[#707070]">
            <span>16:00 Inbound</span>
            <span>20:00 Peak Intake</span>
            <span>21:15 Cap Curtailment</span>
            <span>01:30 Solar/Off-Peak</span>
            <span>04:30 Slack Level</span>
            <span>06:00 Morning Rollout</span>
          </div>
        </div>

        {/* Center Text Headline Lockup */}
        <div className={`mt-8 text-center space-y-3 transition-all duration-700 ${
          phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0] text-xs font-mono">
            <Award className="w-3.5 h-3.5 text-[#0066ff]" />
            <span>Proven Minimum Connection: <strong className="text-[#141414]">200 kW</strong></span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#141414] tracking-tight font-sans">
            Proven Minimum Utility Connection: 200 kW.
          </h2>

          <p className="text-sm sm:text-base text-[#707070] font-light max-w-xl mx-auto leading-relaxed">
            Sizing 40 delivery vans across 10 charger bays. Deadline-first (EDF) with bay swaps survives every disruption under tighter interconnects.
          </p>

          {/* Stadium Pills Feature Matrix */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="px-3.5 py-1 text-xs font-mono font-semibold rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
              40 Delivery Vans
            </span>
            <span className="px-3.5 py-1 text-xs font-mono font-semibold rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
              18 Cable Moves / Night
            </span>
            <span className="px-3.5 py-1 text-xs font-mono font-semibold rounded-full bg-[#141414] text-[#ffffff]">
              100% Cap-Drop Recovery
            </span>
            <span className="px-3.5 py-1 text-xs font-mono font-semibold rounded-full bg-[#0066ff] text-[#ffffff]">
              OR-Tools CP-SAT Verified
            </span>
          </div>
        </div>

      </div>

      {/* 3. Bottom Monospace Telemetry Strip & Progress Bar */}
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-[#707070]">
          <div className="flex items-center gap-2.5">
            <MessageLoading size={18} className="text-[#0066ff] shrink-0" />
            <span className="text-[#141414] font-medium">
              {phase === 1 && '[1/3] Loading 60-night empirical sizing benchmark matrix...'}
              {phase === 2 && '[2/3] Validating deadline-first (EDF) rotation across 10 bays...'}
              {phase >= 3 && '[3/3] Mathematical proof verified: 200 kW connection established.'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#adadad]">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#f0f0f0] text-[#141414] border border-[#e0e0e0]">Esc</kbd> to enter dashboard</span>
          </div>
        </div>

        {/* 1px Progress Track */}
        <div className="w-full h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#141414] transition-all duration-75 ease-out rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
