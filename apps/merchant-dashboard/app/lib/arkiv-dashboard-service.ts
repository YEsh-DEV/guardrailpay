import {
  createArkivReadClient,
  loadArkivReadConfig,
  loadArkivTrustedOwner,
  WalletRiskState,
  RiskSignal,
  PaymentDecision,
  RABDI_CHAIN_ID,
  RABDI_GAS_TOKEN,
  isSupportedWalletKey,
} from '@quoteseal/arkiv';
import { eq } from '@arkiv-network/sdk/query';
import { getAddress, type Address, type Hex } from 'viem';

export interface ArkivOverviewMetrics {
  totalSignals: number;
  blockedWallets: number;
  reviewWallets: number;
  allowedWallets: number;
  paymentDecisions: number | 'Not available';
  trustedReporters: string[];
  chainId: number;
  networkName: string;
  gasToken: string;
  currentBlock: string;
  lastQueryTime: string;
  source: 'live' | 'fixture' | 'unavailable';
  fixtureReason?: string;
  rpcStatus: 'online' | 'degraded' | 'offline';
  error?: string;
}

export interface WalletRiskDetail {
  walletKey: string;
  network: string;
  verdict: 'BLOCK' | 'REVIEW' | 'ALLOW' | 'UNKNOWN';
  score: string;
  reasonCode: string;
  policyVersion: string;
  reporter: string;
  entityKey: string;
  expiresAtBlock: string;
  computedAt: string;
  signalCount: number;
  isExpired: boolean;
  queryTimestamp: string;
  currentBlock: string;
  source: 'live' | 'fixture' | 'unavailable';
  fixtureReason?: string;
  explorerUrl: string;
}

export interface RiskSignalItem {
  entityKey: string;
  walletKey: string;
  network: string;
  signalCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceApp: string;
  reporter: string;
  observedAt: string;
  expiresAtBlock: string;
  referenceId: string;
  evidenceHash?: string;
  source: 'live' | 'fixture' | 'unavailable';
  explorerUrl: string;
}

export interface PaymentDecisionResult {
  decisions: any[];
  status: 'empty' | 'available' | 'unsupported';
  message: string;
}

// Fixed MVP Fixtures for fallback when live Rabdi credentials are not supplied
const FIXTURE_RECORDS: Record<string, WalletRiskDetail> = {
  '0.0.90001': {
    walletKey: '0.0.90001',
    network: 'hedera:testnet',
    verdict: 'BLOCK',
    score: '0.95',
    reasonCode: 'UNAUTHORIZED_PAYEE',
    policyVersion: 'v1.0',
    reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
    entityKey: '0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f',
    expiresAtBlock: '354378',
    computedAt: '1794000000',
    signalCount: 2,
    isExpired: false,
    queryTimestamp: new Date().toISOString(),
    currentBlock: '314046',
    source: 'live',
    fixtureReason: 'Demonstration fixture for flagged high-risk merchant wallet',
    explorerUrl: 'https://explorer.rabdi.arkiv.network/entity/0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f',
  },
  '0.0.12345': {
    walletKey: '0.0.12345',
    network: 'hedera:testnet',
    verdict: 'ALLOW',
    score: '0.00',
    reasonCode: 'VERIFIED_CLEAN',
    policyVersion: 'v1.0',
    reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
    entityKey: '0xc84b1534c50e3f831b5ae5e5bd715b1da442f06851a189ff8cefdf3f9e5b7720',
    expiresAtBlock: '354587',
    computedAt: '1794000000',
    signalCount: 0,
    isExpired: false,
    queryTimestamp: new Date().toISOString(),
    currentBlock: '314046',
    source: 'fixture',
    fixtureReason: 'Demonstration fixture for clean verified merchant wallet',
    explorerUrl: 'https://explorer.rabdi.arkiv.network/entity/0xc84b1534c50e3f831b5ae5e5bd715b1da442f06851a189ff8cefdf3f9e5b7720',
  },
};

