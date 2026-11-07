export type Verdict = 'PASS' | 'HOLD' | 'BLOCK' | 'UNVERIFIABLE';

export type RotationStatus = 'none' | 'pending' | 'active' | 'revoked';

export interface PaymentRequest {
  origin: string;
  payerWallet?: string;
  payTo: string;
  amount: bigint | string | number;
  asset: string;
  network: string;
  expiresAt?: number; // Unix timestamp in seconds
  referenceId?: string;
  ensName?: string;
}

export type SharedRiskLookup =
  | { kind: 'trusted'; state: { status: 'ALLOW' | 'REVIEW' | 'BLOCK' | 'UNKNOWN'; entityKey: string; owner: string; expiresAt: bigint } }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

export interface SharedRiskReader {
  getTrustedWalletRiskState(input: { walletKey: string; network: string }): Promise<SharedRiskLookup>;
}

export interface MerchantProfile {
  ensName: string;
  serviceEndpoint: string;
  network: string;
  assetId: string;
  activePayTo: string;
  maxAmount: bigint | string | number;
  profileVersion: number;
  rotationStatus: RotationStatus;
  pendingPayTo?: string;
  pendingEffectiveAt?: number; // Unix timestamp in seconds
  expiresAt?: number; // Unix timestamp in seconds (profile TTL)
}

export interface BuyerPolicy {
  trustedMerchants: string[]; // List of trusted ENS names or verified merchant origins
  maxAmount?: bigint | string | number;
  strictTimelockEnforcement?: boolean;
}

export interface EvaluationResult {
  verdict: Verdict;
  reason: string;
  details?: {
    checkedPayTo?: string;
    expectedActivePayTo?: string;
    pendingPayTo?: string;
    effectiveAt?: number;
    currentTime?: number;
  };
}

export interface GuardDependencies {
  resolveProfile: (ensNameOrOrigin: string) => Promise<MerchantProfile | null>;
  policy: BuyerPolicy;
  getNow?: () => number;
  riskReader?: SharedRiskReader;
}
