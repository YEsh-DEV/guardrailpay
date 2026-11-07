import { ExpirationTime } from '@arkiv-network/sdk';
import type { CreateEntityValues } from '@arkiv-network/sdk/schema';
import { u64 } from '@arkiv-network/sdk/schema';
import { getAddress, type Address, type Hex } from 'viem';
import { z } from 'zod';
import {
  ArkivQueryError,
  ArkivWriteError,
  ExpiredArkivEntityError,
  UntrustedArkivEntityError,
} from './errors.js';
import { RiskSignal, RISK_SIGNAL_SCHEMA_TAG } from './schema.js';

const hederaAccountId = /^\d+\.\d+\.\d+(?:-[a-z]+)?$/;
const evmAddress = /^0x[0-9a-fA-F]{40}$/;

export function isSupportedWalletKey(value: string): boolean {
  return hederaAccountId.test(value) || evmAddress.test(value);
}

export const RiskSignalInputSchema = z.object({
  walletKey: z
    .string()
    .trim()
    .max(128)
    .refine(isSupportedWalletKey, 'walletKey must be a Hedera account ID or EVM address'),
  network: z.string().trim().min(1).max(128),
  signalCode: z.string().trim().min(1).max(128),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  source: z.string().trim().min(1).max(128),
  observedAt: z.bigint().nonnegative(),
  referenceId: z.string().trim().min(1).max(128),
  evidenceHash: z.string().trim().max(128).optional(),
  expirationHours: z.number().int().min(1).max(720).optional().default(24),
});

export type RiskSignalInput = z.input<typeof RiskSignalInputSchema>;
export type RiskSignalValues = CreateEntityValues<typeof RiskSignal>;

export interface RiskSignalSnapshot {
  $key: Hex;
  $owner: Address;
  $expiresAt: bigint;
  walletKey: { value: string };
  network: { value: string };
  signalCode: { value: string };
  referenceId: { value: string };
}

export interface CreatedRiskSignal {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
  isDuplicate?: boolean;
}

export interface RiskSignalStore {
  create(input: RiskSignalInput): Promise<CreatedRiskSignal>;
  read(entityKey: Hex): Promise<RiskSignalSnapshot>;
  findByReferenceId?(referenceId: string): Promise<RiskSignalSnapshot | null>;
}

export interface RiskSignalEvidence {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
  owner: Address;
  schemaTag: typeof RISK_SIGNAL_SCHEMA_TAG;
  walletKey: string;
  network: string;
  signalCode: string;
  referenceId: string;
  isDuplicate?: boolean;
}

export function createRiskSignalValues(input: RiskSignalInput): RiskSignalValues {
  const parsed = RiskSignalInputSchema.parse(input);

  return {
    walletKey: parsed.walletKey,
    network: parsed.network,
    signalCode: parsed.signalCode,
    severity: parsed.severity,
    source: parsed.source,
    observedAt: u64(parsed.observedAt),
    evidenceHash: parsed.evidenceHash,
    referenceId: parsed.referenceId,
  };
}