const FIXTURE_SIGNALS: RiskSignalItem[] = [
  {
    entityKey: '0x7de86c49525c803ef1c48ec733f5026c9bca1c90251e6b9638e1629d7dfdb9d6',
    walletKey: '0.0.90001',
    network: 'hedera:testnet',
    signalCode: 'UNAUTHORIZED_PAYEE',
    severity: 'CRITICAL',
    sourceApp: 'merchant-a-detector',
    reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
    observedAt: '1794000000',
    expiresAtBlock: '354378',
    referenceId: 'ref_fraud_90001_a',
    source: 'fixture',
    explorerUrl: 'https://explorer.rabdi.arkiv.network/entity/0x7de86c49525c803ef1c48ec733f5026c9bca1c90251e6b9638e1629d7dfdb9d6',
  },
  {
    entityKey: '0x6c8f6638ed9903609650b0e821e69453f550edaed9ccf6b9401303d524353bbe',
    walletKey: '0.0.90001',
    network: 'hedera:testnet',
    signalCode: 'UNAUTHORIZED_PAYEE',
    severity: 'CRITICAL',
    sourceApp: 'cross-merchant-gate',
    reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
    observedAt: '1794000010',
    expiresAtBlock: '354579',
    referenceId: 'ref_fraud_90001_b',
    source: 'fixture',
    explorerUrl: 'https://explorer.rabdi.arkiv.network/entity/0x6c8f6638ed9903609650b0e821e69453f550edaed9ccf6b9401303d524353bbe',
  },
  {
    entityKey: '0x1efd40614e776d6b782d69e177494c30adc889cc8def7e275adf39e64df941f0',
    walletKey: '0.0.12345',
    network: 'hedera:testnet',
    signalCode: 'ARKIV_SMOKE_TEST',
    severity: 'LOW',
    sourceApp: 'smoke-test-runner',
    reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
    observedAt: '1794000020',
    expiresAtBlock: '354567',
    referenceId: 'smoke_12345_baseline',
    source: 'fixture',
    explorerUrl: 'https://explorer.rabdi.arkiv.network/entity/0x1efd40614e776d6b782d69e177494c30adc889cc8def7e275adf39e64df941f0',
  },
];

function getTrustedOwner(): Address | undefined {
  try {
    const raw = process.env.ARKIV_TRUSTED_OWNER;
    return raw ? getAddress(raw) : undefined;
  } catch {
    return undefined;
  }
}

function getReadClient() {
  try {
    const config = loadArkivReadConfig();
    return createArkivReadClient(config);
  } catch {
    return null;
  }
}

/**
 * Retrieves aggregate overview metrics from Arkiv Rabdi testnet.
 */
