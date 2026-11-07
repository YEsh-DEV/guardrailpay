'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { LiveRunError } from '../../lib/demo-types';

interface LiveFailureAlertProps {
  error: LiveRunError;
  onSwitchToFixture: () => void;
  onRetry: () => void;
}

export default function LiveFailureAlert({
  error,
  onSwitchToFixture,
  onRetry,
}: LiveFailureAlertProps) {
  return (
    <div className="p-6 rounded-3xl bg-rose-950/20 border-2 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.2)] space-y-4">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5 text-rose-400" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/30 text-rose-200 uppercase">
              {error.code}
            </span>
            {error.httpStatus && (
              <span className="text-xs font-mono text-rose-300">
                HTTP {error.httpStatus}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white">{error.title}</h3>
          <p className="text-xs text-rose-200/90 leading-relaxed">{error.message}</p>
          {error.details && (
            <pre className="mt-2 p-2.5 rounded-xl bg-black/50 border border-rose-500/20 text-[11px] font-mono text-rose-300 overflow-x-auto">
              {error.details}
            </pre>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rose-500/20">
        <span className="text-[11px] font-mono text-[#888888]">
          Invariant Note: Live mode never silently falls back to fixture mode.
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-mono text-rose-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Live Run</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToFixture}
            className="px-4 py-2 rounded-xl bg-[#DD60F7] hover:bg-[#D152F5] text-black font-semibold text-xs font-mono transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(221,96,247,0.3)]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Switch to Fixture Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
