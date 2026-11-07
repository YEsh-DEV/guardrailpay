'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Layers,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { ArkivProvenance } from '../../lib/demo-types';
import { TRUSTED_ARKIV_REPORTER, RABDI_CHAIN_ID } from '../../lib/demo-api-client';

interface ArkivThreatProvenancePanelProps {
  provenance?: ArkivProvenance;
  scenarioId?: string;
  isSimulated?: boolean;
}

export default function ArkivThreatProvenancePanel({
  provenance,
  scenarioId,
  isSimulated = false,
}: ArkivThreatProvenancePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isCrossMerchant = scenarioId === 'CROSS_MERCHANT_BLOCK';
  const isSuspicious = scenarioId === 'SUSPICIOUS_PAYMENT';
  const isLiveRecord = Boolean(provenance?.isLive) && !isSimulated;

  const riskStateKey =
    provenance?.walletRiskStateEntityKey ||
    (isCrossMerchant ? '0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f' : undefined);

  const signalKey =
    provenance?.riskSignalEntityKey ||
    (isSuspicious ? '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' : undefined);

  return (
    <div className="p-6 rounded-3xl bg-[#0F0F0F] border border-[#262626] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DD60F7]/15 border border-[#DD60F7]/30 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-[#DD60F7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-mono">Arkiv Rabdi Threat Intelligence</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isLiveRecord
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isLiveRecord ? '● Live Rabdi Record' : '▲ Simulated Fixture'}
              </span>
            </div>
            <p className="text-xs text-[#888888] mt-0.5">
              Decentralized, immutable threat registry anchoring cross-merchant risk states.
            </p>
          </div>
        </div>

        <Link
          href="/arkiv"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#DD60F7]/40 bg-[#DD60F7]/10 hover:bg-[#DD60F7]/20 text-xs font-mono text-[#DD60F7] hover:text-white transition-all shadow-[0_0_12px_rgba(221,96,247,0.2)] shrink-0 self-start sm:self-auto"
        >
          <span>Open Full Arkiv Monitor</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Network Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-[#080808] border border-[#1A1A1A]">
          <span className="text-[#666666] block text-[10px] uppercase">Network</span>
          <span className="text-white font-bold">Arkiv Rabdi Testnet</span>
        </div>
        <div className="p-3 rounded-xl bg-[#080808] border border-[#1A1A1A]">
          <span className="text-[#666666] block text-[10px] uppercase">Chain ID / Gas</span>
          <span className="text-white font-bold">{RABDI_CHAIN_ID} (tGLM)</span>
        </div>
        <div className="p-3 rounded-xl bg-[#080808] border border-[#1A1A1A]">
          <span className="text-[#666666] block text-[10px] uppercase">Risk Verdict</span>
          <span
            className={`font-bold ${
              provenance?.riskVerdict === 'BLOCK' || isCrossMerchant || isSuspicious
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}
          >
            {provenance?.riskVerdict || (isCrossMerchant || isSuspicious ? 'BLOCK' : 'ALLOW')}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-[#080808] border border-[#1A1A1A]">
          <span className="text-[#666666] block text-[10px] uppercase">Expires At Block</span>
          <span className="text-[#DD60F7] font-bold">#{provenance?.expiresAtBlock || '354378'}</span>
        </div>
      </div>

      {/* Authoritative Reporter */}
      <div className="p-4 rounded-2xl bg-[#080808] border border-[#1E1E1E] space-y-1.5">
        <span className="text-[10px] font-mono uppercase text-[#777777]">Authoritative Trusted Reporter</span>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-white break-all">
            {provenance?.trustedOwner || TRUSTED_ARKIV_REPORTER}
          </span>
          <button
            onClick={() => copyToClipboard(provenance?.trustedOwner || TRUSTED_ARKIV_REPORTER, 'reporter')}
            className="text-[#666666] hover:text-white shrink-0"
            title="Copy address"
          >
            {copiedKey === 'reporter' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[11px] text-[#666666]">
          Filter Guarantee: Only entities authored by this verified reporter address are accepted by PayeeGuard.
        </p>
      </div>

      {/* Entity Keys */}
      <div className="space-y-2.5">
        {riskStateKey && (
          <div className="p-3.5 rounded-xl bg-[#080808] border border-[#1E1E1E] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#DD60F7]">
                WalletRiskState Entity Key
              </span>
              <a
                href={`https://explorer.rabdi.arkiv.network/entity/${riskStateKey}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#DD60F7] hover:underline"
              >
                Rabdi Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#CCCCCC] truncate max-w-lg">{riskStateKey}</span>
              <button
                onClick={() => copyToClipboard(riskStateKey, 'state-key')}
                className="text-[#666666] hover:text-white shrink-0"
              >
                {copiedKey === 'state-key' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {signalKey && (
          <div className="p-3.5 rounded-xl bg-[#080808] border border-[#1E1E1E] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#DD60F7]">
                RiskSignal Entity Key (Publication)
              </span>
              <a
                href={`https://explorer.rabdi.arkiv.network/entity/${signalKey}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#DD60F7] hover:underline"
              >
                Rabdi Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#CCCCCC] truncate max-w-lg">{signalKey}</span>
              <button
                onClick={() => copyToClipboard(signalKey, 'signal-key')}
                className="text-[#666666] hover:text-white shrink-0"
              >
                {copiedKey === 'signal-key' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Provenance Storyline Callout */}
      <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#999999] leading-relaxed">
        <strong className="text-white block font-mono mb-1">PROVENANCE & FLOW:</strong>
        {provenance?.provenanceDescription ||
          (isCrossMerchant
            ? 'Merchant B received payment request from 0.0.90001, queried Arkiv Rabdi, discovered Merchant A\'s verified BLOCK verdict, and vetoed payment before rawSigner was invoked.'
            : isSuspicious
            ? 'Merchant A detected tampered recipient, blocked the transaction, and published a synthetic threat indicator to Arkiv Rabdi to protect other merchants across the network.'
            : 'Standard autonomous payment: Payee queried on Arkiv Rabdi, verified clean (verdict ALLOW).')}
      </div>
    </div>
  );
}
