import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver, verifyTrustAnchors } from '@quoteseal/ens-profile';
import { ValidationError, NotFoundError } from '@quoteseal/shared';
import type { QuoteSealDatabase, MockDatabaseStore } from '@quoteseal/shared';

export interface MerchantsRouteOptions {
  ensResolver: EnsProfileResolver;
  db?: QuoteSealDatabase | MockDatabaseStore;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const OnboardMerchantRequestSchema = z.object({
  ensName: z.string().min(3).max(255),
  endpointOrigin: z.string().url(),
  activePayTo: z.string().min(1),
  maxAmount: z.string().default('500000000'),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

export const merchantRoutes: FastifyPluginAsync<MerchantsRouteOptions> = async (app, opts) => {
  // GET /v1/merchants/:ensName/profile
  app.get('/v1/merchants/:ensName/profile', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const profile = await opts.ensResolver.resolveProfile(ensName);

    return reply.status(200).send({
      data: {
        profile,
        resolvedAt: new Date().toISOString()
      }
    });
  });

  // GET /v1/merchants/:ensName/trust
  app.get('/v1/merchants/:ensName/trust', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const profile = await opts.ensResolver.resolveProfile(ensName);

    // Trust anchors pinned for this merchant
    const trustAnchors = {
      trustedOwner: profile.owner,
      trustedResolver: profile.resolver,
      trustedExpiry: profile.expiry,
      trustedProfileVersion: profile.profileVersion
    };

    const verification = verifyTrustAnchors(profile, trustAnchors);

    return reply.status(200).send({
      data: {
        ensName,
        trustAnchors,
        verification,
        status: verification.verdict
      }
    });
  });

  // POST /v1/merchants/onboard (Schema and validation interface)
  app.post('/v1/merchants/onboard', async (req, reply) => {
    const bodyResult = OnboardMerchantRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid merchant onboarding request payload', {
        issues: bodyResult.error.issues
      });
    }

    const payload = bodyResult.data;
    // In Phase 5: verifies signature, writes merchant record, pins anchors.
    // Here: validates inputs and returns pending onboarding contract response.
    return reply.status(202).send({
      data: {
        ensName: payload.ensName,
        endpointOrigin: payload.endpointOrigin,
        activePayTo: payload.activePayTo,
        status: 'PENDING_ONBOARDING_CHALLENGE',
        message: 'Onboarding request validated and pending contract deployment verification'
      }
    });
  });
};
