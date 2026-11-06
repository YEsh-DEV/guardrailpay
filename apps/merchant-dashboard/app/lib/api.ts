export type VerdictStatus = 'PASS' | 'BLOCK' | 'HOLD' | 'UNVERIFIABLE';

export interface MerchantProfile {
  ensName: string;
  domain: string;
  network: string;
  chainId: number;
  activePayTo: string;
  allowedAsset: string;
  maxAmountUsdc: number;
  version: string;
  resolverAddress: string;
  isVerified: boolean;
}

export interface RotationProposal {
  id: string;
  proposedPayTo: string;
  proposer: string;
  proposedTimestamp: number;
  unlockTimestamp: number;
  worldIdVerified: boolean;
  nullifierHash: string;
  status: 'PENDING_WORLD_ID' | 'IN_DELAY' | 'READY_TO_ACTIVATE' | 'ACTIVATED' | 'REJECTED';
}

export interface RoleAssignment {
  role: 'ADMIN' | 'ROTATION_OPERATOR' | 'GUARD_OPERATOR' | 'SETTLEMENT_SIGNER';
  address: string;
  assignedAt: string;
  description: string;
}

export interface VerdictLog {
  id: string;
  timestamp: string;
  agent: string;
  endpoint: string;
  payToReceived: string;
  payToExpected: string;
  amount: string;
  network: string;
  status: VerdictStatus;
  reason: string;
  signerCalled: boolean;
  latencyMs: number;
  txId?: string;
  hashScanUrl?: string;
}

export const mockMerchantProfile: MerchantProfile = {
  ensName: 'researchpro.eth',
  domain: 'researchpro.ai',
  network: 'Hedera Testnet',
  chainId: 296,
  activePayTo: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
  allowedAsset: '0.0.456858 (USDC)',
  maxAmountUsdc: 50.0,
  version: 'v2.4',
  resolverAddress: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
  isVerified: true,
};

export const mockActiveRotation: RotationProposal = {
  id: 'rot_2026_11a',
  proposedPayTo: '0x3A2B5E871Cd09491024Af780Ce1129b14A0C901',
  proposer: '0x89201C3...2a1b',
  proposedTimestamp: Date.now() - 36 * 3600 * 1000, // 36h ago
  unlockTimestamp: Date.now() + 12 * 3600 * 1000, // 12h remaining
  worldIdVerified: true,
  nullifierHash: '0x87ab29c018...3f21b790',
  status: 'IN_DELAY',
};

export const mockRoles: RoleAssignment[] = [
  {
    role: 'ADMIN',
    address: '0x89201C38291f094B...2a1b',
    assignedAt: '2026-09-12',
    description: 'Can manage EAC contract roles, freeze payments, and emergency abort rotations.',
  },
  {
    role: 'ROTATION_OPERATOR',
    address: '0x3F1A44917B34c...9c4E',
    assignedAt: '2026-10-01',
    description: 'Authorized to propose new payTo addresses with valid World ID Agent Pass.',
  },
  {
    role: 'SETTLEMENT_SIGNER',
    address: '0x71Cf3D14C8b9E...8f4B',
    assignedAt: '2026-10-15',
    description: 'Designated Hedera wallet authorized to receive verified agent micropayments.',
  },
  {
    role: 'GUARD_OPERATOR',
    address: '0x1A098bc5182...456B',
    assignedAt: '2026-11-01',
    description: 'Automated QuoteSeal monitoring node with fast DNS/ENS cache synchronization.',
  },
];

export const initialVerdictLogs: VerdictLog[] = [
  {
    id: 'tx_001',
    timestamp: '16:48:12',
    agent: 'claude-research-agent/2.0',
    endpoint: '/api/research/paid',
    payToReceived: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    amount: '5.00 USDC',
    network: 'hedera:296',
    status: 'PASS',
    reason: 'Payee matches ENSv2 on-chain record for researchpro.eth. Within max limit.',
    signerCalled: true,
    latencyMs: 9,
    txId: '0.0.9841203@1730911692.000000000',
    hashScanUrl: 'https://hashscan.io/testnet/transaction/0.0.9841203@1730911692',
  },
  {
    id: 'tx_002',
    timestamp: '16:49:05',
    agent: 'curator-bot-v1',
    endpoint: '/api/research/paid',
    payToReceived: '0x9994F8c72aD5519a3929BC00dead1337caFE0000',
    payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    amount: '5.00 USDC',
    network: 'hedera:296',
    status: 'BLOCK',
    reason: 'Recipient mismatch: 402 payTo diverges from researchpro.eth ENS record. Signer never invoked.',
    signerCalled: false,
    latencyMs: 7,
  },
  {
    id: 'tx_003',
    timestamp: '16:50:41',
    agent: 'open-market-crawler',
    endpoint: '/api/datasets/summary',
    payToReceived: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    amount: '120.00 USDC',
    network: 'hedera:296',
    status: 'HOLD',
    reason: 'Amount exceeds ENS max limit (requested $120.00, max allowed $50.00). Transaction held.',
    signerCalled: false,
    latencyMs: 11,
  },
  {
    id: 'tx_004',
    timestamp: '16:51:22',
    agent: 'deep-indexer/3.1',
    endpoint: '/api/research/paid',
    payToReceived: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    payToExpected: '0x71Cf3D14C8b9E06f54b432aBDe456B7Df8f4B',
    amount: '2.50 USDC',
    network: 'hedera:296',
    status: 'PASS',
    reason: 'Verified against ENS resolver cache. Signer approved.',
    signerCalled: true,
    latencyMs: 8,
    txId: '0.0.9841288@1730911882.000000000',
    hashScanUrl: 'https://hashscan.io/testnet/transaction/0.0.9841288@1730911882',
  },
];
