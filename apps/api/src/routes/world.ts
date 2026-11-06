import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@quoteseal/shared';

const WorldStartSchema = z.object({
  proposalId: z.string().uuid()
});

const WorldCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

export const worldRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/world/start
  app.post('/v1/world/start', async (req, reply) => {
    const bodyResult = WorldStartSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid request payload', { issues: bodyResult.error.issues });
    }

    const { proposalId } = bodyResult.data;

    // Phase 5 interface preparation:
    // Generates cryptographically secure state and PKCE binding to proposal
    const sampleState = `st_${proposalId.slice(0, 8)}_${Date.now()}`;
    const redirectUrl = `https://id.worldcoin.org/authorize?response_type=code&client_id=quoteseal&state=${sampleState}`;

    return reply.status(200).send({
      data: {
        proposalId,
        state: sampleState,
        redirectUrl
      }
    });
  });

  // GET /v1/world/callback
  app.get('/v1/world/callback', async (req, reply) => {
    const queryResult = WorldCallbackSchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid callback parameters', { issues: queryResult.error.issues });
    }

    const { code, state } = queryResult.data;

    return reply.status(200).send({
      data: {
        status: 'VERIFIED',
        message: 'World ID OIDC authentication callback received',
        state
      }
    });
  });
};
