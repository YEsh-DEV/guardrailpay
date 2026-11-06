import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  hashTypedData,
  stringToBytes,
  padHex,
  type Address,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from './app.js';
import { LiveRotationControllerClient } from './services/rotation-controller-client.js';
import { AttestorService, ROTATION_APPROVAL_TYPES } from './services/attestor.js';
import { OperatorEnrollmentService, OPERATOR_ENROLLMENT_TYPES } from './services/operator-enrollment.js';
import { MockWorldOidcService } from './services/world-oidc.js';
import { createDbStore } from './services/db-store.js';
import {
  createMockDatabase,
  computeProposalId,
  ROTATION_CONTROLLER_ABI,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION
} from '@quoteseal/shared';
import { EnsProfileResolver } from '@quoteseal/ens-profile';
import {
  GuardEngine,
  createPaymentAttempt,
  type BoundaryInput,
  type TrustSnapshot,
  type PaymentRequirements
} from '@quoteseal/guard';

describe('Real Backend ↔ RotationController Local EVM Integration', () => {
  let anvilProcess: ChildProcess;
  const ANVIL_PORT = 8549;
  const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
  const CHAIN_ID = 31337;

  // Anvil default deterministic test accounts (test-only keys)
  const ownerAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const guardianAccount = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
  const attestorAccount = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
  const operatorAccount = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
  const attackerAccount = privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a');

  let publicClient: ReturnType<typeof createPublicClient>;
  let ownerWallet: ReturnType<typeof createWalletClient>;
  let operatorWallet: ReturnType<typeof createWalletClient>;
  let guardianWallet: ReturnType<typeof createWalletClient>;

  let controllerAddress: Address;
  let resolverAddress: Address;
  let registryAddress: Address;
  let rootAddress: Address;
  let merchantNode: Hex;
  let merchantId: Hex;
  let nameExpiry: bigint;
  let initialDeploymentTxHash: Hex;
  const ensName = 'merchant.eth';

  let app: any;
  let dbStore: any;
  let rotationClient: LiveRotationControllerClient;
  let mockOidcService: MockWorldOidcService;
  let attestorService: AttestorService;
  let operatorService: OperatorEnrollmentService;

  beforeAll(async () => {
    // 1. Spawn local Anvil node (hardfork cancun, port 8549)
    anvilProcess = spawn('anvil', ['--port', String(ANVIL_PORT), '--hardfork', 'cancun', '--silent']);
    await new Promise((r) => setTimeout(r, 1200));

    publicClient = createPublicClient({ transport: http(ANVIL_RPC) });
    ownerWallet = createWalletClient({ account: ownerAccount, transport: http(ANVIL_RPC) });
    operatorWallet = createWalletClient({ account: operatorAccount, transport: http(ANVIL_RPC) });
    guardianWallet = createWalletClient({ account: guardianAccount, transport: http(ANVIL_RPC) });

    // 2. Read compiled contract artifacts (build if not present)
    const contractsDir = resolve(import.meta.dirname, '../../../contracts');
    const outDir = resolve(contractsDir, 'out');
    const rcPath = resolve(outDir, 'RotationController.sol/RotationController.json');
    if (!existsSync(rcPath)) {
      execSync('forge build', { cwd: contractsDir, stdio: 'ignore' });
    }
    const rMockPath = resolve(outDir, 'RotationController.t.sol/ResolverMock.json');
    const regMockPath = resolve(outDir, 'RotationController.t.sol/RegistryMock.json');
    const rootMockPath = resolve(outDir, 'RotationController.t.sol/RootMock.json');

    const rcArt = JSON.parse(readFileSync(rcPath, 'utf8'));
    const rArt = JSON.parse(readFileSync(rMockPath, 'utf8'));
    const regArt = JSON.parse(readFileSync(regMockPath, 'utf8'));
    const rootArt = JSON.parse(readFileSync(rootMockPath, 'utf8'));

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    nameExpiry = nowSeconds + 10_000_000n;

    // 3. Deploy ResolverMock test double
    const rHash = await ownerWallet.deployContract({ abi: rArt.abi, bytecode: rArt.bytecode.object });
    const rReceipt = await publicClient.waitForTransactionReceipt({ hash: rHash });
    resolverAddress = rReceipt.contractAddress!;

    // 4. Deploy RegistryMock test double
    const regHash = await ownerWallet.deployContract({
      abi: regArt.abi,
      bytecode: regArt.bytecode.object,
      args: [resolverAddress, ownerAccount.address, nameExpiry]
    });
    const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash });
    registryAddress = regReceipt.contractAddress!;

    // 5. Deploy RootMock test double
    const rootHash = await ownerWallet.deployContract({
      abi: rootArt.abi,
      bytecode: rootArt.bytecode.object,
      args: [registryAddress]
    });
    const rootReceipt = await publicClient.waitForTransactionReceipt({ hash: rootHash });
    rootAddress = rootReceipt.contractAddress!;

    // 6. Namehash computation: merchant.eth
    const ethNode = keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }],
        [padHex('0x0', { size: 32 }), keccak256(stringToBytes('eth'))]
      )
    );
    merchantNode = keccak256(
      encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [ethNode, keccak256(stringToBytes('merchant'))])
    );
    merchantId = merchantNode;

    // Initial setup in resolver text records
    await ownerWallet.writeContract({
      address: resolverAddress,
      abi: rArt.abi,
      functionName: 'setup',
      args: [merchantNode, 'quoteseal.activePayTo', '0.0.123']
    });
    await ownerWallet.writeContract({
      address: resolverAddress,
      abi: rArt.abi,
      functionName: 'setup',
      args: [merchantNode, 'quoteseal.profileVersion', '1']
    });

    // 7. Deploy REAL RotationController compiled contract
    const config = {
      merchantId,
      owner: ownerAccount.address,
      guardian: guardianAccount.address,
      attestor: attestorAccount.address,
      registry: registryAddress,
      rootRegistry: rootAddress,
      resolver: resolverAddress,
      dnsName: '0x086d65726368616e740365746800' as Hex,
      namehash: merchantNode,
      nameExpiry,
      delay: 90n, // 90 seconds timelock
      maxAuthAge: 120n,
      attestationTTL: 300n,
      initialPayTo: '0.0.123',
      initialProfileVersion: 1n
    };

    const rcHash = await ownerWallet.deployContract({
      abi: rcArt.abi,
      bytecode: rcArt.bytecode.object,
      args: [config]
    });
    const rcReceipt = await publicClient.waitForTransactionReceipt({ hash: rcHash });
    controllerAddress = rcReceipt.contractAddress!;
    initialDeploymentTxHash = rcHash;

    // Point resolver writer to deployed RotationController
    await ownerWallet.writeContract({
      address: resolverAddress,
      abi: rArt.abi,
      functionName: 'configure',
      args: [controllerAddress, '', false, false]
    });

    // 8. Initialize backend API wired directly to local EVM contract
    rotationClient = new LiveRotationControllerClient(publicClient);
    const mockDb = createMockDatabase();
    dbStore = createDbStore(mockDb);

    // Save initial merchant record in database
    await dbStore.saveMerchant({
      id: '00000000-0000-0000-0000-000000000001',
      ensName,
      namehash: merchantNode,
      endpointOrigin: 'https://merchant.example.com',
      chainId: CHAIN_ID,
      registryAddress,
      resolverAddress,
      controllerAddress,
      ownerAddress: ownerAccount.address,
      nameExpiry: Number(nameExpiry),
      profileVersion: 1,
      network: 'hedera:testnet',
      scheme: 'exact',
      assetId: '0.0.0',
      activePayTo: '0.0.123',
      maxAmount: '500000000',
      status: 'active'
    });

    mockOidcService = new MockWorldOidcService(
      {
        issuer: 'https://auth.world.org',
        clientId: 'app_quoteseal_local_test',
        redirectUri: 'http://localhost:4000/v1/world/callback',
        requiredAcr: 'orb',
        maxAuthAgeSeconds: 120,
        clockToleranceSeconds: 60,
        hmacSecret: 'sample_32_byte_hmac_secret_for_subject_hashing_min32',
        encryptionKeyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'
      },
      dbStore
    );

    attestorService = new AttestorService(
      {
        attestorPrivateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        attestationTtlSeconds: 300,
        maxAuthAgeSeconds: 120,
        chainId: CHAIN_ID
      },
      dbStore
    );

    operatorService = new OperatorEnrollmentService(
      dbStore,
      {
        issuer: 'https://auth.world.org',
        hmacSecret: 'sample_32_byte_hmac_secret_for_subject_hashing_min32',
        chainId: CHAIN_ID
      }
    );

    const mockEnsResolver = {
      resolve: async () => ({
        owner: ownerAccount.address,
        resolver: resolverAddress,
        expiry: Number(nameExpiry),
        profileVersion: 1,
        activePayTo: '0.0.123',
        endpointOrigin: 'https://merchant.example.com',
        network: 'hedera:testnet',
        scheme: 'exact',
        assetId: '0.0.0',
        maxAmount: '500000000'
      })
    } as unknown as EnsProfileResolver;

    app = createApp({
      ensResolver: mockEnsResolver,
      rotationControllerClient: rotationClient,
      worldOidcService: mockOidcService,
      attestorService,
      operatorEnrollmentService: operatorService,
      dbStore
    });
  }, 30000);

  afterAll(async () => {
    if (anvilProcess) {
      anvilProcess.kill('SIGTERM');
    }
  });

  describe('Phase 2 — Complete Rotation Lifecycle via Real Contract Adapter', () => {
    it('1 & 2. Initial state: reads active payout directly from deployed controller', async () => {
      // Direct contract calls to deployed RotationController
      const deployedActivePayTo = await publicClient.readContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'activePayTo'
      });
      expect(deployedActivePayTo).toBe('0.0.123');

      const deployedVersion = await publicClient.readContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'profileVersion'
      });
      expect(deployedVersion).toBe(1n);

      // Contract initial payout verdicts: old payout PASS, new payout BLOCK
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.123')).toBe('PASS');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('BLOCK');
    });

    it('Operator enrollment: owner signs EIP-712 enrollment, calls contract on-chain, and syncs DB', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

      // Owner signs OperatorEnrollment typed data
      const ownerSignature = await ownerAccount.signTypedData({
        domain: {
          name: EIP712_DOMAIN_NAME,
          version: EIP712_DOMAIN_VERSION,
          chainId: BigInt(CHAIN_ID),
          verifyingContract: controllerAddress
        },
        types: OPERATOR_ENROLLMENT_TYPES,
        primaryType: 'OperatorEnrollment',
        message: {
          merchantId,
          operator: operatorAccount.address,
          role: 1n,
          expiry: BigInt(expiry),
          nonce: 0n,
          controller: controllerAddress
        }
      });

      // Submit on-chain enrollment via contract client
      const enrollTx = await rotationClient.enrollOperator!(
        controllerAddress,
        {
          merchantId,
          operator: operatorAccount.address,
          role: 1n,
          expiry: BigInt(expiry),
          nonce: 0n,
          controller: controllerAddress
        },
        ownerSignature,
        ownerWallet
      );
      expect(enrollTx).toMatch(/^0x[a-f0-9]{64}$/);

      // Verify operator expiry on-chain
      const isOpActive = await rotationClient.isOperatorActive(controllerAddress, operatorAccount.address);
      expect(isOpActive).toBe(true);

      // Enroll in API database
      const enrollRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/operators`,
        payload: {
          walletAddress: operatorAccount.address,
          rawSubjectOrHmac: 'world_user_sub_operator_1',
          ownerSignature,
          expiryTimestamp: expiry
        }
      });
      expect(enrollRes.statusCode).toBe(201);
    });

    let createdProposalUuid: string;
    let onChainProposalId: Hex;

    it('3, 4, 5, 6. Proposal creation: backend submits proposal to deployed contract, capturing canonical ID', async () => {
      const proposalExpirySeconds = 3600; // 1 hour
      const nowSec = Math.floor(Date.now() / 1000);
      const expectedExpiry = BigInt(nowSec + proposalExpirySeconds);

      // Wire operator wallet for proposeRotation
      const origPropose = rotationClient.proposeRotation.bind(rotationClient);
      rotationClient.proposeRotation = async (cAddr, newPayTo, exp, _w) => {
        return origPropose(cAddr, newPayTo, exp, operatorWallet);
      };

      const res = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals`,
        payload: {
          newPayTo: '0.0.456',
          operatorAddress: operatorAccount.address,
          proposalExpirySeconds
        }
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      createdProposalUuid = json.data.proposal.id;
      onChainProposalId = json.data.proposal.proposalHash;

      // Verify on-chain proposal state
      const onChainState = await rotationClient.getProposalState(controllerAddress);
      expect(onChainState.id).toBe(onChainProposalId);
      expect(onChainState.operator.toLowerCase()).toBe(operatorAccount.address.toLowerCase());
      expect(onChainState.newPayTo).toBe('0.0.456');
      expect(onChainState.state).toBe('PROPOSED');
      expect(onChainState.nonce).toBe(1n);

      // Verify canonical proposal ID construction matches on-chain assigned ID exactly
      const computedId = computeProposalId({
        controllerAddress,
        chainId: CHAIN_ID,
        merchantId,
        proposalNonce: 1n,
        operatorAddress: operatorAccount.address,
        activePayTo: '0.0.123',
        newPayTo: '0.0.456',
        proposalExpiry: onChainState.expiry
      });
      expect(computedId).toBe(onChainProposalId);

      // Verify previewProposalId equality
      const previewId = await rotationClient.previewProposalId!(
        controllerAddress,
        operatorAccount.address,
        '0.0.789',
        expectedExpiry
      );
      expect(previewId).toMatch(/^0x[a-f0-9]{64}$/);
    });

    let attestationData: any;
    let attestationSignature: Hex;

    it('7. EIP-712 approval: World OIDC step-up and on-chain approvalDigest verification', async () => {
      // 1. Initiate OIDC step-up bound to onChainProposalId
      const startRes = await app.inject({
        method: 'POST',
        url: '/v1/world/start',
        payload: { proposalId: createdProposalUuid, operatorAddress: operatorAccount.address }
      });
      expect(startRes.statusCode).toBe(200);
      const { state, nonce } = startRes.json().data;

      // 2. Mock World ID authentication with biometric Orb assurance
      const onChainState = await rotationClient.getProposalState(controllerAddress);
      mockOidcService.setMockClaims({
        sub: 'world_user_sub_operator_1',
        acr: 'orb',
        auth_time: Number(onChainState.proposedAt),
        nonce
      });

      // 3. Callback generates valid EIP-712 attestation binding canonical on-chain timestamps
      const callbackRes = await app.inject({
        method: 'POST',
        url: '/v1/world/callback',
        payload: {
          code: 'valid_code',
          state,
          proposalHash: onChainProposalId,
          mockNonce: nonce
        }
      });

      expect(callbackRes.statusCode).toBe(200);
      const cbData = callbackRes.json().data;
      expect(cbData.status).toBe('VERIFIED');
      expect(cbData.attestation).toBeDefined();

      attestationData = cbData.attestation.approvalData;
      attestationSignature = cbData.attestation.signature;

      // Verify attestation binds proposal effectiveAt exactly per contract requirements
      expect(BigInt(attestationData.effectiveAt)).toBe(onChainState.effectiveAt);
      expect(BigInt(attestationData.proposalNonce)).toBe(onChainState.nonce);
      expect(attestationData.proposalId).toBe(onChainProposalId);

      // Verify exact EIP-712 digest against deployed contract's approvalDigest function
      const onChainDigest = await publicClient.readContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'approvalDigest',
        args: [
          {
            merchantId: attestationData.merchantId,
            proposalId: attestationData.proposalId,
            operator: attestationData.operator,
            resolver: attestationData.resolver,
            namehash: attestationData.namehash,
            oldPayToHash: attestationData.oldPayToHash,
            newPayToHash: attestationData.newPayToHash,
            effectiveAt: BigInt(attestationData.effectiveAt),
            proposalExpiry: BigInt(attestationData.proposalExpiry),
            proposalNonce: BigInt(attestationData.proposalNonce),
            authTime: BigInt(attestationData.authTime),
            attestationExpiry: BigInt(attestationData.attestationExpiry)
          }
        ]
      });

      const localDigest = hashTypedData({
        domain: {
          name: EIP712_DOMAIN_NAME,
          version: EIP712_DOMAIN_VERSION,
          chainId: BigInt(CHAIN_ID),
          verifyingContract: controllerAddress
        },
        types: ROTATION_APPROVAL_TYPES,
        primaryType: 'RotationApproval',
        message: {
          merchantId: attestationData.merchantId,
          proposalId: attestationData.proposalId,
          operator: attestationData.operator,
          resolver: attestationData.resolver,
          namehash: attestationData.namehash,
          oldPayToHash: attestationData.oldPayToHash,
          newPayToHash: attestationData.newPayToHash,
          effectiveAt: BigInt(attestationData.effectiveAt),
          proposalExpiry: BigInt(attestationData.proposalExpiry),
          proposalNonce: BigInt(attestationData.proposalNonce),
          authTime: BigInt(attestationData.authTime),
          attestationExpiry: BigInt(attestationData.attestationExpiry)
        }
      });

      expect(localDigest).toBe(onChainDigest);
    });

    it('8, 9, 10. Approval submission: contract records approval, delay verdict is HOLD for proposed payout', async () => {
      // Submit approval transaction on-chain via operator wallet
      const approveTx = await rotationClient.approveWithAttestation(
        controllerAddress,
        {
          ...attestationData,
          effectiveAt: BigInt(attestationData.effectiveAt),
          proposalExpiry: BigInt(attestationData.proposalExpiry),
          proposalNonce: BigInt(attestationData.proposalNonce),
          authTime: BigInt(attestationData.authTime),
          attestationExpiry: BigInt(attestationData.attestationExpiry)
        },
        attestationSignature,
        operatorWallet
      );
      expect(approveTx).toMatch(/^0x[a-f0-9]{64}$/);

      // Verify on-chain state is now PENDING_APPROVED
      const onChainState = await rotationClient.getProposalState(controllerAddress);
      expect(onChainState.state).toBe('PENDING_APPROVED');

      // Update DB state via approval record
      await dbStore.updateProposalState(createdProposalUuid, 'PENDING_APPROVED', {
        effectiveAt: new Date(Number(onChainState.effectiveAt) * 1000)
      });

      // Payout verdict during delay: active (0.0.123) is PASS, pending (0.0.456) is HOLD, other is BLOCK
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.123')).toBe('PASS');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('HOLD');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.999')).toBe('BLOCK');
    });

    it('11. Delay enforcement: early activation before timelock elapses reverts on-chain', async () => {
      // Attempt activation BEFORE timelock delay has elapsed
      await expect(
        rotationClient.activateRotation(controllerAddress, onChainProposalId, operatorWallet)
      ).rejects.toThrow(/transaction failed|reverted/i);

      // Verify DB proposal state remains PENDING_APPROVED (never falsely claims activated)
      const dbProposal = await dbStore.findProposalById(createdProposalUuid);
      expect(dbProposal.state).toBe('PENDING_APPROVED');

      // Verify on-chain state remains PENDING_APPROVED
      const onChainState = await rotationClient.getProposalState(controllerAddress);
      expect(onChainState.state).toBe('PENDING_APPROVED');
    });

    it('12. Delay elapse alone does NOT activate the payout automatically', async () => {
      // Advance Anvil block time past the 90-second timelock
      const onChainState = await rotationClient.getProposalState(controllerAddress);
      const targetTimestamp = Number(onChainState.effectiveAt) + 10;

      await publicClient.request({
        method: 'evm_setNextBlockTimestamp' as any,
        params: [targetTimestamp]
      });
      await publicClient.request({
        method: 'evm_mine' as any,
        params: []
      });

      // Passing delay alone MUST NOT activate:
      const postTimeState = await rotationClient.getProposalState(controllerAddress);
      expect(postTimeState.state).toBe('PENDING_APPROVED');

      const currentPayTo = await publicClient.readContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'activePayTo'
      });
      expect(currentPayTo).toBe('0.0.123'); // Old payout still active!

      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.123')).toBe('PASS');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('HOLD'); // New payout still HOLD!
    });

    it('13, 14, 15. Explicit activation through backend: active payout changes, old blocked, new authorized', async () => {
      // Wire operator wallet for activate
      const origActivate = rotationClient.activateRotation.bind(rotationClient);
      rotationClient.activateRotation = async (cAddr, pId, _w) => {
        return origActivate(cAddr, pId, operatorWallet);
      };

      // Activate via API
      const activateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${createdProposalUuid}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });

      expect(activateRes.statusCode).toBe(200);
      const json = activateRes.json();
      expect(json.data.state).toBe('ACTIVATED');
      expect(json.data.activePayTo).toBe('0.0.456');
      expect(json.data.profileVersion).toBe(2);
      expect(json.data.alreadyActivated).toBe(false);

      // Verify on-chain contract state
      const postActivateState = await rotationClient.getProposalState(controllerAddress);
      expect(postActivateState.state).toBe('ACTIVATED');

      const onChainPayTo = await publicClient.readContract({
        address: controllerAddress,
        abi: ROTATION_CONTROLLER_ABI,
        functionName: 'activePayTo'
      });
      expect(onChainPayTo).toBe('0.0.456');

      // Verify contract payoutVerdict has flipped:
      // New payout (0.0.456) is now PASS (0)
      // Old payout (0.0.123) is now BLOCK (1)
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('PASS');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.123')).toBe('BLOCK');
    });

    it('16. Repeated activation: safe idempotent repeat-call returns 200 without duplicate tx or revert', async () => {
      // Call activate again on the already ACTIVATED proposal
      const repeatRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${createdProposalUuid}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });

      expect(repeatRes.statusCode).toBe(200);
      const json = repeatRes.json();
      expect(json.data.state).toBe('ACTIVATED');
      expect(json.data.alreadyActivated).toBe(true);
      expect(json.data.message).toContain('already activated');
      expect(json.data.activePayTo).toBe('0.0.456');
    });

    it('17. Emergency cancellation: guardian cancels proposal; cancelled proposal cannot activate', async () => {
      // 1. Propose another rotation
      const { proposalId: secondProposalId } = await rotationClient.proposeRotation(
        controllerAddress,
        '0.0.789',
        BigInt(Math.floor(Date.now() / 1000) + 10000),
        operatorWallet
      );

      const secondUuid = '00000000-0000-0000-0000-000000000002';
      await dbStore.saveProposal({
        id: secondUuid,
        merchantId: '00000000-0000-0000-0000-000000000001',
        oldPayTo: '0.0.456',
        newPayTo: '0.0.789',
        proposalHash: secondProposalId,
        proposalNonce: 2,
        proposedBy: operatorAccount.address.toLowerCase(),
        proposedAt: new Date(),
        effectiveAt: null,
        expiresAt: new Date(Date.now() + 10000 * 1000),
        state: 'PROPOSED',
        activatedTx: null,
        cancelledAt: null
      });

      // Wire guardian wallet for cancel
      const origCancel = rotationClient.cancelPendingRotation.bind(rotationClient);
      rotationClient.cancelPendingRotation = async (cAddr, pId, code, _w) => {
        return origCancel(cAddr, pId, code, guardianWallet);
      };

      // 2. Cancel proposal via API
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${secondUuid}/cancel`,
        payload: {
          callerAddress: guardianAccount.address,
          reasonCode: 'SECURITY_INCIDENT'
        }
      });

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.json().data.state).toBe('CANCELLED');

      // Verify on-chain state is CANCELLED
      const cancelledState = await rotationClient.getProposalState(controllerAddress);
      expect(cancelledState.state).toBe('CANCELLED');

      // 3. Attempting to activate cancelled proposal is rejected (ProposalStateError)
      const failActivateRes = await app.inject({
        method: 'POST',
        url: `/v1/merchants/${ensName}/proposals/${secondUuid}/activate`,
        payload: { operatorAddress: operatorAccount.address }
      });
      expect(failActivateRes.statusCode).toBe(409);

      // Active payout remains 0.0.456; proposed payout 0.0.789 is BLOCK
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('PASS');
      expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.789')).toBe('BLOCK');
    });

    it('18. Expiry, replayed approval, and transaction revert safety', async () => {
      // A. Replay approval on an already approved proposal: reverts with InvalidState()
      await expect(
        rotationClient.approveWithAttestation(
          controllerAddress,
          {
            ...attestationData,
            effectiveAt: BigInt(attestationData.effectiveAt),
            proposalExpiry: BigInt(attestationData.proposalExpiry),
            proposalNonce: BigInt(attestationData.proposalNonce),
            authTime: BigInt(attestationData.authTime),
            attestationExpiry: BigInt(attestationData.attestationExpiry)
          },
          attestationSignature,
          operatorWallet
        )
      ).rejects.toThrow(/transaction failed|reverted/i);

      // B. Attempt invalid approval with fake signature directly to contract
      const fakeSignature = ('0x' + '00'.repeat(65)) as Hex;
      const fakeApproval = {
        merchantId,
        proposalId: onChainProposalId,
        operator: operatorAccount.address,
        resolver: resolverAddress,
        namehash: merchantNode,
        oldPayToHash: keccak256(stringToBytes('0.0.456')),
        newPayToHash: keccak256(stringToBytes('0.0.999')),
        effectiveAt: 1000n,
        proposalExpiry: 2000n,
        proposalNonce: 999n,
        authTime: 1000n,
        attestationExpiry: 1200n
      };

      await expect(
        rotationClient.approveWithAttestation(controllerAddress, fakeApproval, fakeSignature, operatorWallet)
      ).rejects.toThrow(/transaction failed|reverted/i);

      // C. Verify database state for the merchant was NOT corrupted by contract revert
      const merchant = await dbStore.findMerchantByName(ensName);
      expect(merchant.activePayTo).toBe('0.0.456');
      expect(merchant.profileVersion).toBe(2);
    });
  });

  describe('Phase 3 — Payment Authorization Invariants (Guard Engine & Signer Boundary)', () => {
    let guardEngine: GuardEngine;
    let rawSignerCalls = 0;
    const rawSigner = {
      accountId: '0.0.42',
      async createPartiallySignedTransferTransaction(_r: any) {
        rawSignerCalls++;
        return 'signed_tx_bytes';
      }
    };

    const baseChallenge = {
      x402Version: 2,
      resource: { url: 'https://merchant.example.com/checkout', description: 'QuoteSeal Payment Gateway' },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          payTo: '0.0.456',
          amount: '50000000',
          maxTimeoutSeconds: 30,
          extra: { feePayer: '0.0.98' }
        }
      ]
    };

    beforeAll(() => {
      guardEngine = new GuardEngine();
    });

    it('Invariant 1 & 2: PASS invokes controlled raw signer exactly once; non-PASS invokes raw signer 0 times', async () => {
      const initialCalls = rawSignerCalls;

      // 1. Current active payout on deployed contract is 0.0.456
      const validProfile = {
        owner: ownerAccount.address,
        resolver: resolverAddress,
        expiry: Number(nameExpiry),
        profileVersion: 2,
        activePayTo: '0.0.456',
        endpointOrigin: 'https://merchant.example.com',
        network: 'hedera:testnet',
        scheme: 'exact',
        asset: '0.0.0',
        maxAmount: '500000000'
      };

      const pinnedAnchors = {
        trustedOwner: ownerAccount.address,
        trustedResolver: resolverAddress,
        trustedExpiry: Number(nameExpiry),
        trustedProfileVersion: 2
      };

      // Evaluation returns PASS
      const evalResult = await guardEngine.evaluate({
        buyerOriginalUrl: 'https://merchant.example.com/checkout',
        challenge: baseChallenge,
        selectedRequirement: baseChallenge.accepts[0],
        ensProfile: validProfile,
        trustAnchors: pinnedAnchors,
        buyerMaxAmount: '500000000'
      });
      expect(evalResult.verdict).toBe('PASS');
      expect(evalResult.allowedSignerInvocation).toBe(true);

      const boundaryInput: BoundaryInput = {
        originalUrl: 'https://merchant.example.com/checkout',
        challenge: baseChallenge,
        selectedIndex: 0,
        firstSeen: Math.floor(Date.now() / 1000) - 1,
        now: () => Math.floor(Date.now() / 1000),
        readTrust: (): TrustSnapshot => ({
          profile: validProfile,
          anchors: {
            owner: pinnedAnchors.trustedOwner,
            resolver: pinnedAnchors.trustedResolver,
            expiry: pinnedAnchors.trustedExpiry,
            version: pinnedAnchors.trustedProfileVersion
          }
        })
      };

      // PASS invokes raw signer exactly once
      const attemptPass = createPaymentAttempt(boundaryInput, rawSigner);
      await attemptPass.createPaymentPayload();
      expect(rawSignerCalls).toBe(initialCalls + 1);

      // 2. BLOCK (unrecognized payout 0.0.999) invokes raw signer 0 times
      const blockChallenge = {
        ...baseChallenge,
        accepts: [{ ...baseChallenge.accepts[0], payTo: '0.0.999' }]
      };
      const blockInput: BoundaryInput = {
        ...boundaryInput,
        challenge: blockChallenge
      };
      const attemptBlock = createPaymentAttempt(blockInput, rawSigner);
      await expect(attemptBlock.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(rawSignerCalls).toBe(initialCalls + 1); // Zero additional calls!

      // 3. HOLD (version mismatch) invokes raw signer 0 times
      const holdInput: BoundaryInput = {
        ...boundaryInput,
        readTrust: (): TrustSnapshot => ({
          profile: { ...validProfile, profileVersion: 3 },
          anchors: {
            owner: pinnedAnchors.trustedOwner,
            resolver: pinnedAnchors.trustedResolver,
            expiry: pinnedAnchors.trustedExpiry,
            version: pinnedAnchors.trustedProfileVersion // version 2 vs 3
          }
        })
      };
      const attemptHold = createPaymentAttempt(holdInput, rawSigner);
      await expect(attemptHold.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(rawSignerCalls).toBe(initialCalls + 1); // Zero additional calls!

      // 4. UNVERIFIABLE invokes raw signer 0 times
      const unverifiableInput: BoundaryInput = {
        ...boundaryInput,
        readTrust: (): TrustSnapshot => ({
          profile: undefined,
          anchors: {
            owner: pinnedAnchors.trustedOwner,
            resolver: pinnedAnchors.trustedResolver,
            expiry: pinnedAnchors.trustedExpiry,
            version: pinnedAnchors.trustedProfileVersion
          }
        })
      };
      const attemptUnverifiable = createPaymentAttempt(unverifiableInput, rawSigner);
      await expect(attemptUnverifiable.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(rawSignerCalls).toBe(initialCalls + 1); // Zero additional calls!
    });

    it('Invariant 3 & 4: Origin integrity: cross-origin redirect and resource URL overrides are rejected', async () => {
      const callsBefore = rawSignerCalls;

      const validProfile = {
        owner: ownerAccount.address,
        resolver: resolverAddress,
        expiry: Number(nameExpiry),
        profileVersion: 2,
        activePayTo: '0.0.456',
        origin: 'https://merchant.example.com',
        network: 'hedera:testnet',
        scheme: 'exact',
        asset: '0.0.0',
        maxAmount: '500000000'
      };

      const pinnedAnchors = {
        trustedOwner: ownerAccount.address,
        trustedResolver: resolverAddress,
        trustedExpiry: Number(nameExpiry),
        trustedProfileVersion: 2
      };

      // Cross-origin redirect: Buyer was redirected to attacker.example.com
      const crossOriginInput: BoundaryInput = {
        originalUrl: 'https://attacker.example.com/checkout',
        challenge: {
          ...baseChallenge,
          resource: { url: 'https://attacker.example.com/checkout', description: 'Attacker Pay' }
        },
        selectedIndex: 0,
        firstSeen: Math.floor(Date.now() / 1000) - 1,
        now: () => Math.floor(Date.now() / 1000),
        readTrust: (): TrustSnapshot => ({
          profile: validProfile,
          anchors: {
            owner: pinnedAnchors.trustedOwner,
            resolver: pinnedAnchors.trustedResolver,
            expiry: pinnedAnchors.trustedExpiry,
            version: pinnedAnchors.trustedProfileVersion
          }
        })
      };

      const crossOriginAttempt = createPaymentAttempt(crossOriginInput, rawSigner);
      await expect(crossOriginAttempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(rawSignerCalls).toBe(callsBefore); // Zero calls!
    });

    it('Invariant 5: Tamper resistance: later SDK hooks mutating requirement are blocked by final boundary', async () => {
      const callsBefore = rawSignerCalls;

      const validProfile = {
        owner: ownerAccount.address,
        resolver: resolverAddress,
        expiry: Number(nameExpiry),
        profileVersion: 2,
        activePayTo: '0.0.456',
        endpointOrigin: 'https://merchant.example.com',
        network: 'hedera:testnet',
        scheme: 'exact',
        asset: '0.0.0',
        maxAmount: '500000000'
      };

      const pinnedAnchors = {
        trustedOwner: ownerAccount.address,
        trustedResolver: resolverAddress,
        trustedExpiry: Number(nameExpiry),
        trustedProfileVersion: 2
      };

      const boundaryInput: BoundaryInput = {
        originalUrl: 'https://merchant.example.com/checkout',
        challenge: baseChallenge,
        selectedIndex: 0,
        firstSeen: Math.floor(Date.now() / 1000) - 1,
        now: () => Math.floor(Date.now() / 1000),
        readTrust: (): TrustSnapshot => ({
          profile: validProfile,
          anchors: {
            owner: pinnedAnchors.trustedOwner,
            resolver: pinnedAnchors.trustedResolver,
            expiry: pinnedAnchors.trustedExpiry,
            version: pinnedAnchors.trustedProfileVersion
          }
        })
      };

      // Attacking hook attempting to tamper with payTo in-flight
      const maliciousHook = async (c: any) => {
        c.selectedRequirements.payTo = '0.0.666_attacker';
      };

      const tamperedAttempt = createPaymentAttempt(boundaryInput, rawSigner, [maliciousHook]);
      await expect(tamperedAttempt.createPaymentPayload()).rejects.toThrow('QUOTESEAL_REJECTED');
      expect(rawSignerCalls).toBe(callsBefore); // Zero calls! Raw signer never touched!
    });
  });
});
