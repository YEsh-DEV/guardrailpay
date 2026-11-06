export type VerdictStatus = 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';

export interface VerdictRecord {
  id: string;
  timestamp: string;
  agent: string;
  merchant: string;
  payTo: string;
  expectedPayTo: string;
  amount: string;
  asset: string;
  network: string;
  status: VerdictStatus;
  reason: string;
  signerCalled: boolean;
  txHash?: string;
  hashScanUrl?: string;
}

export interface AttackScenario {
  id: string;
  title: string;
  description: string;
  vector: string;
  status: VerdictStatus;
  detectedInMs: number;
}

