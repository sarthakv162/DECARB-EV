import React, { useState } from 'react';
import { 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  X, 
  Cpu 
} from 'lucide-react';
import { ParsedRosterItem } from '../types';
import { MessageLoading } from './ui/message-loading';

interface RosterIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitFleet?: (fleet: ParsedRosterItem[]) => void;
}

const SAMPLE_RAW_ROSTER = `Van-01: Tata Ace EV 70kWh arrived 16:30 at 22% battery -> leaves 05:30 target 90%
V02 | Mahindra Zor | 70 kWh | 17:00 | 35% soc | dep 06:00 (need 85%)
Van 3 - 60kwh arrived 18:15 with 18% remaining, departure 05:45, target 90%
V04: 80 kWh pack, in 17:30 (42%), out 06:30, charge to 95%
V05: 70kwh in 16:45 @ 12% (check low soc!), out 05:30 target 85%`;

export const RosterIngestionModal: React.FC<RosterIngestionModalProps> = ({
  isOpen,
  onClose,
  onCommitFleet,
}) => {
  const [rawText, setRawText] = useState<string>(SAMPLE_RAW_ROSTER);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedFleet, setParsedFleet] = useState<ParsedRosterItem[] | null>(null);
  const [isConfirmedByManager, setIsConfirmedByManager] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleParse = async () => {
    setIsParsing(true);
    try {
      const res = await fetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_roster_text: rawText }),
      });
      if (res.ok) {
        const data = await res.json();
        setParsedFleet(data.fleet);
      }
    } catch (err) {
      console.warn('API error during parsing, using local fallback:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmAndCommit = () => {
    if (parsedFleet) {
      onCommitFleet?.(parsedFleet);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#141414]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl rounded-[24px] bg-[#ffffff] border border-[#e0e0e0] p-6 lg:p-8 flex flex-col gap-5 max-h-[90vh] overflow-y-auto font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[30%] bg-[#141414] text-[#ffffff] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#141414] flex items-center gap-2">
                Amazon Bedrock Messy Roster Ingestion Agent
                <span className="text-[10px] font-mono font-semibold text-[#141414] bg-[#f3f3f3] px-2.5 py-0.5 rounded-full border border-[#e0e0e0]">
                  Claude 3.5 Sonnet
                </span>
              </h3>
              <p className="text-xs text-[#707070]">
                Paste unformatted logistics shift notes or messages. Bedrock parses schema with human-in-the-loop audit.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#707070] hover:text-[#141414] hover:bg-[#f3f3f3] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Column Interface: Raw Text vs. Parsed Fleet Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left: Raw Textarea (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-2 font-mono text-xs">
            <span className="text-[#707070] font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#141414]" />
              Raw Driver Log Input:
            </span>
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw vehicle list here..."
              className="w-full p-4 rounded-[16px] bg-[#f0f0f0] border border-transparent focus:border-[#141414] text-[#141414] placeholder-[#adadad] font-mono text-xs focus:outline-none resize-none leading-relaxed"
            />

            <button
              onClick={handleParse}
              disabled={isParsing || !rawText.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#141414] hover:bg-[#262626] text-[#ffffff] font-semibold text-xs transition-all disabled:opacity-50 mt-1"
            >
              {isParsing ? (
                <>
                  <MessageLoading size={16} className="text-[#ffffff]" />
                  <span>Bedrock Extracting Schema...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Parse Schema with Bedrock</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Parsed Fleet Table (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#707070] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0066ff]" />
                Extracted Fleet Schema:
              </span>
              {parsedFleet && (
                <span className="text-[11px] font-bold text-[#141414]">
                  {parsedFleet.length} Vans Extracted
                </span>
              )}
            </div>

            {parsedFleet ? (
              <div className="overflow-x-auto rounded-[16px] border border-[#e0e0e0] bg-[#ffffff] max-h-64">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#f3f3f3] border-b border-[#e0e0e0] text-[#707070] text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Battery</th>
                      <th className="px-3 py-2 font-semibold">Arrival</th>
                      <th className="px-3 py-2 font-semibold">Departure</th>
                      <th className="px-3 py-2 font-semibold">SOC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0] text-[#141414]">
                    {parsedFleet.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#f3f3f3]">
                        <td className="px-3 py-1.5 font-bold">{item.id}</td>
                        <td className="px-3 py-1.5 text-[#707070]">{item.battery_capacity_kwh} kWh</td>
                        <td className="px-3 py-1.5">{item.arrival_clock || item.arrival_time || '20:00'}</td>
                        <td className="px-3 py-1.5">{item.departure_clock || item.departure_time || '06:00'}</td>
                        <td className="px-3 py-1.5">{item.arrival_soc_pct ?? item.arrival_soc ?? 20}% → {item.target_soc_pct ?? item.target_soc ?? 90}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 min-h-[160px] rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] flex items-center justify-center p-6 text-center text-xs text-[#adadad] font-mono">
                Click "Parse Schema with Bedrock" to extract structured JSON.
              </div>
            )}
          </div>

        </div>

        {/* Manager Audit Confirmation Gate */}
        {parsedFleet && (
          <div className="p-4 rounded-[16px] bg-[#f3f3f3] border border-[#e0e0e0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-xs text-[#141414] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isConfirmedByManager}
                onChange={(e) => setIsConfirmedByManager(e.target.checked)}
                className="w-4 h-4 rounded text-[#141414] border-[#e0e0e0] focus:ring-0"
              />
              <span>
                <strong>Operations Manager Gate:</strong> I verify all {parsedFleet.length} driver dwell windows and pack capacities are correct.
              </span>
            </label>

            <button
              onClick={handleConfirmAndCommit}
              disabled={!isConfirmedByManager}
              className="px-6 py-2 rounded-full bg-[#141414] hover:bg-[#262626] text-[#ffffff] font-bold text-xs transition-all disabled:opacity-40 shrink-0"
            >
              Commit Manifest
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
