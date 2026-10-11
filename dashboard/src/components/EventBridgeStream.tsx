import React from 'react';
import { 
  Radio, 
  Terminal, 
  AlertTriangle, 
  CheckCircle2
} from 'lucide-react';
import { AuditEvent } from '../types';

interface EventBridgeStreamProps {
  events: AuditEvent[];
}

export const EventBridgeStream: React.FC<EventBridgeStreamProps> = ({ events }) => {
  return (
    <div className="rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[30%] bg-[#f3f3f3] text-[#141414] flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-[#141414]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141414] flex items-center gap-2">
              Amazon EventBridge Telemetry & Audit Stream
            </h2>
            <p className="text-xs text-[#707070] font-mono">
              Event Bus: <span className="text-[#141414]">ev-depot-telemetry-bus</span> • DynamoDB Logged
            </p>
          </div>
        </div>

        <span className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-[#f3f3f3] border border-[#e0e0e0] text-[#141414]">
          {events.length} Events Logged
        </span>
      </div>

      {/* Log Feed */}
      <div className="overflow-y-auto max-h-64 space-y-2.5 pr-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-center py-6 text-[#adadad] text-xs">
            Awaiting telemetry from Amazon EventBridge...
          </div>
        ) : (
          events.map((evt) => {
            const isFault = evt.event_type.includes('FAULT') || evt.event_type.includes('TRIP') || evt.event_type.includes('SPIKE') || evt.event_type.includes('CAP_DROP');
            const isApproval = evt.event_type.includes('APPROVED');

            return (
              <div
                key={evt.id}
                className={`p-3 rounded-[16px] border transition-all ${
                  isFault
                    ? 'bg-[#141414] text-[#ffffff] border-[#141414]'
                    : isApproval
                    ? 'bg-[#f3f3f3] border-2 border-[#141414] text-[#141414]'
                    : 'bg-[#f3f3f3] border-[#e0e0e0] text-[#141414]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isFault ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#0066ff] shrink-0" />
                    ) : isApproval ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#141414] shrink-0" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-[#707070] shrink-0" />
                    )}
                    <span className="truncate">{evt.title}</span>
                  </div>
                  <span className={`text-[10px] shrink-0 ${isFault ? 'text-[#adadad]' : 'text-[#707070]'}`}>
                    {evt.timestamp}
                  </span>
                </div>

                <p className={`text-[11px] leading-normal mb-1 font-sans ${isFault ? 'text-[#adadad]' : 'text-[#707070]'}`}>
                  {evt.description}
                </p>

                <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                  isFault ? 'border-[#262626] text-[#707070]' : 'border-[#e0e0e0] text-[#adadad]'
                }`}>
                  <span>ID: {evt.id}</span>
                  <span>Source: {evt.source}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
