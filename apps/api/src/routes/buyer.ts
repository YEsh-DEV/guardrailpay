import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver, verifyTrustAnchors } from '@quoteseal/ens-profile';
import { evaluate, defaultProfile, defaultAnchors } from '@quoteseal/guard';
import {
  ValidationError,
  UnverifiableError,
  type EnvConfig
} from '@quoteseal/shared';
import type { IDbStore } from '../services/db-store.js';

export interface BuyerRouteOptions {
  ensResolver: EnsProfileResolver;
  dbStore?: IDbStore;
  env?: EnvConfig;
}

const PayBodySchema = z.object({
  resourceUrl: z.string().url().refine((u) => u.startsWith('https:'), {
    message: 'resourceUrl must use https:'
  }),
  payTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'payTo must be canonical Hedera account format 0.0.N'),
  amount: z.string().regex(/^(0|[1-9][0-9]*)$/, 'amount must be a non-negative integer string'),
  asset: z.string().min(1),
  network: z.string().min(1),
  scheme: z.string().min(1),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.object({ feePayer: z.string() }),
  allRequirements: z.array(z.unknown()),
  // Identity and trust options (server-side verified, never blindly trusted from caller)
  ensName: z.string().min(3).max(255).optional(),
  merchantId: z.string().min(1).max(255).optional(),
  trustAnchors: z
    .object({
      trustedOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      trustedResolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      trustedExpiry: z.number().int().nonnegative(),
      trustedProfileVersion: z.number().int().positive()
    })
    .optional(),
  demoProfile: z.boolean().optional(),
  // Accepted in schema so callers cannot inject it to bypass validation; server-side logic always ignores caller value
  rpcAgreed: z.boolean().optional()
});

