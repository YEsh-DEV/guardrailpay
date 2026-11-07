import { EvaluationResult, GuardDependencies, PaymentRequest, SharedRiskLookup } from './types.js';
import { evaluate } from './evaluate.js';
import { normalizeAccountId, normalizeNetworkId } from './normalize.js';

export interface GuardedSignerExecution<TOutput> {
  verdict: EvaluationResult['verdict'];
  reason: string;
  result?: TOutput;
  signerCallCount: number;
  details?: EvaluationResult['details'];
}

export interface GuardedSigner<TOutput> {
  execute(payment: PaymentRequest): Promise<GuardedSignerExecution<TOutput>>;
  getSignerCallCount(): number;
  resetCallCount(): void;
}

function riskLookupToEvaluation(lookup: SharedRiskLookup): EvaluationResult | null {
  switch (lookup.kind) {
    case 'trusted':
      switch (lookup.state.status) {
        case 'ALLOW':
          return null;
        case 'BLOCK':
          return {
            verdict: 'BLOCK',
            reason: `ARKIV_RISK_BLOCK: Trusted Arkiv state ${lookup.state.entityKey} blocks this payer`,
          };
        case 'REVIEW':
        case 'UNKNOWN':
          return {
            verdict: 'HOLD',
            reason: `ARKIV_RISK_REVIEW: Trusted Arkiv state ${lookup.state.entityKey} requires review`,
          };
      }
    case 'not_found':
      return {
        verdict: 'HOLD',
        reason: 'ARKIV_RISK_STATE_MISSING: No trusted Arkiv risk state exists for this payer',
      };
    case 'unavailable':
      return {
        verdict: 'UNVERIFIABLE',
        reason: `ARKIV_RISK_UNAVAILABLE: ${lookup.reason}`,
      };
  }
}

/**
 * Creates a guarded signer wrapper.
 * Guarantees that the real signer function is called ONLY if PayeeGuard yields PASS.
 * In any error or uncertainty condition (RPC error, resolver failure), returns UNVERIFIABLE
 * with signerCallCount = 0.
 */
export function createGuardedSigner<TOutput>(
  rawSigner: (payment: PaymentRequest) => Promise<TOutput>,
  deps: GuardDependencies
): GuardedSigner<TOutput> {
  let callCount = 0;

  return {
    getSignerCallCount: () => callCount,
    resetCallCount: () => {
      callCount = 0;
    },
    execute: async (payment: PaymentRequest): Promise<GuardedSignerExecution<TOutput>> => {
      const now = deps.getNow ? deps.getNow() : Math.floor(Date.now() / 1000);

      // 1. Resolve ENS merchant profile
      let profile = null;
      try {
        const lookupKey = payment.ensName || payment.origin;
        profile = await deps.resolveProfile(lookupKey);
      } catch (err: unknown) {
        // Any resolver or network failure MUST resolve to UNVERIFIABLE
        return {
          verdict: 'UNVERIFIABLE',
          reason: `RESOLVER_ERROR: Failed to resolve merchant profile: ${(err as Error).message}`,
          signerCallCount: callCount,
        };
      }

      // 2. Evaluate payment against policy and profile
      const evaluation = evaluate(payment, profile, deps.policy, now);

      if (evaluation.verdict !== 'PASS') {
        return {
          verdict: evaluation.verdict,
          reason: evaluation.reason,
          signerCallCount: callCount,
          details: evaluation.details,
        };
      }

      // 3. A configured shared-risk reader is an additional pre-signing gate.
      if (deps.riskReader) {
        if (!payment.payerWallet) {
          return {
            verdict: 'UNVERIFIABLE',
            reason: 'ARKIV_PAYER_MISSING: A payer wallet is required when shared-risk checks are enabled',
            signerCallCount: callCount,
          };
        }

        let walletKey: string;
        let network: string;
        try {
          walletKey = normalizeAccountId(payment.payerWallet);
          network = normalizeNetworkId(payment.network);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Invalid payer risk lookup input';
          return {
            verdict: 'BLOCK',
            reason: `ARKIV_RISK_INPUT_INVALID: ${message}`,
            signerCallCount: callCount,
          };
        }

        let riskLookup: SharedRiskLookup;
        try {
          riskLookup = await deps.riskReader.getTrustedWalletRiskState({ walletKey, network });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown Arkiv risk lookup failure';
          return {
            verdict: 'UNVERIFIABLE',
            reason: `ARKIV_RISK_UNAVAILABLE: ${message}`,
            signerCallCount: callCount,
          };
        }

        const riskEvaluation = riskLookupToEvaluation(riskLookup);
        if (riskEvaluation) {
          return {
            verdict: riskEvaluation.verdict,
            reason: riskEvaluation.reason,
            signerCallCount: callCount,
          };
        }
      }

      // 4. Strict gate: invoke signer ONLY on PASS
      if (evaluation.verdict === 'PASS') {
        callCount++;
        const signerResult = await rawSigner(payment);
        return {
          verdict: 'PASS',
          reason: evaluation.reason,
          result: signerResult,
          signerCallCount: callCount,
          details: evaluation.details,
        };
      }

      return {
        verdict: 'UNVERIFIABLE',
        reason: 'PAYEE_GUARD_INVARIANT: signer gate reached without a PASS evaluation',
        signerCallCount: callCount,
      };
    },
  };
}