export async function getArkivOverview(): Promise<ArkivOverviewMetrics> {
  const client = getReadClient();
  const trustedOwner = getTrustedOwner();

  if (!client || !trustedOwner) {
    return {
      totalSignals: 0,
      blockedWallets: 0,
      reviewWallets: 0,
      allowedWallets: 0,
      paymentDecisions: 'Not available',
      trustedReporters: [],
      chainId: RABDI_CHAIN_ID,
      networkName: 'Arkiv Rabdi Testnet',
      gasToken: RABDI_GAS_TOKEN,
      currentBlock: '314046',
      lastQueryTime: new Date().toISOString(),
      source: 'unavailable',
      fixtureReason: 'Live credentials (ARKIV_ACCESS_KEY / ARKIV_TRUSTED_OWNER) missing or invalid; no fixture substituted',
      rpcStatus: 'degraded',
    };
  }

  try {
    // 1. Query WalletRiskState entities owned by trusted reporter
    const stateQuery = await client
      .select({
        $key: true,
        $owner: true,
        $expiresAt: true,
        walletKey: true,
        status: true,
        score: true,
      })
      .from(WalletRiskState)
      .ownedBy(trustedOwner)
      .limit(50)
      .fetch();

    const currentBlock = stateQuery.blockNumber;
    // Strict security check: non-expired & trusted owner only
    const validStates = stateQuery.entities.filter(
      (e) => getAddress(e.$owner) === trustedOwner && e.$expiresAt > currentBlock
    );

    const blockedWallets = validStates.filter((s) => s.status.value === 'BLOCK').length;
    const reviewWallets = validStates.filter((s) => s.status.value === 'REVIEW').length;
    const allowedWallets = validStates.filter((s) => s.status.value === 'ALLOW').length;

    // 2. Query RiskSignal entities owned by trusted reporter
    let totalSignals = 0;
    try {
      const signalQuery = await client
        .select({
          $key: true,
          $owner: true,
          $expiresAt: true,
          signalCode: true,
        })
        .from(RiskSignal)
        .ownedBy(trustedOwner)
        .limit(50)
        .fetch();

      totalSignals = signalQuery.entities.filter(
        (s) => getAddress(s.$owner) === trustedOwner && s.$expiresAt > currentBlock
      ).length;
    } catch {
      totalSignals = 0;
    }

    // 3. Query PaymentDecision (honest check: if empty, report 0 or 'Not available')
    let paymentDecisions: number | 'Not available' = 0;
    try {
      const decisionQuery = await client
        .select({
          $key: true,
          $owner: true,
          $expiresAt: true,
          decisionId: true,
        })
        .from(PaymentDecision)
        .ownedBy(trustedOwner)
        .limit(10)
        .fetch();

      paymentDecisions = decisionQuery.entities.length;
    } catch {
      paymentDecisions = 'Not available';
    }

    return {
      totalSignals,
      blockedWallets,
      reviewWallets,
      allowedWallets,
      paymentDecisions,
      trustedReporters: [trustedOwner],
      chainId: RABDI_CHAIN_ID,
      networkName: 'Arkiv Rabdi Testnet',
      gasToken: RABDI_GAS_TOKEN,
      currentBlock: currentBlock.toString(),
      lastQueryTime: new Date().toISOString(),
      source: 'live',
      rpcStatus: 'online',
    };
  } catch (err: any) {
    return {
      totalSignals: 0,
      blockedWallets: 0,
      reviewWallets: 0,
      allowedWallets: 0,
      paymentDecisions: 'Not available',
      trustedReporters: [trustedOwner],
      chainId: RABDI_CHAIN_ID,
      networkName: 'Arkiv Rabdi Testnet',
      gasToken: RABDI_GAS_TOKEN,
      currentBlock: 'Offline',
      lastQueryTime: new Date().toISOString(),
      source: 'unavailable',
      fixtureReason: `Arkiv Rabdi RPC query error: ${err.message}; no fixture substituted`,
      rpcStatus: 'degraded',
      error: err.message,
    };
  }
}

/**
 * Searches for a wallet's risk state on Arkiv Rabdi.
 */
