import React, { useState } from 'react';
import { 
  Truck, 
  Search, 
  Layers, 
  Table, 
  CheckCircle2
} from 'lucide-react';
import { Vehicle } from '../types';

interface FleetDispatchMatrixProps {
  vehicles: Vehicle[];
  selectedInterval: number;
  highlightedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
}

export const FleetDispatchMatrix: React.FC<FleetDispatchMatrixProps> = ({
  vehicles,
  selectedInterval,
  highlightedVehicleId,
  onSelectVehicle,
}) => {
  const [viewMode, setViewMode] = useState<'GANTT' | 'TABLE'>('GANTT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCapacity, setFilterCapacity] = useState<string>('ALL');

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = v.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.assigned_bay?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCapacity = filterCapacity === 'ALL' || v.battery_capacity_kwh.toString() === filterCapacity;
    return matchesSearch && matchesCapacity;
  });

  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-5">
      
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[30%] bg-[#f3f3f3] text-[#141414] flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141414] flex items-center gap-2">
              40-Vehicle Fleet Dispatch & Dwell Matrix
              <span className="text-[11px] font-mono font-semibold text-[#141414] bg-[#f3f3f3] px-3 py-0.5 rounded-full border border-[#e0e0e0]">
                100% Departure Ready (0 Missed SLAs)
              </span>
            </h2>
            <p className="text-xs text-[#707070] mt-0.5">
              60–80 kWh battery packs scheduled strictly within individual dwell windows under 250 kW ceiling.
            </p>
          </div>
        </div>

        {/* View Toggle & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          
          {/* Search Bar adhering to DESIGN.md text-input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#adadad] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Van ID (e.g. V04)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[#f0f0f0] border border-transparent focus:border-[#141414] rounded-full text-[#141414] placeholder-[#adadad] focus:outline-none w-44"
            />
          </div>

          {/* Battery Size Filter */}
          <select
            value={filterCapacity}
            onChange={(e) => setFilterCapacity(e.target.value)}
            className="py-1.5 px-3 text-xs bg-[#f0f0f0] border border-[#e0e0e0] rounded-full text-[#141414] focus:outline-none"
          >
            <option value="ALL">All Packs</option>
            <option value="60">60 kWh</option>
            <option value="70">70 kWh</option>
            <option value="80">80 kWh</option>
          </select>

          {/* View Mode Segmented Control */}
          <div className="flex items-center bg-[#f3f3f3] border border-[#e0e0e0] rounded-full p-1">
            <button
              onClick={() => setViewMode('GANTT')}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs transition-all ${
                viewMode === 'GANTT'
                  ? 'bg-[#141414] text-[#ffffff] font-bold'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Gantt Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-[#141414] text-[#ffffff] font-bold'
                  : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              <Table className="w-3 h-3" />
              <span>Fleet Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: GANTT SCHEDULE MATRIX */}
      {viewMode === 'GANTT' ? (
        <div className="flex flex-col gap-3">
          
          {/* Gantt Legend */}
          <div className="flex items-center justify-between text-xs font-mono px-1">
            <div className="flex items-center gap-4 text-[#707070]">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 rounded-full bg-[#f0f0f0] border border-[#e0e0e0]" />
                Dwell Window (Parked at Depot)
              </span>
              <span className="flex items-center gap-1.5 text-[#141414]">
                <span className="w-3.5 h-2 rounded-full bg-[#0066ff]" />
                Active 50 kW Charging Session
              </span>
            </div>
            <span className="text-[#adadad] text-[11px]">
              Showing {filteredVehicles.length} of 40 Vans
            </span>
          </div>

          {/* Gantt Timeline Container */}
          <div className="overflow-x-auto rounded-[16px] border border-[#e0e0e0] bg-[#ffffff] max-h-96">
            <div className="min-w-[860px]">
              
              {/* Timeline Time Header */}
              <div className="flex items-center bg-[#f3f3f3] border-b border-[#e0e0e0] text-[11px] font-mono text-[#707070] sticky top-0 z-10">
                <div className="w-24 px-3 py-2 shrink-0 font-bold text-[#141414] border-r border-[#e0e0e0] bg-[#f3f3f3]">
                  VAN ID
                </div>
                <div className="flex-1 grid grid-cols-12 text-center py-2">
                  <span>16:00</span>
                  <span>18:00</span>
                  <span>20:00</span>
                  <span>22:00</span>
                  <span>00:00</span>
                  <span>02:00</span>
                  <span>04:00</span>
                  <span>06:00</span>
                  <span>08:00</span>
                  <span>10:00</span>
                  <span>12:00</span>
                  <span>14:00</span>
                </div>
              </div>

              {/* Vehicle Rows */}
              <div className="divide-y divide-[#f0f0f0] font-mono text-xs">
                {filteredVehicles.map((v) => {
                  const isHighlighted = highlightedVehicleId === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => onSelectVehicle?.(v.id)}
                      className={`flex items-center hover:bg-[#f3f3f3] cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-[#f0f0f0]' : ''
                      }`}
                    >
                      {/* Van ID Column */}
                      <div className="w-24 px-3 py-2 shrink-0 flex items-center justify-between border-r border-[#e0e0e0] bg-[#ffffff]">
                        <span className={`font-bold ${isHighlighted ? 'text-[#0066ff]' : 'text-[#141414]'}`}>
                          {v.id}
                        </span>
                        <span className="text-[10px] text-[#adadad]">
                          {v.battery_capacity_kwh}k
                        </span>
                      </div>

                      {/* Timeline Track (96 intervals) */}
                      <div className="flex-1 relative h-6 bg-[#ffffff]">
                        {/* Dwell window bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded-full bg-[#f0f0f0] border border-[#e0e0e0]"
                          style={{
                            left: `${(v.arrival_interval / 96) * 100}%`,
                            width: `${((v.departure_interval - v.arrival_interval) / 96) * 100}%`,
                          }}
                        />

                        {/* Active charging interval bar (Electric Blue Accent from DESIGN.md) */}
                        {v.charging_intervals && v.charging_intervals.length > 0 && (
                          <div
                            className="absolute top-1 bottom-1 rounded-full bg-[#0066ff]"
                            style={{
                              left: `${(v.charging_intervals[0] / 96) * 100}%`,
                              width: `${(v.charging_intervals.length / 96) * 100}%`,
                            }}
                          />
                        )}

                        {/* Current interval vertical tick */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#141414] pointer-events-none"
                          style={{ left: `${(selectedInterval / 96) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: FLEET DATA TABLE */
        <div className="overflow-x-auto rounded-[16px] border border-[#e0e0e0] bg-[#ffffff]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#f3f3f3] border-b border-[#e0e0e0] text-[#707070] uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-3 font-semibold">Van ID</th>
                <th className="px-3.5 py-3 font-semibold">Battery</th>
                <th className="px-3.5 py-3 font-semibold">Arrival</th>
                <th className="px-3.5 py-3 font-semibold">Departure</th>
                <th className="px-3.5 py-3 font-semibold">SOC Progress</th>
                <th className="px-3.5 py-3 font-semibold">Energy Needed</th>
                <th className="px-3.5 py-3 font-semibold">Assigned Bay</th>
                <th className="px-3.5 py-3 font-semibold text-right">Departure SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0] text-[#141414]">
              {filteredVehicles.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => onSelectVehicle?.(v.id)}
                  className={`hover:bg-[#f3f3f3] cursor-pointer transition-colors ${
                    highlightedVehicleId === v.id ? 'bg-[#f0f0f0]' : ''
                  }`}
                >
                  <td className="px-3.5 py-2.5 font-bold">{v.id}</td>
                  <td className="px-3.5 py-2.5 text-[#707070]">{v.battery_capacity_kwh} kWh</td>
                  <td className="px-3.5 py-2.5">{v.arrival_clock}</td>
                  <td className="px-3.5 py-2.5">{v.departure_clock}</td>
                  
                  {/* SOC Progress Bar */}
                  <td className="px-3.5 py-2.5">
                    <div className="w-36 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#707070]">
                        <span>{v.arrival_soc}%</span>
                        <span className="font-semibold text-[#141414]">{v.target_soc}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#adadad]"
                          style={{ width: `${v.arrival_soc}%` }}
                        />
                        <div
                          className="h-full bg-[#0066ff]"
                          style={{ width: `${v.target_soc - v.arrival_soc}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-3.5 py-2.5">{v.energy_needed_kwh} kWh</td>
                  <td className="px-3.5 py-2.5 font-bold">{v.assigned_bay || 'Bay 01'}</td>
                  <td className="px-3.5 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#141414] bg-[#f3f3f3] px-2.5 py-0.5 rounded-full border border-[#e0e0e0]">
                      <CheckCircle2 className="w-3 h-3 text-[#141414]" />
                      READY
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
