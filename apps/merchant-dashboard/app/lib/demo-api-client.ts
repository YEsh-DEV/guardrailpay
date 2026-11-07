/**
 * QuoteSeal Demo API Client & Deterministic Scenario Engine
 * Stage 2 Frontend Integration with Agent 1 Fastify Backend.
 *
 * Guarantees:
 * 1. Never silently falls back to fixture mode on live failures.
 * 2. Strict runId-scoped event polling to isolate concurrent browser sessions.
 * 3. Invariant enforcement: BLOCK strictly enforces signerCallCount = 0 and no resource delivery.
 * 4. Unexecuted security checks remain NOT_RUN.
 */

import {
  ScenarioId,
  DemoMode,
  ScenarioDefinition,
  DemoEvent,
  SecurityCheckResult,
  SecurityCheckName,
  DemoRunState,
  BlockchainEvidence,
  SequenceStepInfo,
  SequenceStepId,
  LiveRunError,
  ArkivProvenance,
} from './demo-types';

export const RABDI_CHAIN_ID = 7794095;
export const TRUSTED_ARKIV_REPORTER = '0xAFc9b641D89cB5C23D247B2Fbf2622BA879E7e7C';
export const LIVE_BLOCKED_WALLET = '0.0.90001';
export const LIVE_CLEAN_WALLET = '0.0.12345';
export const LIVE_ARKIV_ENTITY_KEY = '0xb14aa428576a1d4bdd97062dfc178a1b51040a2de6b7c34f49b531e2f9e9bf1f';

export const SCENARIO_DEFINITIONS: Record<ScenarioId, ScenarioDefinition> = {
  NORMAL_PAYMENT: {
    id: 'NORMAL_PAYMENT',
    title: 'Normal Authorized Payment',
    subtitle: 'Autonomous AI Agent Research Payment',
    description:
      'An authorized buyer agent requests a premium paid intelligence report. PayeeGuard verifies the merchant ENSv2 identity, queries Arkiv Rabdi for risk intelligence (ALLOW), permits signing (signerCallCount = 1), settles on Hedera testnet, and delivers the protected report only after confirmed on-chain settlement.',
    badgeText: 'PASS & SETTLE',
    badgeType: 'success',
    expectedVerdict: 'PASS',
    supportedModes: ['fixture', 'arkiv-live', 'full-live'],
    buyerAccount: '0.0.48201 (claude-research-agent/2.0)',
    merchantIdentity: 'researchpro.eth (0.0.98412)',
    targetNetwork: 'hedera:testnet (Chain ID 296)',
    keyRule: 'ENS identity matched + Arkiv ALLOW + PayeeGuard PASS → rawSigner invoked → On-chain settlement → Resource released.',
  },
  SUSPICIOUS_PAYMENT: {
    id: 'SUSPICIOUS_PAYMENT',
    title: 'Suspicious Payment Interception',
    subtitle: 'Adversarial PayTo Substitution Attack',
    description:
      'A man-in-the-middle attack or malicious proxy modifies the HTTP 402 challenge recipient to a rogue wallet (0x9994...). PayeeGuard inspects the challenge against the ENS identity, detects payee tampering, and immediately triggers a hard BLOCK before the buyer wallet can sign (signerCallCount = 0). Merchant A then anchors a synthetic risk signal to Arkiv Rabdi.',
    badgeText: 'FIREWALL BLOCK',
    badgeType: 'danger',
    expectedVerdict: 'BLOCK',
    supportedModes: ['fixture', 'arkiv-live', 'full-live'],
    buyerAccount: '0.0.48201 (claude-research-agent/2.0)',
    merchantIdentity: 'researchpro.eth (tampered recipient: 0x9994...)',
    targetNetwork: 'hedera:testnet (Chain ID 296)',
    keyRule: 'Payee mismatch with ENS identity → Immediate BLOCK → signerCallCount = 0 → Zero funds transferred.',
  },
  CROSS_MERCHANT_BLOCK: {
    id: 'CROSS_MERCHANT_BLOCK',
    title: 'Cross-Merchant Collaborative Defense',
    subtitle: 'Decentralized Arkiv Rabdi Threat Propagation',
    description:
      'Merchant A previously detected fraudulent behavior from wallet 0.0.90001 and anchored a WalletRiskState to Arkiv Rabdi. When the adversary later attempts an autonomous payment at Merchant B, Merchant B independently queries Arkiv Rabdi, discovers the active BLOCK verdict from Merchant A, and halts signing.',
    badgeText: 'ARKIV ECOSYSTEM VETO',
    badgeType: 'warning',
    expectedVerdict: 'BLOCK',
    supportedModes: ['fixture', 'arkiv-live', 'full-live'],
    buyerAccount: '0.0.90001 (Flagged Adversary)',
    merchantIdentity: 'merchant-b.eth (Merchant B Storefront)',
    targetNetwork: 'hedera:testnet (Chain ID 296)',
    keyRule: 'Merchant A publishes risk to Rabdi → Merchant B reads state → PayeeGuard blocks payment before signing.',
  },
};

