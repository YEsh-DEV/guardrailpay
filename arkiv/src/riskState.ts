import { ExpirationTime } from '@arkiv-network/sdk';
import type { CreateEntityValues } from '@arkiv-network/sdk/schema';
import { dec, u64 } from '@arkiv-network/sdk/schema';
import { getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { z } from 'zod';
import {
  ArkivQueryError,
  ArkivWriteError,
} from './errors.js';
import { isSupportedWalletKey } from './riskSignal.js';
import { WalletRiskState } from './schema.js';

export type WalletRiskStatus = 'ALLOW' | 'REVIEW' | 'BLOCK' | 'UNKNOWN';

export const WalletRiskStatusSchema = z.enum(['ALLOW', 'REVIEW', 'BLOCK', 'UNKNOWN']);

export const WalletRiskStateInputSchema = z.object({
  walletKey: z
    .string()
    .trim()
    .max(128)
    .refine(isSupportedWalletKey, 'walletKey must be a Hedera account ID or EVM address'),
  network: z.string().trim().min(1).max(128),
  status: WalletRiskStatusSchema,
  score: z
    .string()
    .trim()
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 1;
    }, 'score must be a decimal string between 0 and 1'),
  policyVersion: z.string().trim().min(1).max(64),
  signalCount: z.bigint().nonnegative().default(1n),
  lastSignalAt: z.bigint().nonnegative(),
  computedAt: z.bigint().nonnegative().optional(),
  stateHash: z.string().trim().max(128).optional(),
  expirationHours: z.number().int().min(1).max(720).optional().default(24),
});

export type WalletRiskStateInput = z.input<typeof WalletRiskStateInputSchema>;
export type WalletRiskStateValues = CreateEntityValues<typeof WalletRiskState>;

export interface WalletRiskStateCandidate {
  $key: Hex;
  $owner: Address;
  $expiresAt: bigint;
  walletKey: { value: string };
  network: { value: string };
  status: { value: string };
  score: { value: string };
  policyVersion: { value: string };
  computedAt: { value: bigint };
  signalCount?: { value: bigint };
  lastSignalAt?: { value: bigint };
  stateHash?: { value: string };
}

export interface WalletRiskStatePage {
  blockNumber: bigint;
  candidates: readonly WalletRiskStateCandidate[];
}

export interface WalletRiskStateQuery {
  fetchWalletRiskStates(input: { walletKey: string; network: string }): Promise<WalletRiskStatePage>;
}

export type TrustedWalletRiskLookup =
  | { kind: 'trusted'; state: TrustedWalletRiskState }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

export interface TrustedWalletRiskState {
  entityKey: Hex;
  owner: Address;
  expiresAt: bigint;
  walletKey: string;
  network: string;
  status: WalletRiskStatus;
  score: string;
  policyVersion: string;
  computedAt: bigint;
}

export interface TrustedWalletRiskReader {
  getTrustedWalletRiskState(input: { walletKey: string; network: string }): Promise<TrustedWalletRiskLookup>;
}

export interface TrustedWalletRiskReaderOptions {
  timeoutMs?: number;
  retries?: number;
}

export type UpsertAction = 'created' | 'updated' | 'noop';

export interface UpsertWalletRiskStateResult {
  action: UpsertAction;
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
  status: WalletRiskStatus;
  score: string;
  policyVersion: string;
  signalCount: bigint;
  isDuplicate: boolean;
}

export interface WalletRiskStateStoreDependencies {
  query: WalletRiskStateQuery;
  publicClient?: {
    getBlockNumber?(): Promise<bigint>;
    getEntity?(entityKey: Hex, schema: typeof WalletRiskState): Promise<any>;
  };
  walletClient: {
    account?: { address: Address };
    createEntity(
      schema: typeof WalletRiskState,
      values: WalletRiskStateValues,
      options: { expiration: ReturnType<typeof ExpirationTime.fromHours>; flags?: { readonly?: boolean } }
    ): Promise<{ entityKey: Hex; txHash: Hex; expiresAt: bigint }>;
    patchEntity(
      schema: typeof WalletRiskState,
      entityKey: Hex,
      changes: { set?: Partial<WalletRiskStateValues>; unset?: readonly string[] }
    ): Promise<{ txHash: Hex; entityKey: Hex }>;
  };
  expectedOwner?: Address;
}

export interface WalletRiskStateStore {
  upsert(input: WalletRiskStateInput): Promise<UpsertWalletRiskStateResult>;
}

