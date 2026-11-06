import {
  createPaymentAttempt,
  copyData,
  freezeData,
  evaluate,
  type BoundaryInput
} from '@quoteseal/guard';
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
  encodePaymentResponseHeader
} from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import type {
  PaymentOrchestrationOptions,
  PaymentOrchestrationResult,
  BuyerConfirmationRequest,
  OrchestrationMode,
  SettlementVerificationResult
} from './types.js';
import {
  PaymentRequiredParseError,
  UnsupportedRequirementError,
  QuoteSealSecurityRejectionError,
  BuyerConfirmationRequiredError,
  FacilitatorSettlementError,
  SettlementVerificationError,
  ResourceAccessError
} from './types.js';
import { assertValidSettlementResponse } from './facilitator.js';
import {
  HederaMirrorNodeVerifier,
  HEDERA_TESTNET_MIRROR_NODE_URL
} from './verifier.js';

/**
 * Parses a 402 HTTP response into a canonical PaymentRequired challenge.
 * Checks both PAYMENT-REQUIRED headers and JSON body.
 */
async function parsePaymentRequiredResponse(response: Response): Promise<PaymentRequired> {
  const header =
    response.headers.get('PAYMENT-REQUIRED') ||
    response.headers.get('payment-required') ||
    response.headers.get('X-PAYMENT-REQUIRED') ||
    response.headers.get('x-payment-required');

  if (header) {
    try {
      const decoded = decodePaymentRequiredHeader(header) as PaymentRequired;
      if (decoded && decoded.x402Version === 2 && Array.isArray(decoded.accepts)) {
        return decoded;
      }
    } catch {
      // Fallback to body parsing if header decoding fails
    }
  }

  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch {
    throw new PaymentRequiredParseError('Failed to read 402 response body');
  }

  if (bodyText) {
    try {
      const json = JSON.parse(bodyText);
      if (json && json.x402Version === 2 && Array.isArray(json.accepts) && json.accepts.length > 0) {
        return json as PaymentRequired;
      }
    } catch {
      // JSON parse failed
    }
  }

  throw new PaymentRequiredParseError('Failed to parse valid x402 v2 payment requirements from 402 response');
}

/**
 * Parses response body text into JSON if possible, otherwise returns raw text.
 */