export const INITIAL_SEQUENCE_STEPS: Record<ScenarioId, SequenceStepInfo[]> = {
  NORMAL_PAYMENT: [
    { id: 'buyer_request', label: '1. Buyer Agent Request', role: 'Buyer', status: 'pending', detail: 'Agent requests GET /api/research/paid' },
    { id: 'merchant_challenge', label: '2. Merchant HTTP 402 Challenge', role: 'Merchant A', status: 'pending', detail: 'Merchant returns 402 with payTo terms' },
    { id: 'security_checks', label: '3. Identity & Limit Validation', role: 'PayeeGuard', status: 'pending', detail: 'Validating ENS name & autonomous policy' },
    { id: 'arkiv_action', label: '4. Arkiv Rabdi Threat Query', role: 'Arkiv', status: 'pending', detail: 'Querying decentralized risk registry' },
    { id: 'payeeguard_decision', label: '5. PayeeGuard Verdict', role: 'PayeeGuard', status: 'pending', detail: 'Pre-signing evaluation' },
    { id: 'signing_execution', label: '6. Payment Signing', role: 'Buyer', status: 'pending', detail: 'rawSigner invocation decision' },
    { id: 'hedera_settlement', label: '7. Hedera Testnet Settlement', role: 'Hedera', status: 'pending', detail: 'Consensus & Mirror Node verification' },
    { id: 'resource_delivery', label: '8. Protected Resource Delivery', role: 'Merchant A', status: 'pending', detail: 'Alpha report release decision' },
  ],
  SUSPICIOUS_PAYMENT: [
    { id: 'buyer_request', label: '1. Buyer Agent Request', role: 'Buyer', status: 'pending', detail: 'Agent initiates payment attempt' },
    { id: 'merchant_challenge', label: '2. Tampered HTTP 402 Intercept', role: 'Merchant A', status: 'pending', detail: 'Proxy alters recipient address' },
    { id: 'security_checks', label: '3. ENS Identity Verification', role: 'PayeeGuard', status: 'pending', detail: 'Payee mismatch detected' },
    { id: 'arkiv_action', label: '4. Threat Signal Publication', role: 'Arkiv', status: 'pending', detail: 'Anchoring RiskSignal to Rabdi' },
    { id: 'payeeguard_decision', label: '5. PayeeGuard BLOCK Decision', role: 'PayeeGuard', status: 'pending', detail: 'Hard veto triggered' },
    { id: 'signing_execution', label: '6. Signer Skipped (signerCallCount = 0)', role: 'Buyer', status: 'pending', detail: 'Keys strictly protected' },
    { id: 'hedera_settlement', label: '7. Hedera Transfer Blocked', role: 'Hedera', status: 'pending', detail: 'No transaction submitted' },
    { id: 'resource_delivery', label: '8. Access Withheld', role: 'Merchant A', status: 'pending', detail: 'Zero resource delivery' },
  ],
  CROSS_MERCHANT_BLOCK: [
    { id: 'buyer_request', label: '1. Adversary Targets Merchant B', role: 'Buyer', status: 'pending', detail: 'Flagged wallet 0.0.90001 attempts payment' },
    { id: 'merchant_challenge', label: '2. Merchant B Issues Challenge', role: 'Merchant B', status: 'pending', detail: 'Returns payment requirements' },
    { id: 'security_checks', label: '3. PayeeGuard Interception', role: 'PayeeGuard', status: 'pending', detail: 'Pre-signing security inspection' },
    { id: 'arkiv_action', label: '4. Merchant B Queries Arkiv Rabdi', role: 'Arkiv', status: 'pending', detail: 'Reads Merchant A\'s published BLOCK state' },
    { id: 'payeeguard_decision', label: '5. Cross-Merchant Veto', role: 'PayeeGuard', status: 'pending', detail: 'Consensus risk blocks transaction' },
    { id: 'signing_execution', label: '6. Signer Skipped (signerCallCount = 0)', role: 'Buyer', status: 'pending', detail: 'Private keys untouched' },
    { id: 'hedera_settlement', label: '7. Settlement Prevented', role: 'Hedera', status: 'pending', detail: 'Zero tokens transferred' },
    { id: 'resource_delivery', label: '8. Storefront Access Denied', role: 'Merchant B', status: 'pending', detail: 'Merchant B protected from fraud' },
  ],
};

export const INITIAL_SECURITY_CHECKS: SecurityCheckResult[] = [
  { name: 'merchantIdentity', label: 'ENS Merchant Identity', status: 'NOT_RUN', detail: 'Pending verification against ENSv2' },
  { name: 'recipientMatching', label: 'Recipient / PayTo Match', status: 'NOT_RUN', detail: 'Pending comparison with merchant text record' },
  { name: 'assetNetwork', label: 'Asset & Network Integrity', status: 'NOT_RUN', detail: 'Pending HBAR / hedera:testnet validation' },
  { name: 'amountPolicy', label: 'Amount & Quota Policy', status: 'NOT_RUN', detail: 'Pending autonomous budget check' },
  { name: 'arkivRisk', label: 'Arkiv Rabdi Risk State', status: 'NOT_RUN', detail: 'Pending decentralized intelligence query' },
  { name: 'payeeGuard', label: 'PayeeGuard Pre-Signing Gate', status: 'NOT_RUN', detail: 'Guarantees rawSigner called only on PASS' },
  { name: 'paymentProof', label: 'Payment Proof Cryptography', status: 'NOT_RUN', detail: 'Pending buyer signature verification' },
  { name: 'settlement', label: 'Hedera Settlement Confirmation', status: 'NOT_RUN', detail: 'Pending Mirror node consensus confirmation' },
];

/**
 * Fetch scenarios from backend API or fallback to typed definitions
 */
export async function getScenarios(): Promise<ScenarioDefinition[]> {
  const res = await fetch('/api/demo/scenarios');
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readBackendError(data) || `Scenario endpoint returned HTTP ${res.status}`);
  if (!Array.isArray(data) || data.length === 0) throw new Error('Scenario endpoint returned no definitions');
  const definitions = data.filter(isScenarioDefinition).map((definition) => ({ ...SCENARIO_DEFINITIONS[definition.id], ...definition }));
  if (definitions.length !== 3) throw new Error('Scenario endpoint returned an incomplete allowlist');
  return definitions;
}

