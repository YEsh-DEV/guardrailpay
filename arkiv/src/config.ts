import { ArkivConfigurationError } from './errors.js';

export interface ArkivReadConfig {
  accessKey: string;
}

export interface ArkivWriteConfig extends ArkivReadConfig {
  privateKey: `0x${string}`;
}

type Environment = Record<string, string | undefined>;

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const formatted = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(formatted)) {
    throw new ArkivConfigurationError('ARKIV_PRIVATE_KEY must be a 32-byte hexadecimal key');
  }
  return formatted as `0x${string}`;
}

function requiredEnvironmentValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new ArkivConfigurationError(`${name} is required for Arkiv Rabdi access`);
  }
  return value;
}

export function loadArkivReadConfig(environment: Environment = process.env): ArkivReadConfig {
  return {
    accessKey: requiredEnvironmentValue(environment, 'ARKIV_ACCESS_KEY'),
  };
}

export function loadArkivWriteConfig(environment: Environment = process.env): ArkivWriteConfig {
  const accessKey = requiredEnvironmentValue(environment, 'ARKIV_ACCESS_KEY');
  const privateKeyRaw = requiredEnvironmentValue(environment, 'ARKIV_PRIVATE_KEY');
  const privateKey = normalizePrivateKey(privateKeyRaw);

  return { accessKey, privateKey };
}

export function loadArkivTrustedOwner(environment: Environment = process.env): `0x${string}` | undefined {
  const raw = environment.ARKIV_TRUSTED_OWNER?.trim();
  if (!raw) return undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw new ArkivConfigurationError('ARKIV_TRUSTED_OWNER must be a 20-byte 0x-prefixed address');
  }
  return raw as `0x${string}`;
}
