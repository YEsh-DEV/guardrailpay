import { EvaluationResult, GuardDependencies, PaymentRequest } from './types.js';
import { evaluate } from './evaluate.js';

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

      // 3. Strict gate: invoke signer ONLY on PASS
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

      // Non-PASS verdicts abort immediately; callCount remains unchanged
      return {
        verdict: evaluation.verdict,
        reason: evaluation.reason,
        signerCallCount: callCount,
        details: evaluation.details,
      };
    },
  };
}
