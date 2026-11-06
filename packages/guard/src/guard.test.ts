import { describe, it, expect } from 'vitest';
import {
  PaymentRequirementSchema,
  PaymentRequiredChallengeSchema,
  type GuardEvaluationRequest,
  type GuardEvaluationResult,
  type IGuardEngine
} from './interfaces.js';

describe('Guard Interfaces & Schemas', () => {
  it('validates a well-formed PaymentRequirement', () => {
    const requirement = {
      scheme: 'exact',
      network: 'hedera:testnet',
      asset: '0.0.0',
      amount: '5000000',
      payTo: '0.0.123456',
      maxTimeoutSeconds: 60
    };

    const parsed = PaymentRequirementSchema.parse(requirement);
    expect(parsed.payTo).toBe('0.0.123456');
    expect(parsed.scheme).toBe('exact');
  });

  it('validates a PaymentRequiredChallenge containing multiple accepts', () => {
    const challenge = {
      x402Version: 2,
      resource: {
        url: 'https://api.merchant.com/v1/resource'
      },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: '5000000',
          payTo: '0.0.123456'
        }
      ]
    };

    const parsed = PaymentRequiredChallengeSchema.parse(challenge);
    expect(parsed.accepts).toHaveLength(1);
    expect(parsed.resource.url).toBe('https://api.merchant.com/v1/resource');
  });

  it('conforms to IGuardEngine evaluation contract', async () => {
    // Contract implementation proof
    const mockGuardEngine: IGuardEngine = {
      evaluate: async (req: GuardEvaluationRequest): Promise<GuardEvaluationResult> => {
        const matches = req.selectedRequirement.payTo === req.ensProfile.activePayTo;
        return {
          verdict: matches ? 'PASS' : 'BLOCK',
          reasonCode: matches ? 'OK' : 'PAYTO_MISMATCH',
          message: matches ? 'Verified' : 'Tampered payTo',
          allowedSignerInvocation: matches,
          evaluatedAt: new Date()
        };
      }
    };

    const dummyRequest: GuardEvaluationRequest = {
      buyerOriginalUrl: 'https://api.merchant.com/v1/resource',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://api.merchant.com/v1/resource' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '5000000',
            payTo: '0.0.123456'
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '5000000',
        payTo: '0.0.123456'
      },
      ensProfile: {
        ensName: 'merchant.eth',
        namehash: '0x1234',
        owner: '0x1111111111111111111111111111111111111111',
        resolver: '0x2222222222222222222222222222222222222222',
        expiry: 1800000000,
        profileVersion: 1,
        activePayTo: '0.0.123456',
        pendingPayTo: null,
        rotationStatus: 'STABLE',
        network: 'hedera:testnet',
        scheme: 'exact',
        assetId: '0.0.0',
        maxAmount: '500000000',
        finalizedBlockNumber: 12000000,
        finalizedBlockHash: '0x1111'
      },
      trustAnchors: {
        trustedOwner: '0x1111111111111111111111111111111111111111',
        trustedResolver: '0x2222222222222222222222222222222222222222',
        trustedExpiry: 1800000000,
        trustedProfileVersion: 1
      },
      buyerMaxAmount: '500000000'
    };

    const result = await mockGuardEngine.evaluate(dummyRequest);
    expect(result.verdict).toBe('PASS');
    expect(result.allowedSignerInvocation).toBe(true);

    // Tampered payTo check
    const tamperedRequest = {
      ...dummyRequest,
      selectedRequirement: {
        ...dummyRequest.selectedRequirement,
        payTo: '0.0.999999'
      }
    };
    const tamperedResult = await mockGuardEngine.evaluate(tamperedRequest);
    expect(tamperedResult.verdict).toBe('BLOCK');
    expect(tamperedResult.allowedSignerInvocation).toBe(false);
  });
});
