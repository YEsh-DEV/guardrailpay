import { FastifyInstance } from 'fastify';
import { startAuth, validateCallback } from '@quoteseal/world-auth';
import { approveActiveRotation } from './rotation.js';

export async function worldRoutes(server: FastifyInstance) {
  // Start Agent Pass OIDC flow
  server.get('/world/start', async (request, reply) => {
    const clientId = process.env.WORLD_CLIENT_ID || 'app_staging_quoteseal';
    const redirectUri = process.env.WORLD_REDIRECT_URI || 'http://localhost:3001/world/callback';

    const session = startAuth({ clientId, redirectUri });
    return reply.code(200).send({
      authUrl: session.url,
      state: session.state,
      sessionNotice: 'World ID Agent Pass mock authentication active for hackathon demonstration.',
    });
  });

  // World ID OIDC Callback
  server.get('/world/callback', async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (query.error || !query.code || !query.state) {
      return reply.code(400).send({
        success: false,
        error: query.error || 'Missing code or state',
        description: query.error_description || 'World ID authorization was denied or cancelled.',
      });
    }

    try {
      const validation = await validateCallback({
        code: query.code,
        state: query.state,
      });

      if (!validation.valid) {
        return reply.code(403).send({
          success: false,
          error: validation.error || 'Unauthorized operator',
          subject: validation.subject,
        });
      }

      // Automatically approve pending rotation if one is waiting
      const approvalResult = approveActiveRotation(validation.subject);

      return reply.code(200).send({
        success: true,
        message: 'World ID Agent Pass successfully validated. Operator authorized.',
        operator: validation.operator,
        subject: validation.subject,
        rotationApproval: approvalResult,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });
}
