import { getAddress, type Address, type Hex } from 'viem';
import { z } from 'zod';
import { createArkivWalletRiskStateQuery, createArkivWriteClient } from './client.js';
import type { ArkivWriteConfig } from './config.js';
import { ArkivConfigurationError } from './errors.js';
import {
  createRiskSignalStore,
  isSupportedWalletKey,
  type CreatedRiskSignal,
  type RiskSignalInput,
  type RiskSignalStore,
} from './riskSignal.js';
import {
  createWalletRiskStateStore,
  type UpsertWalletRiskStateResult,
  type WalletRiskStateInput,
  type WalletRiskStateStore,
  type WalletRiskStatus,
} from './riskState.js';

export const ReportSuspiciousWalletInputSchema = z.object({
  walletKey: z
    .string()
    .trim()
    .max(128)
    .refine(isSupportedWalletKey, 'walletKey must be a Hedera account ID or EVM address'),
  network: z.string().trim().min(1).max(128),
  signalCode: z.string().trim().min(1).max(128),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  source: z.string().trim().min(1).max(128).default('merchant-detector'),
  referenceId: z.string().trim().min(1).max(128),
  evidenceHash: z.string().trim().max(128).optional(),
  observedAt: z.bigint().nonnegative().optional(),
  status: z.enum(['ALLOW', 'REVIEW', 'BLOCK', 'UNKNOWN']).default('BLOCK'),
  score: z.string().trim().default('1.0'),
  policyVersion: z.string().trim().min(1).max(64).default('quoteseal-risk-v1'),
  expirationHours: z.number().int().min(1).max(720).optional().default(24),
});

export type ReportSuspiciousWalletInput = z.input<typeof ReportSuspiciousWalletInputSchema>;

export interface PublicationResult {
  writer: Address;
  signal: CreatedRiskSignal;
  riskState: UpsertWalletRiskStateResult;
}

export interface MerchantRiskPublisher {
  readonly writer: Address;
  reportSuspiciousWallet(input: ReportSuspiciousWalletInput): Promise<PublicationResult>;
  publishRiskSignal(input: RiskSignalInput): Promise<CreatedRiskSignal>;
  upsertWalletRiskState(input: WalletRiskStateInput): Promise<UpsertWalletRiskStateResult>;
}

export function createMerchantRiskPublisher(config: ArkivWriteConfig): MerchantRiskPublisher {
  if (!config.privateKey || !config.accessKey) {
    throw new ArkivConfigurationError('Valid Arkiv write configuration required');
  }

  const clients = createArkivWriteClient(config);
  const writer = getAddress(clients.account.address);

  const signalStore: RiskSignalStore = createRiskSignalStore({
    publicClient: {
      async getEntity(entityKey, schema) {
        const entity: any = await clients.publicClient.getEntity(entityKey, schema);
        return {
          $key: entity.$key,
          $owner: entity.$owner,
          $expiresAt: entity.$expiresAt,
          walletKey: entity.walletKey,
          network: entity.network,
          signalCode: entity.signalCode,
          referenceId: entity.referenceId,
        };
      },
      select: clients.publicClient.select.bind(clients.publicClient),
      getBlockNumber: () => clients.publicClient.getBlockNumber(),
    },
    walletClient: clients.walletClient,
    expectedOwner: writer,
  });

  const query = createArkivWalletRiskStateQuery(clients.publicClient, writer);

  const riskStateStore: WalletRiskStateStore = createWalletRiskStateStore({
    query,
    publicClient: clients.publicClient,
    walletClient: clients.walletClient,
    expectedOwner: writer,
  });

  return {
    writer,
    async reportSuspiciousWallet(rawInput: ReportSuspiciousWalletInput): Promise<PublicationResult> {
      const parsed = ReportSuspiciousWalletInputSchema.parse(rawInput);
      const observedAt = parsed.observedAt ?? BigInt(Math.floor(Date.now() / 1000));

      // 1. Publish append-only RiskSignal (with idempotency deduplication by referenceId)
      const signal = await signalStore.create({
        walletKey: parsed.walletKey,
        network: parsed.network,
        signalCode: parsed.signalCode,
        severity: parsed.severity,
        source: parsed.source,
        observedAt,
        referenceId: parsed.referenceId,
        evidenceHash: parsed.evidenceHash,
        expirationHours: parsed.expirationHours,
      });

      // 2. Upsert canonical WalletRiskState
      const riskState = await riskStateStore.upsert({
        walletKey: parsed.walletKey,
        network: parsed.network,
        status: parsed.status as WalletRiskStatus,
        score: parsed.score,
        policyVersion: parsed.policyVersion,
        signalCount: 1n,
        lastSignalAt: observedAt,
        computedAt: observedAt,
        expirationHours: parsed.expirationHours,
      });

      return {
        writer,
        signal,
        riskState,
      };
    },
    publishRiskSignal(input: RiskSignalInput): Promise<CreatedRiskSignal> {
      return signalStore.create(input);
    },
    upsertWalletRiskState(input: WalletRiskStateInput): Promise<UpsertWalletRiskStateResult> {
      return riskStateStore.upsert(input);
    },
  };
}
