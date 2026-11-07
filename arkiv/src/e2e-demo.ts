import { randomUUID } from 'node:crypto';
import { getAddress, type Address, type Hex } from 'viem';
import {
  createArkivReadClient,
  createArkivWalletRiskStateQuery,
  createMerchantRiskPublisher,
  createMvpFixtureRiskReader,
  createTrustedWalletRiskReader,
  loadArkivReadConfig,
  loadArkivWriteConfig,
  type PublicationResult,
  type TrustedWalletRiskLookup,
} from './index.js';
import {
  createGuardedSigner,
  type BuyerPolicy,
  type MerchantProfile,
  type PaymentRequest,
} from '@quoteseal/payee-guard';

export interface DemoWorkflowResult {
  mode: 'LIVE_ARKIV_RABDI' | 'FIXTURE';
  description: string;
  writer: string;
  suspiciousWallet: string;
  cleanWallet: string;
  riskSignal?: {
    entityKey: Hex;
    txHash: Hex;
    expiresAt: string;
    isDuplicate?: boolean;
  };
  walletRiskState?: {
    entityKey: Hex;
    txHash: Hex;
    expiresAt: string;
    action: string;
    status: string;
  };
  merchantBRead: {
    kind: string;
    status?: string;
    entityKey?: string;
    owner?: string;
    expiresAt?: string;
  };
  payeeGuardBlockedEvaluation: {
    verdict: string;
    reason: string;
    signerCallCount: number;
    blocked: boolean;
  };
  payeeGuardAllowedEvaluation?: {
    verdict: string;
    reason: string;
    signerCallCount: number;
    passed: boolean;
  };
  dashboardView: {
    mode: 'live' | 'fixture';
    result: any;
  };
}

