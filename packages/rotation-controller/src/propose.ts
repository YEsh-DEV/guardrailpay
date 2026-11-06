import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ROTATION_CONTROLLER_ABI } from './abi.js';

export interface ProposeOptions {
  contractAddress: `0x${string}`;
  rpcUrl?: string;
  treasuryPrivateKey: `0x${string}`;
  newPayTo: string;
}

export async function proposeRotationOnChain({
  contractAddress,
  rpcUrl = 'https://rpc.sepolia.org',
  treasuryPrivateKey,
  newPayTo,
}: ProposeOptions): Promise<{ txHash: string }> {
  const account = privateKeyToAccount(treasuryPrivateKey);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const txHash = await client.writeContract({
    address: contractAddress,
    abi: ROTATION_CONTROLLER_ABI,
    functionName: 'proposeRotation',
    args: [newPayTo],
  });

  return { txHash };
}