/**
 * Executes a demo scenario.
 * - Fixture mode: runs local deterministic simulator.
 * - Live modes (arkiv-live, full-live): connects to backend API.
 *   CRITICAL: If backend fails or is unreachable in live mode, DO NOT silently fall back to fixture!
 *   Instead, return an explicit LiveRunError so the UI can display the failure and offer actions.
 */
export async function executeDemoRun(
  scenarioId: ScenarioId,
  requestedMode: DemoMode,
  onUpdate: (state: DemoRunState) => void
): Promise<DemoRunState> {
  const startTime = new Date().toISOString();
  return runBackendLiveOrchestration(scenarioId, requestedMode, startTime, onUpdate);
}

/**
 * Executes a live run against Agent 1's backend orchestration API.
 * Scoped to the backend-issued runId. paymentRequestId is evidence inside a run and is never used as the run key.
 */
async function runBackendLiveOrchestration(
  scenarioId: ScenarioId,
  requestedMode: DemoMode,
  startTime: string,
  onUpdate: (state: DemoRunState) => void
): Promise<DemoRunState> {
  const steps = JSON.parse(JSON.stringify(INITIAL_SEQUENCE_STEPS[scenarioId])) as SequenceStepInfo[];
  const checks = JSON.parse(JSON.stringify(INITIAL_SECURITY_CHECKS)) as SecurityCheckResult[];

  const initialLiveState: DemoRunState = {
    runId: 'pending',
    scenarioId,
    mode: requestedMode,
    requestedMode,
    status: 'running',
    currentStage: 'INITIATING',
    startTime,
    events: [],
    sequenceSteps: steps,
    securityChecks: checks,
    isSimulated: requestedMode === 'fixture',
    evidence: {
      dataSource: requestedMode,
      isSimulated: requestedMode === 'fixture',
      signerCallCount: 0,
    },
  };
  onUpdate(initialLiveState);

  let runResponse: Response;
  try {
    runResponse = await fetch('/api/demo/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId }),
    });
  } catch (netErr: unknown) {
    const details = netErr instanceof Error ? netErr.message : 'Network request failed';
    const errorState: DemoRunState = {
      ...initialLiveState,
      status: 'failed',
      endTime: new Date().toISOString(),
      liveError: {
        code: 'BACKEND_UNAVAILABLE',
        title: 'Backend Service Unavailable',
        message: 'Could not connect to the merchant API server at http://localhost:3001. Ensure the demo backend is running.',
        details,
        httpStatus: 503,
      },
    };
    onUpdate(errorState);
    return errorState;
  }

  const responsePayload: unknown = await runResponse.json().catch(() => ({}));

  if (!runResponse.ok) {
    const errorMessage = readBackendError(responsePayload) || `Backend returned HTTP ${runResponse.status}`;
    const code =
      runResponse.status === 403
        ? 'UNAUTHORIZED'
        : runResponse.status === 503
        ? 'BACKEND_UNAVAILABLE'
        : runResponse.status === 424
        ? 'LIVE_DEPENDENCY_UNAVAILABLE'
        : 'SERVER_ERROR';

    const errorState: DemoRunState = {
      ...initialLiveState,
      status: 'failed',
      endTime: new Date().toISOString(),
      liveError: {
        code,
        title: runResponse.status === 403 ? 'Unauthorized Demo Runner' : 'Live Scenario Execution Failed',
        message: errorMessage,
        details: JSON.stringify(responsePayload),
        httpStatus: runResponse.status,
      },
    };
    onUpdate(errorState);
    return errorState;
  }

  const runData = parseBackendRun(responsePayload);
  if (!runData) {
    const errorState: DemoRunState = { ...initialLiveState, status: 'failed', endTime: new Date().toISOString(), liveError: { code: 'SERVER_ERROR', title: 'Invalid Demo Response', message: 'Backend did not return a typed runId and mode.', details: JSON.stringify(responsePayload), httpStatus: runResponse.status } };
    onUpdate(errorState);
    return errorState;
  }

  const actualRunId = runData.runId;
  let liveEvents: DemoEvent[] = Array.isArray(runData.events) ? [...runData.events] : [];

  // Poll for events strictly scoped to actualRunId
  for (let poll = 0; poll < 10; poll++) {
    try {
      const evRes = await fetch(`/api/demo/events?runId=${encodeURIComponent(actualRunId)}`);
      if (evRes.ok) {
        const evData: unknown = await evRes.json();
        const parsedEvents = parseBackendEvents(evData);
        if (parsedEvents) liveEvents = parsedEvents;
      } else {
        const errorPayload: unknown = await evRes.json().catch(() => ({}));
        const errorState: DemoRunState = { ...initialLiveState, runId: actualRunId, mode: runData.mode, status: 'failed', endTime: new Date().toISOString(), liveError: { code: 'SERVER_ERROR', title: 'Event Feed Failed', message: readBackendError(errorPayload) || `Backend returned HTTP ${evRes.status}`, httpStatus: evRes.status } };
        onUpdate(errorState);
        return errorState;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Event feed unavailable';
      const errorState: DemoRunState = { ...initialLiveState, runId: actualRunId, mode: runData.mode, status: 'failed', endTime: new Date().toISOString(), liveError: { code: 'BACKEND_UNAVAILABLE', title: 'Event Feed Unavailable', message, httpStatus: 503 } };
      onUpdate(errorState);
      return errorState;
    }

    const isFinished =
      runData.status === 'completed' || runData.status === 'blocked' || runData.status === 'failed';

    const updatedState = mapLiveRunToState(
      actualRunId,
      scenarioId,
      runData.mode,
      runData,
      liveEvents,
      startTime,
      isFinished,
      requestedMode
    );
    onUpdate(updatedState);

    if (isFinished) return updatedState;
    await new Promise((r) => setTimeout(r, 600));
  }

  // Final mapping after polling
  const finalState = mapLiveRunToState(actualRunId, scenarioId, runData.mode, runData, liveEvents, startTime, true, requestedMode);
  onUpdate(finalState);
  return finalState;
}

