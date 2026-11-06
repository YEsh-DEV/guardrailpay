import {
  encodeAbiParameters,
  keccak256,
  stringToBytes,
  type Address,
  type Hex
} from 'viem';

export interface ComputeProposalIdParams {
  controllerAddress: Address;
  chainId: number | bigint;
  merchantId: Hex;
  proposalNonce: number | bigint;
  operatorAddress: Address;
  activePayTo: string;
  newPayTo: string;
  proposalExpiry: number | bigint;
}

/**
 * Computes canonical Proposal ID matching RotationController.sol:
 * keccak256(abi.encode(controller, chainid, merchantId, nonce, operator, _hash(activePayTo), _hash(newPayTo), proposalExpiry))
 */
export function computeProposalId(params: ComputeProposalIdParams): Hex {
  const activePayToHash = keccak256(stringToBytes(params.activePayTo));
  const newPayToHash = keccak256(stringToBytes(params.newPayTo));

  const encoded = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint64' }
    ],
    [
      params.controllerAddress,
      BigInt(params.chainId),
      params.merchantId,
      BigInt(params.proposalNonce),
      params.operatorAddress,
      activePayToHash,
      newPayToHash,
      BigInt(params.proposalExpiry)
    ]
  );

  return keccak256(encoded);
}
