// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEnhancedAccessControl} from "./IEnhancedAccessControl.sol";

/// @title IPermissionedResolver
/// @notice Interface for ENSv2 Permissioned Resolver (UUPS proxy pattern)
/// @dev Based on ENSv2 documentation: https://docs.ens.domains/ensv2/permissioned-resolver/
///      Each merchant MUST deploy a DEDICATED resolver instance.
///      Sharing a resolver instance creates cross-merchant privilege escalation.
///
///      KEY SECURITY FACTS (from ENSv2 docs):
///      1. Argument-scoped roles: a ROLE_SET_TEXT grant for key K applies across
///         ALL names hosted on this resolver, not just one name.
///      2. ROOT_RESOURCE grants override all scoped grants.
///      3. ROLE_UPGRADE allows upgrading the proxy implementation (UUPS).
///      4. ROLE_LINK allows relinking a node to a different record store.
///
///      VERIFICATION STATUS: DOCUMENTED. ABI signatures must be verified on-chain.
interface IPermissionedResolver is IEnhancedAccessControl {
    // =========================================================================
    // ROLE CONSTANTS (ENSv2 PermissionedResolver)
    // These bitmask values are DOCUMENTED patterns. Exact values must be
    // verified against deployed contract storage and bytecode during Spike 1.
    // =========================================================================

    // Text record setter role
    // Allows calling setText(bytes32 node, string key, string value)
    // SCOPED: When granted for a specific key resource, only that key can be set.
    // ROOT: When granted at ROOT_RESOURCE, ALL keys on ALL names can be set.
    // VERIFICATION: MUST VERIFY exact uint256 value against deployed contract.
    function ROLE_SET_TEXT() external pure returns (uint256);

    // Address setter role
    // Allows calling setAddr(bytes32 node, address addr)
    // VERIFICATION: MUST VERIFY exact uint256 value.
    function ROLE_SET_ADDR() external pure returns (uint256);

    // Content hash setter role
    // Allows calling setContenthash(bytes32 node, bytes calldata hash)
    // VERIFICATION: MUST VERIFY exact uint256 value.
    function ROLE_SET_CONTENTHASH() external pure returns (uint256);

    // UPGRADE role — allows upgrading the UUPS proxy implementation
    // CRITICAL SECURITY: If owner holds this role, they can replace the resolver
    // implementation with one that has no access control.
    // MITIGATION: This role must be renounced or placed under multisig/timelock.
    // VERIFICATION: MUST VERIFY exact uint256 value.
    function ROLE_UPGRADE() external pure returns (uint256);

    // LINK role — allows relinking a name node to a different record store
    // CRITICAL SECURITY: If abused, can redirect ENS resolution to a rogue store.
    // MITIGATION: This role must be tightly controlled or renounced.
    // VERIFICATION: MUST VERIFY exact uint256 value.
    function ROLE_LINK() external pure returns (uint256);

    // =========================================================================
    // RESOLVER STANDARD FUNCTIONS
    // =========================================================================

    /// @notice Set a text record
    /// @dev Requires ROLE_SET_TEXT for the appropriate resource
    /// @param node The ENS namehash
    /// @param key The text record key
    /// @param value The text record value
    function setText(bytes32 node, string calldata key, string calldata value) external;

    /// @notice Get a text record
    /// @param node The ENS namehash
    /// @param key The text record key
    /// @return value The text record value
    function text(bytes32 node, string calldata key) external view returns (string memory value);

    /// @notice Set the address record
    /// @dev Requires ROLE_SET_ADDR for the appropriate resource
    function setAddr(bytes32 node, address addr) external;

    /// @notice Get the address record
    function addr(bytes32 node) external view returns (address);

    /// @notice Set the content hash
    function setContenthash(bytes32 node, bytes calldata hash) external;

    /// @notice Get the content hash
    function contenthash(bytes32 node) external view returns (bytes memory);

    // =========================================================================
    // UPGRADE FUNCTION (UUPS)
    // =========================================================================

    /// @notice Upgrade the resolver proxy implementation
    /// @dev Requires ROLE_UPGRADE (or owner, depending on deployment)
    ///      SECURITY RISK: Upgrading to a permissionless implementation
    ///      bypasses all EAC role restrictions.
    /// @param newImplementation The address of the new implementation
    function upgradeTo(address newImplementation) external;

    /// @notice Get the current implementation address
    function implementation() external view returns (address);
}

/// @title IPermissionedRegistry
/// @notice Interface for ENSv2 Permissioned Registry
/// @dev Based on: https://docs.ens.domains/ensv2/permissioned-registry/
///      The registry tracks name ownership and resolver assignments.
///      ROLE_SET_RESOLVER on a name allows changing its resolver.
///      ROOT-level registry roles allow changes across all names.
interface IPermissionedRegistry is IEnhancedAccessControl {
    // Role to change the resolver for a name
    // SCOPED: for a specific name's namehash
    // ROOT: applies to all names in this registry
    // VERIFICATION: MUST VERIFY exact uint256 value.
    function ROLE_SET_RESOLVER() external pure returns (uint256);

    /// @notice Set the resolver for a name
    /// @dev Requires ROLE_SET_RESOLVER for the name's namehash resource
    ///      or ROOT_RESOURCE level ROLE_SET_RESOLVER
    /// @param node The ENS namehash
    /// @param resolver The new resolver address
    function setResolver(bytes32 node, address resolver) external;

    /// @notice Get the resolver for a name
    /// @param node The ENS namehash
    /// @return The resolver address
    function resolver(bytes32 node) external view returns (address);

    /// @notice Get the owner of a name
    /// @param node The ENS namehash
    /// @return The owner address
    function owner(bytes32 node) external view returns (address);

    /// @notice Transfer ownership of a name
    /// @param node The ENS namehash
    /// @param newOwner The new owner address
    function setOwner(bytes32 node, address newOwner) external;

    /// @notice Get the expiry of a name
    /// @param node The ENS namehash
    /// @return The expiry timestamp (0 = no expiry / permanent)
    function expiry(bytes32 node) external view returns (uint64);

    /// @notice ERC-1155 setApprovalForAll — SECURITY-CRITICAL
    /// @dev Approved operators can transfer ERC-1155 name tokens.
    ///      In ENSv2, token ownership and resolver control are DECOUPLED.
    ///      Transferring the ERC-1155 token does NOT inherently grant resolver roles.
    ///      However: if the new owner can re-enroll via the registry,
    ///      this must be evaluated per deployment.
    function setApprovalForAll(address operator, bool approved) external;

    /// @notice Check if an operator is approved for all names
    function isApprovedForAll(address account, address operator) external view returns (bool);
}
