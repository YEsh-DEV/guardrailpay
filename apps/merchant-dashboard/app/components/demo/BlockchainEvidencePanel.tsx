'use client';

import React, { useState } from 'react';
import {
  Database,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  FileCheck2,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import { BlockchainEvidence, DemoRunState } from '../../lib/demo-types';
import ArkivThreatProvenancePanel from './ArkivThreatProvenancePanel';

interface BlockchainEvidencePanelProps {
  runState: DemoRunState | null;
}

export default function BlockchainEvidencePanel({ runState }: BlockchainEvidencePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!runState || runState.status === 'idle') {
    return (
      <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#222222] text-center space-y-3">
        <Database className="w-8 h-8 text-[#555555] mx-auto" />
        <h4 className="text-sm font-semibold text-white">Blockchain Evidence Standby</h4>
        <p className="text-xs text-[#888888] max-w-sm mx-auto">
          Execute a scenario to review on-chain Hedera settlement receipts, Arkiv Rabdi threat records,
          and protected resource delivery states.
        </p>
      </div>
    );
  }

  const { evidence, finalVerdict, status, scenarioId, mode, requestedMode, isModeMismatch } = runState;
  const isSimulated = mode === 'fixture' || runState.isSimulated || evidence.isSimulated || evidence.dataSource === 'fixture';
  const isBlocked = finalVerdict === 'BLOCK' || status === 'blocked';
  const isPass = finalVerdict === 'PASS' || status === 'completed';

  return (
    <div className="space-y-6">
      {/* Top Banner: Prominent Data Source Notice */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isSimulated
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isSimulated ? (
            <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div>
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider">
              {isSimulated ? 'SIMULATED DEMO FIXTURE — NOT CONFIRMED ON-CHAIN' : 'LIVE ON-CHAIN VERIFIED SETTLEMENT'}
            </h4>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              {isSimulated
                ? 'Deterministic simulated execution verifying security invariants in testbench mode.'
                : 'Directly verified against Hedera Testnet Mirror Node and Arkiv Rabdi RPC.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              isSimulated
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            Backend Mode: {mode.toUpperCase()}
          </span>

          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold self-start sm:self-center ${
              isBlocked
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : isPass
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {isBlocked ? 'ACCESS DENIED — PAYMENT BLOCKED' : isPass ? 'ACCESS GRANTED — PAID & SETTLED' : 'ACCESS WITHHELD — SETTLEMENT UNVERIFIED'}
          </span>
        </div>
      </div>

      {isModeMismatch && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-center gap-2.5">
          <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Mode Mismatch Notice:</strong> Requested <em>{requestedMode}</em>, but backend executed in <em>{mode}</em>. Evidence panels strictly reflect backend <strong>{mode}</strong> mode.
          </span>
        </div>
      )}

      {/* Grid of Evidence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Signer Safety Invariant */}
        <div className="p-5 rounded-2xl bg-[#121212] border border-[#222222] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#888888]">Buyer Wallet Access</span>
            <Key className="w-4 h-4 text-[#DD60F7]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                evidence.signerCallCount === 0 ? 'text-emerald-400' : 'text-blue-400'
              }`}
            >
              signerCallCount = {evidence.signerCallCount}
            </span>
          </div>
          <p className="text-xs text-[#999999] leading-relaxed">
            {evidence.signerCallCount === 0
              ? 'Invariant Verified: Private keys were never accessed or exposed to memory because PayeeGuard halted execution prior to signing.'
              : 'Pre-signing gate passed. Cryptographic rawSigner invoked exactly once for the authorized amount.'}
          </p>
        </div>

        {/* Card 2: Hedera Settlement Status */}
        <div className="p-5 rounded-2xl bg-[#121212] border border-[#222222] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#888888]">Hedera Settlement Receipt</span>
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
          </div>
          {evidence.hederaTransactionId ? (
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white truncate">{evidence.hederaTransactionId}</div>
              {!isSimulated && evidence.hashScanUrl ? (
                <a
                  href={evidence.hashScanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 underline"
                >
                  View on HashScan Testnet <ExternalLink className="w-3 h-3" />
                </a>
              ) : isSimulated ? (
                <span className="block text-[10px] font-mono text-amber-400/90">
                  (Simulated testnet transaction format — not broadcast on-chain)
                </span>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#666666] block">No On-Chain Transaction Submitted</span>
              <p className="text-xs text-[#888888]">Transaction aborted at pre-signing firewall gate. 0 HBAR transferred.</p>
            </div>
          )}
        </div>

        {/* Card 3: Protected Resource Delivery Invariant */}
        <div className="p-5 rounded-2xl bg-[#121212] border border-[#222222] space-y-2.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#888888]">Protected Resource Delivery</span>
            {evidence.deliveredResource ? (
              <Unlock className="w-4 h-4 text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 text-rose-400" />
            )}
          </div>

          {evidence.deliveredResource ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                <FileText className="w-4 h-4" />
                <span>{evidence.deliveredResource.title}</span>
              </div>
              <pre className="p-3 rounded-xl bg-[#080808] border border-[#1E1E1E] font-mono text-[11px] text-[#AAAAAA] overflow-x-auto max-h-48">
                {evidence.deliveredResource.payloadPreview}
              </pre>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#080808] border border-rose-500/20 text-xs text-[#888888] space-y-1">
              <span className="font-semibold text-rose-300 block">PROTECTED RESOURCE WITHHELD (HTTP 402 / 400)</span>
              <p>
                Strict Invariant Enforced: The merchant gateway refuses to release the requested alpha report because
                settlement proof was never submitted.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Arkiv Threat Provenance Panel */}
      <ArkivThreatProvenancePanel
        provenance={evidence.arkivProvenance}
        scenarioId={scenarioId}
        isSimulated={isSimulated}
      />
    </div>
  );
}
