'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Play,
  RefreshCw,
  Layers,
  Lock,
  Database,
  ArrowRight,
  Radio,
  FileCheck2,
} from 'lucide-react';
import ScenarioCard from '../components/demo/ScenarioCard';
import EventTimeline from '../components/demo/EventTimeline';
import SecurityCheckPanel from '../components/demo/SecurityCheckPanel';
import BlockchainEvidencePanel from '../components/demo/BlockchainEvidencePanel';
import StorylineSequence from '../components/demo/StorylineSequence';
import LiveFailureAlert from '../components/demo/LiveFailureAlert';
import {
  ScenarioId,
  DemoMode,
  ScenarioDefinition,
  DemoRunState,
} from '../lib/demo-types';
import {
  SCENARIO_DEFINITIONS,
  INITIAL_SEQUENCE_STEPS,
  INITIAL_SECURITY_CHECKS,
  getScenarios,
  executeDemoRun,
} from '../lib/demo-api-client';

export default function DemoControlCenterPage() {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(Object.values(SCENARIO_DEFINITIONS));
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>('NORMAL_PAYMENT');
  const [selectedMode, setSelectedMode] = useState<DemoMode>('fixture');
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState<DemoRunState | null>(null);
  const [activeTab, setActiveTab] = useState<'sequence' | 'timeline' | 'security' | 'evidence'>('sequence');

  // Load scenarios on mount
  useEffect(() => {
    async function load() {
      const [list, capabilities] = await Promise.all([
        getScenarios().catch(() => Object.values(SCENARIO_DEFINITIONS)),
        fetch('/api/demo/capabilities', { cache: 'no-store' }).then((response) => response.ok ? response.json() : { liveEnabled: false }).catch(() => ({ liveEnabled: false })),
      ]);
      setScenarios(list);
      setLiveEnabled(capabilities?.liveEnabled === true);
    }
    load();
  }, []);

  const handleRunScenario = async (scenarioId: ScenarioId, runMode: DemoMode) => {
    if (runMode !== 'fixture' && !liveEnabled) return;
    setSelectedScenarioId(scenarioId);
    setSelectedMode(runMode);
    setIsRunning(true);

    try {
      const result = await executeDemoRun(scenarioId, runMode, (updatedState) => {
        setRunState(updatedState);
      });
      setRunState(result);
    } catch (err: any) {
      console.error('Demo run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSwitchToFixture = () => {
    setSelectedMode('fixture');
    handleRunScenario(selectedScenarioId, 'fixture');
  };

  const handleRetryLive = () => {
    if (!liveEnabled) return;
    handleRunScenario(selectedScenarioId, selectedMode);
  };

  const currentScenario = SCENARIO_DEFINITIONS[selectedScenarioId];

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] selection:bg-[#DD60F7]/30 selection:text-white pb-24">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#050505]/85 backdrop-blur-xl border-b border-[#262626] px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D152F5] to-[#7F359B] flex items-center justify-center shadow-[0_0_15px_rgba(209,82,245,0.4)]">
                <ShieldAlert className="w-4 h-4 text-black" />
              </span>
              <span className="font-sans font-bold text-lg text-white tracking-tight">
                GuardRail Pay
              </span>
            </Link>
            <span className="text-[#333333]">/</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#DD60F7]/15 text-[#DD60F7] border border-[#DD60F7]/30">
                Demo Control Center
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <Radio className="w-3 h-3 text-[#DD60F7] animate-pulse" />
                x402 Live Testbench
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/arkiv"
              className="px-3.5 py-1.5 rounded-lg border border-[#DD60F7]/40 bg-[#DD60F7]/10 hover:bg-[#DD60F7]/20 text-xs font-mono text-[#DD60F7] hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(221,96,247,0.2)]"
            >
              <span>Arkiv Threat Monitor</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/merchant"
              className="px-3.5 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
            >
              Merchant Dashboard
            </Link>
            <Link
              href="/buyer"
              className="px-3.5 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
            >
              Buyer Simulator
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 space-y-8">
        {/* Hero Section */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">
                Interactive Demonstration Suite • ETHGlobal Mumbai
              </p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                x402 Firewall & Settlement Control Center
              </h1>
              <p className="mt-2 text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
                Demonstrating autonomous AI agent payment safety. PayeeGuard intercepts the merchant HTTP 402 challenge,
                validates ENS merchant identity, checks Arkiv Rabdi decentralized threat intelligence, and halts the signer
                on anomalous behavior before any funds can leave the buyer wallet.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#141414] border border-[#262626] text-[#A3A3A3]">
                Selected Mode: <strong className="text-white uppercase">{selectedMode}</strong>
              </span>
              {runState && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono border ${
                    runState.mode === 'fixture' || runState.isSimulated
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  Execution Mode: <strong className="uppercase">{runState.mode}</strong>
                  {runState.mode === 'fixture' && ' (SIMULATED)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mode Mismatch Notice if requestedMode != executionMode */}
        {runState?.isModeMismatch && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="block text-amber-300 font-bold">Backend Mode Override:</strong>
                <span>
                  You requested <code className="text-white font-bold">{runState.requestedMode}</code>, but the backend executed this scenario in <code className="text-white font-bold">{runState.mode}</code> mode. All evidence, checks, and metrics strictly reflect backend <code className="text-white">{runState.mode}</code> execution.
                </span>
              </div>
            </div>
            {runState.mode === 'fixture' && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] shrink-0 font-bold">
                FIXTURE SIMULATION
              </span>
            )}
          </div>
        )}

        {!liveEnabled && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono">
            Public deployment is running in fixture-only mode. Arkiv-live and full-live execution are disabled until a server-configured merchant API is connected; simulated events are labeled and never count as settlement.
          </div>
        )}

        {/* 3 Scenario Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {scenarios.map((sc) => (
            <ScenarioCard
              key={sc.id}
              scenario={sc}
              isSelected={selectedScenarioId === sc.id}
              isRunning={isRunning}
              currentMode={selectedMode}
              confirmedMode={runState?.scenarioId === sc.id ? runState.mode : undefined}
              isSimulated={runState?.scenarioId === sc.id ? (runState.mode === 'fixture' || runState.isSimulated) : undefined}
              liveEnabled={liveEnabled}
              onSelect={() => setSelectedScenarioId(sc.id)}
              onRun={(id, m) => handleRunScenario(id, m)}
              onModeChange={(newMode) => setSelectedMode(newMode)}
            />
          ))}
        </div>

        {/* Selected Scenario Action Bar */}
        <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-[#262626] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888888] uppercase">Active Scenario:</span>
              <span className="text-sm font-bold font-mono text-white">{currentScenario.title}</span>
              <span className="text-xs font-mono text-[#DD60F7]">({currentScenario.keyRule})</span>
            </div>
            <p className="text-xs text-[#999999] max-w-3xl leading-relaxed">
              {currentScenario.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => handleRunScenario(selectedScenarioId, selectedMode)}
              className="px-5 py-2.5 rounded-xl bg-[#DD60F7] hover:bg-[#D152F5] text-black font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(221,96,247,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isRunning ? 'Executing Flow...' : `Run (${selectedMode})`}</span>
            </button>
          </div>
        </div>

        {/* Live Mode Failure Alert (Displayed on live errors - never silently falls back) */}
        {runState?.liveError && (
          <LiveFailureAlert
            error={runState.liveError}
            onSwitchToFixture={handleSwitchToFixture}
            onRetry={handleRetryLive}
          />
        )}

        {/* Tab Navigation for Detailed Inspection */}
        <div className="space-y-6">
          <div className="flex border-b border-[#262626] gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('sequence')}
              className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'sequence'
                  ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                  : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              Execution Sequence (8 Steps)
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'timeline'
                  ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                  : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
              }`}
            >
              <Layers className="w-4 h-4" />
              Event Timeline ({runState?.events.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'security'
                  ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                  : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
              }`}
            >
              <Lock className="w-4 h-4" />
              PayeeGuard Policy Checks (8)
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'evidence'
                  ? 'border-[#DD60F7] text-white bg-[#DD60F7]/5'
                  : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#333333]'
              }`}
            >
              <Database className="w-4 h-4" />
              Blockchain Evidence & Arkiv Provenance
            </button>
          </div>

          {/* TAB 1: Execution Storyline Sequence */}
          {activeTab === 'sequence' && (
            <StorylineSequence
              steps={runState?.sequenceSteps || INITIAL_SEQUENCE_STEPS[selectedScenarioId]}
            />
          )}

          {/* TAB 2: Event Timeline */}
          {activeTab === 'timeline' && (
            <EventTimeline
              events={runState?.events || []}
              isSimulated={runState ? (runState.mode === 'fixture' || runState.isSimulated) : (selectedMode === 'fixture')}
            />
          )}

          {/* TAB 3: Security Validation Panel */}
          {activeTab === 'security' && (
            <SecurityCheckPanel
              checks={runState?.securityChecks || INITIAL_SECURITY_CHECKS}
            />
          )}

          {/* TAB 4: Blockchain Evidence Panel */}
          {activeTab === 'evidence' && (
            <BlockchainEvidencePanel runState={runState} />
          )}
        </div>
      </main>
    </div>
  );
}