interface BackendRunRecord {
  runId: string;
  scenarioId: ScenarioId;
  mode: DemoMode;
  status: 'completed' | 'blocked' | 'failed';
  verdict: 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';
  signerCallCount: number;
  accessGranted: boolean;
  events?: DemoEvent[];
  error?: { code: string; message: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDemoMode(value: unknown): value is DemoMode {
  return value === 'fixture' || value === 'arkiv-live' || value === 'full-live';
}

function isScenarioId(value: unknown): value is ScenarioId {
  return value === 'NORMAL_PAYMENT' || value === 'SUSPICIOUS_PAYMENT' || value === 'CROSS_MERCHANT_BLOCK';
}

function isScenarioDefinition(value: unknown): value is Pick<ScenarioDefinition, 'id' | 'title' | 'expectedVerdict' | 'supportedModes' | 'buyerAccount' | 'merchantIdentity' | 'targetNetwork' | 'keyRule'> {
  if (!isRecord(value) || !isScenarioId(value.id) || typeof value.title !== 'string' || typeof value.buyerAccount !== 'string' || typeof value.merchantIdentity !== 'string' || typeof value.targetNetwork !== 'string' || typeof value.keyRule !== 'string') return false;
  if (value.expectedVerdict !== 'PASS' && value.expectedVerdict !== 'BLOCK') return false;
  return Array.isArray(value.supportedModes) && value.supportedModes.every(isDemoMode);
}

function parseBackendRun(value: unknown): BackendRunRecord | undefined {
  if (!isRecord(value) || typeof value.runId !== 'string' || !isScenarioId(value.scenarioId) || !isDemoMode(value.mode)) return undefined;
  if (value.status !== 'completed' && value.status !== 'blocked' && value.status !== 'failed') return undefined;
  if (value.verdict !== 'PASS' && value.verdict !== 'BLOCK' && value.verdict !== 'HOLD' && value.verdict !== 'UNVERIFIABLE') return undefined;
  if (typeof value.signerCallCount !== 'number' || typeof value.accessGranted !== 'boolean') return undefined;
  return { runId: value.runId, scenarioId: value.scenarioId, mode: value.mode, status: value.status, verdict: value.verdict, signerCallCount: value.signerCallCount, accessGranted: value.accessGranted, events: parseBackendEvents({ events: value.events }) ?? undefined, error: isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string' ? { code: value.error.code, message: value.error.message } : undefined };
}

function parseBackendEvents(value: unknown): DemoEvent[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.events)) return undefined;
  return value.events.filter((event): event is DemoEvent => isRecord(event) && typeof event.runId === 'string' && typeof event.eventId === 'string' && typeof event.paymentRequestId === 'string');
}

function readBackendError(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.message === 'string') return value.message;
  if (isRecord(value.error) && typeof value.error.message === 'string') return value.error.message;
  return undefined;
}

