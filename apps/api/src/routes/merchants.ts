import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type EnsProfileResolver, verifyTrustAnchors } from '@quoteseal/ens-profile';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  EIP712_ONBOARDING_TYPES,
  type AddressSchema,
  type Hex32Schema
} from '@quoteseal/shared';
import type { IDbStore } from '../services/db-store.js';
import type { OperatorEnrollmentService } from '../services/operator-enrollment.js';
import { DomainVerificationService } from '../services/domain-verification.js';
import { verifyTypedData, type Address, type Hex } from 'viem';

export interface MerchantsRouteOptions {
  ensResolver: EnsProfileResolver;
  dbStore: IDbStore;
  operatorEnrollmentService: OperatorEnrollmentService;
  domainVerificationService?: DomainVerificationService;
  chainId?: number;
  controllerAddress?: Address;
}

const EnsNameParamSchema = z.object({
  ensName: z.string().min(3).max(255)
});

const MerchantIdentifierParamSchema = z.object({
  merchantId: z.string().min(1).max(255)
});

const RequestNonceSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be valid Ethereum address'),
  endpointOrigin: z.string().url('Must be valid URL')
});

const LegacyOnboardRequestSchema = z.object({
  ensName: z.string().min(3).max(255),
  endpointOrigin: z.string().url(),
  activePayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  maxAmount: z.string().default('500000000'),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

const NativeOnboardRequestSchema = z.object({
  ownerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  endpointOrigin: z.string().url(),
  domain: z.string().min(1).max(255),
  activePayTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  maxAmount: z.string().default('500000000'),
  nonce: z.string().min(16),
  action: z.literal('ONBOARD_MERCHANT').default('ONBOARD_MERCHANT'),
  expiresAt: z.number().int().positive(),
  ownerSignature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  challengeType: z.enum(['DNS_TXT', 'HTTPS_WELL_KNOWN']).default('DNS_TXT')
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

const VerifyDomainBodySchema = z.object({
  challengeId: z.string().uuid().optional()
});

const AddPayoutWalletBodySchema = z.object({
  payTo: z.string().regex(/^0\.0\.[1-9][0-9]*$/, 'Must be canonical Hedera account format 0.0.N'),
  label: z.string().max(128).optional()
});

export const merchantRoutes: FastifyPluginAsync<MerchantsRouteOptions> = async (app, opts) => {
  const domainVerificationService =
    opts.domainVerificationService ?? new DomainVerificationService(opts.dbStore);
  const chainId = opts.chainId ?? 11155111;
  const verifyingContract = opts.controllerAddress ?? ('0x0000000000000000000000000000000000000000' as Address);

  // Helper to resolve merchant record by id, ensName, or domain
  async function resolveMerchantRecord(idOrName: string) {
    let merchant = await opts.dbStore.findMerchantById(idOrName);
    if (!merchant) {
      merchant = await opts.dbStore.findMerchantByName(idOrName);
    }
    if (!merchant) {
      merchant = await opts.dbStore.findMerchantByIdentity('QUOTESEAL_NATIVE', idOrName);
    }
    return merchant;
  }

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

  // POST /v1/merchants/onboard/nonce
  app.post('/v1/merchants/onboard/nonce', async (req, reply) => {
    const bodyResult = RequestNonceSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid nonce request payload', {
        issues: bodyResult.error.issues
      });
    }

    const { walletAddress, endpointOrigin } = bodyResult.data;
    const nonce = `qs_nonce_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    await opts.dbStore.saveOnboardingNonce({
      nonce,
      merchantId: null,
      walletAddress: walletAddress.toLowerCase(),
      endpointOrigin,
      expiresAt,
      consumedAt: null,
      createdAt: now
    });

    return reply.status(200).send({
      data: {
        nonce,
        expiresAt: expiresAt.toISOString(),
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract
        },
        types: EIP712_ONBOARDING_TYPES
      }
    });
  });

  // POST /v1/merchants/onboard
  app.post('/v1/merchants/onboard', async (req, reply) => {
    // 1. Try parsing as Native Onboarding payload
    const nativeResult = NativeOnboardRequestSchema.safeParse(req.body);
    if (nativeResult.success) {
      const payload = nativeResult.data;

      // Check nonce exists
      const nonceRecord = await opts.dbStore.findOnboardingNonce(payload.nonce);
      if (!nonceRecord) {
        throw new UnauthorizedError('Onboarding nonce not found or invalid');
      }

      if (nonceRecord.consumedAt) {
        throw new UnauthorizedError('Onboarding nonce has already been consumed (replay defense)');
      }

      if (new Date() > new Date(nonceRecord.expiresAt)) {
        throw new UnauthorizedError('Onboarding nonce has expired');
      }

      // Verify nonce binding
      if (nonceRecord.walletAddress.toLowerCase() !== payload.ownerWallet.toLowerCase()) {
        throw new ValidationError('Nonce was not issued for this wallet address');
      }
      if (nonceRecord.endpointOrigin !== payload.endpointOrigin) {
        throw new ValidationError('Nonce was not issued for this endpoint origin');
      }

      // Verify payload timestamp
      if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new ValidationError('Onboarding payload expiration timestamp has already passed');
      }

      // Verify EIP-712 Typed Signature
      const isValid = await verifyTypedData({
        address: payload.ownerWallet as Address,
        domain: {
          name: 'QuoteSeal',
          version: '1',
          chainId,
          verifyingContract
        },
        types: EIP712_ONBOARDING_TYPES,
        primaryType: 'MerchantOnboarding',
        message: {
          ownerWallet: payload.ownerWallet as Address,
          endpointOrigin: payload.endpointOrigin,
          domain: payload.domain,
          activePayTo: payload.activePayTo,
          maxAmount: payload.maxAmount,
          nonce: payload.nonce,
          action: payload.action,
          expiresAt: BigInt(payload.expiresAt)
        },
        signature: payload.ownerSignature as Hex
      });

      if (!isValid) {
        throw new UnauthorizedError('Invalid owner EIP-712 signature for merchant onboarding');
      }

      // Atomically consume nonce
      const consumed = await opts.dbStore.consumeOnboardingNonce(payload.nonce);
      if (!consumed) {
        throw new UnauthorizedError('Onboarding nonce has already been consumed (replay defense)');
      }

      // Check if active merchant with domain already exists
      const existing = await opts.dbStore.findMerchantByIdentity('QUOTESEAL_NATIVE', payload.domain);
      if (existing && existing.status === 'active') {
        throw new ValidationError(`Merchant domain '${payload.domain}' is already actively onboarded`);
      }

      const merchantId = existing ? existing.id : crypto.randomUUID();
      const merchantRecord = {
        id: merchantId,
        identityType: 'QUOTESEAL_NATIVE',
        identityRef: payload.domain,
        ensName: null,
        namehash: null,
        endpointOrigin: payload.endpointOrigin,
        chainId,
        registryAddress: '0x0000000000000000000000000000000000000000',
        resolverAddress: '0x0000000000000000000000000000000000000000',
        controllerAddress: opts.controllerAddress ?? null,
        ownerAddress: payload.ownerWallet.toLowerCase(),
        nameExpiry: 0,
        profileVersion: 1,
        network: 'hedera:testnet',
        scheme: 'exact',
        assetId: '0.0.0',
        activePayTo: payload.activePayTo,
        maxAmount: payload.maxAmount,
        status: 'PENDING_ONBOARDING_CHALLENGE',
        domain: payload.domain,
        domainVerifiedAt: null,
        domainChallenge: null,
        createdAt: new Date()
      };

      await opts.dbStore.saveMerchant(merchantRecord);

      // Register initial payout wallet in operational store
      await opts.dbStore.savePayoutWallet({
        id: crypto.randomUUID(),
        merchantId,
        payTo: payload.activePayTo,
        isActive: true,
        status: 'PENDING',
        label: 'Primary Operational Payout',
        enrolledAt: new Date(),
        revokedAt: null
      });

      // Initiate domain challenge
      const challenge = await domainVerificationService.initiateChallenge(
        merchantId,
        payload.domain,
        payload.challengeType
      );

      return reply.status(201).send({
        data: {
          merchantId,
          identityType: 'QUOTESEAL_NATIVE',
          domain: payload.domain,
          endpointOrigin: payload.endpointOrigin,
          activePayTo: payload.activePayTo,
          status: 'PENDING_ONBOARDING_CHALLENGE',
          challenge: {
            id: challenge.id,
            challengeType: challenge.challengeType,
            token: challenge.token,
            dnsRecordName: `_quoteseal-challenge.${challenge.domain}`,
            dnsRecordValue: `quoteseal-verification=${challenge.token}`,
            wellKnownUrl: `https://${challenge.domain}/.well-known/quoteseal-challenge.json`,
            expiresAt: challenge.expiresAt
          },
          message: 'Native merchant onboarded. Complete domain verification to proceed.'
        }
      });
    }

    // 2. Fallback to Legacy / ENS Onboarding payload
    const legacyResult = LegacyOnboardRequestSchema.safeParse(req.body);
    if (!legacyResult.success) {
      throw new ValidationError('Invalid merchant onboarding request payload', {
        issues: [...nativeResult.error.issues, ...legacyResult.error.issues]
      });
    }

    const payload = legacyResult.data;
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

  // POST /v1/merchants/:merchantId/verify-domain
  app.post('/v1/merchants/:merchantId/verify-domain', async (req, reply) => {
    const paramsResult = MerchantIdentifierParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid merchant identifier', { issues: paramsResult.error.issues });
    }

    const merchant = await resolveMerchantRecord(paramsResult.data.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.merchantId}' not found`);
    }

    const bodyResult = VerifyDomainBodySchema.safeParse(req.body ?? {});
    const challengeId = bodyResult.success ? bodyResult.data.challengeId : undefined;

    const result = await domainVerificationService.verifyMerchantDomain(merchant.id, challengeId);
    if (!result.verified) {
      return reply.status(422).send({
        error: {
          name: 'DomainVerificationFailedError',
          code: 'DOMAIN_VERIFICATION_FAILED',
          message: result.message,
          statusCode: 422,
          details: { challengeId: result.challengeId }
        }
      });
    }

    return reply.status(200).send({
      data: {
        merchantId: merchant.id,
        domain: merchant.domain,
        verified: true,
        verifiedAt: result.verifiedAt,
        status: 'ONBOARDED_UNCOMMITTED',
        message: 'Domain verification successful. Merchant identity anchored.'
      }
    });
  });

  // GET /v1/merchants/:merchantId/payout-wallets
  app.get('/v1/merchants/:merchantId/payout-wallets', async (req, reply) => {
    const paramsResult = MerchantIdentifierParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid merchant identifier', { issues: paramsResult.error.issues });
    }

    const merchant = await resolveMerchantRecord(paramsResult.data.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.merchantId}' not found`);
    }

    const wallets = await opts.dbStore.listPayoutWallets(merchant.id);
    return reply.status(200).send({
      data: {
        merchantId: merchant.id,
        identityType: merchant.identityType,
        identityRef: merchant.identityRef,
        wallets: wallets.map((w) => ({
          id: w.id,
          payTo: w.payTo,
          isActive: w.isActive,
          status: w.status,
          label: w.label,
          enrolledAt: w.enrolledAt,
          revokedAt: w.revokedAt
        }))
      }
    });
  });

  // POST /v1/merchants/:merchantId/payout-wallets (Enroll Multi-Payout Wallet)
  app.post('/v1/merchants/:merchantId/payout-wallets', async (req, reply) => {
    const paramsResult = MerchantIdentifierParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid merchant identifier', { issues: paramsResult.error.issues });
    }

    const merchant = await resolveMerchantRecord(paramsResult.data.merchantId);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.merchantId}' not found`);
    }

    const bodyResult = AddPayoutWalletBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new ValidationError('Invalid payout wallet payload', { issues: bodyResult.error.issues });
    }

    const walletId = crypto.randomUUID();
    const newWallet = {
      id: walletId,
      merchantId: merchant.id,
      payTo: bodyResult.data.payTo,
      isActive: false, // Operational addition is not active until on-chain rotation
      status: 'PENDING',
      label: bodyResult.data.label ?? 'Alternate Operational Payout',
      enrolledAt: new Date(),
      revokedAt: null
    };

    await opts.dbStore.savePayoutWallet(newWallet);

    return reply.status(201).send({
      data: {
        wallet: newWallet,
        message: 'Payout wallet registered in operational storage. Requires on-chain rotation to activate.'
      }
    });
  });

  // GET /v1/merchants/:ensName/operators
  app.get('/v1/merchants/:ensName/operators', async (req, reply) => {
    const paramsResult = EnsNameParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      throw new ValidationError('Invalid ENS name parameter', { issues: paramsResult.error.issues });
    }

    const merchant = await resolveMerchantRecord(paramsResult.data.ensName);
    if (!merchant) {
      throw new NotFoundError(`Merchant '${paramsResult.data.ensName}' not found`);
    }

    const operatorList = await opts.dbStore.listOperators(merchant.id);
    return reply.status(200).send({
      data: {
        ensName: merchant.ensName ?? merchant.identityRef,
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

    const merchant = await resolveMerchantRecord(paramsResult.data.ensName);
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

    const merchant = await resolveMerchantRecord(paramsResult.data.ensName);
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
