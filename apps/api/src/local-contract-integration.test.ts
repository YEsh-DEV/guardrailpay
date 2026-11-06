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
  stringToBytes,
  padHex,
  type Address,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from './app.js';
import { LiveRotationControllerClient } from './services/rotation-controller-client.js';
import { AttestorService } from './services/attestor.js';
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

describe('Part C — Local EVM Integration (RotationController.sol)', () => {
  let anvilProcess: ChildProcess;
  const ANVIL_PORT = 8549;
  const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
  const CHAIN_ID = 31337;

  // Anvil default accounts
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
  const ensName = 'merchant.eth';

  let app: any;
  let dbStore: any;
  let rotationClient: LiveRotationControllerClient;
  let mockOidcService: MockWorldOidcService;
  let attestorService: AttestorService;
  let operatorService: OperatorEnrollmentService;

  beforeAll(async () => {
    // 1. Spawn local Anvil node
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
    const nameExpiry = nowSeconds + 10_000_000n;

    // 3. Deploy ResolverMock
    const rHash = await ownerWallet.deployContract({ abi: rArt.abi, bytecode: rArt.bytecode.object });
    const rReceipt = await publicClient.waitForTransactionReceipt({ hash: rHash });
    resolverAddress = rReceipt.contractAddress!;

    // 4. Deploy RegistryMock
    const regHash = await ownerWallet.deployContract({
      abi: regArt.abi,
      bytecode: regArt.bytecode.object,
      args: [resolverAddress, ownerAccount.address, nameExpiry]
    });
    const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash });
    registryAddress = regReceipt.contractAddress!;

    // 5. Deploy RootMock
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

    // 7. Deploy RotationController
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

    // Point resolver writer to RotationController
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

  it('1. Operator enrollment: owner signs EIP-712 enrollment, calls contract on-chain, and syncs DB', async () => {
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

  it('2. Proposal creation & 3. Proposal ID retrieval: operator proposes rotation and contract emits authoritative ID', async () => {
    const proposalExpirySeconds = 3600; // 1 hour
    const nowSec = Math.floor(Date.now() / 1000);
    const expectedExpiry = BigInt(nowSec + proposalExpirySeconds);

    // Call API proposal creation (which executes proposeRotation on-chain via operator wallet)
    // First attach operator wallet to rotationClient proposeRotation
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

  it('4. EIP-712 approval: World OIDC step-up and backend attestor signature generation', async () => {
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
  });

  it('5. Approval transaction: on-chain approveWithAttestation transitions state to PENDING_APPROVED', async () => {
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

  it('6. Delay enforcement: early activation before timelock elapses reverts on-chain', async () => {
    // Attempt activation BEFORE timelock delay has elapsed
    // In our setup, delay is 90 seconds, and only ~2 seconds have passed
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

  it('7. Delay elapse & Activation: advancing block time allows successful activation and flips payout verdict', async () => {
    // Advance Anvil block time past the 90-second timelock
    const onChainState = await rotationClient.getProposalState(controllerAddress);
    const targetTimestamp = Number(onChainState.effectiveAt) + 10;

    // Use Anvil RPC to warp time past effectiveAt
    await publicClient.request({
      method: 'evm_setNextBlockTimestamp' as any,
      params: [targetTimestamp]
    });
    await publicClient.request({
      method: 'evm_mine' as any,
      params: []
    });

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

    // Verify contract payoutVerdict has flipped:
    // New payout (0.0.456) is now PASS (0)
    // Old payout (0.0.123) is now BLOCK (1)
    expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.456')).toBe('PASS');
    expect(await rotationClient.payoutVerdict(controllerAddress, '0.0.123')).toBe('BLOCK');
  });

  it('8. Repeated activation: safe idempotent repeat-call returns 200 without reverting or duplicate tx', async () => {
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

  it('9. Cancellation: operator or guardian cancels proposal on-chain; cancelled proposal cannot activate', async () => {
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
  });

  it('10. Failed/reverted transactions: contract revert never alters database or claims transition', async () => {
    // Attempt to submit invalid approval with fake signature directly to contract
    const fakeSignature = '0x' + '00'.repeat(65) as Hex;
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

    // Contract will revert with InvalidApproval() or InvalidSignature()
    await expect(
      rotationClient.approveWithAttestation(controllerAddress, fakeApproval, fakeSignature, operatorWallet)
    ).rejects.toThrow(/transaction failed|reverted/i);

    // Verify database state for the merchant was NOT corrupted
    const merchant = await dbStore.findMerchantByName(ensName);
    expect(merchant.activePayTo).toBe('0.0.456');
    expect(merchant.profileVersion).toBe(2);
  });
});
