import type {
  IGuardEngine,
  GuardEvaluationRequest,
  GuardEvaluationResult
} from './interfaces.js';
import { evaluate, type EvaluatableProfile, type EvaluatableAnchors } from './evaluate.js';
import { verifyTrustAnchors } from '@quoteseal/ens-profile';
import type { ReasonCode, Verdict } from '@quoteseal/shared';

export class GuardEngine implements IGuardEngine {
  async evaluate(request: GuardEvaluationRequest): Promise<GuardEvaluationResult> {
    const now = Date.now();
    const firstSeen = now;

    // 1. Verify trust anchors using canonical ens-profile verifyTrustAnchors
    const anchorVerification = verifyTrustAnchors(request.ensProfile, request.trustAnchors, {
      currentTimeSeconds: Math.floor(now / 1000),
      expectedPayTo: request.selectedRequirement.payTo
    });

    if (anchorVerification.verdict === 'HOLD' || anchorVerification.verdict === 'BLOCK') {
      return {
        verdict: anchorVerification.verdict,
        reasonCode: anchorVerification.reasonCode,
        message: anchorVerification.message,
        allowedSignerInvocation: false,
        evaluatedAt: new Date(now),
        divergentFields: anchorVerification.divergentFields
      };
    }

    // 2. Full deep evaluation using pre-signing guard rules
    const profile: EvaluatableProfile = {
      owner: request.ensProfile.owner,
      resolver: request.ensProfile.resolver,
      expiry: request.ensProfile.expiry,
      profileVersion: request.ensProfile.profileVersion,
      activePayTo: request.ensProfile.activePayTo,
      network: request.ensProfile.network,
      scheme: request.ensProfile.scheme,
      assetId: request.ensProfile.assetId,
      maxAmount: request.buyerMaxAmount,
      origin: request.buyerOriginalUrl,
      checkedAt: now,
      rpcAgreed: true
    };

    const anchors: EvaluatableAnchors = {
      trustedOwner: request.trustAnchors.trustedOwner,
      trustedResolver: request.trustAnchors.trustedResolver,
      trustedExpiry: request.trustAnchors.trustedExpiry,
      trustedProfileVersion: request.trustAnchors.trustedProfileVersion
    };

    const verdict = evaluate(
      request.selectedRequirement,
      request.challenge.accepts,
      profile,
      anchors,
      request.buyerOriginalUrl,
      firstSeen,
      now
    );

    let reasonCode: ReasonCode = 'OK';
    let message = 'Evaluation passed all security checks';

    if (verdict === 'BLOCK') {
      reasonCode = 'PAYTO_MISMATCH';
      message = 'Payment requirement rejected by guard policy';
    } else if (verdict === 'HOLD') {
      reasonCode = 'ANCHOR_MISMATCH';
      message = 'Trust anchor divergence detected';
    } else if (verdict === 'UNVERIFIABLE') {
      reasonCode = 'RPC_DISAGREEMENT';
      message = 'State unverifiable due to RPC divergence or staleness';
    }

    return {
      verdict,
      reasonCode,
      message,
      allowedSignerInvocation: verdict === 'PASS',
      evaluatedAt: new Date(now)
    };
  }
}
