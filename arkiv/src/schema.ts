import { bool, dec, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';

export const RISK_SIGNAL_SCHEMA_TAG = 'quoteseal.risk-signal.v1';
export const WALLET_RISK_STATE_SCHEMA_TAG = 'quoteseal.wallet-risk-state.v1';
export const PAYMENT_DECISION_SCHEMA_TAG = 'quoteseal.payment-decision.v1';

export const RiskSignal = defineSchema(RISK_SIGNAL_SCHEMA_TAG, {
  walletKey: str().indexed(),
  network: str().indexed(),
  signalCode: str().indexed(),
  severity: str().indexed(),
  source: str().indexed(),
  observedAt: u64().indexed(),
  evidenceHash: str().optional(),
  referenceId: str().indexed(),
});

export const WalletRiskState = defineSchema(WALLET_RISK_STATE_SCHEMA_TAG, {
  walletKey: str().indexed(),
  network: str().indexed(),
  status: str().indexed(),
  score: dec().indexed(),
  policyVersion: str().indexed(),
  signalCount: u64(),
  lastSignalAt: u64().indexed(),
  computedAt: u64().indexed(),
  stateHash: str(),
});

export const PaymentDecision = defineSchema(PAYMENT_DECISION_SCHEMA_TAG, {
  decisionId: str().indexed(),
  requestHash: str().indexed(),
  walletKey: str().indexed(),
  network: str().indexed(),
  payTo: str().indexed(),
  amount: str(),
  asset: str().indexed(),
  verdict: str().indexed(),
  reasonCode: str().indexed(),
  profileVersion: str().indexed(),
  rotationId: str().optional(),
  signerCalled: bool().indexed(),
  evaluatedAt: u64().indexed(),
});
