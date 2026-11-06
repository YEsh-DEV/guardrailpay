import type { PaymentRequirements } from '@x402/core/types';

/**
 * Status of independent Hedera consensus settlement verification.
 */
export type SettlementStatus =
  | 'SETTLED_VERIFIED'
  | 'SETTLEMENT_FAILED'
  | 'SETTLEMENT_PENDING'
  | 'SETTLEMENT_UNVERIFIED'
  | 'SETTLEMENT_MISMATCH';

/**
 * Normalized evidence captured from independent Hedera Mirror Node query.
 */
export interface VerifiedSettlementEvidence {
  readonly transactionId: string;
  readonly consensusTimestamp: string;
  readonly result: string;
  readonly payer?: string;
  readonly recipient: string;
  readonly amount: string;
  readonly asset: string;
  readonly network: string;
  readonly rawResponse?: unknown;
}

/**
 * Result of independent Hedera consensus settlement verification.
 */
export interface SettlementVerificationResult {
  readonly status: SettlementStatus;
  readonly transactionId: string;
  readonly reason?: string;
  readonly evidence?: VerifiedSettlementEvidence;
}

/**
 * Options provided to the independent settlement verifier.
 */
export interface VerifySettlementOptions {
  /** Transaction ID returned by the facilitator */
  readonly transactionId: string;
  /** Expected buyer / payer account ID */
  readonly expectedPayer?: string;
  /** Expected merchant payout recipient account ID */
  readonly expectedRecipient: string;
  /** Expected payment amount in tinybars (or base token units) */
  readonly expectedAmount: string;
  /** Expected asset ('0.0.0' for HBAR or token entity ID) */
  readonly expectedAsset: string;
  /** Expected CAIP-2 network (e.g. 'hedera:testnet') */
  readonly expectedNetwork: string;
  /** Polling interval in milliseconds if transaction is pending (default: 0 = single shot) */
  readonly pollIntervalMs?: number;
  /** Maximum number of polling attempts (default: 1) */
  readonly maxAttempts?: number;
  /** Optional wall-clock deadline: stop polling when Date.now() >= Date.now()+deadlineMs at call time */
  readonly deadlineMs?: number;
}

/**
 * Interface for independent Hedera consensus settlement verification.
 */
export interface IHederaSettlementVerifier {
  verifySettlement(options: VerifySettlementOptions): Promise<SettlementVerificationResult>;
}

/**
 * Mirror Node REST API raw transfer representation.
 */
export interface MirrorNodeTransfer {
  readonly account: string;
  readonly amount: number | string;
  readonly is_approval?: boolean;
}

/**
 * Mirror Node REST API raw token transfer representation.
 */
export interface MirrorNodeTokenTransfer {
  readonly token_id: string;
  readonly account: string;
  readonly amount: number | string;
  readonly is_approval?: boolean;
}

/**
 * Mirror Node REST API raw transaction representation.
 */
export interface MirrorNodeTransactionRecord {
  readonly transaction_id: string;
  readonly consensus_timestamp: string;
  readonly result: string;
  readonly name?: string;
  readonly node?: string;
  readonly charged_tx_fee?: number | string;
  readonly transfers?: readonly MirrorNodeTransfer[];
  readonly token_transfers?: readonly MirrorNodeTokenTransfer[];
}

/**
 * Mirror Node REST API transaction response schema.
 */
export interface MirrorNodeTransactionsResponse {
  readonly transactions?: readonly MirrorNodeTransactionRecord[];
}

/**
 * Canonical testnet mirror node base URL.
 */
export const HEDERA_TESTNET_MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';

/**
 * Normalizes any valid Hedera transaction ID representation into the canonical
 * Mirror Node REST path format: `<shard>.<realm>.<num>-<seconds>-<nanos>`.
 *
 * Supports input formats:
 * - `0.0.5001@1700000000.000000000`
 * - `0.0.5001-1700000000-000000000`
 * - `0.0.5001@1700000000.123`
 */
export function normalizeMirrorNodeTransactionId(txId: string): string {
  if (!txId || typeof txId !== 'string') {
    throw new Error('Transaction ID must be a non-empty string');
  }

  const trimmed = txId.trim();
  // Match: entity (0.0.x), separator (@ or -), seconds (\d+), separator (. or -), nanos (\d+)
  const match = trimmed.match(/^(\d+\.\d+\.\d+)[@-](\d+)[.-](\d+)$/);
  if (!match) {
    throw new Error(`Invalid Hedera transaction ID format: '${txId}'`);
  }

  const [, entity, seconds, nanos] = match;
  // Pad nanos to 9 digits if needed
  const paddedNanos = nanos.padEnd(9, '0').slice(0, 9);
  return `${entity}-${seconds}-${paddedNanos}`;
}

/**
 * Verifies a single MirrorNodeTransactionRecord against the approved payment requirements.
 */
