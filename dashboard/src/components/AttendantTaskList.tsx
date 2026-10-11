import React from 'react';
import { 
  ClipboardList, 
  ArrowRightLeft, 
  PlugZap, 
  Unplug
} from 'lucide-react';
import { AttendantTask } from '../types';

interface AttendantTaskListProps {
  tasks?: AttendantTask[];
  extraPluginsCount?: number;
  operatingMode?: 'SAFE' | 'GREEN';
}

const DEFAULT_TASKS: AttendantTask[] = [
  { interval: 0, clock: "16:00", task_type: "PLUG_IN", van_id: "V01", bay_id: "C01", details: "Plug in V01 on Bay C01 (Target 90% SOC, departs 05:30)." },
  { interval: 2, clock: "16:30", task_type: "PLUG_IN", van_id: "V04", bay_id: "C02", details: "Plug in V04 on Bay C02 (Target 85% SOC, departs 06:00)." },
  { interval: 8, clock: "18:00", task_type: "PLUG_IN", van_id: "V07", bay_id: "C03", details: "Plug in V07 on Bay C03 (Target 90% SOC, departs 05:30)." },
  { interval: 22, clock: "21:30", task_type: "BAY_SWAP", van_id: "V12", bay_id: "C01", details: "V01 reached target SOC. Transfer Bay C01 to V12 for early morning departure." },
  { interval: 26, clock: "22:30", task_type: "BAY_SWAP", van_id: "V15", bay_id: "C02", details: "V04 finished. Transfer Bay C02 to V15." },
  { interval: 34, clock: "00:30", task_type: "PLUG_IN", van_id: "V21", bay_id: "C04", details: "Clean off-peak window started. Connect V21 to Bay C04." },
  { interval: 42, clock: "02:30", task_type: "BAY_SWAP", van_id: "V28", bay_id: "C03", details: "Transfer Bay C03 to V28." },
  { interval: 52, clock: "05:00", task_type: "UNPLUG", van_id: "V01", bay_id: "C01", details: "All charge cycles verified 100%. Unplug V01 and stage at dispatch bay." },
];

export const AttendantTaskList: React.FC<AttendantTaskListProps> = ({
  tasks = DEFAULT_TASKS,
  extraPluginsCount = 18,
  operatingMode = 'SAFE',
}) => {
  const displayTasks = tasks && tasks.length > 0 ? tasks : DEFAULT_TASKS;

  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[30%] bg-[#f3f3f3] text-[#141414] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141414] flex items-center gap-2">
              Overnight Attendant Task List (Physical Cable Moves)
              <span className="text-[11px] font-mono font-semibold px-3 py-0.5 rounded-full bg-[#f3f3f3] text-[#141414] border border-[#e0e0e0]">
                {operatingMode === 'SAFE' ? '18 Moves / Night (Safe Mode)' : '94 Moves / Night (Green Mode)'}
              </span>
            </h2>
            <p className="text-xs text-[#707070] mt-0.5">
              Vans outnumber chargers 4 to 1. Attendants rotate vans overnight using sticky bay swaps.
            </p>
          </div>
        </div>

        {/* Plug-in Efficiency Metric */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-[#adadad] block text-[10px] font-semibold uppercase">Extra Moves</span>
            <span className="font-bold text-[#141414]">
              +{extraPluginsCount} Plug-ins
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#adadad] block text-[10px] font-semibold uppercase">Labor Load</span>
            <span className="font-bold text-[#141414]">
              {operatingMode === 'SAFE' ? '~1.2 hrs' : '~4.8 hrs'}
            </span>
          </div>
        </div>
      </div>

      {/* Task Queue List */}
      <div className="space-y-2.5">
        {displayTasks.map((task, idx) => (
          <div 
            key={idx}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] hover:border-[#141414] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-[#141414] text-[#ffffff] font-mono text-xs font-bold shrink-0">
                {task.clock}
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-[#ffffff] border border-[#e0e0e0] text-[#141414] font-mono font-bold text-xs shrink-0">
                {task.van_id}
              </span>

              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 shrink-0 ${
                task.task_type === 'PLUG_IN'
                  ? 'bg-[#0066ff] text-[#ffffff]'
                  : task.task_type === 'BAY_SWAP'
                  ? 'bg-[#141414] text-[#ffffff]'
                  : 'bg-[#ffffff] text-[#707070] border border-[#e0e0e0]'
              }`}>
                {task.task_type === 'PLUG_IN' && <PlugZap className="w-3 h-3" />}
                {task.task_type === 'BAY_SWAP' && <ArrowRightLeft className="w-3 h-3" />}
                {task.task_type === 'UNPLUG' && <Unplug className="w-3 h-3" />}
                <span>{task.task_type.replace('_', ' ')}</span>
              </span>

              <span className="text-xs font-mono font-bold text-[#141414]">
                Bay {task.bay_id}
              </span>
            </div>

            <p className="text-xs text-[#707070] sm:text-right font-sans">
              {task.details}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
};
