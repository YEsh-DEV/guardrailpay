import { z } from 'zod';
import type { Verdict, ReasonCode, TrustAnchors } from '@quoteseal/shared';
import type { EnsProfileRecord } from '@quoteseal/ens-profile';

export const PaymentRequirementSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int().positive().optional()
});
export type PaymentRequirement = z.infer<typeof PaymentRequirementSchema>;

export const PaymentRequiredChallengeSchema = z.object({
  x402Version: z.number().int().default(2),
  resource: z.object({
    url: z.string().url()
  }),
  accepts: z.array(PaymentRequirementSchema).min(1)
});
export type PaymentRequiredChallenge = z.infer<typeof PaymentRequiredChallengeSchema>;

export interface GuardEvaluationRequest {
  buyerOriginalUrl: string;
  challenge: PaymentRequiredChallenge;
  selectedRequirement: PaymentRequirement;
  ensProfile: EnsProfileRecord;
  trustAnchors: TrustAnchors;
  buyerMaxAmount: string;
}

export interface GuardEvaluationResult {
  verdict: Verdict;
  reasonCode: ReasonCode;
  message: string;
  allowedSignerInvocation: boolean;
  evaluatedAt: Date;
  divergentFields?: string[];
}

/**
 * Integration interface for the pre-signing guard engine.
 * Decouples caller from internal evaluation rules.
 */
export interface IGuardEngine {
  evaluate(request: GuardEvaluationRequest): Promise<GuardEvaluationResult>;
}