export function computeStateHash(values: {
  walletKey: string;
  network: string;
  status: string;
  score: string;
  policyVersion: string;
  signalCount: bigint;
  lastSignalAt: bigint;
}): string {
  const content = `${values.walletKey}:${values.network}:${values.status}:${values.score}:${values.policyVersion}:${values.signalCount.toString()}:${values.lastSignalAt.toString()}`;
  return keccak256(toHex(content));
}

export function createWalletRiskStateValues(input: WalletRiskStateInput): WalletRiskStateValues {
  const parsed = WalletRiskStateInputSchema.parse(input);
  const computedAt = parsed.computedAt ?? BigInt(Math.floor(Date.now() / 1000));
  const stateHash =
    parsed.stateHash ??
    computeStateHash({
      walletKey: parsed.walletKey,
      network: parsed.network,
      status: parsed.status,
      score: parsed.score,
      policyVersion: parsed.policyVersion,
      signalCount: parsed.signalCount,
      lastSignalAt: parsed.lastSignalAt,
    });

  return {
    walletKey: parsed.walletKey,
    network: parsed.network,
    status: parsed.status,
    score: dec(parsed.score),
    policyVersion: parsed.policyVersion,
    signalCount: u64(parsed.signalCount),
    lastSignalAt: u64(parsed.lastSignalAt),
    computedAt: u64(computedAt),
    stateHash,
  };
}

export function createWalletRiskStateStore(deps: WalletRiskStateStoreDependencies): WalletRiskStateStore {
  const authorizedWriter = deps.expectedOwner ?? deps.walletClient.account?.address;
  if (!authorizedWriter) {
    throw new ArkivWriteError('An authorized writer account is required for WalletRiskState publication');
  }

  const writer = getAddress(authorizedWriter);

  return {
    async upsert(input) {
      const parsed = WalletRiskStateInputSchema.parse(input);
      const computedAt = parsed.computedAt ?? BigInt(Math.floor(Date.now() / 1000));
      const stateHash =
        parsed.stateHash ??
        computeStateHash({
          walletKey: parsed.walletKey,
          network: parsed.network,
          status: parsed.status,
          score: parsed.score,
          policyVersion: parsed.policyVersion,
          signalCount: parsed.signalCount,
          lastSignalAt: parsed.lastSignalAt,
        });

      // 1. Query existing records for this wallet and network
      let page: WalletRiskStatePage;
      try {
        page = await deps.query.fetchWalletRiskStates({
          walletKey: parsed.walletKey,
          network: parsed.network,
        });
      } catch (err: unknown) {
        throw new ArkivQueryError('Arkiv query for existing WalletRiskState failed during upsert', err);
      }

      // 2. Filter for non-expired candidates owned by our authorized writer
      const activeCandidates = page.candidates.filter(
        (c) => getAddress(c.$owner) === writer && c.$expiresAt > page.blockNumber
      );

      // Pick current candidate
      const existing = activeCandidates.length > 0 ? chooseMostRestrictive(activeCandidates) : undefined;

      if (existing) {
        // Idempotency check: if status, score, policyVersion, and signalCount match, it is an idempotent no-op
        const statusMatches = existing.status.value === parsed.status;
        const scoreMatches = existing.score.value === parsed.score;
        const policyMatches = existing.policyVersion.value === parsed.policyVersion;
        const signalCountMatches = existing.signalCount
          ? existing.signalCount.value === parsed.signalCount
          : true;

        if (statusMatches && scoreMatches && policyMatches && signalCountMatches) {
          return {
            action: 'noop',
            entityKey: existing.$key,
            txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
            expiresAt: existing.$expiresAt,
            status: parsed.status,
            score: parsed.score,
            policyVersion: parsed.policyVersion,
            signalCount: parsed.signalCount,
            isDuplicate: true,
          };
        }

        // State has changed: update existing entity via patchEntity
        try {
          const patchResult = await deps.walletClient.patchEntity(WalletRiskState, existing.$key, {
            set: {
              status: parsed.status,
              score: dec(parsed.score),
              policyVersion: parsed.policyVersion,
              signalCount: u64(parsed.signalCount),
              lastSignalAt: u64(parsed.lastSignalAt),
              computedAt: u64(computedAt),
              stateHash,
            },
          });

          return {
            action: 'updated',
            entityKey: existing.$key,
            txHash: patchResult.txHash,
            expiresAt: existing.$expiresAt,
            status: parsed.status,
            score: parsed.score,
            policyVersion: parsed.policyVersion,
            signalCount: parsed.signalCount,
            isDuplicate: false,
          };
        } catch (patchErr: unknown) {
          // If patching failed (e.g. entity was created readonly), fall through to createEntity
        }
      }

      // 3. No existing active entity or patch failed: create a new mutable entity
      const expirationHours = parsed.expirationHours ?? 24;
      try {
        const createResult = await deps.walletClient.createEntity(
          WalletRiskState,
          {
            walletKey: parsed.walletKey,
            network: parsed.network,
            status: parsed.status,
            score: dec(parsed.score),
            policyVersion: parsed.policyVersion,
            signalCount: u64(parsed.signalCount),
            lastSignalAt: u64(parsed.lastSignalAt),
            computedAt: u64(computedAt),
            stateHash,
          },
          {
            expiration: ExpirationTime.fromHours(expirationHours),
            flags: { readonly: false }, // Mutable for upsert/patches
          }
        );

        return {
          action: 'created',
          entityKey: createResult.entityKey,
          txHash: createResult.txHash,
          expiresAt: createResult.expiresAt,
          status: parsed.status,
          score: parsed.score,
          policyVersion: parsed.policyVersion,
          signalCount: parsed.signalCount,
          isDuplicate: false,
        };
      } catch (writeErr: unknown) {
        throw new ArkivWriteError('Arkiv rejected the WalletRiskState write', writeErr);
      }
    },
  };
}

