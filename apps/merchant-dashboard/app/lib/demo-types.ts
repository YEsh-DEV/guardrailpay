/**
 * Shared Type Definitions for QuoteSeal / GuardRail Pay Interactive Demo
 * Strict integration contract with Agent 1 stage 1 orchestration backend.
 */

export type ScenarioId = 'NORMAL_PAYMENT' | 'SUSPICIOUS_PAYMENT' | 'CROSS_MERCHANT_BLOCK';

export type DemoMode = 'fixture' | 'arkiv-live' | 'full-live';

export type DemoStage =
  | 'challenge'
  | 'firewall'
  | 'risk-publication'
  | 'risk-read'
  | 'signing'
  | 'settlement-verification'
  | 'access'
  | 'INITIATING'
  | 'CHALLENGE_ISSUED'
  | 'SECURITY_EVALUATION'
  | 'SIGNING'
  | 'SUBMITTING'
  | 'SETTLING'
  | 'RESOURCE_DELIVERY'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'ERROR';

export type SequenceStepId =
  | 'buyer_request'
  | 'merchant_challenge'
  | 'security_checks'
  | 'arkiv_action'
  | 'payeeguard_decision'
  | 'signing_execution'
  | 'hedera_settlement'
  | 'resource_delivery';

export type SequenceStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

export interface SequenceStepInfo {
  id: SequenceStepId;
  label: string;
  role: 'Buyer' | 'Merchant A' | 'Merchant B' | 'Arkiv' | 'Hedera' | 'PayeeGuard';
  status: SequenceStepStatus;
  detail: string;
}

export type SecurityCheckName =
  | 'merchantIdentity'
  | 'recipientMatching'
  | 'assetNetwork'
  | 'amountPolicy'
  | 'arkivRisk'
  | 'payeeGuard'
  | 'paymentProof'
  | 'settlement';

export type SecurityCheckStatus = 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE' | 'NOT_RUN';

export interface SecurityCheckResult {
  name: SecurityCheckName;
  label: string;
  status: SecurityCheckStatus;
  detail: string;
  timestamp?: string;
}

export type EventDataSource = 'fixture' | 'local' | 'arkiv-rabdi' | 'hedera-testnet' | 'simulated_fixture' | 'arkiv_live' | 'hedera_live';

export interface DemoEvent {
  runId: string;
  scenarioId: ScenarioId;
  eventId: string;
  eventType: string;
  timestamp: string;
  buyerId: string;
  merchantId: string;
  paymentRequestId: string;
  network: string;
  stage: DemoStage | string;
  verdict: 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE' | 'NOT_RUN' | 'ERROR';
  reasonCode: string;
  dataSource: EventDataSource;
  arkivEntityKey?: string;
  arkivExplorerUrl?: string;
  arkivTrustedOwner?: string;
  arkivExpiresAtBlock?: string;
  hederaTransactionId?: string;
  hederaHashScanUrl?: string;
  signerCallCount?: number;
  message?: string;
  rawPayload?: Record<string, any>;
  [key: string]: any;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  subtitle: string;
  description: string;
  badgeText: string;
  badgeType: 'success' | 'danger' | 'warning' | 'info';
  expectedVerdict: 'PASS' | 'BLOCK';
  supportedModes: DemoMode[];
  buyerAccount: string;
  merchantIdentity: string;
  targetNetwork: string;
  keyRule: string;
}

export interface ArkivProvenance {
  network: string;
  chainId: number;
  trustedOwner: string;
  riskSignalEntityKey?: string;
  walletRiskStateEntityKey?: string;
  riskVerdict?: 'BLOCK' | 'ALLOW' | 'REVIEW' | 'UNKNOWN';
  expiresAtBlock?: string;
  currentBlock?: string;
  provenanceDescription: string;
  isLive: boolean;
  explorerUrl?: string;
}

export interface BlockchainEvidence {
  hederaTransactionId?: string;
  hashScanUrl?: string;
  arkivEntityKey?: string;
  arkivExplorerUrl?: string;
  trustedReporter?: string;
  expirationBlock?: string;
  dataSource: DemoMode;
  isSimulated: boolean;
  signerCallCount: number;
  settlementVerified?: boolean;
  deliveredResource?: {
    id: string;
    title: string;
    contentType: string;
    payloadPreview: string;
  };
  arkivProvenance?: ArkivProvenance;
}

export interface LiveRunError {
  code: 'BACKEND_UNAVAILABLE' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'TIMEOUT' | 'SETTLEMENT_FAILED' | 'CONFIG_ERROR' | 'LIVE_DEPENDENCY_UNAVAILABLE';
  title: string;
  message: string;
  details?: string;
  httpStatus?: number;
}

export interface DemoRunState {
  runId: string;
  scenarioId: ScenarioId;
  mode: DemoMode;
  requestedMode?: DemoMode;
  isModeMismatch?: boolean;
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'failed';
  currentStage: DemoStage;
  startTime: string;
  endTime?: string;
  events: DemoEvent[];
  sequenceSteps: SequenceStepInfo[];
  securityChecks: SecurityCheckResult[];
  finalVerdict?: 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE' | 'ERROR';
  isSimulated: boolean;
  evidence: BlockchainEvidence;
  liveError?: LiveRunError;
  error?: string;
}
