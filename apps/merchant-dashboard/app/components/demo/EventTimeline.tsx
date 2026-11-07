'use client';

import React, { useState } from 'react';
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Send,
  FileText,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Database,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { DemoEvent } from '../../lib/demo-types';

interface EventTimelineProps {
  events: DemoEvent[];
  isSimulated: boolean;
}

export default function EventTimeline({ events, isSimulated }: EventTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (events.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#222222] text-center space-y-3">
        <Clock className="w-8 h-8 text-[#555555] mx-auto animate-pulse" />
        <h4 className="text-sm font-semibold text-white">Event Timeline Standby</h4>
        <p className="text-xs text-[#888888] max-w-sm mx-auto">
          Select a scenario above and click &quot;Run Scenario&quot; to inspect real-time security events,
          challenge issuance, PayeeGuard evaluation, and settlement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#DD60F7]" />
          Execution Event Timeline
        </h3>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
            isSimulated
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {isSimulated ? '▲ SIMULATED FIXTURE TIMELINE' : '● LIVE ON-CHAIN TIMELINE'}
        </span>
      </div>

      <div className="relative pl-6 border-l-2 border-[#262626] space-y-6">
        {events.map((evt, idx) => {
          const isExpanded = !!expandedEvents[evt.eventId];
          const isBlocked = evt.verdict === 'BLOCK' || evt.stage === 'BLOCKED';
          const isPass = evt.verdict === 'PASS' || evt.stage === 'COMPLETED';

          return (
            <div key={evt.eventId || idx} className="relative group">
              {/* Timeline Pin Node */}
              <div
                className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 transition-transform group-hover:scale-125 ${
                  isBlocked
                    ? 'bg-rose-500 border-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                    : isPass
                    ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    : 'bg-[#DD60F7] border-white shadow-[0_0_10px_rgba(221,96,247,0.5)]'
                }`}
              />

              {/* Event Content Card */}
              <div className="rounded-2xl bg-[#121212] border border-[#222222] p-4.5 hover:border-[#333333] transition-all space-y-2.5">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      {evt.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-[#666666]">#{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#888888]">{evt.timestamp}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isBlocked
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : isPass
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#DD60F7]/15 text-[#DD60F7] border border-[#DD60F7]/30'
                      }`}
                    >
                      {evt.stage}
                    </span>
                  </div>
                </div>

                {/* Event Message */}
                <p className="text-xs text-[#CCCCCC] leading-relaxed font-sans">{evt.message}</p>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  {evt.buyerId && (
                    <span className="px-2 py-0.5 rounded bg-[#181818] border border-[#262626] text-[#999999]">
                      Buyer: <strong className="text-white">{evt.buyerId}</strong>
                    </span>
                  )}
                  {evt.merchantId && (
                    <span className="px-2 py-0.5 rounded bg-[#181818] border border-[#262626] text-[#999999]">
                      Merchant: <strong className="text-white">{evt.merchantId}</strong>
                    </span>
                  )}
                  {evt.network && (
                    <span className="px-2 py-0.5 rounded bg-[#181818] border border-[#262626] text-[#999999]">
                      Net: <strong className="text-[#DD60F7]">{evt.network}</strong>
                    </span>
                  )}
                  {typeof evt.signerCallCount === 'number' && (
                    <span
                      className={`px-2 py-0.5 rounded font-bold border ${
                        evt.signerCallCount === 0
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      signerCallCount = {evt.signerCallCount}
                    </span>
                  )}
                  {evt.reasonCode && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold">
                      {evt.reasonCode}
                    </span>
                  )}
                  {evt.dataSource && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] text-[#666666]">
                      [{evt.dataSource === 'simulated_fixture' ? 'SIMULATED' : 'LIVE'}]
                    </span>
                  )}
                </div>

                {/* Evidence links if present */}
                {(evt.hederaHashScanUrl || evt.arkivExplorerUrl) && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono">
                    {evt.hederaHashScanUrl && (
                      <a
                        href={evt.hederaHashScanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                      >
                        Hedera HashScan <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {evt.arkivExplorerUrl && (
                      <a
                        href={evt.arkivExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#DD60F7] hover:text-[#E482F9] underline underline-offset-2"
                      >
                        Rabdi Explorer Entity <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Expandable Payload Toggle */}
                {evt.rawPayload && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(evt.eventId)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#888888] hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{isExpanded ? 'Hide Payload' : 'View Raw Payload Details'}</span>
                    </button>
                    {isExpanded && (
                      <pre className="mt-2 p-3 rounded-xl bg-[#080808] border border-[#222222] font-mono text-[11px] text-[#AAAAAA] overflow-x-auto">
                        {JSON.stringify(evt.rawPayload, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
