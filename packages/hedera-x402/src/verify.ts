/**
 * Payment proof verification module for Hedera HTTP 402 payments.
 *
 * Implements independent, server-side cryptographic and on-chain verification
 * for payments on Hedera Testnet.
 *
 * Protocol note:
 * This implementation provides a secure custom Hedera testnet payment verification
 * flow with on-chain Consensus/Mirror Node settlement and cryptographic payer intent
 * binding. It is documented explicitly as a custom HTTP 402 protocol, not official
 * x402 V2 compliance (since no official x402 facilitator currently exists for Hedera).
 */

import { PublicKey } from '@hashgraph/sdk';
import type {
  HederaPaymentProofPayload,
  OnChainTransactionRecord,
  PaymentVerificationResult,
  VerificationConfig,
  VerifiedPaymentPayload,
  X402PaymentTerms,
} from './types.js';
import type { ReplayProtection } from './replay.js';
import { reconcileHederaTransaction } from './reconcile.js';

export type {
  PaymentVerificationResult,
  VerifiedPaymentPayload,
  VerificationConfig,
  OnChainTransactionRecord,
};

export interface VerifyPaymentOptions {
  fetchFn?: typeof fetch;
  skipOnChainCheck?: boolean; // For isolated unit tests with mock payloads
}

/**
 * Normalizes Hedera network identifiers to standard format (e.g. 'hedera:testnet').
 */
function normalizeNetwork(network: string): string {
  const lower = network.trim().toLowerCase();
  if (lower === 'testnet' || lower === 'hedera:testnet' || lower === 'hedera-testnet') {
    return 'hedera:testnet';
  }
  if (lower === 'mainnet' || lower === 'hedera:mainnet' || lower === 'hedera-mainnet') {
    return 'hedera:mainnet';
  }
  return lower;
}

/**
 * Independently verifies a payment proof against a merchant challenge,
 * cryptographic signatures, on-chain mirror node records, and persistent replay protection.
 */
