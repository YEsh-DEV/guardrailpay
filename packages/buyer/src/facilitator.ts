import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from '@x402/core/types';
import type { IFacilitatorClient } from './types.js';
import { FacilitatorSettlementError, InvalidSettlementEvidenceError } from './types.js';

/**
 * Validates whether a transaction string follows the canonical Hedera transaction ID format:
 * `<shard>.<realm>.<account>@<seconds>.<nanoseconds>`
 * e.g. "0.0.5001@1700000000.000000000"
 */
export function isValidHederaTransactionId(txId: string): boolean {
  if (!txId || typeof txId !== 'string') return false;
  return /^\d+\.\d+\.\d+[@-]\d+[.-]\d+$/.test(txId.trim());
}

/**
 * Asserts that a facilitator settlement response is valid, successful, and contains
 * real on-chain transaction evidence. Fails closed on any inconsistency.
 */
export function assertValidSettlementResponse(
  settleRes: SettleResponse,
  expectedNetwork: string
): void {
  if (!settleRes || typeof settleRes !== 'object') {
    throw new FacilitatorSettlementError('Facilitator returned empty or invalid response object');
  }

  if (settleRes.success !== true) {
    throw new FacilitatorSettlementError(
      settleRes.errorMessage || settleRes.errorReason || 'Facilitator reported settlement failure',
      settleRes.errorReason
    );
  }

  if (!settleRes.transaction || !isValidHederaTransactionId(settleRes.transaction)) {
    throw new InvalidSettlementEvidenceError(
      `Facilitator response lacks verifiable Hedera transaction evidence: transaction='${settleRes.transaction}'`
    );
  }

  if (settleRes.network !== expectedNetwork) {
    throw new FacilitatorSettlementError(
      `Facilitator network mismatch: expected '${expectedNetwork}', got '${settleRes.network}'`
    );
  }
}

/**
 * HTTP client for communicating with a remote x402 facilitator endpoint.
 */
export class HttpFacilitatorClient implements IFacilitatorClient {
  readonly isMock: false = false;

  constructor(
    private readonly facilitatorUrl: string,
    private readonly customFetch: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {
    if (!facilitatorUrl || typeof facilitatorUrl !== 'string') {
      throw new Error('Facilitator URL must be a non-empty string');
    }
    const parsed = new URL(facilitatorUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid facilitator URL protocol '${parsed.protocol}': expected http: or https:`);
    }
  }

  async checkHealth(): Promise<{ healthy: boolean; details?: unknown }> {
    const healthUrl = this.endpoint('health');
    try {
      const response = await this.customFetch(healthUrl, { method: 'GET' });
      if (!response.ok) {
        return { healthy: false, details: `HTTP ${response.status} from facilitator health endpoint` };
      }
      const data = await response.json().catch(() => ({}));
      return { healthy: true, details: data };
    } catch (err: unknown) {
      return { healthy: false, details: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkCapabilities(
    network: string = 'hedera:testnet',
    scheme: string = 'exact'
  ): Promise<{ supported: boolean; details?: unknown }> {
    const supportedUrl = this.endpoint('supported');
    try {
      const response = await this.customFetch(supportedUrl, { method: 'GET' });
      if (!response.ok) {
        return { supported: false, details: `HTTP ${response.status} from facilitator /supported` };
      }
      const data = (await response.json()) as { kinds?: Array<{ network?: string; scheme?: string }> };
      if (Array.isArray(data.kinds)) {
        const found = data.kinds.some((k) => k.network === network && k.scheme === scheme);
        return { supported: found, details: data };
      }
      return { supported: false, details: data };
    } catch (err: unknown) {
      return { supported: false, details: err instanceof Error ? err.message : String(err) };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const settleUrl = this.endpoint('settle');

    let response: Response;
    try {
      response = await this.customFetch(settleUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          x402Version: 2,
          paymentPayload: payload,
          paymentRequirements: requirements
        })
      });
    } catch (err: unknown) {
      throw new FacilitatorSettlementError(
        `Failed to reach facilitator at ${settleUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new FacilitatorSettlementError(
        `Facilitator HTTP error ${response.status}: ${errBody || response.statusText}`
      );
    }

    let settleRes: SettleResponse;
    try {
      settleRes = (await response.json()) as SettleResponse;
    } catch {
      throw new FacilitatorSettlementError('Failed to parse facilitator settlement JSON response');
    }

    assertValidSettlementResponse(settleRes, requirements.network);
    return settleRes;
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const verifyUrl = this.endpoint('verify');
    const response = await this.customFetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: requirements
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new FacilitatorSettlementError(
        `Facilitator verify HTTP error ${response.status}: ${errBody || response.statusText}`
      );
    }

    return (await response.json()) as VerifyResponse;
  }

  private endpoint(path: string): string {
    const url = new URL(this.facilitatorUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${path}`;
    return url.href;
  }
}

/**
 * In-memory test double for testing without live testnet credentials.
 */
export class MockFacilitatorClient implements IFacilitatorClient {
  readonly isMock: true = true;
  public calls: Array<{ payload: PaymentPayload; requirements: PaymentRequirements }> = [];
  public shouldFail: boolean = false;
  public failureReason?: string;
  public simulatedTransactionId: string = '0.0.5001@1700000000.000000000';
  public invalidEvidence: boolean = false;

  async checkHealth(): Promise<{ healthy: boolean; details?: unknown }> {
    return { healthy: !this.shouldFail, details: this.shouldFail ? this.failureReason : 'simulated-ok' };
  }

  async checkCapabilities(
    network: string = 'hedera:testnet',
    scheme: string = 'exact'
  ): Promise<{ supported: boolean; details?: unknown }> {
    return {
      supported: network === 'hedera:testnet' && scheme === 'exact',
      details: { kinds: [{ x402Version: 2, scheme: 'exact', network: 'hedera:testnet' }] }
    };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    this.calls.push({ payload, requirements });

    if (this.shouldFail) {
      const errorRes: SettleResponse = {
        success: false,
        errorReason: this.failureReason ?? 'FACILITATOR_SUBMISSION_REVERTED',
        errorMessage: 'Simulated facilitator settlement failure',
        transaction: '',
        network: requirements.network
      };
      assertValidSettlementResponse(errorRes, requirements.network);
      return errorRes;
    }

    const txId = this.invalidEvidence ? 'invalid_fake_id' : this.simulatedTransactionId;

    const res: SettleResponse = {
      success: true,
      transaction: txId,
      payer: '0.0.123456',
      network: requirements.network
    };

    assertValidSettlementResponse(res, requirements.network);
    return res;
  }
}
