import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import {
  createMockDatabase,
  validateEnv,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION
} from '@quoteseal/shared';
import { computeSubjectHmac } from './services/crypto.js';
import { MockWorldOidcService } from './services/world-oidc.js';
import { OperatorEnrollmentService, OPERATOR_ENROLLMENT_TYPES } from './services/operator-enrollment.js';
import { AttestorService } from './services/attestor.js';
import { MockRotationControllerClient } from './services/rotation-controller-client.js';
import { createDbStore } from './services/db-store.js';
import type { EnsProfileResolver, EnsProfileRecord } from '@quoteseal/ens-profile';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import type { Address, Hex } from 'viem';

describe('World OIDC & Payout Rotation Backend (Comprehensive Suite)', () => {
  const env = validateEnv();

  // Test Accounts
  const ownerPrivateKey = generatePrivateKey();
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  const operatorPrivateKey = generatePrivateKey();
  const operatorAccount = privateKeyToAccount(operatorPrivateKey);

  const attestorPrivateKey = generatePrivateKey();
  const attestorAccount = privateKeyToAccount(attestorPrivateKey);

  const attackerPrivateKey = generatePrivateKey();
  const attackerAccount = privateKeyToAccount(attackerPrivateKey);

  const merchantId = '11111111-1111-1111-1111-111111111111';
  const ensName = 'testmerchant.eth';
  const controllerAddress = '0x4444444444444444444444444444444444444444' as Address;
  const resolverAddress = '0x5555555555555555555555555555555555555555' as Address;
  const namehash = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

  let mockDb: ReturnType<typeof createMockDatabase>;
  let dbStore: ReturnType<typeof createDbStore>;
  let mockContractClient: MockRotationControllerClient;
  let mockOidcService: MockWorldOidcService;
  let operatorEnrollmentService: OperatorEnrollmentService;
  let attestorService: AttestorService;
  let app: any;

  const validWorldSubject = 'world_sub_verified_operator_999';
  const validSubjectHmac = computeSubjectHmac(validWorldSubject, env.OPERATOR_SUBJECT_HMAC_SECRET);

  const sampleProfile: EnsProfileRecord = {
    ensName,
    namehash,
    owner: ownerAccount.address,
    resolver: resolverAddress,
    expiry: 1900000000,
    profileVersion: 1,
    activePayTo: '0.0.100001',
    pendingPayTo: null,
    rotationStatus: 'STABLE',
    network: 'hedera:testnet',
    scheme: 'exact',
    assetId: '0.0.0',
    maxAmount: '500000000',
    finalizedBlockNumber: 12000000,
    finalizedBlockHash: '0x1111'
  };

  const mockEnsResolver = {
    resolveProfile: vi.fn().mockResolvedValue(sampleProfile)
  } as unknown as EnsProfileResolver;

  beforeEach(() => {
    mockDb = createMockDatabase();
    dbStore = createDbStore(mockDb);

    // Seed test merchant
    mockDb.merchants.set(merchantId, {
      id: merchantId,
      ensName,
      namehash,
      endpointOrigin: 'https://api.testmerchant.com',
      chainId: env.APPLICATION_CHAIN_ID,
      registryAddress: '0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2',
      resolverAddress,
      controllerAddress,
      ownerAddress: ownerAccount.address,
      nameExpiry: 1900000000,
      profileVersion: 1,
      network: 'hedera:testnet',
      scheme: 'exact',
      assetId: '0.0.0',
      activePayTo: '0.0.100001',
      maxAmount: '500000000',
      status: 'active',
      createdAt: new Date()
    });

    mockContractClient = new MockRotationControllerClient();
    mockContractClient.activePayToValue = '0.0.100001';

    mockOidcService = new MockWorldOidcService(
      {
        issuer: env.WORLD_ID_ISSUER,
        clientId: env.WORLD_ID_CLIENT_ID,
        clientSecret: env.WORLD_ID_CLIENT_SECRET,
        redirectUri: env.WORLD_ID_REDIRECT_URI,
        requiredAcr: 'orb',
        maxAuthAgeSeconds: 120,
        hmacSecret: env.OPERATOR_SUBJECT_HMAC_SECRET,
        encryptionKeyHex: env.ENCRYPTION_KEY_HEX
      },
      dbStore,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any
    );

    operatorEnrollmentService = new OperatorEnrollmentService(
      dbStore,
      {
        issuer: env.WORLD_ID_ISSUER,
        hmacSecret: env.OPERATOR_SUBJECT_HMAC_SECRET,
        chainId: env.APPLICATION_CHAIN_ID
      },
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any
    );

    attestorService = new AttestorService(
      {
        attestorPrivateKey: attestorPrivateKey,
        attestationTtlSeconds: 300,
        maxAuthAgeSeconds: 120,
        chainId: env.APPLICATION_CHAIN_ID
      },
      dbStore,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any
    );

    app = createApp({
      ensResolver: mockEnsResolver,
      dbStore,
      env,
      worldOidcService: mockOidcService,
      operatorEnrollmentService,
      attestorService,
      rotationControllerClient: mockContractClient
    });
  });

  // Helper to generate valid owner EIP-712 signature for operator enrollment
  async function signOperatorEnrollment(operatorAddr: Address, expiry: number, nonce: bigint = 0n): Promise<Hex> {
    return ownerAccount.signTypedData({
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: BigInt(env.APPLICATION_CHAIN_ID),
        verifyingContract: controllerAddress
      },
      types: OPERATOR_ENROLLMENT_TYPES,
      primaryType: 'OperatorEnrollment',
      message: {
        merchantId: namehash,
        operator: operatorAddr,
        role: 1n,
        expiry: BigInt(expiry),
        nonce,
        controller: controllerAddress
      }
    });
  }

  // ===========================================================================
  // 1. OPERATOR ENROLLMENT & REVOCATION TESTS
  // ===========================================================================

  describe('Operator Enrollment & Access Control', () => {
    it('successfully enrolls operator with valid merchant owner EIP-712 signature', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
      const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/operators`,
        payload: {
          walletAddress: operatorAccount.address,
          rawSubjectOrHmac: validWorldSubject,
          isPreHashedSubject: false,
          ownerSignature: ownerSig,
          expiryTimestamp: expiry
        }
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.operator.walletAddress).toBe(operatorAccount.address.toLowerCase());
      expect(json.data.operator.subjectHmac).toBe(validSubjectHmac);
      expect(json.data.operator.status).toBe('active');
    });

    it('rejects operator enrollment with signature from unauthorized non-owner address', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
      // Attacker signs instead of merchant owner
      const fakeSig = await attackerAccount.signTypedData({
        domain: {
          name: EIP712_DOMAIN_NAME,
          version: EIP712_DOMAIN_VERSION,
          chainId: BigInt(env.APPLICATION_CHAIN_ID),
          verifyingContract: controllerAddress
        },
        types: OPERATOR_ENROLLMENT_TYPES,
        primaryType: 'OperatorEnrollment',
        message: {
          merchantId: namehash,
          operator: operatorAccount.address,
          role: 1n,
          expiry: BigInt(expiry),
          nonce: 0n,
          controller: controllerAddress
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/operators`,
        payload: {
          walletAddress: operatorAccount.address,
          rawSubjectOrHmac: validWorldSubject,
          ownerSignature: fakeSig,
          expiryTimestamp: expiry
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('rejects duplicate operator enrollment for already active World ID subject', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
      const ownerSig = await signOperatorEnrollment(operatorAccount.address, expiry);

      // Enroll first
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

      // Attempt duplicate enrollment with valid signature for new address but duplicate World ID subject
      const attackerOwnerSig = await signOperatorEnrollment(attackerAccount.address, expiry);
      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/operators`,
        payload: {
          walletAddress: attackerAccount.address,
          rawSubjectOrHmac: validWorldSubject,
          ownerSignature: attackerOwnerSig,
          expiryTimestamp: expiry
        }
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('CONFLICT');
    });

    it('allows merchant owner to revoke an operator and blocks non-owner revocation', async () => {
      // 1. Enroll operator
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

      // 2. Non-owner attempts revocation -> 401
      const failRes = await app.inject({
        method: 'DELETE',
        url: `/v1/merchants/${ensName}/operators/${operatorAccount.address}`,
        payload: { callerAddress: attackerAccount.address }
      });
      expect(failRes.statusCode).toBe(401);

      // 3. Real owner revokes -> 200 OK
      const successRes = await app.inject({
        method: 'DELETE',
        url: `/v1/merchants/${ensName}/operators/${operatorAccount.address}`,
        payload: { callerAddress: ownerAccount.address, reason: 'Key rotation' }
      });
      expect(successRes.statusCode).toBe(200);
      expect(successRes.json().data.status).toBe('revoked');
    });
  });

  // ===========================================================================
  // 2. ROTATION PROPOSAL & SECURITY GUARDS
  // ===========================================================================

  describe('Rotation Proposal Validation', () => {
    beforeEach(async () => {
      // Pre-enroll operator
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
    });

    it('allows enrolled active operator to propose rotation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.200002',
          operatorAddress: operatorAccount.address
        }
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.proposal.newPayTo).toBe('0.0.200002');
      expect(json.data.proposal.state).toBe('PROPOSED');
      expect(json.data.proposal.proposalHash).toBeDefined();
    });

    it('rejects proposal if sender is not an enrolled operator', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.200002',
          operatorAddress: attackerAccount.address
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('OPERATOR_NOT_ENROLLED');
    });

    it('rejects proposal if proposed newPayTo is identical to activePayTo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.100001', // Identical to active
          operatorAddress: operatorAccount.address
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects direct client attempts to mutate activePayTo (no backdoor endpoint)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/activePayTo`,
        payload: { activePayTo: '0.0.999999' }
      });

      expect(res.statusCode).toBe(404); // Route does not exist
    });
  });

  // ===========================================================================
  // 3. WORLD ID OIDC STEP-UP & ATTACK MITIGATION TESTS
  // ===========================================================================

  describe('World ID OIDC Step-Up & Attack Defenses', () => {
    let proposalId: string;
    let proposalHash: string;

    beforeEach(async () => {
      // 1. Enroll operator
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

      // 2. Propose rotation
      const propRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.200002',
          operatorAddress: operatorAccount.address
        }
      });
      const propJson = propRes.json();
      proposalId = propJson.data.proposal.id;
      proposalHash = propJson.data.proposal.proposalHash;
    });

    it('binds OIDC initiation to exact proposalHash and returns PKCE challenge with max_age=0', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: {
          proposalId,
          operatorAddress: operatorAccount.address
        }
      });

      expect(startRes.statusCode).toBe(200);
      const json = startRes.json();
      expect(json.data.proposalHash).toBe(proposalHash);
      expect(json.data.state).toBeDefined();
      expect(json.data.codeChallenge).toBeDefined();
      expect(json.data.authorizationUrl).toContain('max_age=0');
    });

    it('rejects callback with unknown or mismatched state', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state: 'unrecognized_fake_state_123',
          proposalHash
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('rejects callback when proposalHash does not match session binding', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state } = startRes.json().data;

      const fakeProposalHash = '0x' + 'ff'.repeat(32);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash: fakeProposalHash
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toContain('Proposal hash mismatch');
    });

    it('rejects callback with stale auth_time exceeding maxAuthAge', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      // Mock an ID token where biometric proof was performed 200 seconds ago (max is 120s)
      mockOidcService.setMockClaims({
        sub: validWorldSubject,
        auth_time: Math.floor(Date.now() / 1000) - 200,
        acr: 'orb',
        nonce
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('STALE_AUTHENTICATION');
    });

    it('rejects callback with insufficient verification assurance level (device instead of orb)', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      // Mock an ID token with only phone/device verification (no orb)
      mockOidcService.setMockClaims({
        sub: validWorldSubject,
        acr: 'device',
        amr: ['device'],
        nonce
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toContain('Insufficient World ID verification level');
    });

    it('rejects callback when World ID subject does not match enrolled operator', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      // Attacker authenticates with their own different World ID
      mockOidcService.setMockClaims({
        sub: 'attacker_world_subject_unauthorized_404',
        acr: 'orb',
        nonce
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toContain('World ID subject does not match enrolled operator');
    });

    it('prevents replay attack: consuming an auth state once blocks any reuse', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      mockOidcService.setMockClaims({
        sub: validWorldSubject,
        acr: 'orb',
        auth_time: Math.floor(Date.now() / 1000),
        nonce
      });

      // 1. First callback succeeds and generates EIP-712 attestation
      const res1 = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().data.status).toBe('VERIFIED');
      expect(res1.json().data.attestation.signature).toBeDefined();

      // 2. Replay attempt using identical state is blocked
      const res2 = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'replayed_code',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error.code).toBe('REPLAY_DETECTED');
    });

    it('concurrent callbacks with identical state execute as atomic single-winner (race defense)', async () => {
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      mockOidcService.setMockClaims({
        sub: validWorldSubject,
        acr: 'orb',
        auth_time: Math.floor(Date.now() / 1000),
        nonce
      });

      // Fire 2 concurrent callback requests with identical state
      const [resA, resB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/v1/world/callback',
          payload: { code: 'code_a', state, proposalHash, mockNonce: nonce }
        }),
        app.inject({
          method: 'POST',
          url: '/v1/world/callback',
          payload: { code: 'code_b', state, proposalHash, mockNonce: nonce }
        })
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode].sort();
      // Exactly ONE must succeed (200) and the other must be rejected (409 REPLAY_DETECTED)
      expect(statusCodes).toEqual([200, 409]);
    });
  });

  // ===========================================================================
  // 4. EIP-712 ATTESTATION & ROTATION LIFECYCLE
  // ===========================================================================

  describe('Attestor Service & On-Chain Rotation Lifecycle', () => {
    let proposalId: string;
    let proposalHash: string;

    beforeEach(async () => {
      // 1. Enroll operator
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

      // 2. Propose rotation
      const propRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.200002',
          operatorAddress: operatorAccount.address
        }
      });
      const propJson = propRes.json();
      proposalId = propJson.data.proposal.id;
      proposalHash = propJson.data.proposal.proposalHash;
    });

    it('attestor refuses to sign proposal if proposal state is not PROPOSED', async () => {
      // Force proposal state to ACTIVATED
      await dbStore.updateProposalState(proposalId, 'ACTIVATED');

      const prop = await dbStore.findProposalById(proposalId);
      const op = await dbStore.findOperatorByWallet(prop.merchantId, prop.proposedBy);

      await expect(
        attestorService.signProposalApproval({
          proposalId,
          operatorId: op.id,
          authAttemptId: '00000000-0000-0000-0000-000000000000',
          authTime: Math.floor(Date.now() / 1000),
          acr: 'orb',
          amr: ['orb']
        })
      ).rejects.toThrow('Cannot approve proposal in state');
    });

    it('full rotation lifecycle: propose -> World ID step-up -> approve -> delay -> activate', async () => {
      // 1. Start World ID step-up
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId, operatorAddress: operatorAccount.address }
      });
      const { state, nonce } = startRes.json().data;

      // 2. World ID callback -> generates EIP-712 attestation
      mockOidcService.setMockClaims({
        sub: validWorldSubject,
        acr: 'orb',
        auth_time: Math.floor(Date.now() / 1000),
        nonce
      });

      const callbackRes = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'fresh_code_123',
          state,
          proposalHash,
          mockNonce: nonce
        }
      });
      expect(callbackRes.statusCode).toBe(200);
      const attestation = callbackRes.json().data.attestation;
      expect(attestation.attestorAddress.toLowerCase()).toBe(attestorAccount.address.toLowerCase());

      // 3. Submit approval on-chain
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
      expect(approveRes.json().data.state).toBe('PENDING_APPROVED');

      // 4. Verify Payout Verdict during delay: old is PASS, new is HOLD, unauthorized is BLOCK
      const oldVerdict = await mockContractClient.payoutVerdict(controllerAddress, '0.0.100001');
      expect(oldVerdict).toBe('PASS');

      const newVerdict = await mockContractClient.payoutVerdict(controllerAddress, '0.0.200002');
      expect(newVerdict).toBe('HOLD');

      const attackerVerdict = await mockContractClient.payoutVerdict(controllerAddress, '0.0.666666');
      expect(attackerVerdict).toBe('BLOCK');

      // 5. Attempt early activation before timelock elapses -> fails
      const earlyActivateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });
      expect(earlyActivateRes.statusCode).toBe(502); // ContractExecutionError

      // 6. Fast-forward contract effective time past delay
      mockContractClient.proposal!.effectiveAt = BigInt(Math.floor(Date.now() / 1000) - 10);

      // 7. Activate rotation after delay elapses -> 200 OK
      const activateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });
      expect(activateRes.statusCode).toBe(200);
      expect(activateRes.json().data.state).toBe('ACTIVATED');
      expect(activateRes.json().data.activePayTo).toBe('0.0.200002');
      expect(activateRes.json().data.profileVersion).toBe(2);

      // 8. Verify post-activation Payout Verdict: new is PASS, old is BLOCK
      const postNewVerdict = await mockContractClient.payoutVerdict(controllerAddress, '0.0.200002');
      expect(postNewVerdict).toBe('PASS');

      const postOldVerdict = await mockContractClient.payoutVerdict(controllerAddress, '0.0.100001');
      expect(postOldVerdict).toBe('BLOCK');

      // 9. Repeat activation test: safe idempotent repeat call returns 200 without double-execution
      const repeatActivateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });
      expect(repeatActivateRes.statusCode).toBe(200);
      expect(repeatActivateRes.json().data.state).toBe('ACTIVATED');
      expect(repeatActivateRes.json().data.alreadyActivated).toBe(true);
      expect(repeatActivateRes.json().data.activePayTo).toBe('0.0.200002');
    });

    it('emergency cancellation by guardian or operator cancels proposal and blocks activation', async () => {
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/cancel`,
        payload: {
          callerAddress: operatorAccount.address,
          reasonCode: 'EMERGENCY_CANCEL_SUSPECTED_COMPROMISE'
        }
      });

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.json().data.state).toBe('CANCELLED');

      // Attempting to approve or activate cancelled proposal fails
      const activateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });
      expect(activateRes.statusCode).toBe(409); // ProposalStateError
    });

    it('handles simulated contract revert gracefully with ContractExecutionError', async () => {
      mockContractClient.shouldFailTx = true;
      mockContractClient.failErrorMessage = 'Execution reverted: CustomContractError()';

      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${proposalId}/cancel`,
        payload: {
          callerAddress: operatorAccount.address,
          reasonCode: 'TEST'
        }
      });

      expect(res.statusCode).toBe(502);
      expect(res.json().error.code).toBe('CONTRACT_EXECUTION_FAILED');
    });
  });
});
