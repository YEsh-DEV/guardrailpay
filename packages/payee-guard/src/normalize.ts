/**
 * Normalization utilities for QuoteSeal PayeeGuard.
 * Canonicalizes URLs, network IDs, assets, and account IDs to prevent bypasses.
 */

export function normalizeOrigin(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Invalid origin: URL must be a non-empty string');
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid origin URL: ${rawUrl}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Unsupported protocol in origin: ${protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  let port = parsed.port;

  // Remove default ports
  if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
    port = '';
  }

  const portSuffix = port ? `:${port}` : '';
  return `${protocol}//${hostname}${portSuffix}`;
}

export function normalizeNetworkId(rawNetwork: string): string {
  if (!rawNetwork || typeof rawNetwork !== 'string') {
    throw new Error('Invalid network ID: must be a non-empty string');
  }

  const cleaned = rawNetwork.trim().toLowerCase();

  // Canonical mapping
  switch (cleaned) {
    case 'hedera:testnet':
    case 'hedera-testnet':
      return 'hedera:testnet';
    case 'hedera:mainnet':
    case 'hedera-mainnet':
      return 'hedera:mainnet';
    case 'ethereum:sepolia':
    case 'sepolia':
    case 'eth:sepolia':
      return 'ethereum:sepolia';
    case 'ethereum:mainnet':
    case 'ethereum':
    case 'eth:mainnet':
      return 'ethereum:mainnet';
    default:
      return cleaned;
  }
}

export function normalizeAsset(rawAsset: string): string {
  if (!rawAsset || typeof rawAsset !== 'string') {
    throw new Error('Invalid asset identifier: must be a non-empty string');
  }

  const trimmed = rawAsset.trim();

  // If Hedera token ID (0.0.x)
  if (/^0\.0\.\d+$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed.toUpperCase();
}

export function normalizeAccountId(rawAccount: string): string {
  if (!rawAccount || typeof rawAccount !== 'string') {
    throw new Error('Invalid account ID: must be a non-empty string');
  }

  const trimmed = rawAccount.trim().toLowerCase();

  // Hedera account ID format: 0.0.12345 or with checksum e.g. 0.0.12345-abcde
  const hederaMatch = trimmed.match(/^(\d+\.\d+\.\d+)(-[a-z]+)?$/);
  if (hederaMatch && hederaMatch[1]) {
    return hederaMatch[1];
  }

  // EVM address: 0x...
  if (/^0x[a-f0-9]{40}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

export function normalizeAmount(rawAmount: bigint | string | number): bigint {
  if (typeof rawAmount === 'bigint') {
    if (rawAmount < 0n) throw new Error('Amount cannot be negative');
    return rawAmount;
  }

  if (typeof rawAmount === 'number') {
    if (!Number.isFinite(rawAmount) || rawAmount < 0 || !Number.isInteger(rawAmount)) {
      throw new Error(`Invalid numeric amount: ${rawAmount}`);
    }
    return BigInt(rawAmount);
  }

  if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`Invalid string amount: ${rawAmount}`);
    }
    return BigInt(trimmed);
  }

  throw new Error(`Unsupported amount format: ${typeof rawAmount}`);
}
