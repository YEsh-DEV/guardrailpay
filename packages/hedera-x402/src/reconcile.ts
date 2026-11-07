export interface ReconcileResult {
  status: 'CONFIRMED' | 'FAILED' | 'PENDING' | 'UNCERTAIN';
  transactionId: string;
  result?: string;
  consensusTimestamp?: string;
  transfers?: Array<{ account: string; amount: number }>;
  memo?: string;
  reason?: string;
}

export function formatTransactionIdForMirrorNode(txId: string): string {
  // If already in mirror node format (e.g. 0.0.12345-1234567890-123456789), return it
  if (txId.includes('-') && !txId.includes('@')) {
    return txId;
  }
  // txId is in SDK format: accountId@seconds.nanos (e.g. 0.0.11338944@1794010060.845175208)
  const [account, time] = txId.split('@');
  if (!time) {
    return txId;
  }
  const formattedTime = time.replace('.', '-');
  return `${account}-${formattedTime}`;
}

export async function reconcileHederaTransaction(
  transactionId: string,
  options: {
    mirrorNodeUrl?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  } = {}
): Promise<ReconcileResult> {
  const baseUrl = options.mirrorNodeUrl || 'https://testnet.mirrornode.hedera.com';
  const timeoutMs = options.timeoutMs ?? 5_000;
  const fetcher = options.fetchFn ?? fetch;

  const formattedId = formatTransactionIdForMirrorNode(transactionId);
  const url = `${baseUrl}/api/v1/transactions/${formattedId}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetcher(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 404) {
      return {
        status: 'PENDING',
        transactionId,
        reason: 'Transaction not yet recorded by mirror node',
      };
    }

    if (!res.ok) {
      return {
        status: 'UNCERTAIN',
        transactionId,
        reason: `Mirror node HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as any;
    const transactions = data.transactions;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        status: 'PENDING',
        transactionId,
        reason: 'No transaction entries returned by mirror node',
      };
    }

    const tx = transactions[0];
    const isSuccess = tx.result === 'SUCCESS';
    const memo = tx.memo_base64
      ? Buffer.from(tx.memo_base64, 'base64').toString('utf8')
      : undefined;

    if (isSuccess) {
      return {
        status: 'CONFIRMED',
        transactionId,
        result: tx.result,
        consensusTimestamp: tx.consensus_timestamp,
        transfers: tx.transfers,
        memo,
      };
    }

    return {
      status: 'FAILED',
      transactionId,
      result: tx.result,
      reason: `Transaction settled with failed result: ${tx.result}`,
      transfers: tx.transfers,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      status: 'UNCERTAIN',
      transactionId,
      reason: err.name === 'AbortError' ? 'Mirror node request timed out' : err.message,
    };
  }
}
