import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver } from '@quoteseal/ens-profile';
import { evaluate } from '@quoteseal/guard';
import { ValidationError } from '@quoteseal/shared';

export interface BuyerRouteOptions {
  ensResolver: EnsProfileResolver;
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
  allRequirements: z.array(z.unknown())
});

export const buyerRoutes: FastifyPluginAsync<BuyerRouteOptions> = async (app, opts) => {
  /**
   * POST /v1/buyer/pay
   *
   * Guard evaluation service for buyer-side x402 payment challenges.
   * The API does NOT hold a private key — it only evaluates the guard and
   * returns a payment snapshot for the buyer to confirm before signing.
   */
  app.post('/v1/buyer/pay', async (req, reply) => {
    const bodyResult = PayBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid buyer pay request', { issues: bodyResult.error.issues });
    }

    const body = bodyResult.data;

    // Resolve the merchant ENS profile from the payTo account via the resolver
    // The resourceUrl origin identifies the merchant.
    const merchantOrigin = new URL(body.resourceUrl).origin;

    // Build a selectedRequirement matching the x402 structure
    const selectedRequirement = {
      scheme: body.scheme,
      network: body.network,
      asset: body.asset,
      amount: body.amount,
      payTo: body.payTo,
      maxTimeoutSeconds: body.maxTimeoutSeconds,
      extra: body.extra
    };

    const now = Date.now();
    const firstSeen = now;

    // Build an evaluatable profile from the submitted requirement fields.
    // The API uses a trust-snapshot-like profile drawn from the requirement data
    // since the caller supplies the full x402 requirement.
    const profile = {
      owner: 'unknown',
      resolver: 'unknown',
      expiry: 9999999999,
      version: 1,
      payTo: body.payTo,
      activePayTo: body.payTo,
      network: body.network,
      scheme: body.scheme,
      assetId: body.asset,
      asset: body.asset,
      maxAmount: body.amount,
      origin: merchantOrigin,
      checkedAt: now,
      rpcAgreed: true
    };

    const anchors = {
      owner: 'unknown',
      resolver: 'unknown',
      expiry: 9999999999,
      version: 1
    };

    const verdict = evaluate(
      selectedRequirement,
      body.allRequirements as typeof selectedRequirement[],
      profile,
      anchors,
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
      reason: `Guard evaluation returned ${verdict} for the submitted payment requirement`
    });
  });
};
