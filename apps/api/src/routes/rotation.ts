import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver } from '@quoteseal/ens-profile';
import {
  ValidationError,
  NotFoundError,
  ProposalStateError,
  UnauthorizedError,
  OperatorNotEnrolledError,
  OperatorRevokedError
} from '@quoteseal/shared';
import type { IDbStore } from '../services/db-store.js';
import type { IRotationControllerClient } from '../services/rotation-controller-client.js';
import type { Address, Hex } from 'viem';

export interface RotationRouteOptions {
  ensResolver: EnsProfileResolver;
  dbStore: IDbStore;
  rotationControllerClient: IRotationControllerClient;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const ProposalIdParamSchema = z.object({
  ensName: z.string().min(3).max(255),
  proposalId: z.string().uuid()
});

const CreateProposalSchema = z
  .object({
    newPayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N').optional(),
    proposedPayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N').optional(),
    operatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    proposalExpirySeconds: z.number().int().positive().default(604800), // 7 days
    reasonCode: z.string().optional()
  })
  .refine((d) => Boolean(d.newPayTo || d.proposedPayTo), {
    message: 'Must provide newPayTo or proposedPayTo'
  })
  .transform((d) => ({
    ...d,
    newPayTo: (d.newPayTo ?? d.proposedPayTo)!
  }));

const SubmitApprovalSchema = z.object({
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  approvalData: z.object({
    merchantId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    proposalId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    operator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    resolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    namehash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    oldPayToHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    newPayToHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    effectiveAt: z.coerce.bigint(),
    proposalExpiry: z.coerce.bigint(),
    proposalNonce: z.coerce.bigint(),
    authTime: z.coerce.bigint(),
    attestationExpiry: z.coerce.bigint()
  })
});

const ActivateProposalSchema = z.object({
  operatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const CancelProposalSchema = z.object({
  callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  reasonCode: z.string().default('MANUAL_CANCELLATION')
});

export const rotationRoutes: FastifyPluginAsync<RotationRouteOptions> = async (app, opts) => {
  // GET /v1/merchants/:ensName/rotation-status
  app.get('/v1/merchants/:ensName/rotation-status', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const { ensName } = paramsResult.data;
    const merchant = await opts.dbStore.findMerchantByName(ensName);
    const profile = await opts.ensResolver.resolveProfile(ensName);

    let contractState = null;
    if (merchant?.controllerAddress) {
      contractState = await opts.rotationControllerClient.getProposalState(merchant.controllerAddress as Address);
    }

    return reply.status(200).send({
      data: {
        ensName,
        activePayTo: profile.activePayTo,
        pendingPayTo: profile.pendingPayTo,
        rotationStatus: contractState?.state ?? profile.rotationStatus,
        profileVersion: profile.profileVersion,
        onChainState: contractState
          ? {
              proposalId: contractState.id,
              state: contractState.state,
              effectiveAt: Number(contractState.effectiveAt),
              expiry: Number(contractState.expiry),
              nonce: Number(contractState.nonce)
            }
          : null,
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

    const { proposalId } = paramsResult.data;
    const proposal = await opts.dbStore.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${proposalId}' not found`);
    }

    const merchant = await opts.dbStore.findMerchantById(proposal.merchantId);
    let contractState = null;
    if (merchant?.controllerAddress) {
      contractState = await opts.rotationControllerClient.getProposalState(merchant.controllerAddress as Address);
    }

    return reply.status(200).send({
      data: {
        proposal,
        contractState,
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
    const { newPayTo, operatorAddress, proposalExpirySeconds, reasonCode } = bodyResult.data;

    const merchant = await opts.dbStore.findMerchantByName(ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${ensName}' not found`);
    }

    // Verify operator is enrolled and active
    const operator = await opts.dbStore.findOperatorByWallet(merchant.id, operatorAddress);
    if (!operator) {
      throw new OperatorNotEnrolledError(`Operator '${operatorAddress}' is not enrolled for this merchant`);
    }

    if (operator.status !== 'active') {
      throw new OperatorRevokedError(`Operator '${operatorAddress}' is ${operator.status}`);
    }

    if (new Date(operator.expiresAt) <= new Date()) {
      throw new UnauthorizedError(`Operator '${operatorAddress}' enrollment has expired`);
    }

    if (newPayTo === merchant.activePayTo) {
      throw new ValidationError('New payout address cannot be identical to active payout address');
    }

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;
    const expiryBigInt = BigInt(Math.floor(Date.now() / 1000) + proposalExpirySeconds);

    // Call on-chain RotationController client
    const { txHash, proposalId: onChainProposalId } = await opts.rotationControllerClient.proposeRotation(
      controllerAddress,
      newPayTo,
      expiryBigInt,
      { account: { address: operatorAddress as Address } }
    );

    const proposalUuid = crypto.randomUUID();
    const proposalRecord = {
      id: proposalUuid,
      merchantId: merchant.id,
      oldPayTo: merchant.activePayTo,
      newPayTo,
      proposalHash: onChainProposalId,
      proposalNonce: 1, // Will increment or align with contract nonce
      proposedBy: operatorAddress.toLowerCase(),
      proposedAt: new Date(),
      effectiveAt: null,
      expiresAt: new Date(Number(expiryBigInt) * 1000),
      state: 'PROPOSED',
      activatedTx: null,
      cancelledAt: null,
      reasonCode: reasonCode ?? 'MANUAL_ROTATION_REQUEST'
    };

    await opts.dbStore.saveProposal(proposalRecord);

    await opts.dbStore.saveAuditEvent({
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      eventType: 'PROPOSAL_CREATED',
      decisionId: proposalUuid,
      proposalId: proposalUuid,
      verdict: 'HOLD',
      reasonCode: 'OK',
      chainId: merchant.chainId,
      blockNumber: 0,
      blockHash: '0x' + '00'.repeat(32),
      txHash,
      metadataJson: { newPayTo, proposedBy: operatorAddress }
    });

    return reply.status(201).send({
      data: {
        proposal: proposalRecord,
        proposalId: proposalRecord.id,
        proposalHash: proposalRecord.proposalHash,
        status: proposalRecord.state,
        proposedPayTo: proposalRecord.newPayTo,
        txHash,
        message: 'Rotation proposed on-chain; awaiting World ID OIDC step-up authorization'
      }
    });
  });

  // POST /v1/merchants/:ensName/proposals/:proposalId/approve
  app.post('/v1/merchants/:ensName/proposals/:proposalId/approve', async (req, reply) => {
    const paramsResult = ProposalIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const bodyResult = SubmitApprovalSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid approval payload', { issues: bodyResult.error.issues });
    }

    const { proposalId, ensName } = paramsResult.data;
    const { signature, approvalData } = bodyResult.data;

    const proposal = await opts.dbStore.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${proposalId}' not found`);
    }

    const merchant = await opts.dbStore.findMerchantByName(ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${ensName}' not found`);
    }

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;

    // Submit EIP-712 approval to on-chain RotationController
    const txHash = await opts.rotationControllerClient.approveWithAttestation(
      controllerAddress,
      approvalData as any,
      signature as Hex,
      { account: { address: approvalData.operator as Address } }
    );

    await opts.dbStore.updateProposalState(proposal.id, 'PENDING_APPROVED', {
      effectiveAt: new Date(Number(approvalData.effectiveAt) * 1000)
    });

    await opts.dbStore.saveAuditEvent({
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      eventType: 'PROPOSAL_APPROVED',
      decisionId: proposal.id,
      proposalId: proposal.id,
      verdict: 'HOLD',
      reasonCode: 'OK',
      chainId: merchant.chainId,
      blockNumber: 0,
      blockHash: '0x' + '00'.repeat(32),
      txHash,
      metadataJson: { effectiveAt: Number(approvalData.effectiveAt) }
    });

    return reply.status(200).send({
      data: {
        proposalId,
        state: 'PENDING_APPROVED',
        effectiveAt: new Date(Number(approvalData.effectiveAt) * 1000).toISOString(),
        txHash,
        message: 'On-chain approval recorded; timelock delay initiated'
      }
    });
  });

  // POST /v1/merchants/:ensName/proposals/:proposalId/activate
  app.post('/v1/merchants/:ensName/proposals/:proposalId/activate', async (req, reply) => {
    const paramsResult = ProposalIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid parameters', { issues: paramsResult.error.issues });
    }

    const bodyResult = ActivateProposalSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid activation payload', { issues: bodyResult.error.issues });
    }

    const { proposalId, ensName } = paramsResult.data;
    const { operatorAddress } = bodyResult.data;

    const proposal = await opts.dbStore.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${proposalId}' not found`);
    }

    const merchant = await opts.dbStore.findMerchantByName(ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${ensName}' not found`);
    }

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;

    // Submit on-chain activation
    const txHash = await opts.rotationControllerClient.activateRotation(
      controllerAddress,
      proposal.proposalHash as Hex,
      { account: { address: operatorAddress as Address } }
    );

    // Update database records
    await opts.dbStore.updateProposalState(proposal.id, 'ACTIVATED', {
      activatedTx: txHash
    });

    // Update merchant activePayTo and bump profileVersion
    const updatedMerchant = {
      ...merchant,
      activePayTo: proposal.newPayTo,
      profileVersion: (merchant.profileVersion ?? 1) + 1
    };
    await opts.dbStore.saveMerchant(updatedMerchant);

    await opts.dbStore.saveAuditEvent({
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      eventType: 'PROPOSAL_ACTIVATED',
      decisionId: proposal.id,
      proposalId: proposal.id,
      verdict: 'PASS',
      reasonCode: 'OK',
      chainId: merchant.chainId,
      blockNumber: 0,
      blockHash: '0x' + '00'.repeat(32),
      txHash,
      metadataJson: { activePayTo: proposal.newPayTo, version: updatedMerchant.profileVersion }
    });

    return reply.status(200).send({
      data: {
        proposalId,
        state: 'ACTIVATED',
        activePayTo: proposal.newPayTo,
        profileVersion: updatedMerchant.profileVersion,
        txHash,
        message: 'Rotation activated successfully on-chain and in database index'
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
    const { callerAddress, reasonCode } = bodyResult.data;

    const proposal = await opts.dbStore.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundError(`Proposal '${proposalId}' not found`);
    }

    const merchant = await opts.dbStore.findMerchantByName(ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${ensName}' not found`);
    }

    const controllerAddress = (merchant.controllerAddress ?? '0x0000000000000000000000000000000000000000') as Address;
    const reasonCodeHex = `0x${Buffer.from(reasonCode.slice(0, 32)).toString('hex').padEnd(64, '0')}` as Hex;

    // Submit emergency cancel to on-chain RotationController
    const txHash = await opts.rotationControllerClient.cancelPendingRotation(
      controllerAddress,
      proposal.proposalHash as Hex,
      reasonCodeHex,
      { account: { address: callerAddress as Address } }
    );

    await opts.dbStore.updateProposalState(proposal.id, 'CANCELLED', {
      cancelledAt: new Date(),
      reasonCode
    });

    await opts.dbStore.saveAuditEvent({
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      eventType: 'PROPOSAL_CANCELLED',
      decisionId: proposal.id,
      proposalId: proposal.id,
      verdict: 'BLOCK',
      reasonCode: 'PROPOSAL_ALREADY_CONSUMED',
      chainId: merchant.chainId,
      blockNumber: 0,
      blockHash: '0x' + '00'.repeat(32),
      txHash,
      metadataJson: { reasonCode, cancelledBy: callerAddress }
    });

    return reply.status(200).send({
      data: {
        proposalId,
        state: 'CANCELLED',
        txHash,
        message: 'Proposal successfully cancelled on-chain; cannot be activated'
      }
    });
  });
};
