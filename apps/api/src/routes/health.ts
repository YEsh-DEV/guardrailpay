import type { FastifyPluginAsync } from 'fastify';

export type DependencyState = 'READY' | 'NOT_READY' | 'NOT_CONFIGURED';
export interface DatabaseHealth {
  connected: boolean;
  migrationsApplied: boolean;
}
type Check = () => Promise<boolean>;

export interface HealthRouteOptions {
  checkDatabase?: () => Promise<DatabaseHealth>;
  checkRpcPrimary?: Check;
  checkRpcSecondary?: Check;
  checkController?: Check;
  checkEns?: Check;
  checkWorldId?: Check;
  checkHedera?: Check;
  checkFacilitator?: Check;
  requiredDependencies: string[];
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  app.get('/health', async (_req, reply) => reply.status(200).send({
    status: 'ok',
    service: 'quoteseal-api',
    timestamp: new Date().toISOString()
  }));

  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, DependencyState> = {
      database: 'NOT_CONFIGURED',
      migrations: 'NOT_CONFIGURED',
      rpcPrimary: 'NOT_CONFIGURED',
      rpcSecondary: 'NOT_CONFIGURED',
      controller: 'NOT_CONFIGURED',
      ens: 'NOT_CONFIGURED',
      worldId: 'NOT_CONFIGURED',
      hedera: 'NOT_CONFIGURED',
      facilitator: 'NOT_CONFIGURED'
    };

    if (opts.checkDatabase) {
      try {
        const state = await opts.checkDatabase();
        checks.database = state.connected ? 'READY' : 'NOT_READY';
        checks.migrations = state.migrationsApplied ? 'READY' : 'NOT_READY';
      } catch {
        checks.database = 'NOT_READY';
        checks.migrations = 'NOT_READY';
      }
    }

    const run = async (name: string, check?: Check) => {
      if (!check) return;
      try {
        checks[name] = (await check()) ? 'READY' : 'NOT_READY';
      } catch {
        checks[name] = 'NOT_READY';
      }
    };
    await Promise.all([
      run('rpcPrimary', opts.checkRpcPrimary),
      run('rpcSecondary', opts.checkRpcSecondary),
      run('controller', opts.checkController),
      run('ens', opts.checkEns),
      run('worldId', opts.checkWorldId),
      run('hedera', opts.checkHedera),
      run('facilitator', opts.checkFacilitator)
    ]);

    const ready = opts.requiredDependencies.every((name) => checks[name] === 'READY');
    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'unready',
      checks,
      timestamp: new Date().toISOString()
    });
  });
};
