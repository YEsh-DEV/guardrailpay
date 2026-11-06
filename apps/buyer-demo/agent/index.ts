import { createGuardedSigner, PaymentRequest, BuyerPolicy } from '@quoteseal/payee-guard';
import { resolveProfile, EnsMerchantProfile } from '@quoteseal/ens-profile';
import { executeHederaPayment } from '@quoteseal/hedera-x402';
import { createLogger, getHashScanUrl } from '@quoteseal/shared';

const logger = createLogger('BuyerAgent');

export interface AgentRunResult {
  step: string;
  verdict: 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';
  reason: string;
  targetUrl: string;
  payToRequested?: string;
  activePayToOnEns?: string;
  hashScanUrl?: string;
  transactionId?: string;
  signerCalled: boolean;
  contentReceived?: unknown;
}

export async function runAgentPurchase(
  targetUrl = 'http://localhost:3001/api/research/paid',
  options: {
    mockProfile?: EnsMerchantProfile;
    policy?: BuyerPolicy;
  } = {}
): Promise<AgentRunResult> {
  logger.info(`Starting autonomous agent purchase loop for: ${targetUrl}`);

  // Step 1: Initial request to resource
  let response: Response;
  try {
    response = await fetch(targetUrl);
  } catch (err: unknown) {
    logger.error(`Failed to reach endpoint: ${(err as Error).message}`);
    return {
      step: 'FETCH_RESOURCE',
      verdict: 'UNVERIFIABLE',
      reason: `Connection error: ${(err as Error).message}`,
      targetUrl,
      signerCalled: false,
    };
  }

  // Expect HTTP 402 Payment Required
  if (response.status !== 402) {
    const text = await response.text();
    return {
      step: '402_CHALLENGE',
      verdict: 'UNVERIFIABLE',
      reason: `Expected 402, received ${response.status}: ${text}`,
      targetUrl,
      signerCalled: false,
    };
  }

  // Step 2: Parse 402 challenge
  const challengeBody = (await response.json()) as any;
  const payment = challengeBody.payment;

  if (!payment) {
    return {
      step: 'PARSE_CHALLENGE',
      verdict: 'BLOCK',
      reason: 'Malformed 402 challenge: missing payment terms',
      targetUrl,
      signerCalled: false,
    };
  }

  const paymentRequest: PaymentRequest = {
    origin: targetUrl,
    payTo: payment.payTo,
    amount: payment.amount,
    asset: payment.asset || 'HBAR',
    network: payment.network || 'hedera:testnet',
    expiresAt: payment.expiresAt,
    ensName: payment.ensName || 'researchpro.eth',
  };

  logger.info(`Received 402 Payment Challenge: payTo=${paymentRequest.payTo}, amount=${paymentRequest.amount}`);

  // Step 3: Setup guarded signer
  const policy: BuyerPolicy = options.policy || {
    trustedMerchants: ['researchpro.eth'],
    maxAmount: 1000000000n, // 10 HBAR limit
  };

  const guardedSigner = createGuardedSigner(
    async (req: PaymentRequest) => {
      logger.info(`[GUARDED SIGNER INVOKED] Signing payment of ${req.amount} to ${req.payTo}...`);
      return executeHederaPayment({
        network: req.network,
        asset: req.asset,
        payTo: req.payTo,
        amount: String(req.amount),
        serviceEndpoint: req.origin,
        referenceId: `ref_${Date.now()}`,
        expiresAt: req.expiresAt || Math.floor(Date.now() / 1000) + 300,
      });
    },
    {
      resolveProfile: async (key: string) => {
        if (options.mockProfile) return options.mockProfile;
        const mockMap = new Map<string, EnsMerchantProfile>();
        mockMap.set('researchpro.eth', {
          ensName: 'researchpro.eth',
          serviceEndpoint: 'http://localhost:3001',
          hederaNetwork: 'hedera:testnet',
          assetId: 'HBAR',
          activePayTo: '0.0.12345',
          maxAmount: 1000000000n,
          profileVersion: 1,
          rotationStatus: 'none',
        });
        return resolveProfile(key, { mockRegistry: mockMap });
      },
      policy,
    }
  );

  // Step 4: Run PayeeGuard Evaluation and Gated Execution
  const execution = await guardedSigner.execute(paymentRequest);
  logger.info(`PayeeGuard Verdict: ${execution.verdict} | Reason: ${execution.reason}`);

  if (execution.verdict !== 'PASS') {
    logger.warn(`Payment halted! Signer call count = ${execution.signerCallCount}`);
    return {
      step: 'EVALUATE_AND_SIGN',
      verdict: execution.verdict,
      reason: execution.reason,
      targetUrl,
      payToRequested: paymentRequest.payTo,
      activePayToOnEns: '0.0.12345',
      signerCalled: execution.signerCallCount > 0,
    };
  }

  // Step 5: Submit payment proof to retrieve content
  const paymentReceipt = execution.result?.receipt;
  const proof = execution.result?.paymentProof;

  logger.info(`Hedera Payment Settled! HashScan: ${paymentReceipt?.hashScanUrl}`);

  const paidResponse = await fetch(targetUrl, {
    headers: {
      'payment-signature': proof || '',
    },
  });

  const content = await paidResponse.json();
  logger.info(`Successfully retrieved purchased content! Title: ${content.title}`);

  return {
    step: 'COMPLETED',
    verdict: 'PASS',
    reason: execution.reason,
    targetUrl,
    payToRequested: paymentRequest.payTo,
    activePayToOnEns: '0.0.12345',
    hashScanUrl: paymentReceipt?.hashScanUrl,
    transactionId: paymentReceipt?.transactionId,
    signerCalled: true,
    contentReceived: content,
  };
}

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.includes('agent/index.ts')) {
  runAgentPurchase().then((res) => {
    console.log('\n--- Buyer Agent Result ---');
    console.log(JSON.stringify(res, null, 2));
  });
}
