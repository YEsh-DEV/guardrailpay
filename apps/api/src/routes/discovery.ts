import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@quoteseal/shared';
import type { ArkivDiscoveryService } from '@quoteseal/arkiv';

export interface DiscoveryRouteOptions {
  arkivDiscoveryService: ArkivDiscoveryService;
}

const DiscoveryQuerySchema = z.object({
  domain: z.string().optional(),
  activePayTo: z.string().optional(),
  identityType: z.enum(['ENSV2', 'QUOTESEAL_NATIVE']).optional(),
  verifiedOnly: z.preprocess((val) => {
    if (val === 'false' || val === false) return false;
    return true;
  }, z.boolean()).default(true)
});

const DiscoveryParamSchema = z.object({
  keyOrId: z.string().min(1).max(255)
});

export const discoveryRoutes: FastifyPluginAsync<DiscoveryRouteOptions> = async (app, opts) => {
  // GET /v1/merchants/discovery
  app.get('/v1/merchants/discovery', async (req, reply) => {
    const queryResult = DiscoveryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid discovery query parameters', {
        issues: queryResult.error.issues
      });
    }

    const merchants = await opts.arkivDiscoveryService.discoverMerchants({
      domain: queryResult.data.domain,
      activePayTo: queryResult.data.activePayTo,
      identityType: queryResult.data.identityType,
      verifiedOnly: queryResult.data.verifiedOnly
    });

    return reply.status(200).send({
      data: {
        merchants,
        count: merchants.length,
        queriedAt: new Date().toISOString()
      }
    });
  });

  // GET /v1/merchants/discovery/:keyOrId
  app.get('/v1/merchants/discovery/:keyOrId', async (req, reply) => {
    const paramResult = DiscoveryParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid key or identifier parameter', {
        issues: paramResult.error.issues
      });
    }

    const merchant = await opts.arkivDiscoveryService.getMerchantProfile(paramResult.data.keyOrId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramResult.data.keyOrId}' not found in Arkiv index`);
    }

    return reply.status(200).send({
      data: {
        merchant,
        queriedAt: new Date().toISOString()
      }
    });
  });
};
