import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@quoteseal/shared';
import type { IDbStore } from '../services/db-store.js';

export interface AuditRouteOptions {
  dbStore: IDbStore;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const QueryAuditSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  verdict: z.enum(['PASS', 'HOLD', 'BLOCK', 'UNVERIFIABLE']).optional()
});

export const auditRoutes: FastifyPluginAsync<AuditRouteOptions> = async (app, opts) => {
  // GET /v1/merchants/:ensName/audit-events
  app.get('/v1/merchants/:ensName/audit-events', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const queryResult = QueryAuditSchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', { issues: queryResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const { limit, verdict } = queryResult.data;

    const merchant = await opts.dbStore.findMerchantByName(ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${ensName}' not found`);
    }

    const rawEvents = await opts.dbStore.listAuditEvents(merchant.id);
    const filtered = rawEvents
      .filter((e) => (verdict ? e.verdict === verdict : true))
      .slice(-limit)
      .reverse();

    return reply.status(200).send({
      data: {
        ensName,
        total: filtered.length,
        events: filtered
      }
    });
  });
};
