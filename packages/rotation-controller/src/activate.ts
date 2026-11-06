import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ROTATION_CONTROLLER_ABI } from './abi.js';

export interface ActivateOptions {
  contractAddress: `0x${string}`;
  rpcUrl?: string;
  callerPrivateKey: `0x${string}`;
  rotationId: bigint;
}

export async function activateRotationOnChain({
  contractAddress,
  rpcUrl = 'https://rpc.sepolia.org',
  callerPrivateKey,
  rotationId,
}: ActivateOptions): Promise<{ txHash: string }> {
  const account = privateKeyToAccount(callerPrivateKey);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const txHash = await client.writeContract({
    address: contractAddress,
    abi: ROTATION_CONTROLLER_ABI,
    functionName: 'activate',
    args: [rotationId],
  });

  return { txHash };
}
