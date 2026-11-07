'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  User,
  Store,
  Shield,
  Database,
  Coins,
  FileCheck,
} from 'lucide-react';
import { SequenceStepInfo, SequenceStepStatus } from '../../lib/demo-types';

interface StorylineSequenceProps {
  steps: SequenceStepInfo[];
}

export default function StorylineSequence({ steps }: StorylineSequenceProps) {
  const getRoleIcon = (role: SequenceStepInfo['role']) => {
    switch (role) {
      case 'Buyer':
        return <User className="w-3.5 h-3.5 text-blue-400" />;
      case 'Merchant A':
      case 'Merchant B':
        return <Store className="w-3.5 h-3.5 text-purple-400" />;
      case 'Arkiv':
        return <Database className="w-3.5 h-3.5 text-[#DD60F7]" />;
      case 'Hedera':
        return <Coins className="w-3.5 h-3.5 text-emerald-400" />;
      case 'PayeeGuard':
      default:
        return <Shield className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getStatusIcon = (status: SequenceStepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'blocked':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-[#DD60F7] animate-spin shrink-0" />;
      case 'skipped':
        return <MinusCircle className="w-4 h-4 text-[#555555] shrink-0" />;
      case 'pending':
      default:
        return <div className="w-3 h-3 rounded-full border border-[#444444] shrink-0" />;
    }
  };

  return (
    <div className="p-5 rounded-3xl bg-[#0D0D0D] border border-[#222222] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#DD60F7]" />
            End-to-End Execution Sequence
          </h3>
          <p className="text-xs text-[#888888] mt-0.5">
            Role orchestration across Buyer, Merchant A, Merchant B, Arkiv Rabdi, and Hedera.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
            Buyer Agent
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
            Merchant
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DD60F7]/10 text-[#DD60F7] border border-[#DD60F7]/20">
            Arkiv Rabdi
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Hedera
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const isDone = step.status === 'completed';
          const isBlocked = step.status === 'blocked';
          const isActive = step.status === 'in_progress';

          return (
            <div
              key={step.id || idx}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                isBlocked
                  ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                  : isDone
                  ? 'bg-[#121212] border-emerald-500/30'
                  : isActive
                  ? 'bg-[#161616] border-[#DD60F7] ring-1 ring-[#DD60F7]/40 shadow-[0_0_15px_rgba(221,96,247,0.15)]'
                  : 'bg-[#090909] border-[#1C1C1C]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#181818] border border-[#262626] text-[10px] font-mono text-[#AAAAAA]">
                    {getRoleIcon(step.role)}
                    {step.role}
                  </span>
                  {getStatusIcon(step.status)}
                </div>

                <h4 className="text-xs font-bold text-white font-mono leading-tight">{step.label}</h4>
                <p className="mt-1.5 text-[11px] text-[#888888] leading-relaxed">{step.detail}</p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#555555]">Step {idx + 1}/8</span>
                <span
                  className={`uppercase font-bold ${
                    isBlocked
                      ? 'text-rose-400'
                      : isDone
                      ? 'text-emerald-400'
                      : isActive
                      ? 'text-[#DD60F7]'
                      : 'text-[#666666]'
                  }`}
                >
                  {step.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
