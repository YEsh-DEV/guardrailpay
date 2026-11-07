'use client';

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  MinusCircle,
  CheckCircle2,
  XCircle,
  Lock,
} from 'lucide-react';
import { SecurityCheckResult, SecurityCheckStatus } from '../../lib/demo-types';

interface SecurityCheckPanelProps {
  checks: SecurityCheckResult[];
}

export default function SecurityCheckPanel({ checks }: SecurityCheckPanelProps) {
  const getStatusBadge = (status: SecurityCheckStatus) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case 'BLOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
            <XCircle className="w-3.5 h-3.5" />
            BLOCK
          </span>
        );
      case 'HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            HOLD
          </span>
        );
      case 'UNVERIFIABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <HelpCircle className="w-3.5 h-3.5" />
            UNVERIFIABLE
          </span>
        );
      case 'NOT_RUN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-[#1F1F1F] text-[#777777] border border-[#2E2E2E]">
            <MinusCircle className="w-3 h-3" />
            NOT RUN
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#DD60F7]" />
            PayeeGuard Synchronous Policy Checks
          </h3>
          <p className="text-xs text-[#888888] mt-0.5">
            Invariant Policy: Unexecuted checks strictly remain NOT_RUN. A BLOCK stops execution before rawSigner is accessed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {checks.map((check) => {
          const isBlock = check.status === 'BLOCK';
          const isPass = check.status === 'PASS';
          const isNotRun = check.status === 'NOT_RUN';

          return (
            <div
              key={check.name}
              className={`p-4 rounded-2xl border transition-all ${
                isBlock
                  ? 'bg-rose-950/20 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                  : isPass
                  ? 'bg-[#121212] border-emerald-500/20'
                  : 'bg-[#0E0E0E] border-[#222222]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-semibold text-white font-mono">{check.label}</span>
                {getStatusBadge(check.status)}
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  isBlock ? 'text-rose-200' : isPass ? 'text-[#BBBBBB]' : 'text-[#666666]'
                }`}
              >
                {check.detail}
              </p>
              {check.timestamp && (
                <div className="mt-2 text-[10px] font-mono text-[#555555]">
                  Evaluated at: {check.timestamp}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
