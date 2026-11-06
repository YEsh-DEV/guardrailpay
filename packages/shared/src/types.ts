export type NetworkId = 'hedera:testnet' | 'hedera:mainnet' | 'ethereum:sepolia' | 'ethereum:mainnet' | string;

export interface HashScanLinkOptions {
  network?: 'testnet' | 'mainnet' | 'previewnet';
  type: 'transaction' | 'account' | 'token' | 'topic';
  id: string;
}

export function getHashScanUrl({
  network = 'testnet',
  type,
  id,
}: HashScanLinkOptions): string {
  const prefix = network === 'mainnet' ? 'https://hashscan.io/mainnet' : `https://hashscan.io/${network}`;
  return `${prefix}/${type}/${encodeURIComponent(id)}`;
}

export interface HederaPaymentReceipt {
  transactionId: string;
  consensusTimestamp?: string;
  payerAccountId: string;
  recipientAccountId: string;
  amount: string;
  hashScanUrl: string;
}