function isWalletRiskStatus(value: string): value is WalletRiskStatus {
  switch (value) {
    case 'ALLOW':
    case 'REVIEW':
    case 'BLOCK':
    case 'UNKNOWN':
      return true;
    default:
      return false;
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Arkiv query timed out after ${timeoutMs}ms`)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function isTrustedCandidate(
  candidate: WalletRiskStateCandidate,
  expectedOwner: Address,
  currentBlock: bigint,
  expectedWalletKey: string,
  expectedNetwork: string
): boolean {
  return (
    getAddress(candidate.$owner) === getAddress(expectedOwner) &&
    candidate.$expiresAt > currentBlock &&
    candidate.walletKey.value === expectedWalletKey &&
    candidate.network.value === expectedNetwork &&
    isWalletRiskStatus(candidate.status.value)
  );
}

function riskPriority(status: WalletRiskStatus): number {
  if (status === 'BLOCK') return 3;
  if (status === 'REVIEW') return 2;
  if (status === 'UNKNOWN') return 1;
  return 0;
}

export function chooseMostRestrictive(candidates: readonly WalletRiskStateCandidate[]): WalletRiskStateCandidate {
  return candidates.reduce((selected, candidate) => {
    const selectedStatus = selected.status.value;
    const candidateStatus = candidate.status.value;

    if (!isWalletRiskStatus(selectedStatus) || !isWalletRiskStatus(candidateStatus)) {
      return selected;
    }

    if (riskPriority(candidateStatus) > riskPriority(selectedStatus)) return candidate;
    if (
      riskPriority(candidateStatus) === riskPriority(selectedStatus) &&
      candidate.computedAt.value > selected.computedAt.value
    ) {
      return candidate;
    }
    return selected;
  });
}

export function createTrustedWalletRiskReader(
  query: WalletRiskStateQuery,
  expectedOwner: Address,
  options: TrustedWalletRiskReaderOptions = {}
): TrustedWalletRiskReader {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const retries = options.retries ?? 1;

  return {
    async getTrustedWalletRiskState(input) {
      let lastError: unknown;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const page = await withTimeout(query.fetchWalletRiskStates(input), timeoutMs);
          const trusted = page.candidates.filter((candidate) =>
            isTrustedCandidate(candidate, expectedOwner, page.blockNumber, input.walletKey, input.network)
          );

          if (trusted.length === 0) return { kind: 'not_found' };

          const selected = chooseMostRestrictive(trusted);
          const status = selected.status.value;
          if (!isWalletRiskStatus(status)) return { kind: 'not_found' };

          return {
            kind: 'trusted',
            state: {
              entityKey: selected.$key,
              owner: getAddress(selected.$owner),
              expiresAt: selected.$expiresAt,
              walletKey: selected.walletKey.value,
              network: selected.network.value,
              status,
              score: selected.score.value,
              policyVersion: selected.policyVersion.value,
              computedAt: selected.computedAt.value,
            },
          };
        } catch (error: unknown) {
          lastError = error;
        }
      }

      const message = lastError instanceof Error ? lastError.message : 'Unknown Arkiv query failure';
      return { kind: 'unavailable', reason: message };
    },
  };
}
