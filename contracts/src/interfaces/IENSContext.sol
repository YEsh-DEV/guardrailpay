// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal interfaces verified against ensdomains/namechain revision
/// 48b3e2d39513b9dd32ef1850877a29009bc807b9, NOT a claim about deployed bytecode.
interface IQuoteSealResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
    function getAlias(bytes memory name) external view returns (bytes memory);
}

interface IQuoteSealRegistry {
    function getSubregistry(string calldata label) external view returns (address);
    function getResolver(string calldata label) external view returns (address);
    function findOwner(string calldata label) external view returns (address);
    function findExpiry(string calldata label) external view returns (uint64);
}
