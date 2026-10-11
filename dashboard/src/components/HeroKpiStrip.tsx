import React from 'react';
import { 
  IndianRupee, 
  Leaf, 
  CheckCircle2, 
  ArrowDownRight,
  Gauge
} from 'lucide-react';
import { ImpactMetrics } from '../types';

interface HeroKpiStripProps {
  metrics: ImpactMetrics;
  currentIntervalLoad?: number;
  transformerCap?: number;
}

export const HeroKpiStrip: React.FC<HeroKpiStripProps> = ({
  metrics,
  currentIntervalLoad = 250.0,
  transformerCap = 250.0,
}) => {
  const currentHeadroom = Math.max(0, transformerCap - currentIntervalLoad);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      
      {/* 1. Peak Transformer Load (Featured Card with Soft Canvas Tint) */}
      <div className="rounded-[24px] bg-[#f3f3f3] border border-[#e0e0e0] p-5 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#707070] uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#141414]" />
              Peak Transformer Load
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#141414] text-[#ffffff]">
              <ArrowDownRight className="w-3 h-3" />
              -{metrics.peak_reduction_pct}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold font-mono text-[#141414] tracking-tight">
              {metrics.optimized_peak_kw.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#707070]">kW / 250.0 Cap</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-[#e0e0e0]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#707070]">Unmanaged Spike:</span>
            <span className="font-mono text-[#707070] line-through font-medium">
              {metrics.baseline_peak_kw} kW (+93% Over)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-[#141414]">
            <span>Interval Headroom:</span>
            <span className="font-semibold">
              {currentHeadroom === 0 ? '0.0 kW (Full)' : `+${currentHeadroom.toFixed(1)} kW Free`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Daily Electricity Cost (Canvas Card) */}
      <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-5 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#707070] uppercase tracking-wider flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-[#141414]" />
              Daily Electricity Cost
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
              <ArrowDownRight className="w-3 h-3" />
              -{metrics.cost_savings_pct}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold font-mono text-[#141414] tracking-tight">
              ₹{metrics.optimized_cost_inr.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#707070] font-medium">
              (Saved ₹{metrics.cost_savings_inr.toLocaleString()})
            </span>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#707070]">Unmanaged FIFO:</span>
            <span className="font-mono text-[#adadad] line-through">
              ₹{metrics.baseline_cost_inr.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-[#141414]">
            <span>Night Savings:</span>
            <span className="font-semibold text-[#0066ff]">
              ₹{(metrics.cost_savings_inr / 40).toFixed(0)} / van
            </span>
          </div>
        </div>
      </div>

      {/* 3. Carbon Emissions Avoided (Canvas Card with Commercial Accent Callout) */}
      <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-5 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#707070] uppercase tracking-wider flex items-center gap-1.5">
              <Leaf className="w-4 h-4 text-[#141414]" />
              Carbon Avoided
            </span>
            {/* Mobbin Electric Blue Commercial Badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#0066ff] text-[#ffffff]">
              <ArrowDownRight className="w-3 h-3" />
              -{metrics.carbon_reduction_pct}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold font-mono text-[#141414] tracking-tight">
              {metrics.carbon_reduction_kg.toFixed(0)}
            </span>
            <span className="text-xs font-mono text-[#707070]">kg CO₂e Shifted</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#707070]">Baseline Grid Carbon:</span>
            <span className="font-mono text-[#adadad] line-through">
              {metrics.baseline_carbon_kg.toFixed(0)} kg CO₂e
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-[#141414]">
            <span>Clean Window Draw:</span>
            <span className="font-semibold text-[#0066ff]">
              {metrics.optimized_carbon_kg.toFixed(0)} kg CO₂e
            </span>
          </div>
        </div>
      </div>

      {/* 4. Departure SLA Guarantee (Canvas Card) */}
      <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-5 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#707070] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#141414]" />
              Morning Departure SLA
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
              40 / 40 Ready
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold font-mono text-[#141414] tracking-tight">
              {metrics.ready_vehicles_pct.toFixed(0)}%
            </span>
            <span className="text-xs font-mono text-[#707070]">Zero Rollout Delays</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#707070]">Target Delivery:</span>
            <span className="font-mono text-[#141414] font-medium">
              80%–90% Battery Pack
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-[#141414]">
            <span>Cap-Drop Recovery:</span>
            <span className="font-semibold text-[#141414]">
              100% Certified
            </span>
          </div>
        </div>
      </div>

    </section>
  );
};
