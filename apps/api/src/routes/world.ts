import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ValidationError,
  NotFoundError,
  ProposalStateError,
  OperatorNotEnrolledError,
  OperatorRevokedError,
  UnauthorizedError
} from '@quoteseal/shared';
import type { IWorldOidcService } from '../services/world-oidc.js';
import type { AttestorService } from '../services/attestor.js';
import type { IDbStore } from '../services/db-store.js';

export interface WorldRouteOptions {
  worldOidcService: IWorldOidcService;
  attestorService: AttestorService;
  dbStore: IDbStore;
}

const WorldStartSchema = z.object({
  proposalId: z.string().uuid(),
  operatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const WorldCallbackBodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  proposalHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  mockNonce: z.string().optional() // for deterministic unit tests
});

export const worldRoutes: FastifyPluginAsync<WorldRouteOptions> = async (app, opts) => {
  // POST /v1/world/start (Initiate OIDC flow bound to exact proposal)
  app.post('/v1/world/start', async (req, reply) => {
    const bodyResult = WorldStartSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid request payload', { issues: bodyResult.error.issues });
    }

    const { proposalId, operatorAddress } = bodyResult.data;

    const proposal = await opts.dbStore.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${proposalId}' not found`);
    }

    if (proposal.state !== 'PROPOSED') {
      throw new ProposalStateError(`Cannot initiate World ID step-up for proposal in state '${proposal.state}'`);
    }

    const operator = await opts.dbStore.findOperatorByWallet(proposal.merchantId, operatorAddress);
    if (!operator) {
      throw new OperatorNotEnrolledError(`Operator '${operatorAddress}' is not enrolled for this merchant`);
    }

    if (operator.status !== 'active') {
      throw new OperatorRevokedError(`Operator '${operatorAddress}' is ${operator.status}`);
    }

    if (new Date(operator.expiresAt) <= new Date()) {
      throw new UnauthorizedError(`Operator '${operatorAddress}' enrollment has expired`);
    }

    // Initiate PKCE OIDC session
    const result = await opts.worldOidcService.initiate({
      merchantId: proposal.merchantId,
      operatorId: operator.id,
      proposalId: proposal.id,
      proposalHash: proposal.proposalHash
    });

    return reply.status(200).send({
      data: result
    });
  });

  // POST /v1/world/callback (Handle callback, verify claims, generate EIP-712 attestation)
  app.post('/v1/world/callback', async (req, reply) => {
    const bodyResult = WorldCallbackBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid callback parameters', { issues: bodyResult.error.issues });
    }

    const { code, state, proposalHash, mockNonce } = bodyResult.data;

    // 1. Verify World ID OIDC session, claims, and operator identity
    const verifiedSession = await opts.worldOidcService.handleCallback({
      code,
      state,
      proposalHash,
      mockNonce
    });

    // 2. Generate EIP-712 Attestation signed by QuoteSeal Attestor
    const attestation = await opts.attestorService.signProposalApproval({
      proposalId: verifiedSession.proposalId,
      operatorId: verifiedSession.operatorId,
      authAttemptId: verifiedSession.authAttemptId,
      authTime: verifiedSession.authTime,
      acr: verifiedSession.acr,
      amr: verifiedSession.amr
    });

    return reply.status(200).send({
      data: {
        status: 'VERIFIED',
        session: {
          sessionId: verifiedSession.sessionId,
          proposalId: verifiedSession.proposalId,
          proposalHash: verifiedSession.proposalHash,
          operatorId: verifiedSession.operatorId,
          acr: verifiedSession.acr,
          authTime: verifiedSession.authTime
        },
        attestation: {
          approvalData: {
            ...attestation.approvalData,
            effectiveAt: Number(attestation.approvalData.effectiveAt),
            proposalExpiry: Number(attestation.approvalData.proposalExpiry),
            proposalNonce: Number(attestation.approvalData.proposalNonce),
            authTime: Number(attestation.approvalData.authTime),
            attestationExpiry: Number(attestation.approvalData.attestationExpiry)
          },
          signature: attestation.signature,
          signatureHash: attestation.signatureHash,
          attestorAddress: attestation.attestorAddress
        },
        message: 'World ID OIDC authentication verified; EIP-712 attestation generated successfully'
      }
    });
  });

  // GET /v1/world/callback (Redirect landing from browser)
  app.get('/v1/world/callback', async (req, reply) => {
    const query = req.query as Record<string, string>;
    return reply.status(200).send({
      data: {
        status: 'CALLBACK_RECEIVED',
        code: query['code'] ? '[REDACTED]' : undefined,
        state: query['state'],
        message: 'Send code and state via POST /v1/world/callback with proposalHash to complete token exchange'
      }
    });
  });
};
