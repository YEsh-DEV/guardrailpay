import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@quoteseal/shared';
import { AuditEventSchema } from '@quoteseal/shared';
import type { QuoteSealDatabase, MockDatabaseStore } from '@quoteseal/shared';

export interface AuditRouteOptions {
  db?: QuoteSealDatabase | MockDatabaseStore;
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

    let events: unknown[] = [];

    if (opts.db && 'auditEvents' in opts.db) {
      const mockDb = opts.db as MockDatabaseStore;
      events = mockDb.auditEvents
        .filter((e) => (verdict ? e.verdict === verdict : true))
        .slice(-limit)
        .reverse();
    }

    return reply.status(200).send({
      data: {
        ensName,
        total: events.length,
        events
      }
    });
  });
};
