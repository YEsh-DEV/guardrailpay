import type { HederaPaymentReceipt } from '@quoteseal/shared';

export interface X402PaymentTerms {
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  ensName?: string;
  serviceEndpoint: string;
  referenceId: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface HederaPaymentProofPayload {
  scheme: string;
  network: string;
  transactionId?: string;
  payerAccountId?: string;
  payer?: string;
  payTo: string;
  amount: string;
  asset: string;
  referenceId: string;
  timestamp: number;
  signature?: string;
  publicKey?: string;
  simulated?: boolean;
  x402Version?: string;
}

export interface VerifiedPaymentPayload {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  referenceId: string;
  expiresAt: number;
  payer?: string;
  transactionId?: string;
  x402Version?: string;
}

export interface OnChainTransactionRecord {
  transactionId: string;
  consensusTimestamp: string;
  payerAccountId: string;
  recipientAccountId: string;
  transferredAmount: string;
  memo: string;
  result: string;
}

export type PaymentVerificationResult =
  | { type: 'VERIFIED'; payload: VerifiedPaymentPayload; onChainRecord?: OnChainTransactionRecord }
  | { type: 'INVALID'; reason: string }
  | { type: 'EXPIRED'; reason: string }
  | { type: 'REPLAYED'; reason: string }
  | { type: 'UNSUPPORTED_PROOF'; reason: string }
  | { type: 'VERIFICATION_UNAVAILABLE'; reason: string };

export interface SupportedSchemeConfig {
  scheme: string;
  network: string;
  verifiableWithoutFacilitator: boolean;
  facilitatorRef?: string;
}

export interface FacilitatorConfig {
  url: string;
  apiKey?: string;
  network: string;
}

export interface VerificationConfig {
  network?: string;
  mirrorNodeUrl?: string;
  requireCryptoSignature?: boolean;
  allowSimulatedProofs?: boolean;
  timeoutMs?: number;
  maxProofAgeSec?: number;
  supportedSchemes?: SupportedSchemeConfig[];
  facilitator?: FacilitatorConfig;
}

export interface HederaSignerOptions {
  buyerAccountId?: string;
  buyerPrivateKey?: string;
  network?: 'testnet' | 'mainnet';
  mode?: 'real' | 'simulated';
  facilitatorUrl?: string;
  mirrorNodeUrl?: string;
}

export interface PaymentExecutionResult {
  receipt: HederaPaymentReceipt;
  paymentProof: string;
  payload: HederaPaymentProofPayload;
}