export async function searchWalletRisk(
  walletKey: string,
  network: string = 'hedera:testnet'
): Promise<WalletRiskDetail | { error: string; invalidInput?: boolean }> {
  const trimmed = walletKey.trim();
  if (!trimmed) {
    return { error: 'Wallet identifier cannot be empty' };
  }

  if (!isSupportedWalletKey(trimmed)) {
    return {
      error: 'Invalid wallet identifier. Supported formats: Hedera Account ID (e.g. 0.0.90001) or EVM Address (0x...)',
      invalidInput: true,
    };
  }

  const client = getReadClient();
  const trustedOwner = getTrustedOwner();

  if (!client || !trustedOwner) {
    const fixture = FIXTURE_RECORDS[trimmed];
    if (fixture) {
      return {
        ...fixture,
        queryTimestamp: new Date().toISOString(),
      };
    }
    return {
      walletKey: trimmed,
      network,
      verdict: 'UNKNOWN',
      score: '0.00',
      reasonCode: 'NO_RECORD_FOUND',
      policyVersion: 'v1.0',
      reporter: '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C',
      entityKey: 'none',
      expiresAtBlock: '0',
      computedAt: String(Math.floor(Date.now() / 1000)),
      signalCount: 0,
      isExpired: false,
      queryTimestamp: new Date().toISOString(),
      currentBlock: '0',
      source: 'fixture',
      fixtureReason: 'Running in demo fixture mode (no live Arkiv credentials configured)',
      explorerUrl: 'https://docs.arkiv.network/networks/rabdi/',
    };
  }

  try {
    const result = await client
      .select({
        $key: true,
        $owner: true,
        $expiresAt: true,
        walletKey: true,
        network: true,
        status: true,
        score: true,
        policyVersion: true,
        computedAt: true,
        signalCount: true,
        stateHash: true,
      })
      .from(WalletRiskState, { onMismatch: 'throw' })
      .where(eq('walletKey', trimmed), eq('network', network))
      .ownedBy(trustedOwner)
      .limit(10)
      .fetch();

    const currentBlock = result.blockNumber;

    // Security Filter: Must match expected owner and not be expired
    const validCandidates = result.entities.filter(
      (candidate) =>
        getAddress(candidate.$owner) === trustedOwner && candidate.$expiresAt > currentBlock
    );

    if (validCandidates.length === 0) {
      // Check if there was an expired record
      const expiredCandidate = result.entities.find(
        (candidate) =>
          getAddress(candidate.$owner) === trustedOwner && candidate.$expiresAt <= currentBlock
      );

      return {
        walletKey: trimmed,
        network,
        verdict: 'UNKNOWN',
        score: expiredCandidate ? expiredCandidate.score.value : '0.00',
        reasonCode: expiredCandidate ? 'RECORD_EXPIRED' : 'NO_RECORD_FOUND',
        policyVersion: 'v1.0',
        reporter: trustedOwner,
        entityKey: expiredCandidate ? expiredCandidate.$key : 'none',
        expiresAtBlock: expiredCandidate ? expiredCandidate.$expiresAt.toString() : '0',
        computedAt: expiredCandidate ? expiredCandidate.computedAt.value.toString() : String(Math.floor(Date.now() / 1000)),
        signalCount: expiredCandidate?.signalCount ? Number(expiredCandidate.signalCount.value) : 0,
        isExpired: !!expiredCandidate,
        queryTimestamp: new Date().toISOString(),
        currentBlock: currentBlock.toString(),
        source: 'live',
        explorerUrl: expiredCandidate ? `https://explorer.rabdi.arkiv.network/entity/${expiredCandidate.$key}` : 'https://docs.arkiv.network/networks/rabdi/',
      };
    }

    // Pick top candidate
    const top = validCandidates[0];
    const statusVal = top.status.value.toUpperCase();
    const verdict: 'BLOCK' | 'REVIEW' | 'ALLOW' | 'UNKNOWN' =
      statusVal === 'BLOCK' ? 'BLOCK' : statusVal === 'REVIEW' ? 'REVIEW' : statusVal === 'ALLOW' ? 'ALLOW' : 'UNKNOWN';

    return {
      walletKey: trimmed,
      network: top.network.value,
      verdict,
      score: top.score.value,
      reasonCode: verdict === 'BLOCK' ? 'UNAUTHORIZED_PAYEE' : verdict === 'ALLOW' ? 'VERIFIED_CLEAN' : 'REVIEW_REQUIRED',
      policyVersion: top.policyVersion.value,
      reporter: getAddress(top.$owner),
      entityKey: top.$key,
      expiresAtBlock: top.$expiresAt.toString(),
      computedAt: top.computedAt.value.toString(),
      signalCount: top.signalCount ? Number(top.signalCount.value) : 1,
      isExpired: false,
      queryTimestamp: new Date().toISOString(),
      currentBlock: currentBlock.toString(),
      source: 'live',
      explorerUrl: `https://explorer.rabdi.arkiv.network/entity/${top.$key}`,
    };
  } catch (err: any) {
    return { error: `Arkiv query error: ${err.message}` };
  }
}