export function verifyTransactionRecordAgainstRequirements(
  record: MirrorNodeTransactionRecord,
  options: VerifySettlementOptions
): SettlementVerificationResult {
  const txId = record.transaction_id || options.transactionId;

  // 1. Transaction status check
  if (!record.result) {
    return {
      status: 'SETTLEMENT_PENDING',
      transactionId: txId,
      reason: 'Transaction is pending consensus or missing result status'
    };
  }

  if (record.result !== 'SUCCESS') {
    return {
      status: 'SETTLEMENT_FAILED',
      transactionId: txId,
      reason: `Transaction on-chain result is '${record.result}' (expected SUCCESS)`
    };
  }

  // 2. Validate expected network
  const network = options.expectedNetwork.toLowerCase();
  if (network !== 'hedera:testnet' && network !== 'testnet' && network !== 'hedera:mainnet' && network !== 'mainnet') {
    return {
      status: 'SETTLEMENT_MISMATCH',
      transactionId: txId,
      reason: `Unsupported network '${options.expectedNetwork}'`
    };
  }

  // 3. Amount & Transfer verification
  let expectedAmountBigInt: bigint;
  try {
    expectedAmountBigInt = BigInt(options.expectedAmount);
    if (expectedAmountBigInt <= 0n) {
      return {
        status: 'SETTLEMENT_MISMATCH',
        transactionId: txId,
        reason: `Expected amount must be positive, got '${options.expectedAmount}'`
      };
    }
  } catch {
    return {
      status: 'SETTLEMENT_MISMATCH',
      transactionId: txId,
      reason: `Invalid non-integer expected amount: '${options.expectedAmount}'`
    };
  }

  // Case A: Native HBAR (asset === '0.0.0')
  if (options.expectedAsset === '0.0.0') {
    const transfers = record.transfers;
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return {
        status: 'SETTLEMENT_MISMATCH',
        transactionId: txId,
        reason: 'Transaction contains no HBAR transfer entries'
      };
    }

    // Recipient check: must have a positive transfer equal to expectedAmount
    const recipientTransfer = transfers.find((t) => t.account === options.expectedRecipient);
    if (!recipientTransfer) {
      return {
        status: 'SETTLEMENT_MISMATCH',
        transactionId: txId,
        reason: `Recipient account '${options.expectedRecipient}' was not credited in HBAR transfers`
      };
    }

    const recipientAmount = BigInt(recipientTransfer.amount);
    if (recipientAmount !== expectedAmountBigInt) {
      return {
        status: 'SETTLEMENT_MISMATCH',
        transactionId: txId,
        reason: `Transfer amount mismatch: expected ${expectedAmountBigInt.toString()} tinybars, recipient received ${recipientAmount.toString()} tinybars`
      };
    }

    // Optional payer check
    let verifiedPayer: string | undefined;
    if (options.expectedPayer) {
      const payerTransfer = transfers.find((t) => t.account === options.expectedPayer);
      if (payerTransfer && BigInt(payerTransfer.amount) < 0n) {
        verifiedPayer = options.expectedPayer;
      }
    }

    return {
      status: 'SETTLED_VERIFIED',
      transactionId: txId,
      evidence: {
        transactionId: txId,
        consensusTimestamp: record.consensus_timestamp,
        result: record.result,
        payer: verifiedPayer ?? options.expectedPayer,
        recipient: options.expectedRecipient,
        amount: options.expectedAmount,
        asset: options.expectedAsset,
        network: options.expectedNetwork,
        rawResponse: record
      }
    };
  }

  // Case B: Hedera Token Service (HTS) Token
  const tokenTransfers = record.token_transfers;
  if (!Array.isArray(tokenTransfers) || tokenTransfers.length === 0) {
    return {
      status: 'SETTLEMENT_MISMATCH',
      transactionId: txId,
      reason: `Transaction contains no token transfers for token '${options.expectedAsset}'`
    };
  }

  const recipientTokenTransfer = tokenTransfers.find(
    (t) => t.token_id === options.expectedAsset && t.account === options.expectedRecipient
  );

  if (!recipientTokenTransfer) {
    return {
      status: 'SETTLEMENT_MISMATCH',
      transactionId: txId,
      reason: `Recipient '${options.expectedRecipient}' was not credited for token '${options.expectedAsset}'`
    };
  }

  const tokenAmount = BigInt(recipientTokenTransfer.amount);
  if (tokenAmount !== expectedAmountBigInt) {
    return {
      status: 'SETTLEMENT_MISMATCH',
      transactionId: txId,
      reason: `Token transfer amount mismatch: expected ${expectedAmountBigInt.toString()}, recipient received ${tokenAmount.toString()}`
    };
  }

  let verifiedPayer: string | undefined;
  if (options.expectedPayer) {
    const payerTransfer = tokenTransfers.find(
      (t) => t.token_id === options.expectedAsset && t.account === options.expectedPayer
    );
    if (payerTransfer && BigInt(payerTransfer.amount) < 0n) {
      verifiedPayer = options.expectedPayer;
    }
  }

  return {
    status: 'SETTLED_VERIFIED',
    transactionId: txId,
    evidence: {
      transactionId: txId,
      consensusTimestamp: record.consensus_timestamp,
      result: record.result,
      payer: verifiedPayer ?? options.expectedPayer,
      recipient: options.expectedRecipient,
      amount: options.expectedAmount,
      asset: options.expectedAsset,
      network: options.expectedNetwork,
      rawResponse: record
    }
  };
}

