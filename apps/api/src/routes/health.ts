import type { FastifyPluginAsync } from 'fastify';

export interface HealthRouteOptions {
  checkDatabase?: () => Promise<boolean>;
  checkRpcPrimary?: () => Promise<boolean>;
  checkRpcSecondary?: () => Promise<boolean>;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  // Liveness check
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'quoteseal-api',
      timestamp: new Date().toISOString()
    });
  });

  // Readiness check
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'degraded' | 'unavailable'> = {
      database: 'ok',
      rpcPrimary: 'ok',
      rpcSecondary: 'ok'
    };

    let isReady = true;

    if (opts.checkDatabase) {
      try {
        const ok = await opts.checkDatabase();
        checks.database = ok ? 'ok' : 'unavailable';
        if (!ok) isReady = false;
      } catch {
        checks.database = 'unavailable';
        isReady = false;
      }
    }

    if (opts.checkRpcPrimary) {
      try {
        const ok = await opts.checkRpcPrimary();
        checks.rpcPrimary = ok ? 'ok' : 'unavailable';
        if (!ok) isReady = false;
      } catch {
        checks.rpcPrimary = 'unavailable';
        isReady = false;
      }
    }

    if (opts.checkRpcSecondary) {
      try {
        const ok = await opts.checkRpcSecondary();
        checks.rpcSecondary = ok ? 'ok' : 'unavailable';
        if (!ok) isReady = false;
      } catch {
        checks.rpcSecondary = 'unavailable';
        isReady = false;
      }
    }

    const statusCode = isReady ? 200 : 503;
    return reply.status(statusCode).send({
      status: isReady ? 'ready' : 'unready',
      checks,
      timestamp: new Date().toISOString()
    });
  });
};