async function parseResponseBody<T = unknown>(response: Response): Promise<T> {
  const text = await response.text().catch(() => '');
  if (!text) return '' as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Minimal buyer-side x402 payment orchestrator.
 * Connects the 402 challenge flow, QuoteSeal guard evaluation, explicit buyer confirmation,
 * one-shot signer boundary, facilitator settlement, and payment proof delivery.
 */
export class BuyerPaymentOrchestrator {
  /**
   * Executes the complete 15-step buyer payment flow.
   */
  async execute<T = unknown>(
    options: PaymentOrchestrationOptions
  ): Promise<PaymentOrchestrationResult<T>> {
    const mode: OrchestrationMode = options.mode ?? 'local';

    // In live mode, forbid mock facilitator
    if (mode === 'live' && options.facilitator.isMock === true) {
      throw new FacilitatorSettlementError(
        'Cannot use MockFacilitatorClient in live mode: live mode requires real network facilitator transport'
      );
    }

    const customFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    const originalUrl = new URL(options.resourceUrl).href;
    const trustedOrigin = new URL(originalUrl).origin;

    // 1. & 2. Buyer submits merchant resource URL and makes initial HTTP request
    const initialResponse = await customFetch(originalUrl, {
      ...options.requestInit,
      redirect: 'manual'
    });

    // Cross-origin redirect defense
    if (initialResponse.status >= 300 && initialResponse.status < 400) {
      const location = initialResponse.headers.get('location');
      if (location) {
        const redirectOrigin = new URL(location, originalUrl).origin;
        if (redirectOrigin !== trustedOrigin) {
          throw new QuoteSealSecurityRejectionError(
            'BLOCK',
            `Cross-origin redirect rejected: ${trustedOrigin} -> ${redirectOrigin}`
          );
        }
      }
    }

    // If resource does not require payment (e.g. 200 OK), return directly
    if (initialResponse.status === 200) {
      const data = await parseResponseBody<T>(initialResponse);
      return {
        success: true,
        statusCode: 200,
        mode,
        data,
        headers: Object.fromEntries(initialResponse.headers.entries())
      };
    }

    // 3. Merchant returns HTTP 402
    if (initialResponse.status !== 402) {
      throw new ResourceAccessError(
        initialResponse.status,
        `Unexpected response status ${initialResponse.status} from resource: expected 402 Payment Required`
      );
    }

    // 4. Buyer parses the payment requirements
    const rawChallenge = await parsePaymentRequiredResponse(initialResponse);
    const challenge: PaymentRequired = copyData(rawChallenge);

    // Defense: verify challenge resource URL does not attempt to redefine trusted merchant origin
    if (challenge.resource?.url) {
      const challengeOrigin = new URL(challenge.resource.url, originalUrl).origin;
      if (challengeOrigin !== trustedOrigin) {
        throw new QuoteSealSecurityRejectionError(
          'BLOCK',
          `Challenge resource origin mismatch: expected ${trustedOrigin}, got ${challengeOrigin}`
        );
      }
    }

    // 5. Buyer selects the exact supported payment requirement
    // Policy: x402 v2, scheme: 'exact', network: 'hedera:testnet', asset: '0.0.0'
    const selectedIndex = challenge.accepts.findIndex(
      (r) =>
        r.scheme === 'exact' &&
        r.network === 'hedera:testnet' &&
        r.asset === '0.0.0' &&
        typeof r.amount === 'string' &&
        r.extra &&
        typeof r.extra.feePayer === 'string'
    );

    if (selectedIndex === -1) {
      throw new UnsupportedRequirementError(
        'No supported exact hedera:testnet payment requirement found in 402 challenge'
      );
    }

    const selectedRequirement: PaymentRequirements = freezeData(copyData(challenge.accepts[selectedIndex]));

    // 6. Buyer sends original URL and exact selected requirement to QuoteSeal
    const trust = options.readTrust();
    const firstSeen = options.now ? options.now() : Date.now();
    const nowTime = options.now ? options.now() : Date.now();

    // 7. QuoteSeal returns PASS / BLOCK / HOLD / UNVERIFIABLE
    const verdict = evaluate(
      selectedRequirement,
      challenge.accepts,
      trust.profile,
      trust.anchors,
      originalUrl,
      firstSeen,
      nowTime
    );

    // 8. On non-PASS, abort with zero signer calls
    if (verdict !== 'PASS') {
      throw new QuoteSealSecurityRejectionError(
        verdict,
        `QuoteSeal security guard rejected payment: verdict=${verdict}`
      );
    }

    // 9. Prepare the controlled payment attempt binding the evaluated trust snapshot BEFORE confirmation
    const boundaryInput: BoundaryInput = {
      originalUrl,
      challenge: copyData(challenge),
      selectedIndex,
      firstSeen,
      now: options.now ?? (() => Date.now()),
      readTrust: options.readTrust
    };

    const attempt = createPaymentAttempt(boundaryInput, options.signer);

    // 10. On PASS, show the exact merchant, amount, asset and payout to the buyer
    const summary: BuyerConfirmationRequest = freezeData({
      resourceUrl: originalUrl,
      merchantOrigin: trustedOrigin,
      merchantEns:
        trust.profile && 'ensName' in trust.profile && typeof trust.profile.ensName === 'string'
          ? trust.profile.ensName
          : undefined,
      payTo: selectedRequirement.payTo,
      amount: selectedRequirement.amount,
      asset: selectedRequirement.asset,
      network: selectedRequirement.network,
      maxTimeoutSeconds: selectedRequirement.maxTimeoutSeconds,
      rawRequirement: copyData(selectedRequirement)
    });

    // 11. Require explicit buyer confirmation
    const confirmed = await options.confirm(summary);
    if (confirmed !== true) {
      throw new BuyerConfirmationRequiredError(
        'Payment aborted: explicit buyer confirmation was not granted'
      );
    }

    // 12. Invoke the controlled signer exactly once via the frozen QuoteSeal boundary
    const paymentPayload = await attempt.createPaymentPayload();

    // 13. Submit the x402 payment through the verified Hedera facilitator
    const settleResponse = await options.facilitator.settle(
      paymentPayload,
      selectedRequirement
    );

    // 14. Verify settlement response and transaction evidence
    assertValidSettlementResponse(settleResponse, selectedRequirement.network);

    // 15. Independent Hedera Mirror Node Settlement Verification
    let verificationResult: SettlementVerificationResult | undefined;
    const shouldVerify =
      mode === 'live' || options.requireSettlementVerification === true || options.verifier !== undefined;

    if (shouldVerify) {
      const verifier =
        options.verifier ??
        new HederaMirrorNodeVerifier(
          options.mirrorNodeUrl ?? HEDERA_TESTNET_MIRROR_NODE_URL,
          customFetch
        );

      verificationResult = await verifier.verifySettlement({
        transactionId: settleResponse.transaction,
        expectedPayer: settleResponse.payer,
        expectedRecipient: selectedRequirement.payTo,
        expectedAmount: selectedRequirement.amount,
        expectedAsset: selectedRequirement.asset,
        expectedNetwork: selectedRequirement.network
      });

      // Live mode and strict verification fail-closed if not SETTLED_VERIFIED
      if (mode === 'live' || options.requireSettlementVerification) {
        if (verificationResult.status !== 'SETTLED_VERIFIED') {
          throw new SettlementVerificationError(
            verificationResult.status,
            `Independent Hedera settlement verification failed (${verificationResult.status}): ${verificationResult.reason}`,
            verificationResult.evidence
          );
        }
      }
    } else {
      // Local demo mode without explicit verifier
      verificationResult = {
        status: 'SETTLEMENT_UNVERIFIED',
        transactionId: settleResponse.transaction,
        reason: 'Local simulation: independent Mirror Node verification not requested'
      };
    }

    // 16. Retry the original resource request with the payment proof
    const retryHeaders = new Headers(options.requestInit?.headers);
    retryHeaders.set('PAYMENT-SIGNATURE', encodePaymentSignatureHeader(paymentPayload));
    retryHeaders.set('PAYMENT-RESPONSE', encodePaymentResponseHeader(settleResponse));
    retryHeaders.set('Access-Control-Expose-Headers', 'PAYMENT-RESPONSE,X-PAYMENT-RESPONSE');

    const paidResponse = await customFetch(originalUrl, {
      ...options.requestInit,
      headers: retryHeaders,
      redirect: 'manual'
    });

    // Cross-origin redirect defense on paid response
    if (paidResponse.status >= 300 && paidResponse.status < 400) {
      const location = paidResponse.headers.get('location');
      if (location) {
        const redirectOrigin = new URL(location, originalUrl).origin;
        if (redirectOrigin !== trustedOrigin) {
          throw new ResourceAccessError(
            paidResponse.status,
            `Paid resource cross-origin redirect rejected: ${trustedOrigin} -> ${redirectOrigin}`
          );
        }
      }
    }

    if (paidResponse.status !== 200) {
      throw new ResourceAccessError(
        paidResponse.status,
        `Merchant rejected payment proof with HTTP ${paidResponse.status}`
      );
    }

    // 17. Display the final resource and payment result
    const data = await parseResponseBody<T>(paidResponse);

    return {
      success: true,
      statusCode: paidResponse.status,
      mode,
      data,
      headers: Object.fromEntries(paidResponse.headers.entries()),
      settlement: {
        transactionId: settleResponse.transaction,
        payer: settleResponse.payer,
        network: settleResponse.network,
        simulated: mode === 'local' && (options.facilitator.isMock ?? false)
      },
      verification: verificationResult,
      payment: {
        merchantPayTo: selectedRequirement.payTo,
        amount: selectedRequirement.amount,
        asset: selectedRequirement.asset,
        network: selectedRequirement.network
      }
    };
  }
}