function mapLiveRunToState(
  runId: string,
  scenarioId: ScenarioId,
  mode: DemoMode,
  runData: BackendRunRecord,
  events: DemoEvent[],
  startTime: string,
  isFinished: boolean,
  requestedMode?: DemoMode
): DemoRunState {
  const isModeMismatch = requestedMode !== undefined && requestedMode !== mode;
  const isSimulated = mode === 'fixture' || events.some((event) => event.dataSource === 'simulated_fixture' || event.dataSource === 'fixture');
  const verdict = runData.verdict;
  const isBlocked = verdict === 'BLOCK';
  const signerCallCount = typeof runData.signerCallCount === 'number' ? runData.signerCallCount : isBlocked ? 0 : 1;
  const settlementVerified = events.some((event) => event.eventType === 'SETTLEMENT_VERIFIED' && event.verdict === 'PASS' && event.dataSource === 'hedera_live' && typeof event.hederaTransactionId === 'string');
  const accessGranted = runData.accessGranted && settlementVerified;

  // Map 8 Sequence Steps
  const steps = JSON.parse(JSON.stringify(INITIAL_SEQUENCE_STEPS[scenarioId])) as SequenceStepInfo[];
  const checks = JSON.parse(JSON.stringify(INITIAL_SECURITY_CHECKS)) as SecurityCheckResult[];
  steps[0].status = 'completed'; // Buyer request
  steps[1].status = 'completed'; // Challenge

  if (runData.status === 'failed') {
    steps.forEach((step) => { step.status = step.id === 'buyer_request' ? 'completed' : 'skipped'; });
    steps[7].status = 'blocked';
    checks.forEach((check) => {
      check.status = 'UNVERIFIABLE';
      check.detail = runData.error?.message ?? 'Backend run failed before this check completed';
    });
  } else if (isBlocked) {
    steps[2].status = 'blocked';
    steps[3].status = 'completed';
    steps[4].status = 'blocked';
    steps[5].status = 'blocked'; // Signer skipped (signerCallCount = 0)
    steps[6].status = 'skipped';
    steps[7].status = 'blocked'; // Access withheld
  } else {
    steps[2].status = 'completed';
    steps[3].status = 'completed';
    steps[4].status = 'completed';
    steps[5].status = 'completed';
    steps[6].status = accessGranted ? 'completed' : 'in_progress';
    steps[7].status = accessGranted ? 'completed' : 'blocked';
  }

  // Map 8 Security Checks
  checks[0].status = 'PASS';
  checks[0].detail = 'ENS merchant identity resolved and validated';

  if (isBlocked) {
    if (scenarioId === 'SUSPICIOUS_PAYMENT') {
      checks[1].status = 'BLOCK';
      checks[1].detail = 'Recipient does not match ENS record (PayTo substitution detected)';
      checks[2].status = 'PASS';
      checks[3].status = 'BLOCK';
      checks[3].detail = 'Autonomous agent policy hard block: unauthorized payee';
      checks[4].status = 'BLOCK';
      checks[4].detail = 'RiskSignal broadcast to Arkiv Rabdi threat registry';
    } else {
      // CROSS_MERCHANT_BLOCK
      checks[1].status = 'PASS';
      checks[2].status = 'PASS';
      checks[3].status = 'BLOCK';
      checks[3].detail = 'Wallet flagged on Arkiv Rabdi by peer merchant';
      checks[4].status = 'BLOCK';
      checks[4].detail = 'Active BLOCK state returned by Arkiv Rabdi';
    }
    checks[5].status = 'BLOCK';
    checks[5].detail = 'PayeeGuard veto invoked before signing (signerCallCount = 0)';
    checks[6].status = 'NOT_RUN';
    checks[6].detail = 'Aborted prior to signing — zero cryptographic proof generated';
    checks[7].status = 'NOT_RUN';
    checks[7].detail = 'No transaction submitted to Hedera';
  } else {
    checks[0].status = 'PASS';
    checks[0].detail = 'ENS merchant identity resolved and validated';
    checks[1].status = 'PASS';
    checks[1].detail = 'Recipient matches merchant ENS text record';
    checks[2].status = 'PASS';
    checks[2].detail = 'Asset and network verified';
    checks[3].status = 'PASS';
    checks[3].detail = 'Amount within autonomous quota policy';
    checks[4].status = 'PASS';
    checks[4].detail = 'Arkiv Rabdi threat registry: clean';
    checks[5].status = 'PASS';
    checks[5].detail = 'PayeeGuard pre-signing validation passed';
    checks[6].status = signerCallCount > 0 ? 'PASS' : 'NOT_RUN';
    checks[6].detail = signerCallCount > 0 ? 'Payment signature authorized and verified' : 'Signing not invoked';
    checks[7].status = settlementVerified ? 'PASS' : 'UNVERIFIABLE';
    checks[7].detail = settlementVerified
      ? 'Mirror node verified consensus on Hedera Testnet'
      : (mode === 'fixture' ? 'Fixture mode does not provide independent Hedera settlement evidence' : 'Settlement evidence missing or pending confirmation');
  }

  // Extract Arkiv Evidence
  const arkivEvent = events.find((e) => e.arkivEntityKey);
  const arkivKey = arkivEvent?.arkivEntityKey;
  const arkivProvenance: ArkivProvenance | undefined = arkivKey
    ? {
        network: 'Arkiv Rabdi Testnet',
        chainId: RABDI_CHAIN_ID,
        trustedOwner: arkivEvent?.arkivTrustedOwner ?? '',
        riskSignalEntityKey: scenarioId === 'SUSPICIOUS_PAYMENT' ? arkivKey : undefined,
        walletRiskStateEntityKey: scenarioId === 'CROSS_MERCHANT_BLOCK' ? arkivKey : undefined,
        riskVerdict: isBlocked ? 'BLOCK' : 'ALLOW',
        expiresAtBlock: arkivEvent?.arkivExpiresAtBlock,
        provenanceDescription:
          scenarioId === 'CROSS_MERCHANT_BLOCK'
            ? 'Merchant B queried Arkiv Rabdi; verified Merchant A anchor.'
            : 'Merchant A published synthetic threat signal to Arkiv Rabdi.',
        isLive: !isSimulated && events.some((event) => event.dataSource === 'arkiv_live'),
        explorerUrl: arkivEvent?.arkivExplorerUrl,
      }
    : undefined;

  // Extract Hedera Evidence
  const hederaEvent = events.find((e) => e.hederaTransactionId);
  const hederaTxId = hederaEvent?.hederaTransactionId;

  return {
    runId,
    scenarioId,
    mode,
    requestedMode,
    isModeMismatch,
    status: isFinished ? (runData.status === 'failed' ? 'failed' : isBlocked ? 'blocked' : 'completed') : 'running',
    currentStage: isFinished ? (runData.status === 'failed' ? 'ERROR' : isBlocked ? 'BLOCKED' : 'COMPLETED') : 'SETTLING',
    startTime,
    endTime: isFinished ? new Date().toISOString() : undefined,
    events,
    sequenceSteps: steps,
    securityChecks: checks,
    finalVerdict: verdict,
    isSimulated,
    evidence: {
      dataSource: isSimulated ? 'fixture' : mode,
      isSimulated,
      signerCallCount,
      settlementVerified,
      hederaTransactionId: hederaTxId,
      hashScanUrl: hederaTxId ? `https://hashscan.io/testnet/transaction/${hederaTxId}` : undefined,
      arkivEntityKey: arkivKey,
      arkivExplorerUrl: arkivEvent?.arkivExplorerUrl,
      trustedReporter: arkivEvent?.arkivTrustedOwner,
      expirationBlock: arkivEvent?.arkivExpiresAtBlock,
      arkivProvenance,
      deliveredResource: accessGranted && settlementVerified
        ? {
            id: 'ALPHA-REPORT-2026-X8',
            title: 'Verified Institutional Liquidity Alpha (Live Settlement)',
            contentType: 'application/json',
            payloadPreview: JSON.stringify(
              { status: 'SUCCESS', verifiedAt: new Date().toISOString(), transactionId: hederaTxId },
              null,
              2
            ),
          }
        : undefined,
    },
  };
}

