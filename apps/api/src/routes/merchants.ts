import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver, verifyTrustAnchors } from '@quoteseal/ens-profile';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError
} from '@quoteseal/shared';
import type { IDbStore } from '../services/db-store.js';
import type { OperatorEnrollmentService } from '../services/operator-enrollment.js';
import type { Address, Hex } from 'viem';

export interface MerchantsRouteOptions {
  ensResolver: EnsProfileResolver;
  dbStore: IDbStore;
  operatorEnrollmentService: OperatorEnrollmentService;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const OnboardMerchantRequestSchema = z.object({
  ensName: z.string().min(3).max(255),
  endpointOrigin: z.string().url(),
  activePayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  maxAmount: z.string().default('500000000'),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

const EnrollOperatorSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  rawSubjectOrHmac: z.string().min(1),
  isPreHashedSubject: z.boolean().default(false),
  role: z.string().default('ROLE_ROTATION_APPROVER'),
  expirySeconds: z.number().int().positive().optional(),
  expiryTimestamp: z.number().int().positive().optional(),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  nonce: z.coerce.bigint().optional()
});

const RevokeOperatorParamSchema = z.object({
  ensName: z.string().min(3).max(255),
  operatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const RevokeOperatorBodySchema = z.object({
  callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  reason: z.string().optional()
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

  // POST /v1/merchants/onboard
  app.post('/v1/merchants/onboard', async (req, reply) => {
    const bodyResult = OnboardMerchantRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid merchant onboarding request payload', {
        issues: bodyResult.error.issues
      });
    }

    const payload = bodyResult.data;
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

  // GET /v1/merchants/:ensName/operators
  app.get('/v1/merchants/:ensName/operators', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const merchant = await opts.dbStore.findMerchantByName(paramsResult.data.ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.ensName}' not found`);
    }

    const operatorList = await opts.dbStore.listOperators(merchant.id);
    return reply.status(200).send({
      data: {
        ensName: merchant.ensName,
        operators: operatorList.map((op) => ({
          id: op.id,
          walletAddress: op.walletAddress,
          role: op.role,
          status: op.status,
          enrolledAt: op.enrolledAt,
          expiresAt: op.expiresAt,
          revokedAt: op.revokedAt
        }))
      }
    });
  });

  // POST /v1/merchants/:ensName/operators (Enroll Operator)
  app.post('/v1/merchants/:ensName/operators', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const bodyResult = EnrollOperatorSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid operator enrollment payload', { issues: bodyResult.error.issues });
    }

    const merchant = await opts.dbStore.findMerchantByName(paramsResult.data.ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.ensName}' not found`);
    }

    const result = await opts.operatorEnrollmentService.enrollOperator({
      merchantId: merchant.id,
      walletAddress: bodyResult.data.walletAddress as Address,
      rawSubjectOrHmac: bodyResult.data.rawSubjectOrHmac,
      isPreHashedSubject: bodyResult.data.isPreHashedSubject,
      role: bodyResult.data.role,
      expirySeconds: bodyResult.data.expirySeconds,
      expiryTimestamp: bodyResult.data.expiryTimestamp,
      ownerSignature: bodyResult.data.ownerSignature as Hex,
      nonce: bodyResult.data.nonce
    });

    return reply.status(201).send({
      data: {
        operator: result,
        message: 'Operator successfully enrolled by merchant owner'
      }
    });
  });

  // DELETE /v1/merchants/:ensName/operators/:operatorAddress (Revoke Operator)
  app.delete('/v1/merchants/:ensName/operators/:operatorAddress', async (req, reply) => {
    const paramsResult = RevokeOperatorParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const bodyResult = RevokeOperatorBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid revocation request body', { issues: bodyResult.error.issues });
    }

    const merchant = await opts.dbStore.findMerchantByName(paramsResult.data.ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.ensName}' not found`);
    }

    await opts.operatorEnrollmentService.revokeOperator(
      {
        merchantId: merchant.id,
        operatorAddress: paramsResult.data.operatorAddress as Address,
        reason: bodyResult.data.reason
      },
      bodyResult.data.callerAddress as Address
    );

    return reply.status(200).send({
      data: {
        operatorAddress: paramsResult.data.operatorAddress,
        status: 'revoked',
        message: 'Operator successfully revoked by merchant owner'
      }
    });
  });
};
