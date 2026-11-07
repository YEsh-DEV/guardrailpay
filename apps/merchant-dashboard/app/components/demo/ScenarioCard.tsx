'use client';

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import { ScenarioDefinition, DemoMode, ScenarioId } from '../../lib/demo-types';

interface ScenarioCardProps {
  scenario: ScenarioDefinition;
  isSelected: boolean;
  isRunning: boolean;
  currentMode: DemoMode;
  confirmedMode?: DemoMode;
  isSimulated?: boolean;
  liveEnabled: boolean;
  onSelect: () => void;
  onRun: (scenarioId: ScenarioId, mode: DemoMode) => void;
  onModeChange: (mode: DemoMode) => void;
}

export default function ScenarioCard({
  scenario,
  isSelected,
  isRunning,
  currentMode,
  confirmedMode,
  isSimulated,
  liveEnabled,
  onSelect,
  onRun,
  onModeChange,
}: ScenarioCardProps) {
  const isNormal = scenario.id === 'NORMAL_PAYMENT';
  const isSuspicious = scenario.id === 'SUSPICIOUS_PAYMENT';
  const isCross = scenario.id === 'CROSS_MERCHANT_BLOCK';

  const badgeColors = {
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    info: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }[scenario.badgeType];

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-3xl p-6 transition-all cursor-pointer border flex flex-col justify-between ${
        isSelected
          ? 'bg-[#141414] border-[#DD60F7] shadow-[0_0_30px_rgba(221,96,247,0.15)] ring-1 ring-[#DD60F7]/50'
          : 'bg-[#0E0E0E] border-[#222222] hover:border-[#383838] hover:bg-[#121212]'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isNormal
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isSuspicious
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {isNormal && <ShieldCheck className="w-5 h-5" />}
              {isSuspicious && <ShieldAlert className="w-5 h-5" />}
              {isCross && <Users className="w-5 h-5" />}
            </span>
            <span className="font-mono text-xs uppercase text-[#888888]">
              {isNormal ? 'SCENARIO 1' : isSuspicious ? 'SCENARIO 2' : 'SCENARIO 3'}
            </span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${badgeColors}`}>
            {scenario.badgeText}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight">{scenario.title}</h3>
        <p className="text-xs font-mono text-[#DD60F7] mt-0.5">{scenario.subtitle}</p>

        <p className="mt-3 text-xs text-[#9CA3AF] leading-relaxed line-clamp-3">
          {scenario.description}
        </p>

        {/* Security Invariant Highlights */}
        <div className="mt-4 p-3 rounded-xl bg-[#080808] border border-[#1E1E1E] space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between text-[#888888]">
            <span>Target Merchant:</span>
            <span className="text-white truncate max-w-[170px]">{scenario.merchantIdentity}</span>
          </div>
          <div className="flex items-center justify-between text-[#888888]">
            <span>Expected Verdict:</span>
            <span className={scenario.expectedVerdict === 'PASS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {scenario.expectedVerdict}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#888888]">
            <span>Signer Call Count:</span>
            <span className={scenario.expectedVerdict === 'PASS' ? 'text-emerald-400' : 'text-emerald-400 font-bold'}>
              {scenario.expectedVerdict === 'PASS' ? '1 (Permitted)' : '0 (Hard Veto)'}
            </span>
          </div>
        </div>
      </div>

      {/* Mode Selector & Action Button */}
      <div className="mt-5 pt-4 border-t border-[#1C1C1C] space-y-3">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#888888]">Requested Mode:</span>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onModeChange('fixture')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                currentMode === 'fixture'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-[#181818] text-[#888888] hover:text-white'
              }`}
            >
              Fixture
            </button>
            <button
              type="button"
              disabled={!liveEnabled}
              onClick={() => onModeChange('arkiv-live')}
              title={liveEnabled ? 'Use the configured merchant API' : 'Live mode is disabled on the public frontend'}
              className={`px-2 py-0.5 rounded text-[10px] font-mono disabled:cursor-not-allowed disabled:opacity-40 ${
                currentMode === 'arkiv-live'
                  ? 'bg-[#DD60F7]/20 text-[#DD60F7] border border-[#DD60F7]/40 font-bold'
                  : 'bg-[#181818] text-[#888888] hover:text-white'
              }`}
            >
              Arkiv Live
            </button>
            <button
              type="button"
              disabled={!liveEnabled}
              onClick={() => onModeChange('full-live')}
              title={liveEnabled ? 'Use the configured merchant API' : 'Live mode is disabled on the public frontend'}
              className={`px-2 py-0.5 rounded text-[10px] font-mono disabled:cursor-not-allowed disabled:opacity-40 ${
                currentMode === 'full-live'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-[#181818] text-[#888888] hover:text-white'
              }`}
            >
              Full Live
            </button>
          </div>
        </div>

        {isSelected && confirmedMode && (
          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#181818]">
            <span className="text-[#888888]">Confirmed Execution:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                confirmedMode === 'fixture' || isSimulated
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {confirmedMode.toUpperCase()} {confirmedMode === 'fixture' && '(SIMULATED)'}
            </span>
          </div>
        )}

        <button
          type="button"
          disabled={isRunning || (!liveEnabled && currentMode !== 'fixture')}
          onClick={(e) => {
            e.stopPropagation();
            onRun(scenario.id, currentMode);
          }}
          className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 ${
            isRunning && isSelected
              ? 'bg-[#1C1C1C] text-[#888888] cursor-not-allowed border border-[#333333]'
              : 'bg-[#DD60F7] hover:bg-[#D152F5] text-black shadow-[0_0_15px_rgba(221,96,247,0.25)] hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {isRunning && isSelected ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Executing Flow...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Scenario</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