export const buyerRoutes: FastifyPluginAsync<BuyerRouteOptions> = async (app, opts) => {
  /**
   * POST /v1/buyer/pay
   *
   * Server-side guard evaluation service for buyer-side x402 payment challenges.
   *
   * SECURITY INVARIANTS:
   * 1. Caller fields must never establish trust or fabricate merchant profiles.
   * 2. Merchant identity is independently resolved via Dual-RPC ENSv2 or anchored storage.
   * 3. rpcAgreed is NEVER derived from caller input.
   * 4. Demo trust profile is strictly restricted to test/local-e2e environments.
   * 5. Pending, uncommitted, or unanchored merchants are strictly rejected with BLOCK.
   */
  app.post('/v1/buyer/pay', async (req, reply) => {
    const bodyResult = PayBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid buyer pay request', { issues: bodyResult.error.issues });
    }

    const body = bodyResult.data;
    const now = Date.now();
    const firstSeen = now;
    const merchantOrigin = new URL(body.resourceUrl).origin;

    const selectedRequirement = {
      scheme: body.scheme,
      network: body.network,
      asset: body.asset,
      amount: body.amount,
      payTo: body.payTo,
      maxTimeoutSeconds: body.maxTimeoutSeconds,
      extra: body.extra
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Explicit DEMO TRUST PROFILE branch (strictly restricted to test env)
    // ─────────────────────────────────────────────────────────────────────────
    if (body.demoProfile === true) {
      const isTestEnv =
        opts.env?.NODE_ENV === 'test' ||
        opts.env?.APP_PROFILE === 'local-e2e' ||
        process.env.NODE_ENV === 'test' ||
        process.env.APP_PROFILE === 'local-e2e';

      if (!isTestEnv) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: 'DEMO TRUST PROFILE is strictly prohibited outside test/local-e2e environments'
        });
      }

      // In test mode, evaluate against the known demo fixture profile
      // Even in demo mode, enforce that payTo and amount match the authoritative profile
      if (body.payTo !== defaultProfile.payTo) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          mode: 'DEMO_TRUST_PROFILE',
          reason: `Demo payment payTo mismatch: expected ${defaultProfile.payTo}, got ${body.payTo}`
        });
      }

      if (BigInt(body.amount) > BigInt(defaultProfile.maxAmount ?? '100')) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          mode: 'DEMO_TRUST_PROFILE',
          reason: `Demo payment amount exceeds cap: ${body.amount} > ${defaultProfile.maxAmount}`
        });
      }

      const demoExpiry = Math.floor(now / 1000) + 86400 * 365;
      const demoEvaluatableProfile = {
        ...defaultProfile,
        expiry: demoExpiry,
        origin: merchantOrigin,
        checkedAt: now,
        rpcAgreed: true
      };

      const demoEvaluatableAnchors = {
        ...defaultAnchors,
        expiry: demoExpiry
      };

      const verdict = evaluate(
        selectedRequirement,
        body.allRequirements as typeof selectedRequirement[],
        demoEvaluatableProfile,
        demoEvaluatableAnchors,
        body.resourceUrl,
        firstSeen,
        now
      );

      if (verdict === 'PASS') {
        return reply.status(200).send({
          verdict: 'PASS',
          mode: 'DEMO_TRUST_PROFILE',
          summary: {
            resourceUrl: body.resourceUrl,
            merchantOrigin,
            payTo: body.payTo,
            amount: body.amount,
            asset: body.asset,
            network: body.network,
            maxTimeoutSeconds: body.maxTimeoutSeconds
          }
        });
      }

      return reply.status(200).send({
        verdict,
        mode: 'DEMO_TRUST_PROFILE',
        reason: `Guard evaluation returned ${verdict} for demo payment requirement`
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Resolve merchant identity from trusted server-side sources
    // ─────────────────────────────────────────────────────────────────────────
    let resolvedEnsName: string | undefined = body.ensName?.toLowerCase().trim();
    let merchantRecord = null;

    if (opts.dbStore) {
      if (body.merchantId) {
        merchantRecord = await opts.dbStore.findMerchantById(body.merchantId);
      } else if (resolvedEnsName) {
        merchantRecord = await opts.dbStore.findMerchantByName(resolvedEnsName);
      } else {
        merchantRecord = await opts.dbStore.findMerchantByOrigin(merchantOrigin);
      }
    }

    if (!resolvedEnsName && merchantRecord?.ensName) {
      resolvedEnsName = merchantRecord.ensName.toLowerCase().trim();
    }

    // Reject unresolvable merchant identity
    if (!resolvedEnsName && !merchantRecord) {
      return reply.status(200).send({
        verdict: 'BLOCK',
        reason: 'Merchant identity could not be resolved from trusted server-side sources'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Reject pending or uncommitted merchants
    // ─────────────────────────────────────────────────────────────────────────
    if (merchantRecord) {
      if (merchantRecord.status !== 'active') {
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: `Merchant is in '${merchantRecord.status}' status; only active merchants are authorized`
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Never use PostgreSQL alone as proof of on-chain authorization
    // ─────────────────────────────────────────────────────────────────────────
    if (!resolvedEnsName) {
      // Native merchant without ENS must have verified on-chain controller anchoring
      if (
        !merchantRecord?.controllerAddress ||
        merchantRecord.controllerAddress === '0x0000000000000000000000000000000000000000'
      ) {
        return reply.status(200).send({
          verdict: 'UNVERIFIABLE',
          reason: 'Native merchant lacks verified on-chain controller authorization anchor'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Independently resolve on-chain ENS profile via Dual-RPC
    // ─────────────────────────────────────────────────────────────────────────
    let resolvedProfile;
    if (resolvedEnsName) {
      try {
        resolvedProfile = await opts.ensResolver.resolveProfile(resolvedEnsName);
      } catch (err) {
        if (err instanceof UnverifiableError) {
          return reply.status(200).send({
            verdict: 'UNVERIFIABLE',
            reason: `Dual-RPC resolution failed for ${resolvedEnsName}: ${err.message}`
          });
        }
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: `Failed to resolve ENS profile for ${resolvedEnsName}: ${(err as Error).message}`
        });
      }
    }

    if (!resolvedProfile) {
      return reply.status(200).send({
        verdict: 'UNVERIFIABLE',
        reason: 'No authoritative profile available to evaluate payment'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Origin validation against merchant record
    // ─────────────────────────────────────────────────────────────────────────
    if (merchantRecord?.endpointOrigin) {
      const expectedOrigin = new URL(merchantRecord.endpointOrigin).origin;
      if (expectedOrigin !== merchantOrigin) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: `Resource origin ${merchantOrigin} does not match merchant registered origin ${expectedOrigin}`
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Trust Anchors Verification
    // ─────────────────────────────────────────────────────────────────────────
    let anchors: {
      trustedOwner: string;
      trustedResolver: string;
      trustedExpiry: number;
      trustedProfileVersion: number;
    };

    if (body.trustAnchors) {
      // Caller-supplied pinned anchors: verify they match on-chain truth
      anchors = body.trustAnchors;

      // Reject fake resolver or owner addresses
      if (anchors.trustedResolver.toLowerCase() !== resolvedProfile.resolver.toLowerCase()) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: `Caller-supplied resolver address ${anchors.trustedResolver} does not match verified on-chain resolver ${resolvedProfile.resolver}`
        });
      }

      if (anchors.trustedOwner.toLowerCase() !== resolvedProfile.owner.toLowerCase()) {
        return reply.status(200).send({
          verdict: 'BLOCK',
          reason: `Caller-supplied owner address ${anchors.trustedOwner} does not match verified on-chain owner ${resolvedProfile.owner}`
        });
      }

      const anchorVerification = verifyTrustAnchors(resolvedProfile, anchors, {
        currentTimeSeconds: Math.floor(now / 1000),
        expectedPayTo: body.payTo
      });

      if (anchorVerification.verdict !== 'PASS') {
        return reply.status(200).send({
          verdict: anchorVerification.verdict,
          reason: anchorVerification.message
        });
      }
    } else if (merchantRecord?.ownerAddress && merchantRecord?.resolverAddress) {
      // Use verified trust anchors from database
      anchors = {
        trustedOwner: merchantRecord.ownerAddress,
        trustedResolver: merchantRecord.resolverAddress,
        trustedExpiry: Number(merchantRecord.nameExpiry ?? 0),
        trustedProfileVersion: merchantRecord.profileVersion ?? 1
      };

      const anchorVerification = verifyTrustAnchors(resolvedProfile, anchors, {
        currentTimeSeconds: Math.floor(now / 1000),
        expectedPayTo: body.payTo
      });

      if (anchorVerification.verdict !== 'PASS') {
        return reply.status(200).send({
          verdict: anchorVerification.verdict,
          reason: anchorVerification.message
        });
      }
    } else {
      // No trust anchors available to bind the merchant
      return reply.status(200).send({
        verdict: 'HOLD',
        reason: 'No verified trust anchors established for merchant'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Pre-signing Guard Evaluation
    // ─────────────────────────────────────────────────────────────────────────
    // Profile is constructed SOLELY from independently resolved on-chain profile
    // rpcAgreed is true because DualRpcClient succeeded without throwing UnverifiableError
    const evaluatableProfile = {
      owner: resolvedProfile.owner,
      resolver: resolvedProfile.resolver,
      expiry: resolvedProfile.expiry,
      profileVersion: resolvedProfile.profileVersion,
      activePayTo: resolvedProfile.activePayTo,
      network: resolvedProfile.network,
      scheme: resolvedProfile.scheme,
      assetId: resolvedProfile.assetId,
      maxAmount: resolvedProfile.maxAmount,
      origin: merchantOrigin,
      checkedAt: now,
      rpcAgreed: true
    };

    const evaluatableAnchors = {
      trustedOwner: anchors.trustedOwner,
      trustedResolver: anchors.trustedResolver,
      trustedExpiry: anchors.trustedExpiry,
      trustedProfileVersion: anchors.trustedProfileVersion
    };

    const verdict = evaluate(
      selectedRequirement,
      body.allRequirements as typeof selectedRequirement[],
      evaluatableProfile,
      evaluatableAnchors,
      body.resourceUrl,
      firstSeen,
      now
    );

    if (verdict === 'PASS') {
      return reply.status(200).send({
        verdict: 'PASS',
        summary: {
          resourceUrl: body.resourceUrl,
          merchantOrigin,
          merchantEns: resolvedProfile.ensName,
          payTo: body.payTo,
          amount: body.amount,
          asset: body.asset,
          network: body.network,
          maxTimeoutSeconds: body.maxTimeoutSeconds,
          finalizedBlockNumber: resolvedProfile.finalizedBlockNumber,
          finalizedBlockHash: resolvedProfile.finalizedBlockHash
        }
      });
    }

    return reply.status(200).send({
      verdict,
      reason: `Guard evaluation returned ${verdict} for the payment requirement`
    });
  });
};