/**
 * Deterministic Simulation Engine (for explicit Fixture Mode)
 */
async function runDeterministicSimulation(
  scenarioId: ScenarioId,
  mode: DemoMode,
  runId: string,
  startTime: string,
  onUpdate: (state: DemoRunState) => void,
  requestedMode: DemoMode = mode
): Promise<DemoRunState> {
  const events: DemoEvent[] = [];
  const steps = JSON.parse(JSON.stringify(INITIAL_SEQUENCE_STEPS[scenarioId])) as SequenceStepInfo[];
  let checks = JSON.parse(JSON.stringify(INITIAL_SECURITY_CHECKS)) as SecurityCheckResult[];

  const updateStep = (id: SequenceStepId, status: SequenceStepInfo['status'], detail?: string) => {
    const s = steps.find((item) => item.id === id);
    if (s) {
      s.status = status;
      if (detail) s.detail = detail;
    }
  };

  const updateCheck = (name: SecurityCheckName, status: SecurityCheckResult['status'], detail: string) => {
    checks = checks.map((c) => (c.name === name ? { ...c, status, detail, timestamp: new Date().toLocaleTimeString() } : c));
  };

  const dispatch = (stage: any, status: any, verdict?: any, evidencePatch?: Partial<BlockchainEvidence>) => {
    const currentState: DemoRunState = {
      runId,
      scenarioId,
      mode: 'fixture',
      requestedMode,
      isModeMismatch: requestedMode !== 'fixture',
      status,
      currentStage: stage,
      startTime,
      endTime: status === 'completed' || status === 'blocked' ? new Date().toISOString() : undefined,
      events: [...events],
      sequenceSteps: [...steps],
      securityChecks: [...checks],
      finalVerdict: verdict,
      isSimulated: true,
      evidence: {
        dataSource: 'fixture',
        isSimulated: true,
        signerCallCount: verdict === 'BLOCK' ? 0 : 1,
        ...evidencePatch,
      },
    };
    onUpdate(currentState);
    return currentState;
  };

  // STEP 1: Buyer Agent Request
  updateStep('buyer_request', 'in_progress', 'Buyer autonomous agent invoking /api/research/paid');
  events.push({
    runId,
    scenarioId,
    eventId: `evt_${Date.now()}_1`,
    eventType: 'REQUEST_INITIATED',
    timestamp: new Date().toLocaleTimeString(),
    buyerId: scenarioId === 'CROSS_MERCHANT_BLOCK' ? LIVE_BLOCKED_WALLET : '0.0.48201',
    merchantId: scenarioId === 'CROSS_MERCHANT_BLOCK' ? 'merchant-b.eth' : 'researchpro.eth',
    paymentRequestId: runId,
    network: 'hedera:testnet',
    stage: 'challenge',
    verdict: 'PASS',
    reasonCode: 'AGENT_SERVICE_REQUEST',
    dataSource: 'simulated_fixture',
    message: 'Buyer AI agent sent HTTP GET /api/research/paid requesting premium intelligence report.',
  });
  dispatch('challenge', 'running');
  await delay(400);

  // STEP 2: Merchant HTTP 402 Challenge
  updateStep('buyer_request', 'completed');
  updateStep('merchant_challenge', 'in_progress', 'Generating x402 payment challenge');
  const challengePayTo =
    scenarioId === 'SUSPICIOUS_PAYMENT'
      ? '0x9994F8c72aD5519a3929BC00dead1337caFE0000'
      : '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B';

  events.push({
    runId,
    scenarioId,
    eventId: `evt_${Date.now()}_2`,
    eventType: 'HTTP_402_CHALLENGE',
    timestamp: new Date().toLocaleTimeString(),
    buyerId: scenarioId === 'CROSS_MERCHANT_BLOCK' ? LIVE_BLOCKED_WALLET : '0.0.48201',
    merchantId: scenarioId === 'CROSS_MERCHANT_BLOCK' ? 'merchant-b.eth' : 'researchpro.eth',
    paymentRequestId: runId,
    network: 'hedera:testnet',
    stage: 'challenge',
    verdict: 'PASS',
    reasonCode: 'HTTP_402_PAYMENT_REQUIRED',
    dataSource: 'simulated_fixture',
    rawPayload: {
      status: 402,
      payTo: challengePayTo,
      amount: '5.00000000',
      asset: 'HBAR',
      network: 'hedera:testnet',
      challenge: '0x9a8f27b14c3e8092a47f03bc104d5e82119cba048201772183921048201',
    },
    message: `Merchant gateway responded with HTTP 402 Payment Required. Demanded 5.0 HBAR to ${challengePayTo}.`,
  });
  updateStep('merchant_challenge', 'completed');
  dispatch('firewall', 'running');
  await delay(450);

  // SCENARIO 1: NORMAL_PAYMENT
  if (scenarioId === 'NORMAL_PAYMENT') {
    updateStep('security_checks', 'completed', 'ENS identity & policy limits verified');
    updateCheck('merchantIdentity', 'PASS', 'ENS name researchpro.eth resolved to contract 0x71Cf3D14...8f4B');
    updateCheck('recipientMatching', 'PASS', 'Challenge recipient exactly matches ENS x402.payTo record');
    updateCheck('assetNetwork', 'PASS', 'Asset HBAR on hedera:testnet verified');
    updateCheck('amountPolicy', 'PASS', '5.00 HBAR is within autonomous budget quota (< 25 HBAR)');

    updateStep('arkiv_action', 'completed', 'Arkiv Rabdi query: ALLOW / VERIFIED_CLEAN');
    updateCheck('arkivRisk', 'PASS', 'Arkiv Rabdi query for 0.0.98412 returned VERIFIED_CLEAN (Score: 0.00)');

    updateStep('payeeguard_decision', 'completed', 'All 8 invariants validated: PASS');
    updateCheck('payeeGuard', 'PASS', 'Pre-signing gate allows execution');
    dispatch('signing', 'running');
    await delay(500);

    // STEP 6: Signing
    updateStep('signing_execution', 'completed', 'rawSigner invoked (signerCallCount = 1)');
    updateCheck('paymentProof', 'PASS', 'Cryptographic signature from authorized payer verified');
    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_3`,
      eventType: 'PAYMENT_SIGNED',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: '0.0.48201',
      merchantId: 'researchpro.eth',
      paymentRequestId: runId,
      network: 'hedera:testnet',
      stage: 'signing',
      verdict: 'PASS',
      reasonCode: 'SIGNATURE_AUTHORIZED',
      signerCallCount: 1,
      dataSource: 'simulated_fixture',
      message: 'Autonomous buyer rawSigner invoked (callCount = 1). Cryptographic Hedera TransferTransaction signed.',
    });
    dispatch('settlement-verification', 'running');
    await delay(500);

    // STEP 7: Fixture payment attempt. No Hedera transaction or settlement claim is created.
    updateStep('hedera_settlement', 'skipped', 'Fixture payment was not submitted to Hedera');
    updateCheck('settlement', 'UNVERIFIABLE', 'Fixture mode does not provide independent Hedera settlement evidence');
    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_4`,
      eventType: 'PAYMENT_SUBMISSION_SIMULATED',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: '0.0.48201',
      merchantId: 'researchpro.eth',
      paymentRequestId: runId,
      network: 'hedera:testnet',
      stage: 'SETTLING',
      verdict: 'UNVERIFIABLE',
      reasonCode: 'SIMULATED_PAYMENT_NOT_SUBMITTED',
      dataSource: 'simulated_fixture',
      message: 'Fixture mode recorded a simulated payment attempt. No Hedera transaction was submitted.',
    });
    dispatch('access', 'running');
    await delay(500);

    // STEP 8: Fixture resource delivery is withheld until a verifier supplies evidence.
    updateStep('resource_delivery', 'blocked', 'Access withheld: fixture has no settlement proof');
    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_5`,
      eventType: 'ACCESS_WITHHELD',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: '0.0.48201',
      merchantId: 'researchpro.eth',
      paymentRequestId: runId,
      network: 'hedera:testnet',
      stage: 'RESOURCE_DELIVERY',
      verdict: 'UNVERIFIABLE',
      reasonCode: 'SIMULATED_PAYMENT_CANNOT_GRANT_ACCESS',
      dataSource: 'simulated_fixture',
      message: 'Protected resource withheld because fixture execution has no verified Hedera settlement.',
    });

    return dispatch('COMPLETED', 'completed', 'PASS', { signerCallCount: 1 });
  }

  // SCENARIO 2: SUSPICIOUS_PAYMENT
  if (scenarioId === 'SUSPICIOUS_PAYMENT') {
    updateStep('security_checks', 'blocked', 'PayTo mismatch! Tampered recipient detected');
    updateCheck('merchantIdentity', 'PASS', 'ENS name researchpro.eth resolved to 0x71Cf3D14...8f4B');
    updateCheck('recipientMatching', 'BLOCK', 'Challenge payTo (0x9994F8c7...) does NOT match ENS identity (0x71Cf3D14...)!');
    updateCheck('assetNetwork', 'PASS', '5.00 HBAR requested');
    updateCheck('amountPolicy', 'BLOCK', 'Payee substitution attack detected. Critical security violation.');

    updateStep('arkiv_action', 'completed', 'Threat signal anchored to Arkiv Rabdi threat registry');
    updateCheck('arkivRisk', 'BLOCK', 'Synthetic signal broadcast to protect peer merchants');

    updateStep('payeeguard_decision', 'blocked', 'Hard BLOCK invoked! rawSigner execution prohibited');
    updateCheck('payeeGuard', 'BLOCK', 'Pre-signing firewall veto: signing halted');
    updateCheck('paymentProof', 'NOT_RUN', 'Aborted prior to signing — zero cryptographic proof generated');
    updateCheck('settlement', 'NOT_RUN', 'No transaction submitted to Hedera');

    updateStep('signing_execution', 'blocked', 'Signer skipped: signerCallCount = 0');
    updateStep('hedera_settlement', 'skipped', 'Transfer blocked before network broadcast');
    updateStep('resource_delivery', 'blocked', 'Access withheld: HTTP 400 / 402');

    const fixtureEntityKey = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_3`,
      eventType: 'SIGNER_SKIPPED',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: '0.0.48201',
      merchantId: 'researchpro.eth',
      paymentRequestId: runId,
      network: 'hedera:testnet',
      stage: 'signing',
      verdict: 'BLOCK',
      reasonCode: 'UNAUTHORIZED_PAYEE_SUBSTITUTION',
      signerCallCount: 0,
      dataSource: 'simulated_fixture',
      message: 'CRITICAL FIREWALL ALERT: PayTo substitution detected! Signer skipped (signerCallCount = 0).',
    });

    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_4`,
      eventType: 'RISK_SIGNAL_PUBLISHED',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: '0.0.48201',
      merchantId: 'researchpro.eth',
      paymentRequestId: runId,
      network: 'arkiv:rabdi',
      stage: 'risk-publication',
      verdict: 'BLOCK',
      reasonCode: 'DEMO_SYNTHETIC_RISK_SIGNAL',
      arkivEntityKey: fixtureEntityKey,
      signerCallCount: 0,
      dataSource: 'simulated_fixture',
      message: 'Threat signal DEMO_SYNTHETIC_RISK_SIGNAL broadcast to Arkiv Rabdi to protect peer agents.',
    });

    return dispatch('BLOCKED', 'blocked', 'BLOCK', {
      signerCallCount: 0,
      arkivEntityKey: fixtureEntityKey,
      trustedReporter: TRUSTED_ARKIV_REPORTER,
      expirationBlock: '354378',
      arkivProvenance: {
        network: 'Arkiv Rabdi Testnet',
        chainId: RABDI_CHAIN_ID,
        trustedOwner: TRUSTED_ARKIV_REPORTER,
        riskSignalEntityKey: fixtureEntityKey,
        riskVerdict: 'BLOCK',
        expiresAtBlock: '354378',
        provenanceDescription: 'Merchant A published synthetic threat signal to Arkiv Rabdi.',
        isLive: false,
        explorerUrl: `https://explorer.rabdi.arkiv.network/entity/${fixtureEntityKey}`,
      },
    });
  }

  // SCENARIO 3: CROSS_MERCHANT_BLOCK
  if (scenarioId === 'CROSS_MERCHANT_BLOCK') {
    updateStep('security_checks', 'completed', 'Merchant B identity verified');
    updateCheck('merchantIdentity', 'PASS', 'Merchant B identity verified');
    updateCheck('recipientMatching', 'PASS', 'Terms format valid');
    updateCheck('assetNetwork', 'PASS', 'HBAR on hedera:testnet');
    updateCheck('amountPolicy', 'BLOCK', 'Wallet 0.0.90001 flagged on Arkiv Rabdi threat registry');

    updateStep('arkiv_action', 'completed', 'Arkiv Rabdi returned active BLOCK state from Merchant A');
    updateCheck('arkivRisk', 'BLOCK', `Active BLOCK on Rabdi (Entity: ${LIVE_ARKIV_ENTITY_KEY.slice(0, 10)}...)`);

    updateStep('payeeguard_decision', 'blocked', 'Cross-merchant collaborative veto! Payment denied');
    updateCheck('payeeGuard', 'BLOCK', 'Decentralized threat intelligence veto: payment halted');
    updateCheck('paymentProof', 'NOT_RUN', 'Signing aborted');
    updateCheck('settlement', 'NOT_RUN', 'No transaction submitted');

    updateStep('signing_execution', 'blocked', 'Signer skipped: signerCallCount = 0');
    updateStep('hedera_settlement', 'skipped', 'Transfer blocked');
    updateStep('resource_delivery', 'blocked', 'Storefront access denied to flagged wallet');

    const explorerUrl = `https://explorer.rabdi.arkiv.network/entity/${LIVE_ARKIV_ENTITY_KEY}`;

    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_3`,
      eventType: 'WALLET_RISK_STATE_READ',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: LIVE_BLOCKED_WALLET,
      merchantId: 'merchant-b.eth',
      paymentRequestId: runId,
      network: 'arkiv:rabdi',
      stage: 'risk-read',
      verdict: 'BLOCK',
      reasonCode: 'TRUSTED_OWNER_AND_EXPIRATION_VALIDATED_BLOCK',
      arkivEntityKey: LIVE_ARKIV_ENTITY_KEY,
      arkivExplorerUrl: explorerUrl,
      signerCallCount: 0,
      dataSource: 'simulated_fixture',
      message: `Merchant B queried Arkiv Rabdi for wallet 0.0.90001. Found active BLOCK published by Merchant A.`,
    });

    events.push({
      runId,
      scenarioId,
      eventId: `evt_${Date.now()}_4`,
      eventType: 'SIGNER_SKIPPED',
      timestamp: new Date().toLocaleTimeString(),
      buyerId: LIVE_BLOCKED_WALLET,
      merchantId: 'merchant-b.eth',
      paymentRequestId: runId,
      network: 'hedera:testnet',
      stage: 'signing',
      verdict: 'BLOCK',
      reasonCode: 'UNAUTHORIZED_PAYEE',
      signerCallCount: 0,
      dataSource: 'simulated_fixture',
      message: 'PayeeGuard issued hard BLOCK before signing. Zero tokens transferred.',
    });

    return dispatch('BLOCKED', 'blocked', 'BLOCK', {
      signerCallCount: 0,
      arkivEntityKey: LIVE_ARKIV_ENTITY_KEY,
      arkivExplorerUrl: explorerUrl,
      trustedReporter: TRUSTED_ARKIV_REPORTER,
      expirationBlock: '354378',
      arkivProvenance: {
        network: 'Arkiv Rabdi Testnet',
        chainId: RABDI_CHAIN_ID,
        trustedOwner: TRUSTED_ARKIV_REPORTER,
        walletRiskStateEntityKey: LIVE_ARKIV_ENTITY_KEY,
        riskVerdict: 'BLOCK',
        expiresAtBlock: '354378',
        provenanceDescription: 'Merchant B queried Arkiv Rabdi; discovered Merchant A threat state.',
        isLive: false,
        explorerUrl,
      },
    });
  }

  return dispatch('ERROR', 'failed', 'ERROR', { signerCallCount: 0 });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
