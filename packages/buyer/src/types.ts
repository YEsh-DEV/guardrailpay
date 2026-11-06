import type { PaymentRequired, PaymentRequirements, PaymentPayload, SettleResponse, VerifyResponse } from '@x402/core/types';
import type { ClientHederaSigner } from '@x402/hedera';
import type { TrustSnapshot } from '@quoteseal/guard';
import type {
  SettlementStatus,
  SettlementVerificationResult,
  VerifiedSettlementEvidence,
  IHederaSettlementVerifier
} from './verifier.js';

export type {
  SettlementStatus,
  SettlementVerificationResult,
  VerifiedSettlementEvidence,
  IHederaSettlementVerifier
};

/**
 * Execution mode:
 * - 'local': Local testing and simulated settlement demo.
 * - 'live': Live Hedera Testnet execution requiring independent Mirror Node verification.
 */
export type OrchestrationMode = 'local' | 'live';

/**
 * Immutable summary presented to the buyer for explicit confirmation.
 * Contains the exact merchant identity, destination payout, amount, and asset.
 */
export interface BuyerConfirmationRequest {
  readonly resourceUrl: string;
  readonly merchantOrigin: string;
  readonly merchantEns?: string;
  readonly payTo: string;
  readonly amount: string;
  readonly asset: string;
  readonly network: string;
  readonly maxTimeoutSeconds: number;
  readonly rawRequirement: PaymentRequirements;
}

/**
 * Confirmation callback requiring explicit buyer consent.
 * Must return strict boolean `true` to approve payment.
 */
export type BuyerConfirmCallback = (
  summary: BuyerConfirmationRequest
) => Promise<boolean> | boolean;

/**
 * Interface for communicating with the verified x402 facilitator.
 */
export interface IFacilitatorClient {
  /** Indicates whether this client is an in-memory mock or live HTTP transport */
  readonly isMock?: boolean;

  /**
   * Settle a payment payload with the facilitator on-chain.
   */
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;

  /**
   * Optional pre-settlement verification with the facilitator.
   */
  verify?(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  /**
   * Optional health/capability check for live facilitator.
   */
  checkHealth?(): Promise<{ healthy: boolean; details?: unknown }>;

  /**
   * Optional supported capabilities probe.
   */
  checkCapabilities?(
    network?: string,
    scheme?: string
  ): Promise<{ supported: boolean; details?: unknown }>;
}

/**
 * Input configuration for buyer payment orchestration.
 */
export interface PaymentOrchestrationOptions {
  /** The protected resource URL requested by the buyer */
  resourceUrl: string;

  /** Execution mode: 'local' (default) or 'live' */
  mode?: OrchestrationMode;

  /** Controlled Hedera client signer (held in trusted boundary, never exposed) */
  signer: ClientHederaSigner;

  /** Synchronous read of current trusted ENS profile and trust anchors */
  readTrust: () => TrustSnapshot;

  /** Explicit buyer confirmation callback */
  confirm: BuyerConfirmCallback;

  /** Verified x402 facilitator client */
  facilitator: IFacilitatorClient;

  /** Optional independent Hedera Mirror Node settlement verifier */
  verifier?: IHederaSettlementVerifier;

  /** Whether to strictly enforce independent on-chain settlement verification (always true in live mode) */
  requireSettlementVerification?: boolean;

  /** Custom Hedera Mirror Node base URL (defaults to Hedera Testnet) */
  mirrorNodeUrl?: string;

  /** Optional custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof fetch;

  /** Optional local time source in milliseconds (defaults to Date.now) */
  now?: () => number;

  /** Optional HTTP request options for the resource call */
  requestInit?: RequestInit;
}

/**
 * Final result of the buyer payment orchestration.
 */
export interface PaymentOrchestrationResult<T = unknown> {
  success: boolean;
  statusCode: number;
  mode: OrchestrationMode;
  data: T;
  headers: Record<string, string>;
  settlement?: {
    transactionId: string;
    payer?: string;
    network: string;
    simulated?: boolean;
  };
  verification?: SettlementVerificationResult;
  payment?: {
    merchantPayTo: string;
    amount: string;
    asset: string;
    network: string;
  };
}

// =============================================================================
// DOMAIN ERROR HIERARCHY
// =============================================================================

export class QuoteSealBuyerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteSealBuyerError';
  }
}

export class PaymentRequiredParseError extends QuoteSealBuyerError {
  constructor(message: string = 'Failed to parse x402 payment requirements from 402 response') {
    super(message);
    this.name = 'PaymentRequiredParseError';
  }
}

export class UnsupportedRequirementError extends QuoteSealBuyerError {
  constructor(message: string = 'No supported payment requirement found in 402 challenge') {
    super(message);
    this.name = 'UnsupportedRequirementError';
  }
}

export class QuoteSealSecurityRejectionError extends QuoteSealBuyerError {
  readonly verdict: string;
  constructor(verdict: string, message: string = `Payment rejected by QuoteSeal guard (${verdict})`) {
    super(message);
    this.name = 'QuoteSealSecurityRejectionError';
    this.verdict = verdict;
  }
}

export class BuyerConfirmationRequiredError extends QuoteSealBuyerError {
  constructor(message: string = 'Payment aborted: explicit buyer confirmation was not granted') {
    super(message);
    this.name = 'BuyerConfirmationRequiredError';
  }
}

export class FacilitatorSettlementError extends QuoteSealBuyerError {
  readonly errorReason?: string;
  constructor(message: string, errorReason?: string) {
    super(message);
    this.name = 'FacilitatorSettlementError';
    this.errorReason = errorReason;
  }
}

export class InvalidSettlementEvidenceError extends QuoteSealBuyerError {
  constructor(message: string = 'Facilitator response lacks verifiable Hedera transaction evidence') {
    super(message);
    this.name = 'InvalidSettlementEvidenceError';
  }
}

export class SettlementVerificationError extends QuoteSealBuyerError {
  readonly status: SettlementStatus;
  readonly evidence?: VerifiedSettlementEvidence;
  constructor(status: SettlementStatus, message: string, evidence?: VerifiedSettlementEvidence) {
    super(message);
    this.name = 'SettlementVerificationError';
    this.status = status;
    this.evidence = evidence;
  }
}

export class ResourceAccessError extends QuoteSealBuyerError {
  readonly statusCode: number;
  constructor(statusCode: number, message: string = `Merchant rejected payment proof with HTTP ${statusCode}`) {
    super(message);
    this.name = 'ResourceAccessError';
    this.statusCode = statusCode;
  }
}