export async function runCrossMerchantDemo(): Promise<DemoWorkflowResult> {
  const suspiciousWallet = '0.0.90001';
  const cleanWallet = '0.0.12345';
  const network = 'hedera:testnet';

  const baseProfile: MerchantProfile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    network: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: 1000000000n,
    profileVersion: 1,
    rotationStatus: 'none',
  };

  const buyerPolicy: BuyerPolicy = {
    trustedMerchants: ['researchpro.eth'],
    maxAmount: 500000000n,
  };

  // Try live configuration
  let isLive = false;
  let publisher: ReturnType<typeof createMerchantRiskPublisher> | null = null;
  let writerAddress: Address = '0x1111111111111111111111111111111111111111';

  try {
    const writeConfig = loadArkivWriteConfig();
    publisher = createMerchantRiskPublisher(writeConfig);
    writerAddress = publisher.writer;
    isLive = true;
  } catch (err: unknown) {
    isLive = false;
  }

  if (!isLive || !publisher) {
    // FIXTURE DEMO MODE
    const fixtureReader = createMvpFixtureRiskReader();
    let rawSignerCalled = 0;
    const guarded = createGuardedSigner(
      async () => {
        rawSignerCalled += 1;
        return { success: true };
      },
      {
        resolveProfile: async () => baseProfile,
        policy: buyerPolicy,
        riskReader: fixtureReader,
        getNow: () => 1800000000,
      }
    );

    const paymentBlocked: PaymentRequest = {
      origin: 'https://api.researchpro.com',
      payerWallet: suspiciousWallet,
      payTo: '0.0.12345',
      amount: 100000000n,
      asset: 'HBAR',
      network: 'hedera:testnet',
      ensName: 'researchpro.eth',
    };

    const blockedResult = await guarded.execute(paymentBlocked);
    const lookup = await fixtureReader.getTrustedWalletRiskState({ walletKey: suspiciousWallet, network });

    return {
      mode: 'FIXTURE',
      description: 'Arkiv credentials unavailable. Demonstration running in labeled fixture mode.',
      writer: writerAddress,
      suspiciousWallet,
      cleanWallet,
      merchantBRead: lookup.kind === 'trusted' ? {
        kind: lookup.kind,
        status: lookup.state.status,
        entityKey: lookup.state.entityKey,
        owner: lookup.state.owner,
        expiresAt: lookup.state.expiresAt.toString(),
      } : { kind: lookup.kind },
      payeeGuardBlockedEvaluation: {
        verdict: blockedResult.verdict,
        reason: blockedResult.reason,
        signerCallCount: blockedResult.signerCallCount,
        blocked: blockedResult.verdict === 'BLOCK' && blockedResult.signerCallCount === 0,
      },
      dashboardView: {
        mode: 'fixture',
        result: lookup.kind === 'trusted' ? {
          kind: lookup.kind,
          state: {
            ...lookup.state,
            expiresAt: lookup.state.expiresAt.toString(),
            computedAt: lookup.state.computedAt.toString(),
          },
        } : lookup,
      },
    };
  }

  // LIVE DEMO MODE
  console.log(`[Merchant A] Connected with authorized Rabdi writer: ${writerAddress}`);

  // Step 1: Merchant A publishes synthetic suspicious-wallet record
  const referenceId = `ref-${randomUUID()}`;
  console.log(`[Merchant A] Publishing RiskSignal and WalletRiskState for ${suspiciousWallet}...`);
  const pubResult: PublicationResult = await publisher.reportSuspiciousWallet({
    walletKey: suspiciousWallet,
    network,
    signalCode: 'UNAUTHORIZED_PAYEE',
    severity: 'CRITICAL',
    source: 'merchant-a-detector',
    referenceId,
    status: 'BLOCK',
    score: '1.0',
    policyVersion: 'quoteseal-risk-v1',
    expirationHours: 24,
  });

  console.log(`[Merchant A] Published:
  - RiskSignal Key: ${pubResult.signal.entityKey} (tx: ${pubResult.signal.txHash})
  - WalletRiskState Key: ${pubResult.riskState.entityKey} (tx: ${pubResult.riskState.txHash}, action: ${pubResult.riskState.action})`);

  // Step 2: Merchant B queries Arkiv independently
  console.log(`[Merchant B] Initializing independent reader for trusted writer: ${writerAddress}...`);
  const readConfig = loadArkivReadConfig();
  const readClient = createArkivReadClient(readConfig);
  const query = createArkivWalletRiskStateQuery(readClient, writerAddress);
  const merchantBReader = createTrustedWalletRiskReader(query, writerAddress, { timeoutMs: 3_000, retries: 2 });

  const bLookup: TrustedWalletRiskLookup = await merchantBReader.getTrustedWalletRiskState({
    walletKey: suspiciousWallet,
    network,
  });

  if (bLookup.kind !== 'trusted') {
    throw new Error(`Merchant B failed to retrieve trusted state from Arkiv Rabdi: ${JSON.stringify(bLookup)}`);
  }

  console.log(`[Merchant B] Verified trusted state from Arkiv:
  - Status: ${bLookup.state.status}
  - Entity Key: ${bLookup.state.entityKey}
  - Owner: ${bLookup.state.owner}
  - Expiry Block: ${bLookup.state.expiresAt}`);

  // Step 3: Merchant B runs PayeeGuard before signing simulated payment
  console.log(`[Merchant B] Evaluating simulated payment with PayeeGuard...`);
  let rawSignerCalls = 0;
  const guardedSigner = createGuardedSigner(
    async (req: PaymentRequest) => {
      rawSignerCalls += 1;
      return { simulatedReceipt: `signed_payment_to_${req.payTo}` };
    },
    {
      resolveProfile: async () => baseProfile,
      policy: buyerPolicy,
      riskReader: merchantBReader,
      getNow: () => Math.floor(Date.now() / 1000),
    }
  );

  const paymentToTest: PaymentRequest = {
    origin: 'https://api.researchpro.com',
    payerWallet: suspiciousWallet,
    payTo: '0.0.12345',
    amount: 100000000n,
    asset: 'HBAR',
    network: 'hedera:testnet',
    ensName: 'researchpro.eth',
  };

  const execBlocked = await guardedSigner.execute(paymentToTest);
  console.log(`[Merchant B] PayeeGuard Decision: ${execBlocked.verdict} (reason: ${execBlocked.reason})`);
  console.log(`[Merchant B] rawSigner call count: ${execBlocked.signerCallCount} (underlying: ${rawSignerCalls})`);

  // Step 4: Verify clean wallet allows payment
  console.log(`[Merchant A & B] Verifying clean wallet ${cleanWallet}...`);
  await publisher.upsertWalletRiskState({
    walletKey: cleanWallet,
    network,
    status: 'ALLOW',
    score: '0.0',
    policyVersion: 'quoteseal-risk-v1',
    signalCount: 0n,
    lastSignalAt: 0n,
    expirationHours: 24,
  });

  const paymentClean: PaymentRequest = {
    origin: 'https://api.researchpro.com',
    payerWallet: cleanWallet,
    payTo: '0.0.12345',
    amount: 100000000n,
    asset: 'HBAR',
    network: 'hedera:testnet',
    ensName: 'researchpro.eth',
  };

  const execAllowed = await guardedSigner.execute(paymentClean);
  console.log(`[Merchant B] Clean wallet PayeeGuard Decision: ${execAllowed.verdict} (calls: ${execAllowed.signerCallCount})`);

  return {
    mode: 'LIVE_ARKIV_RABDI',
    description: 'Merchant A published real RiskSignal & WalletRiskState to Arkiv Rabdi; Merchant B queried and PayeeGuard blocked.',
    writer: writerAddress,
    suspiciousWallet,
    cleanWallet,
    riskSignal: {
      entityKey: pubResult.signal.entityKey,
      txHash: pubResult.signal.txHash,
      expiresAt: pubResult.signal.expiresAt.toString(),
      isDuplicate: pubResult.signal.isDuplicate,
    },
    walletRiskState: {
      entityKey: pubResult.riskState.entityKey,
      txHash: pubResult.riskState.txHash,
      expiresAt: pubResult.riskState.expiresAt.toString(),
      action: pubResult.riskState.action,
      status: pubResult.riskState.status,
    },
    merchantBRead: {
      kind: bLookup.kind,
      status: bLookup.state.status,
      entityKey: bLookup.state.entityKey,
      owner: bLookup.state.owner,
      expiresAt: bLookup.state.expiresAt.toString(),
    },
    payeeGuardBlockedEvaluation: {
      verdict: execBlocked.verdict,
      reason: execBlocked.reason,
      signerCallCount: execBlocked.signerCallCount,
      blocked: execBlocked.verdict === 'BLOCK' && execBlocked.signerCallCount === 0,
    },
    payeeGuardAllowedEvaluation: {
      verdict: execAllowed.verdict,
      reason: execAllowed.reason,
      signerCallCount: execAllowed.signerCallCount,
      passed: execAllowed.verdict === 'PASS' && execAllowed.signerCallCount === 1,
    },
    dashboardView: {
      mode: 'live',
      result: {
        kind: 'trusted',
        state: {
          ...bLookup.state,
          expiresAt: bLookup.state.expiresAt.toString(),
          computedAt: bLookup.state.computedAt.toString(),
        },
      },
    },
  };
}

if (process.argv[1]?.includes('e2e-demo')) {
  runCrossMerchantDemo()
    .then((result) => {
      console.log('\n=== CROSS-MERCHANT ARKIV DEMO RESULT ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('Demo failed:', err);
      process.exitCode = 1;
    });
}
