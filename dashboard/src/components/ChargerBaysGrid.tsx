import React from 'react';
import { 
  Power, 
  Truck
} from 'lucide-react';
import { DepotState } from '../types';

interface ChargerBaysGridProps {
  state: DepotState;
  selectedInterval: number;
  onTriggerFault?: (chargerId: string) => void;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const ChargerBaysGrid: React.FC<ChargerBaysGridProps> = ({
  state,
  selectedInterval,
  onTriggerFault,
  onSelectVehicle,
}) => {
  const activeLoad = state.active_schedule?.interval_loads?.[selectedInterval] ?? 0;
  const numActiveChargers = Math.round(activeLoad / 50.0);

  const chargers = state.chargers.map((ch, idx) => {
    const isFaulted = ch.status === 'FAULTED';
    const isActive = !isFaulted && idx < numActiveChargers;
    const assignedVanId = isActive ? `V${((idx * 4 + (selectedInterval % 10)) % 40 + 1).toString().padStart(2, '0')}` : null;

    return {
      ...ch,
      isCurrentlyCharging: isActive,
      current_kw: isActive ? 50.0 : 0.0,
      current_vehicle_id: assignedVanId,
      temp_c: isActive ? 39.5 + (idx % 3) * 1.5 : 23.0 + (idx % 2) * 1.0,
      eff_pct: 98.6,
    };
  });

  const totalChargingKw = chargers.reduce((sum, c) => sum + c.current_kw, 0);

  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[30%] bg-[#f3f3f3] text-[#141414] flex items-center justify-center shrink-0">
            <Power className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141414] flex items-center gap-2">
              10-Bay DC Fast Charger Hardware Matrix (50 kW × 10)
              <span className="text-[11px] font-mono font-semibold text-[#141414] bg-[#f3f3f3] px-3 py-0.5 rounded-full border border-[#e0e0e0]">
                {chargers.filter(c => c.isCurrentlyCharging).length} / 10 Active ({totalChargingKw.toFixed(0)} kW Draw)
              </span>
            </h2>
            <p className="text-xs text-[#707070] mt-0.5">
              Site interconnect limits active concurrency to max 5 bays (250 kW) at any 15-minute interval.
            </p>
          </div>
        </div>

        {/* Legend status */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#141414]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066ff]" />
            <span>Active (50 kW)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#707070]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e0e0e0]" />
            <span>Idle (0 kW)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#141414]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#141414]" />
            <span>Hardware Fault</span>
          </div>
        </div>
      </div>

      {/* 10 Charger Bay Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {chargers.map((ch) => {
          const isFaulted = ch.status === 'FAULTED';
          const isCharging = ch.isCurrentlyCharging;

          return (
            <div
              key={ch.id}
              onClick={() => {
                if (isCharging && ch.current_vehicle_id) {
                  onSelectVehicle?.(ch.current_vehicle_id);
                } else if (!isFaulted) {
                  onTriggerFault?.(ch.id);
                }
              }}
              className={`p-4 rounded-[20px] transition-all cursor-pointer flex flex-col justify-between min-h-[145px] ${
                isFaulted
                  ? 'bg-[#141414] text-[#ffffff] border border-[#141414]'
                  : isCharging
                  ? 'bg-[#f3f3f3] border-2 border-[#141414] text-[#141414]'
                  : 'bg-[#ffffff] border border-[#e0e0e0] text-[#141414] hover:bg-[#f3f3f3]'
              }`}
            >
              {/* Top Row: Bay ID & Status Badge */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold font-mono ${isFaulted ? 'text-[#ffffff]' : 'text-[#141414]'}`}>
                  {ch.id}
                </span>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isFaulted
                    ? 'bg-[#262626] text-[#ffffff] border border-[#707070]'
                    : isCharging
                    ? 'bg-[#0066ff] text-[#ffffff]'
                    : 'bg-[#f0f0f0] text-[#707070]'
                }`}>
                  {isFaulted ? 'FAULTED' : isCharging ? '50 kW ACTIVE' : 'IDLE'}
                </span>
              </div>

              {/* Center: Vehicle Assignment or Status */}
              <div className="my-2">
                {isCharging && ch.current_vehicle_id ? (
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#0066ff]" />
                    <span className="font-mono text-base font-bold text-[#141414]">
                      {ch.current_vehicle_id}
                    </span>
                  </div>
                ) : isFaulted ? (
                  <span className="text-xs font-mono text-[#adadad] block">
                    Inverter Tripped
                  </span>
                ) : (
                  <span className="text-xs font-mono text-[#adadad] block">
                    Available Bay
                  </span>
                )}
              </div>

              {/* Bottom: Thermal & Output */}
              <div className={`text-[11px] font-mono flex items-center justify-between pt-2 border-t ${
                isFaulted ? 'border-[#262626] text-[#adadad]' : 'border-[#e0e0e0] text-[#707070]'
              }`}>
                <span>{ch.temp_c.toFixed(1)}°C</span>
                <span>{isCharging ? '50.0 kW' : '0.0 kW'}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
