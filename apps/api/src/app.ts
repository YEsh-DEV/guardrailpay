import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { QuoteSealError } from '@quoteseal/shared';
import { type EnsProfileResolver } from '@quoteseal/ens-profile';
import type { QuoteSealDatabase, MockDatabaseStore } from '@quoteseal/shared';
import { createLogger, SENSITIVE_PATHS } from '@quoteseal/shared';
import { healthRoutes } from './routes/health.js';
import { merchantRoutes } from './routes/merchants.js';
import { rotationRoutes } from './routes/rotation.js';
import { auditRoutes } from './routes/audit.js';
import { worldRoutes } from './routes/world.js';

export interface AppDependencies {
  ensResolver: EnsProfileResolver;
  db?: QuoteSealDatabase | MockDatabaseStore;
  checkDatabase?: () => Promise<boolean>;
  checkRpcPrimary?: () => Promise<boolean>;
  checkRpcSecondary?: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): FastifyInstance {
  const log = createLogger({ name: 'quoteseal-api' });

  const app = Fastify({
    loggerInstance: log as any,
    disableRequestLogging: false
  });

  // Security headers & CORS
  app.register(helmet, {
    contentSecurityPolicy: false // API only
  });

  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  app.register(sensible);

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    // Check if error is a known QuoteSeal domain error
    if (error instanceof QuoteSealError) {
      request.log.warn({
        errName: error.name,
        code: error.code,
        statusCode: error.statusCode,
        message: error.message
      });
      return reply.status(error.statusCode).send(error.toJSON());
    }

    // Fastify validation errors
    if (error && error.validation) {
      return reply.status(400).send({
        error: {
          name: 'ValidationError',
          code: 'VALIDATION_ERROR',
          message: error.message,
          statusCode: 400
        }
      });
    }

    // Internal unexpected error (redact sensitive info)
    request.log.error(error);
    return reply.status(500).send({
      error: {
        name: 'InternalError',
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
        statusCode: 500
      }
    });
  });

  // Register routes
  app.register(healthRoutes, {
    checkDatabase: deps.checkDatabase,
    checkRpcPrimary: deps.checkRpcPrimary,
    checkRpcSecondary: deps.checkRpcSecondary
  });

  app.register(merchantRoutes, {
    ensResolver: deps.ensResolver,
    db: deps.db
  });

  app.register(rotationRoutes, {
    ensResolver: deps.ensResolver,
    db: deps.db
  });

  app.register(auditRoutes, {
    db: deps.db
  });

  app.register(worldRoutes);

  return app as any as FastifyInstance;
}