export async function verifyPaymentProof(
  proofBase64: string,
  challenge: X402PaymentTerms,
  config: VerificationConfig,
  replay?: ReplayProtection,
  options: VerifyPaymentOptions = {}
): Promise<PaymentVerificationResult> {
  // 1. Basic configuration validation
  if (!config) {
    return {
      type: 'VERIFICATION_UNAVAILABLE',
      reason: 'Verification configuration is missing',
    };
  }

  // 2. Decode and parse payment proof base64
  if (!proofBase64 || typeof proofBase64 !== 'string' || proofBase64.trim() === '') {
    return { type: 'INVALID', reason: 'Missing or empty payment proof' };
  }

  let proof: HederaPaymentProofPayload;
  try {
    const raw = Buffer.from(proofBase64, 'base64').toString('utf8');
    proof = JSON.parse(raw);
  } catch {
    return { type: 'INVALID', reason: 'Payment proof is not valid base64 JSON' };
  }

  if (!proof.scheme || !proof.network) {
    return { type: 'INVALID', reason: 'Payment proof missing scheme or network' };
  }

  // 3. Supported scheme checks if config.supportedSchemes is configured
  if (config.supportedSchemes && config.supportedSchemes.length > 0) {
    const schemeConfigByName = config.supportedSchemes.find((s) => s.scheme === proof.scheme);
    const schemeConfig = config.supportedSchemes.find(
      (s) => s.scheme === proof.scheme && normalizeNetwork(s.network) === normalizeNetwork(proof.network)
    );

    if (!schemeConfig) {
      if (schemeConfigByName) {
        return {
          type: 'INVALID',
          reason: `Unsupported network ${proof.network} for scheme ${proof.scheme}; expected ${schemeConfigByName.network}`,
        };
      }
      return {
        type: 'UNSUPPORTED_PROOF',
        reason: `Unsupported payment scheme/network: ${proof.scheme}/${proof.network}`,
      };
    }

    if (!schemeConfig.verifiableWithoutFacilitator && !config.facilitator) {
      return {
        type: 'UNSUPPORTED_PROOF',
        reason: `Payment scheme ${proof.scheme}/${proof.network} is not cryptographically verifiable without a facilitator`,
      };
    }
  }

  // 4. Verify network match
  const proofNet = normalizeNetwork(proof.network);
  const challengeNet = normalizeNetwork(challenge.network);
  if (proofNet !== challengeNet) {
    return {
      type: 'INVALID',
      reason: `Network mismatch: proof network=${proof.network} challenge network=${challenge.network}`,
    };
  }

  // 5. Verify asset match
  const proofAsset = proof.asset?.toUpperCase();
  const challengeAsset = challenge.asset?.toUpperCase();
  if (proofAsset !== challengeAsset) {
    return {
      type: 'INVALID',
      reason: `Asset mismatch: proof asset=${proof.asset} challenge asset=${challenge.asset}`,
    };
  }

  // 6. Verify recipient match
  if (proof.payTo !== challenge.payTo) {
    return {
      type: 'INVALID',
      reason: `Recipient mismatch: proof payTo=${proof.payTo} challenge payTo=${challenge.payTo}`,
    };
  }

  // 7. Verify amount match (tinybar numeric comparison)
  try {
    const proofAmt = BigInt(proof.amount);
    const challengeAmt = BigInt(challenge.amount);
    if (proofAmt < challengeAmt) {
      return {
        type: 'INVALID',
        reason: `Amount mismatch: proof amount=${proof.amount} challenge amount=${challenge.amount}`,
      };
    }
  } catch {
    return { type: 'INVALID', reason: `Invalid amount format in proof: ${proof.amount}` };
  }

  // 8. Verify challenge expiration & timestamp
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (challenge.expiresAt && nowSeconds > challenge.expiresAt) {
    return {
      type: 'EXPIRED',
      reason: `Payment proof is expired: challenge expired at ${challenge.expiresAt}, current time ${nowSeconds}`,
    };
  }

  if (proof.timestamp) {
    const proofTimeSec =
      proof.timestamp > 10_000_000_000 ? Math.floor(proof.timestamp / 1000) : proof.timestamp;
    if (challenge.expiresAt && proofTimeSec > challenge.expiresAt) {
      return {
        type: 'EXPIRED',
        reason: 'Payment proof is expired: created after challenge expiry',
      };
    }
    const maxAge = config.maxProofAgeSec ?? 300;
    if (nowSeconds - proofTimeSec > maxAge) {
      return {
        type: 'EXPIRED',
        reason: `Payment proof is expired: timestamp is older than ${maxAge} seconds`,
      };
    }
  }

  // 9. Challenge binding check (referenceId)
  if (proof.referenceId && challenge.referenceId && proof.referenceId !== challenge.referenceId) {
    return {
      type: 'INVALID',
      reason: `Challenge binding mismatch: proof referenceId=${proof.referenceId} challenge referenceId=${challenge.referenceId}`,
    };
  }

  // 10. Check if simulated proof is offered
  if (proof.simulated) {
    if (!config.allowSimulatedProofs) {
      return {
        type: 'UNSUPPORTED_PROOF',
        reason: 'Simulated payment proofs are rejected by this merchant',
      };
    }
  }

  // 11. Cryptographic payer signature verification (if signed intent is attached)
  if (proof.signature && proof.publicKey) {
    try {
      const authPayloadToVerify = {
        scheme: proof.scheme,
        network: proof.network,
        transactionId: proof.transactionId,
        payerAccountId: proof.payerAccountId,
        payTo: proof.payTo,
        amount: proof.amount,
        asset: proof.asset,
        referenceId: proof.referenceId,
        timestamp: proof.timestamp,
      };

      const payloadBytes = Buffer.from(JSON.stringify(authPayloadToVerify));
      const sigBytes = Buffer.from(proof.signature, 'hex');
      const publicKey = PublicKey.fromString(proof.publicKey);

      const isValidSignature = publicKey.verify(payloadBytes, sigBytes);
      if (!isValidSignature) {
        return {
          type: 'INVALID',
          reason: 'Cryptographic signature verification failed: invalid payer signature',
        };
      }
    } catch (sigErr: any) {
      return {
        type: 'INVALID',
        reason: `Cryptographic signature verification error: ${sigErr.message}`,
      };
    }
  }

  // 12. On-Chain Hedera Mirror Node Settlement Verification
  let onChainRecord: OnChainTransactionRecord | undefined;

  if (!options.skipOnChainCheck && !proof.simulated && proof.transactionId) {
    const reconcile = await reconcileHederaTransaction(proof.transactionId, {
      mirrorNodeUrl: config.mirrorNodeUrl,
      timeoutMs: config.timeoutMs,
      fetchFn: options.fetchFn,
    });

    if (reconcile.status === 'PENDING') {
      return {
        type: 'VERIFICATION_UNAVAILABLE',
        reason: `Hedera transaction ${proof.transactionId} is pending consensus confirmation`,
      };
    }

    if (reconcile.status === 'UNCERTAIN') {
      return {
        type: 'VERIFICATION_UNAVAILABLE',
        reason: `Hedera Mirror Node unavailable: ${reconcile.reason}`,
      };
    }

    if (reconcile.status === 'FAILED') {
      return {
        type: 'INVALID',
        reason: `Hedera transaction failed on-chain with status ${reconcile.result}`,
      };
    }

    if (reconcile.status === 'CONFIRMED') {
      // Verify recipient credit in on-chain transfers
      const transfers = reconcile.transfers ?? [];
      const recipientTransfer = transfers.find((t) => t.account === challenge.payTo);

      if (!recipientTransfer) {
        return {
          type: 'INVALID',
          reason: `On-chain transaction did not credit merchant account ${challenge.payTo}`,
        };
      }

      if (BigInt(recipientTransfer.amount) < BigInt(challenge.amount)) {
        return {
          type: 'INVALID',
          reason: `On-chain transfer credited ${recipientTransfer.amount} tinybars, less than required ${challenge.amount}`,
        };
      }

      // Verify payer debit if payer is specified
      const payerId = proof.payerAccountId || proof.payer;
      if (payerId) {
        const payerTransfer = transfers.find((t) => t.account === payerId && t.amount < 0);
        if (!payerTransfer) {
          return {
            type: 'INVALID',
            reason: `On-chain transaction did not debit payer account ${payerId}`,
          };
        }
      }

      // Verify on-chain memo binding if referenceId is required
      if (challenge.referenceId && reconcile.memo) {
        const expectedMemo = `qs:${challenge.referenceId}`;
        if (reconcile.memo !== expectedMemo && reconcile.memo !== challenge.referenceId) {
          return {
            type: 'INVALID',
            reason: `On-chain memo '${reconcile.memo}' does not match expected challenge binding '${expectedMemo}'`,
          };
        }
      }

      onChainRecord = {
        transactionId: proof.transactionId,
        consensusTimestamp: reconcile.consensusTimestamp ?? '',
        payerAccountId: proof.payerAccountId || proof.payer || '',
        recipientAccountId: challenge.payTo,
        transferredAmount: String(recipientTransfer.amount),
        memo: reconcile.memo ?? '',
        result: reconcile.result ?? 'SUCCESS',
      };
    }
  }

  // 13. Persistent Replay & Concurrency-Safe Idempotency Check
  if (replay) {
    const txIdForReplay = proof.transactionId || `ref_${proof.referenceId}_${proof.timestamp}`;

    if (replay.consumePayment) {
      const consumeResult = await replay.consumePayment({
        referenceId: challenge.referenceId,
        transactionId: txIdForReplay,
        payerAccountId: proof.payerAccountId || proof.payer,
        payTo: challenge.payTo,
        amount: challenge.amount,
      });

      if (consumeResult.status === 'REPLAYED' || consumeResult.status === 'ALREADY_SETTLED') {
        return {
          type: 'REPLAYED',
          reason:
            consumeResult.status === 'REPLAYED'
              ? consumeResult.reason
              : 'Payment proof has already been verified',
        };
      }
    } else {
      const isDuplicate = await replay.checkAndMark(txIdForReplay);
      if (isDuplicate) {
        return {
          type: 'REPLAYED',
          reason: 'Payment proof has already been verified',
        };
      }
    }
  }

  // 14. All checks successfully passed
  const verifiedPayload: VerifiedPaymentPayload = {
    scheme: proof.scheme,
    network: challenge.network,
    asset: challenge.asset,
    payTo: challenge.payTo,
    amount: challenge.amount,
    referenceId: challenge.referenceId,
    expiresAt: challenge.expiresAt,
    payer: proof.payerAccountId || proof.payer,
    transactionId: proof.transactionId,
    x402Version: proof.x402Version || 'custom-hedera-v1',
  };

  return {
    type: 'VERIFIED',
    payload: verifiedPayload,
    onChainRecord,
  };
}
