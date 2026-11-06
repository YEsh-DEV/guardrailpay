import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import {
  QuoteSealError,
  createLogger,
  createMockDatabase,
  validateEnv,
  type EnvConfig,
  type QuoteSealDatabase,
  type MockDatabaseStore
} from '@quoteseal/shared';
import { type EnsProfileResolver } from '@quoteseal/ens-profile';
import { createDbStore, type IDbStore } from './services/db-store.js';
import {
  LiveWorldOidcService,
  MockWorldOidcService,
  type IWorldOidcService
} from './services/world-oidc.js';
import { OperatorEnrollmentService } from './services/operator-enrollment.js';
import { AttestorService } from './services/attestor.js';
import {
  MockRotationControllerClient,
  type IRotationControllerClient
} from './services/rotation-controller-client.js';
import { healthRoutes } from './routes/health.js';
import { merchantRoutes } from './routes/merchants.js';
import { rotationRoutes } from './routes/rotation.js';
import { auditRoutes } from './routes/audit.js';
import { worldRoutes } from './routes/world.js';
import type { Hex } from 'viem';

export interface AppDependencies {
  ensResolver: EnsProfileResolver;
  db?: QuoteSealDatabase | MockDatabaseStore;
  dbStore?: IDbStore;
  env?: EnvConfig;
  worldOidcService?: IWorldOidcService;
  operatorEnrollmentService?: OperatorEnrollmentService;
  attestorService?: AttestorService;
  rotationControllerClient?: IRotationControllerClient;
  checkDatabase?: () => Promise<boolean>;
  checkRpcPrimary?: () => Promise<boolean>;
  checkRpcSecondary?: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): FastifyInstance {
  const log = createLogger({ name: 'quoteseal-api' }) as unknown as FastifyBaseLogger;

  const app = Fastify({
    loggerInstance: log,
    disableRequestLogging: false
  });

  const env = deps.env ?? validateEnv(process.env);
  const dbStore = deps.dbStore ?? createDbStore(deps.db ?? createMockDatabase());

  const worldOidcService: IWorldOidcService =
    deps.worldOidcService ??
    (env.NODE_ENV === 'test'
      ? new MockWorldOidcService(
          {
            issuer: env.WORLD_ID_ISSUER,
            clientId: env.WORLD_ID_CLIENT_ID,
            clientSecret: env.WORLD_ID_CLIENT_SECRET,
            redirectUri: env.WORLD_ID_REDIRECT_URI,
            requiredAcr: env.WORLD_ID_REQUIRED_ACR,
            maxAuthAgeSeconds: env.WORLD_ID_MAX_AUTH_AGE_SECONDS,
            hmacSecret: env.OPERATOR_SUBJECT_HMAC_SECRET,
            encryptionKeyHex: env.ENCRYPTION_KEY_HEX
          },
          dbStore,
          log
        )
      : new LiveWorldOidcService(
          {
            issuer: env.WORLD_ID_ISSUER,
            clientId: env.WORLD_ID_CLIENT_ID,
            clientSecret: env.WORLD_ID_CLIENT_SECRET,
            redirectUri: env.WORLD_ID_REDIRECT_URI,
            requiredAcr: env.WORLD_ID_REQUIRED_ACR,
            maxAuthAgeSeconds: env.WORLD_ID_MAX_AUTH_AGE_SECONDS,
            hmacSecret: env.OPERATOR_SUBJECT_HMAC_SECRET,
            encryptionKeyHex: env.ENCRYPTION_KEY_HEX
          },
          dbStore,
          log
        ));

  const operatorEnrollmentService =
    deps.operatorEnrollmentService ??
    new OperatorEnrollmentService(
      dbStore,
      {
        issuer: env.WORLD_ID_ISSUER,
        hmacSecret: env.OPERATOR_SUBJECT_HMAC_SECRET,
        chainId: env.APPLICATION_CHAIN_ID
      },
      log
    );

  const attestorService =
    deps.attestorService ??
    new AttestorService(
      {
        attestorPrivateKey: env.ATTESTOR_PRIVATE_KEY as Hex,
        attestationTtlSeconds: env.ATTESTATION_TTL_SECONDS,
        maxAuthAgeSeconds: env.WORLD_ID_MAX_AUTH_AGE_SECONDS,
        chainId: env.APPLICATION_CHAIN_ID
      },
      dbStore,
      log
    );

  const rotationControllerClient =
    deps.rotationControllerClient ?? new MockRotationControllerClient();

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
    dbStore,
    operatorEnrollmentService
  });

  app.register(rotationRoutes, {
    ensResolver: deps.ensResolver,
    dbStore,
    rotationControllerClient
  });

  app.register(auditRoutes, {
    dbStore
  });

  app.register(worldRoutes, {
    worldOidcService,
    attestorService,
    dbStore
  });

  return app;
}