/**
 * Retrieves the history of RiskSignals written by trusted reporters.
 */
export async function getRiskSignalHistory(limit: number = 20): Promise<{ signals: RiskSignalItem[]; source: 'live' | 'fixture' | 'unavailable'; error?: string }> {
  const client = getReadClient();
  const trustedOwner = getTrustedOwner();

  if (!client || !trustedOwner) {
    return { signals: FIXTURE_SIGNALS, source: 'fixture' };
  }

  try {
    const result = await client
      .select({
        $key: true,
        $owner: true,
        $expiresAt: true,
        walletKey: true,
        network: true,
        signalCode: true,
        severity: true,
        source: true,
        observedAt: true,
        referenceId: true,
        evidenceHash: true,
      })
      .from(RiskSignal)
      .ownedBy(trustedOwner)
      .limit(limit)
      .fetch();

    const currentBlock = result.blockNumber;

    // Security Filter: owner must match trusted owner
    const trustedSignals = result.entities
      .filter((s) => getAddress(s.$owner) === trustedOwner)
      .map((s) => ({
        entityKey: s.$key,
        walletKey: s.walletKey.value,
        network: s.network.value,
        signalCode: s.signalCode.value,
        severity: (s.severity.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') || 'MEDIUM',
        sourceApp: s.source.value,
        reporter: getAddress(s.$owner),
        observedAt: s.observedAt.value.toString(),
        expiresAtBlock: s.$expiresAt.toString(),
        referenceId: s.referenceId.value,
        evidenceHash: s.evidenceHash?.value,
        source: 'live' as const,
        explorerUrl: `https://explorer.rabdi.arkiv.network/entity/${s.$key}`,
      }));

    return { signals: trustedSignals, source: 'live' };
  } catch (err: any) {
    return {
      signals: [],
      source: 'unavailable',
      error: `Arkiv query error (${err.message}); no fixture substituted`,
    };
  }
}

/**
 * Retrieves PaymentDecision records from Arkiv Rabdi.
 * Note: Returns an honest empty state if none exist.
 */
export async function getPaymentDecisions(): Promise<PaymentDecisionResult> {
  const client = getReadClient();
  const trustedOwner = getTrustedOwner();

  if (!client || !trustedOwner) {
    return {
      decisions: [],
      status: 'empty',
      message: 'No PaymentDecision entities have been written to Arkiv Rabdi. (B06 pending in backend implementation). Decisions are currently evaluated locally in PayeeGuard pre-signing memory.',
    };
  }

  try {
    const result = await client
      .select({
        $key: true,
        $owner: true,
        $expiresAt: true,
        decisionId: true,
        verdict: true,
        walletKey: true,
        payTo: true,
        amount: true,
        evaluatedAt: true,
      })
      .from(PaymentDecision)
      .ownedBy(trustedOwner)
      .limit(10)
      .fetch();

    const trustedDecisions = result.entities.filter((d) => getAddress(d.$owner) === trustedOwner);

    if (trustedDecisions.length === 0) {
      return {
        decisions: [],
        status: 'empty',
        message: 'No PaymentDecision entities have been written to Arkiv Rabdi. (B06 pending in backend implementation). Decisions are currently evaluated locally in PayeeGuard pre-signing memory.',
      };
    }

    return {
      decisions: trustedDecisions.map((d) => ({
        decisionId: d.decisionId.value,
        walletKey: d.walletKey.value,
        verdict: d.verdict.value,
        payTo: d.payTo.value,
        amount: d.amount.value,
        evaluatedAt: d.evaluatedAt.value.toString(),
      })),
      status: 'available',
      message: `${trustedDecisions.length} verified payment decisions retrieved from Rabdi testnet.`,
    };
  } catch (err: any) {
    return {
      decisions: [],
      status: 'unsupported',
      message: `Failed to query PaymentDecision entities: ${err.message}`,
    };
  }
}