export function createRiskSignalStore({
  publicClient,
  walletClient,
  expectedOwner,
  findExistingByReferenceId,
}: {
  publicClient: {
    getEntity(entityKey: Hex, schema: typeof RiskSignal): Promise<RiskSignalSnapshot>;
    select?: any;
    getBlockNumber?(): Promise<bigint>;
  };
  walletClient: {
    account?: { address: Address };
    createEntity(
      schema: typeof RiskSignal,
      values: RiskSignalValues,
      options: { expiration: ReturnType<typeof ExpirationTime.fromHours>; flags: { readonly: true } }
    ): Promise<CreatedRiskSignal>;
  };
  expectedOwner?: Address;
  findExistingByReferenceId?: (referenceId: string) => Promise<RiskSignalSnapshot | null>;
}): RiskSignalStore {
  const ownerAddress = expectedOwner ?? walletClient.account?.address;

  async function lookupByReferenceId(referenceId: string): Promise<RiskSignalSnapshot | null> {
    if (findExistingByReferenceId) {
      return findExistingByReferenceId(referenceId);
    }

    if (typeof (publicClient as any).select === 'function') {
      try {
        let query = (publicClient as any)
          .select({
            $key: true,
            $owner: true,
            $expiresAt: true,
            walletKey: true,
            network: true,
            signalCode: true,
            referenceId: true,
          })
          .from(RiskSignal, { onMismatch: 'throw' });

        if (ownerAddress) {
          query = query.ownedBy(ownerAddress);
        }

        const result = await query.limit(25).fetch();
        const entities: RiskSignalSnapshot[] = result.entities ?? [];
        const match = entities.find((e) => e.referenceId.value === referenceId);
        return match ?? null;
      } catch (err: unknown) {
        throw new ArkivQueryError('Arkiv query for existing referenceId failed', err);
      }
    }

    return null;
  }

  return {
    async create(input) {
      const parsed = RiskSignalInputSchema.parse(input);

      // Deterministic idempotency: check if referenceId already published
      try {
        const existing = await lookupByReferenceId(parsed.referenceId);
        if (existing) {
          if (ownerAddress && getAddress(existing.$owner) !== getAddress(ownerAddress)) {
            throw new UntrustedArkivEntityError('Existing RiskSignal referenceId is owned by an untrusted writer');
          }
          return {
            entityKey: existing.$key,
            txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
            expiresAt: existing.$expiresAt,
            isDuplicate: true,
          };
        }
      } catch (err: unknown) {
        if (err instanceof UntrustedArkivEntityError) throw err;
        // If lookup query failed, throw ArkivQueryError
        if (err instanceof ArkivQueryError) throw err;
      }

      const expirationHours = parsed.expirationHours ?? 24;
      try {
        const created = await walletClient.createEntity(RiskSignal, createRiskSignalValues(parsed), {
          expiration: ExpirationTime.fromHours(expirationHours),
          flags: { readonly: true },
        });

        return {
          ...created,
          isDuplicate: false,
        };
      } catch (error) {
        throw new ArkivWriteError('Arkiv rejected the RiskSignal write', error);
      }
    },
    async read(entityKey) {
      try {
        return await publicClient.getEntity(entityKey, RiskSignal);
      } catch (error) {
        throw new ArkivQueryError('Arkiv RiskSignal query failed', error);
      }
    },
    findByReferenceId: lookupByReferenceId,
  };
}

export function verifyTrustedRiskSignal({
  created,
  entity,
  expectedOwner,
  currentBlock,
}: {
  created: CreatedRiskSignal;
  entity: RiskSignalSnapshot;
  expectedOwner: Address;
  currentBlock: bigint;
}): RiskSignalEvidence {
  if (entity.$key !== created.entityKey) {
    throw new ArkivQueryError('Arkiv returned a RiskSignal with an unexpected entity key');
  }

  if (getAddress(entity.$owner) !== getAddress(expectedOwner)) {
    throw new UntrustedArkivEntityError('Arkiv RiskSignal owner does not match the configured writer');
  }

  if (entity.$expiresAt !== created.expiresAt || entity.$expiresAt <= currentBlock) {
    throw new ExpiredArkivEntityError('Arkiv RiskSignal is expired or has an unexpected expiry block');
  }

  return {
    entityKey: created.entityKey,
    txHash: created.txHash,
    expiresAt: entity.$expiresAt,
    owner: getAddress(entity.$owner),
    schemaTag: RISK_SIGNAL_SCHEMA_TAG,
    walletKey: entity.walletKey.value,
    network: entity.network.value,
    signalCode: entity.signalCode.value,
    referenceId: entity.referenceId.value,
    isDuplicate: created.isDuplicate,
  };
}

export async function runRiskSignalSmokeTest({
  store,
  input,
  expectedOwner,
  currentBlock,
}: {
  store: RiskSignalStore;
  input: RiskSignalInput;
  expectedOwner: Address;
  currentBlock: () => Promise<bigint>;
}): Promise<RiskSignalEvidence> {
  const created = await store.create(input);
  const entity = await store.read(created.entityKey);
  const block = await currentBlock();

  return verifyTrustedRiskSignal({ created, entity, expectedOwner, currentBlock: block });
}