/**
 * Independent Hedera Testnet Mirror Node Verifier.
 * Queries the Hedera Mirror Node REST API to verify that a facilitator-claimed
 * transaction actually reached consensus with SUCCESS and the exact expected payout.
 */
export class HederaMirrorNodeVerifier implements IHederaSettlementVerifier {
  constructor(
    private readonly mirrorNodeBaseUrl: string = HEDERA_TESTNET_MIRROR_NODE_URL,
    private readonly customFetch: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {}

  async verifySettlement(
    options: VerifySettlementOptions
  ): Promise<SettlementVerificationResult> {
    let normalizedId: string;
    try {
      normalizedId = normalizeMirrorNodeTransactionId(options.transactionId);
    } catch (err: unknown) {
      return {
        status: 'SETTLEMENT_FAILED',
        transactionId: options.transactionId,
        reason: `Invalid transaction ID syntax: ${err instanceof Error ? err.message : String(err)}`
      };
    }

    const queryUrl = new URL(`/api/v1/transactions/${encodeURIComponent(normalizedId)}`, this.mirrorNodeBaseUrl).href;
    const maxAttempts = options.maxAttempts ?? (options.deadlineMs !== undefined ? Infinity : 1);
    const pollInterval = options.pollIntervalMs ?? 0;
    const deadline = options.deadlineMs !== undefined ? Date.now() + options.deadlineMs : undefined;
    let deadlineExceeded = false;

    let lastResult: SettlementVerificationResult = {
      status: 'SETTLEMENT_PENDING',
      transactionId: options.transactionId,
      reason: 'Transaction verification not yet executed'
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (deadline !== undefined && Date.now() >= deadline) {
        deadlineExceeded = true;
        break;
      }

      if (attempt > 0 && pollInterval > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      if (deadline !== undefined && Date.now() >= deadline) {
        deadlineExceeded = true;
        break;
      }

      let response: Response;
      try {
        response = await this.customFetch(queryUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (err: unknown) {
        lastResult = {
          status: 'SETTLEMENT_UNVERIFIED',
          transactionId: options.transactionId,
          reason: `Mirror Node network request failed: ${err instanceof Error ? err.message : String(err)}`
        };
        continue;
      }

      // If 404: transaction has not been ingested or does not exist
      if (response.status === 404) {
        lastResult = {
          status: 'SETTLEMENT_PENDING',
          transactionId: options.transactionId,
          reason: `Transaction not found on Mirror Node (status 404): '${normalizedId}'`
        };
        continue;
      }

      // If server error or unexpected HTTP status
      if (!response.ok) {
        lastResult = {
          status: 'SETTLEMENT_UNVERIFIED',
          transactionId: options.transactionId,
          reason: `Mirror Node returned HTTP ${response.status} (${response.statusText})`
        };
        continue;
      }

      // Parse JSON
      let data: MirrorNodeTransactionsResponse;
      try {
        data = (await response.json()) as MirrorNodeTransactionsResponse;
      } catch {
        lastResult = {
          status: 'SETTLEMENT_UNVERIFIED',
          transactionId: options.transactionId,
          reason: 'Failed to parse Mirror Node response as JSON'
        };
        continue;
      }

      if (!data || !Array.isArray(data.transactions) || data.transactions.length === 0) {
        lastResult = {
          status: 'SETTLEMENT_PENDING',
          transactionId: options.transactionId,
          reason: 'Mirror Node returned empty transactions list'
        };
        continue;
      }

      // Evaluate records. If any transaction matches all requirements and succeeds, accept it.
      let latestFailedOrMismatch: SettlementVerificationResult | undefined;
      for (const record of data.transactions) {
        const result = verifyTransactionRecordAgainstRequirements(record, options);
        if (result.status === 'SETTLED_VERIFIED') {
          return result;
        }
        latestFailedOrMismatch = result;
      }

      lastResult = latestFailedOrMismatch ?? {
        status: 'SETTLEMENT_MISMATCH',
        transactionId: options.transactionId,
        reason: 'None of the returned transaction records matched requirements'
      };

      // If result is a definite failure or mismatch, do not keep polling
      if (lastResult.status === 'SETTLEMENT_FAILED' || lastResult.status === 'SETTLEMENT_MISMATCH') {
        return lastResult;
      }
    }

    // If deadline was exceeded, or if still pending after multiple attempts / deadline window, return unverified outcome
    if (deadlineExceeded || (lastResult.status === 'SETTLEMENT_PENDING' && (maxAttempts > 1 || options.deadlineMs !== undefined))) {
      return {
        status: 'SETTLEMENT_UNVERIFIED',
        transactionId: options.transactionId,
        reason: deadlineExceeded
          ? 'Verification deadline exceeded'
          : `Verification deadline exceeded after ${maxAttempts} attempts`
      };
    }
    return lastResult;
  }
}
