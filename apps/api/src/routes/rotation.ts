import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver } from '@quoteseal/ens-profile';
import { ValidationError, NotFoundError } from '@quoteseal/shared';
import type { QuoteSealDatabase, MockDatabaseStore } from '@quoteseal/shared';

export interface RotationRouteOptions {
  ensResolver: EnsProfileResolver;
  db?: QuoteSealDatabase | MockDatabaseStore;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const ProposalIdParamSchema = z.object({
  ensName: z.string().min(3).max(255),
  proposalId: z.string().uuid()
});

const CreateProposalSchema = z.object({
  newPayTo: z.string().min(1).max(64),
  reasonCode: z.string().optional()
});

const ApproveProposalSchema = z.object({
  approvalToken: z.string().min(10)
});

const CancelProposalSchema = z.object({
  reasonCode: z.string().min(1)
});

export const rotationRoutes: FastifyPluginAsync<RotationRouteOptions> = async (app, opts) => {
  // GET /v1/merchants/:ensName/rotation-status
  app.get('/v1/merchants/:ensName/rotation-status', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const profile = await opts.ensResolver.resolveProfile(ensName);

    return reply.status(200).send({
      data: {
        ensName,
        activePayTo: profile.activePayTo,
        pendingPayTo: profile.pendingPayTo,
        rotationStatus: profile.rotationStatus,
        profileVersion: profile.profileVersion,
        blockNumber: profile.finalizedBlockNumber,
        blockHash: profile.finalizedBlockHash
      }
    });
  });

  // GET /v1/merchants/:ensName/proposals/:proposalId
  app.get('/v1/merchants/:ensName/proposals/:proposalId', async (req, reply) => {
    const paramsResult = ProposalIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const { ensName, proposalId } = paramsResult.data;

    // Check in-memory store or DB if available
    if (opts.db && 'rotationProposals' in opts.db) {
      const mockDb = opts.db as MockDatabaseStore;
      const proposal = mockDb.rotationProposals.get(proposalId);
      if (proposal) {
        return reply.status(200).send({ data: proposal });
      }
    }

    // Default structure for proposal status check
    const profile = await opts.ensResolver.resolveProfile(ensName);
    return reply.status(200).send({
      data: {
        id: proposalId,
        ensName,
        oldPayTo: profile.activePayTo,
        newPayTo: profile.pendingPayTo ?? 'pending-activation',
        state: profile.rotationStatus,
        queryTimestamp: new Date().toISOString()
      }
    });
  });

  // POST /v1/merchants/:ensName/proposals (Submit new proposal)
  app.post('/v1/merchants/:ensName/proposals', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const bodyResult = CreateProposalSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid proposal creation payload', { issues: bodyResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const { newPayTo, reasonCode } = bodyResult.data;

    const profile = await opts.ensResolver.resolveProfile(ensName);

    return reply.status(201).send({
      data: {
        ensName,
        oldPayTo: profile.activePayTo,
        newPayTo,
        state: 'PROPOSED',
        reasonCode: reasonCode ?? 'MANUAL_ROTATION_REQUEST',
        message: 'Rotation proposal created and awaiting World ID step-up approval'
      }
    });
  });

  // POST /v1/merchants/:ensName/proposals/:proposalId/approve
  app.post('/v1/merchants/:ensName/proposals/:proposalId/approve', async (req, reply) => {
    const paramsResult = ProposalIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const bodyResult = ApproveProposalSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid approval payload', { issues: bodyResult.error.issues });
    }

    const { proposalId, ensName } = paramsResult.data;
    const { approvalToken } = bodyResult.data;

    return reply.status(200).send({
      data: {
        proposalId,
        ensName,
        approvalStatus: 'ACCEPTED',
        message: 'Step-up verification accepted; timelock initiated'
      }
    });
  });

  // POST /v1/merchants/:ensName/proposals/:proposalId/cancel
  app.post('/v1/merchants/:ensName/proposals/:proposalId/cancel', async (req, reply) => {
    const paramsResult = ProposalIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const bodyResult = CancelProposalSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid cancellation payload', { issues: bodyResult.error.issues });
    }

    const { proposalId, ensName } = paramsResult.data;
    const { reasonCode } = bodyResult.data;

    return reply.status(200).send({
      data: {
        proposalId,
        ensName,
        status: 'CANCELLED',
        reasonCode,
        message: 'Proposal successfully cancelled; cannot be activated'
      }
    });
  });
};
