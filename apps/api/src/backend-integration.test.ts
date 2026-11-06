import { describe, it, expect, beforeEach } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { createApp } from './app.js';
import { MemoryDbStore } from './services/db-store.js';
import { MockWorldOidcService } from './services/world-oidc.js';
import { OperatorEnrollmentService, OPERATOR_ENROLLMENT_TYPES } from './services/operator-enrollment.js';
import { AttestorService } from './services/attestor.js';
import { MockRotationControllerClient } from './services/rotation-controller-client.js';
import {
  DualRpcClient,
  EnsProfileResolver,
  type IRpcProvider,
  type EnsProfileRecord
} from '@quoteseal/ens-profile';
import {
  GuardEngine,
  createPaymentAttempt,
  type BoundaryInput,
  type TrustSnapshot
} from '@quoteseal/guard';
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  validateEnv,
  type TrustAnchors
} from '@quoteseal/shared';

describe('QuoteSeal Backend Integration Suite (12 Core Verification Scenarios)', () => {
  const merchantOwner = privateKeyToAccount(generatePrivateKey());
  const operatorAccount = privateKeyToAccount(generatePrivateKey());
  const unenrolledAccount = privateKeyToAccount(generatePrivateKey());
  const attestorPrivateKey = generatePrivateKey();
  const attestorAccount = privateKeyToAccount(attestorPrivateKey);

  const ensName = 'acmemerchant.eth';
  const controllerAddress = '0x1000000000000000000000000000000000000001' as Address;
  const resolverAddress = '0x2000000000000000000000000000000000000002' as Address;
  const registryAddress = '0x3000000000000000000000000000000000000003' as Address;

  let dbStore: MemoryDbStore;
  let oidcService: MockWorldOidcService;
  let enrollmentService: OperatorEnrollmentService;
  let attestorService: AttestorService;
  let contractClient: MockRotationControllerClient;
  let guardEngine: GuardEngine;
  let app: any;

  let currentProfile: EnsProfileRecord;
  let trustAnchors: TrustAnchors;
  let rpcProviderPrimary: IRpcProvider;
  let rpcProviderSecondary: IRpcProvider;
  let dualRpcClient: DualRpcClient;
  let ensResolver: EnsProfileResolver;

  const validWorldSubject = 'world_sub_verified_operator_001';

  beforeEach(async () => {
    dbStore = new MemoryDbStore();
    guardEngine = new GuardEngine();

    // Default starting state: payTo is 0.0.123456
    currentProfile = {
      ensName,
      namehash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      owner: merchantOwner.address,
      resolver: resolverAddress,
      expiry: Math.floor(Date.now() / 1000) + 86400 * 365,
      profileVersion: 1,
      activePayTo: '0.0.123456',
      pendingPayTo: null,
      rotationStatus: 'STABLE',
      network: 'hedera:testnet',
      scheme: 'exact',
      assetId: '0.0.0',
      maxAmount: '500000000',
      finalizedBlockNumber: 12000000,
      finalizedBlockHash: '0x1111111111111111111111111111111111111111111111111111111111111111'
    };

    trustAnchors = {
      trustedOwner: merchantOwner.address,
      trustedResolver: resolverAddress,
      trustedExpiry: currentProfile.expiry,
      trustedProfileVersion: 1
    };

    rpcProviderPrimary = {
      getBlockNumber: async () => 12000000n,
      getBlock: async () => ({
        number: 12000000n,
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`
      }),
      readContract: async (params: any) => {
        if (params.functionName === 'owner') return currentProfile.owner;
        if (params.functionName === 'resolver') return currentProfile.resolver;
        if (params.functionName === 'expiry') return BigInt(currentProfile.expiry);
        if (params.functionName === 'text') {
          const key = params.args[1];
          if (key === 'quoteseal.activePayTo') return currentProfile.activePayTo;
          if (key === 'quoteseal.pendingPayTo') return currentProfile.pendingPayTo ?? '';
          if (key === 'quoteseal.rotationStatus') return currentProfile.rotationStatus;
          if (key === 'quoteseal.version') return String(currentProfile.profileVersion);
          if (key === 'quoteseal.network') return currentProfile.network;
          if (key === 'quoteseal.scheme') return currentProfile.scheme;
          if (key === 'quoteseal.asset') return currentProfile.assetId;
          if (key === 'quoteseal.maxAmount') return currentProfile.maxAmount;
        }
        return '';
      }
    };

    rpcProviderSecondary = { ...rpcProviderPrimary };

    dualRpcClient = new DualRpcClient({
      primary: rpcProviderPrimary,
      secondary: rpcProviderSecondary,
      maxBlockDivergenceTolerance: 3
    });

    ensResolver = new EnsProfileResolver({
      dualRpcClient,
      registryAddress
    });

    const config = {
      issuer: 'https://auth.world.org',
      clientId: 'app_quoteseal_integration_test',
      redirectUri: 'http://localhost:4000/v1/world/callback',
      requiredAcr: 'orb',
      maxAuthAgeSeconds: 120,
      hmacSecret: 'sample_32_byte_hmac_secret_for_subject_hashing_min32',
      encryptionKeyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      chainId: 11155111
    };

    oidcService = new MockWorldOidcService(config, dbStore as any);
    enrollmentService = new OperatorEnrollmentService(dbStore, config);
    attestorService = new AttestorService(
      {
        attestorPrivateKey,
        attestationTtlSeconds: 300,
        maxAuthAgeSeconds: 300,
        chainId: 11155111
      },
      dbStore,
      console as any
    );

    contractClient = new MockRotationControllerClient();

    // Register merchant in database
    const merchant: any = {
      id: '11111111-1111-1111-1111-111111111111',
      ensName,
      namehash: currentProfile.namehash,
      endpointOrigin: 'https://acmemerchant.example',
      chainId: 11155111,
      registryAddress,
      resolverAddress,
      ownerAddress: merchantOwner.address,
      nameExpiry: currentProfile.expiry,
      profileVersion: 1,
      network: 'hedera:testnet',
      scheme: 'exact',
      assetId: '0.0.0',
      activePayTo: currentProfile.activePayTo,
      pendingPayTo: null,
      rotationStatus: 'STABLE',
      maxAmount: '500000000',
      status: 'active',
      controllerAddress
    };
    await dbStore.saveMerchant(merchant);

    app = createApp({
      ensResolver,
      rotationControllerClient: contractClient,
      dbStore,
      worldOidcService: oidcService,
      operatorEnrollmentService: enrollmentService,
      attestorService,
      env: {
        ...validateEnv({ NODE_ENV: 'test' }),
        NODE_ENV: 'test',
        APPLICATION_CHAIN_ID: 11155111,
        ROTATION_TIMELOCK_SECONDS: 60,
        ROTATION_CONTROLLER_ADDRESS: controllerAddress
      } as any
    });
    await app.ready();
  });

  async function signOperatorEnrollment(operatorAddr: Address, expiry: number) {
    return await merchantOwner.signTypedData({
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: 11155111n,
        verifyingContract: controllerAddress
      },
      types: OPERATOR_ENROLLMENT_TYPES,
      primaryType: 'OperatorEnrollment',
      message: {
        merchantId: currentProfile.namehash as Hex,
        operator: operatorAddr,
        role: 1n,
        expiry: BigInt(expiry),
        nonce: 0n,
        controller: controllerAddress
      }
    });
  }

  // Helper for buyer pre-signing guard evaluation & Hedera signer attempt
  function runBuyerAttempt(selectedPayTo: string, readTrustProfile: () => EnsProfileRecord | undefined) {
    let calls = 0;
    const rawSigner = {
      accountId: '0.0.42',
      async createPartiallySignedTransferTransaction(_r: any) {
        calls++;
        return 'signed_payload';
      }
    };

    const challenge = {
      x402Version: 2,
      resource: { url: 'https://acmemerchant.example/checkout' },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: '10',
          payTo: selectedPayTo,
          maxTimeoutSeconds: 60,
          extra: { feePayer: '0.0.98' }
        }
      ]
    };

    const boundaryInput: BoundaryInput = {
      originalUrl: 'https://acmemerchant.example/checkout',
      challenge: challenge as any,
      selectedIndex: 0,
      firstSeen: 1000,
      now: () => 1001,
      readTrust: (): TrustSnapshot => ({
        profile: readTrustProfile() as any,
        anchors: {
          owner: trustAnchors.trustedOwner,
          resolver: trustAnchors.trustedResolver,
          expiry: trustAnchors.trustedExpiry,
          version: trustAnchors.trustedProfileVersion
        }
      })
    };

    const attempt = createPaymentAttempt(boundaryInput, rawSigner);
    return { attempt, calls: () => calls };
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Trusted ENS profile -> valid selected x402 requirement -> PASS
  // ---------------------------------------------------------------------------
  it('1. Trusted ENS profile -> valid selected x402 requirement -> PASS', async () => {
    const profile = await ensResolver.resolveProfile(ensName);
    expect(profile.activePayTo).toBe('0.0.123456');

    const evalResult = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.123456',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.123456',
        maxTimeoutSeconds: 60
      },
      ensProfile: profile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });

    expect(evalResult.verdict).toBe('PASS');
    expect(evalResult.allowedSignerInvocation).toBe(true);

    // Verify buyer one-shot guarded signer boundary invokes raw signer once
    const { attempt, calls } = runBuyerAttempt('0.0.123456', () => profile);
    const payload = await attempt.createPaymentPayload();
    expect(calls()).toBe(1);
    expect(payload.accepted.payTo).toBe('0.0.123456');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Modified payTo -> BLOCK
  // ---------------------------------------------------------------------------
  it('2. Modified payTo -> BLOCK', async () => {
    const profile = await ensResolver.resolveProfile(ensName);
    const maliciousPayTo = '0.0.999999';

    const evalResult = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: maliciousPayTo,
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: maliciousPayTo,
        maxTimeoutSeconds: 60
      },
      ensProfile: profile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });

    expect(evalResult.verdict).toBe('BLOCK');
    expect(evalResult.allowedSignerInvocation).toBe(false);
    expect(evalResult.reasonCode).toBe('PAYTO_MISMATCH');

    // Signer boundary must block signing and not call raw signer
    const { attempt, calls } = runBuyerAttempt(maliciousPayTo, () => profile);
    await expect(attempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
    expect(calls()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Resolver or owner drift -> HOLD
  // ---------------------------------------------------------------------------
  it('3. Resolver or owner drift -> HOLD', async () => {
    // Simulate resolver drift in profile
    const driftedProfile = {
      ...currentProfile,
      resolver: '0x9999999999999999999999999999999999999999' as Address
    };

    const evalResult = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.123456',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.123456',
        maxTimeoutSeconds: 60
      },
      ensProfile: driftedProfile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });

    expect(evalResult.verdict).toBe('HOLD');
    expect(evalResult.allowedSignerInvocation).toBe(false);
    expect(evalResult.reasonCode).toBe('ANCHOR_RESOLVER_MISMATCH');

    // Signer boundary rejects
    const { attempt, calls } = runBuyerAttempt('0.0.123456', () => driftedProfile);
    await expect(attempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
    expect(calls()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: RPC disagreement -> UNVERIFIABLE
  // ---------------------------------------------------------------------------
  it('4. RPC disagreement -> UNVERIFIABLE', async () => {
    // Primary and Secondary disagree on block numbers beyond tolerance
    const disagreeingPrimary: IRpcProvider = {
      ...rpcProviderPrimary,
      getBlock: async () => ({
        number: 12000000n,
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111'
      })
    };
    const disagreeingSecondary: IRpcProvider = {
      ...rpcProviderSecondary,
      getBlock: async () => ({
        number: 11999900n, // Divergence = 100 > 3
        hash: '0x2222222222222222222222222222222222222222222222222222222222222222'
      })
    };

    const divergingDualRpc = new DualRpcClient({
      primary: disagreeingPrimary,
      secondary: disagreeingSecondary,
      maxBlockDivergenceTolerance: 3
    });

    const divergingResolver = new EnsProfileResolver({
      dualRpcClient: divergingDualRpc,
      registryAddress
    });

    await expect(divergingResolver.resolveProfile(ensName)).rejects.toThrow(/divergence exceeds tolerance/);

    // Guard evaluated with rpcAgreed: false
    const unverifiableProfile = { ...currentProfile, rpcAgreed: false };
    const { attempt, calls } = runBuyerAttempt('0.0.123456', () => unverifiableProfile as any);
    await expect(attempt.createPaymentPayload()).rejects.toThrow();
    expect(calls()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Valid operator enrollment -> proposal permitted
  // ---------------------------------------------------------------------------
  it('5. Valid operator enrollment -> proposal permitted', async () => {
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);

    // 1. Enroll operator
    const enrollRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });
    expect(enrollRes.statusCode).toBe(201);
    expect(enrollRes.json().data.operator.status).toBe('active');

    // 2. Submit proposal by enrolled operator
    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'REGULAR_KEY_ROTATION'
      }
    });

    expect(propRes.statusCode).toBe(201);
    const body = propRes.json().data;
    expect(body.status).toBe('PROPOSED');
    expect(body.proposedPayTo).toBe('0.0.654321');
    expect(body.proposalHash).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Unenrolled operator -> rejected
  // ---------------------------------------------------------------------------
  it('6. Unenrolled operator -> rejected', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: unenrolledAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'UNAUTHORIZED_ATTEMPT'
      }
    });

    expect(propRes.statusCode).toBe(403);
    expect(propRes.json().error.code).toBe('OPERATOR_NOT_ENROLLED');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: World callback replay -> rejected
  // ---------------------------------------------------------------------------
  it('7. World callback replay -> rejected', async () => {
    // 1. Enroll operator & create proposal
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'REPLAY_TEST'
      }
    });
    const { proposalId, proposalHash } = propRes.json().data;

    // 2. Start OIDC step-up
    const startRes = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId,
        operatorAddress: operatorAccount.address
      }
    });
    expect(startRes.statusCode).toBe(200);
    const { state, nonce } = startRes.json().data;

    // Configure mock claims for successful verification
    oidcService.setMockClaims({
      sub: validWorldSubject,
      iss: 'https://auth.world.org',
      aud: 'app_quoteseal_integration_test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      acr: 'orb',
      amr: ['orb'],
      nonce: 'dummy'
    });

    // 3. First callback consumption succeeds
    const firstCallback = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: {
        code: 'valid_auth_code',
        state,
        proposalHash,
        mockNonce: nonce
      }
    });
    expect(firstCallback.statusCode).toBe(200);

    // 4. Replayed callback fails with 409 REPLAY_DETECTED
    const replayCallback = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: {
        code: 'valid_auth_code',
        state,
        proposalHash,
        mockNonce: nonce
      }
    });
    expect(replayCallback.statusCode).toBe(409);
    expect(replayCallback.json().error.code).toBe('REPLAY_DETECTED');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Proposal hash mismatch -> rejected
  // ---------------------------------------------------------------------------
  it('8. Proposal hash mismatch -> rejected', async () => {
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'HASH_MISMATCH_TEST'
      }
    });
    const { proposalId } = propRes.json().data;

    const startRes = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId,
        operatorAddress: operatorAccount.address
      }
    });
    expect(startRes.statusCode).toBe(200);
    const { state } = startRes.json().data;

    // Attempt callback with different/tampered proposalHash
    const tamperedHash = '0x9999999999999999999999999999999999999999999999999999999999999999';
    const callbackRes = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: {
        code: 'valid_auth_code',
        state,
        proposalHash: tamperedHash
      }
    });

    expect(callbackRes.statusCode).toBe(401);
    expect(callbackRes.json().error.message).toContain('Proposal hash mismatch');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Revoked operator -> cannot obtain approval
  // ---------------------------------------------------------------------------
  it('9. Revoked operator -> cannot obtain approval', async () => {
    // 1. Enroll operator & create proposal
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'REVOKE_TEST'
      }
    });
    const { proposalId, proposalHash } = propRes.json().data;

    const startRes = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId,
        operatorAddress: operatorAccount.address
      }
    });
    expect(startRes.statusCode).toBe(200);
    const { state, nonce } = startRes.json().data;

    // 2. Revoke operator before callback completes
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/v1/merchants/${ensName}/operators/${operatorAccount.address}`,
      payload: {
        callerAddress: merchantOwner.address,
        reason: 'Revocation test'
      }
    });
    expect(revokeRes.statusCode).toBe(200);

    // 3. Attempt to finalize OIDC step-up
    oidcService.setMockClaims({
      sub: validWorldSubject,
      iss: 'https://auth.world.org',
      aud: 'app_quoteseal_integration_test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      acr: 'orb',
      amr: ['orb'],
      nonce: 'dummy'
    });

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: {
        code: 'valid_auth_code',
        state,
        proposalHash,
        mockNonce: nonce
      }
    });
    expect(callbackRes.statusCode).toBe(403);
    expect(callbackRes.json().error.code).toBe('OPERATOR_REVOKED');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Failed contract transaction -> database does not claim activation
  // ---------------------------------------------------------------------------
  it('10. Failed contract transaction -> database does not claim activation', async () => {
    // 1. Setup approved proposal
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'FAIL_TEST'
      }
    });
    const { proposalId, proposalHash } = propRes.json().data;

    const startRes = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId,
        operatorAddress: operatorAccount.address
      }
    });
    expect(startRes.statusCode).toBe(200);
    const { state, nonce } = startRes.json().data;

    oidcService.setMockClaims({
      sub: validWorldSubject,
      iss: 'https://auth.world.org',
      aud: 'app_quoteseal_integration_test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      acr: 'orb',
      amr: ['orb'],
      nonce: 'dummy'
    });

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: { code: 'code', state, proposalHash, mockNonce: nonce }
    });
    expect(callbackRes.statusCode).toBe(200);
    const attestation = callbackRes.json().data.attestation;

    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/approve`,
      payload: {
        signature: attestation.signature,
        approvalData: {
          ...attestation.approvalData,
          effectiveAt: String(attestation.approvalData.effectiveAt),
          proposalExpiry: String(attestation.approvalData.proposalExpiry),
          proposalNonce: String(attestation.approvalData.proposalNonce),
          authTime: String(attestation.approvalData.authTime),
          attestationExpiry: String(attestation.approvalData.attestationExpiry)
        }
      }
    });
    expect(approveRes.statusCode).toBe(200);

    // 2. Configure mock contract to simulate a revert during activation
    contractClient.setShouldRevert(true, 'CustomContractError()');

    // 3. Attempt activation
    const actRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
      payload: { operatorAddress: operatorAccount.address }
    });

    expect(actRes.statusCode).toBe(502);
    expect(actRes.json().error.code).toBe('CONTRACT_EXECUTION_FAILED');

    // 4. Verify database DOES NOT claim activation!
    const proposalInDb = await dbStore.findProposalById(proposalId);
    expect(proposalInDb!.state).toBe('PENDING_APPROVED'); // Still PENDING_APPROVED, not ACTIVATED
    const merchant = await dbStore.findMerchantByName(ensName);
    expect(merchant!.activePayTo).toBe('0.0.123456'); // Old payTo untouched
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Activated rotation -> new payout accepted and old payout rejected
  // ---------------------------------------------------------------------------
  it('11. Activated rotation -> new payout accepted and old payout rejected', async () => {
    // 1. Setup approved proposal
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.654321',
        reasonCode: 'SUCCESSFUL_ACTIVATION'
      }
    });
    const { proposalId, proposalHash } = propRes.json().data;

    const startRes = await app.inject({
      method: 'POST',
      url: '/v1/world/start',
      payload: {
        proposalId,
        operatorAddress: operatorAccount.address
      }
    });
    expect(startRes.statusCode).toBe(200);
    const { state, nonce } = startRes.json().data;

    oidcService.setMockClaims({
      sub: validWorldSubject,
      iss: 'https://auth.world.org',
      aud: 'app_quoteseal_integration_test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      acr: 'orb',
      amr: ['orb'],
      nonce: 'dummy'
    });

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/v1/world/callback',
      payload: { code: 'code', state, proposalHash, mockNonce: nonce }
    });
    expect(callbackRes.statusCode).toBe(200);
    const attestation = callbackRes.json().data.attestation;

    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/approve`,
      payload: {
        signature: attestation.signature,
        approvalData: {
          ...attestation.approvalData,
          effectiveAt: String(attestation.approvalData.effectiveAt),
          proposalExpiry: String(attestation.approvalData.proposalExpiry),
          proposalNonce: String(attestation.approvalData.proposalNonce),
          authTime: String(attestation.approvalData.authTime),
          attestationExpiry: String(attestation.approvalData.attestationExpiry)
        }
      }
    });
    expect(approveRes.statusCode).toBe(200);

    // 2. Activate rotation
    contractClient.setShouldRevert(false);
    contractClient.setBypassTimelock(true);
    const actRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
      payload: { operatorAddress: operatorAccount.address }
    });

    expect(actRes.statusCode).toBe(200);
    const actBody = actRes.json().data;
    expect(actBody.state).toBe('ACTIVATED');
    expect(actBody.activePayTo).toBe('0.0.654321');
    expect(actBody.profileVersion).toBe(2);

    // Update current on-chain mock state to reflect activated payout & version bump
    currentProfile.activePayTo = '0.0.654321';
    currentProfile.profileVersion = 2;
    // Buyer updates pinned version anchor to 2
    trustAnchors.trustedProfileVersion = 2;

    const updatedProfile = await ensResolver.resolveProfile(ensName);
    expect(updatedProfile.activePayTo).toBe('0.0.654321');

    // 3. Buyer evaluates payment to new payout (0.0.654321) -> PASS
    const newEval = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.654321',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.654321',
        maxTimeoutSeconds: 60
      },
      ensProfile: updatedProfile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });
    expect(newEval.verdict).toBe('PASS');

    // 4. Buyer evaluates payment to OLD payout (0.0.123456) -> BLOCK!
    const oldEval = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.123456',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.123456',
        maxTimeoutSeconds: 60
      },
      ensProfile: updatedProfile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });
    expect(oldEval.verdict).toBe('BLOCK');
    expect(oldEval.reasonCode).toBe('PAYTO_MISMATCH');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Cancelled rotation -> old payout remains active
  // ---------------------------------------------------------------------------
  it('12. Cancelled rotation -> old payout remains active', async () => {
    // 1. Setup proposal
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);
    await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/operators`,
      payload: {
        walletAddress: operatorAccount.address,
        rawSubjectOrHmac: validWorldSubject,
        ownerSignature: ownerSig,
        expiryTimestamp: expiry
      }
    });

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals`,
      payload: {
        operatorAddress: operatorAccount.address,
        newPayTo: '0.0.777777',
        reasonCode: 'CANCEL_TEST'
      }
    });
    const { proposalId } = propRes.json().data;

    // 2. Emergency cancel proposal
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/cancel`,
      payload: {
        callerAddress: operatorAccount.address,
        reasonCode: 'EMERGENCY_CANCEL'
      }
    });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().data.state).toBe('CANCELLED');

    // 3. Attempting to activate cancelled proposal is blocked
    const actRes = await app.inject({
      method: 'POST',
      url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
      payload: { operatorAddress: operatorAccount.address }
    });
    expect(actRes.statusCode).toBe(409); // ProposalStateError: Proposal status is 'CANCELLED', expected 'PENDING_APPROVED'

    // 4. Old payout (0.0.123456) remains active and passes guard evaluation
    const profile = await ensResolver.resolveProfile(ensName);
    expect(profile.activePayTo).toBe('0.0.123456');

    const evalResult = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.123456',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.123456',
        maxTimeoutSeconds: 60
      },
      ensProfile: profile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });
    expect(evalResult.verdict).toBe('PASS');

    // Cancelled payout (0.0.777777) is blocked
    const cancelledEval = await guardEngine.evaluate({
      buyerOriginalUrl: 'https://acmemerchant.example/checkout',
      challenge: {
        x402Version: 2,
        resource: { url: 'https://acmemerchant.example/checkout' },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: '0.0.777777',
            maxTimeoutSeconds: 60
          }
        ]
      },
      selectedRequirement: {
        scheme: 'exact',
        network: 'hedera:testnet',
        asset: '0.0.0',
        amount: '10',
        payTo: '0.0.777777',
        maxTimeoutSeconds: 60
      },
      ensProfile: profile,
      trustAnchors,
      buyerMaxAmount: '1000'
    });
    expect(cancelledEval.verdict).toBe('BLOCK');
  });
});
