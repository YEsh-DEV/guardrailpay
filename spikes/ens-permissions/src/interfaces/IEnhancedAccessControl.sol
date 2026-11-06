// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEnhancedAccessControl
/// @notice Interface for ENSv2 Enhanced Access Control (EAC)
/// @dev Based on ENSv2 documentation: https://docs.ens.domains/ensv2/enhanced-access-control/
///      ROOT_RESOURCE (0x0) grants override all resource-scoped grants.
///      Role constants are uint256 bitmasks. Callers need the ADMIN role of a role to grant/revoke it.
///      VERIFICATION STATUS: DOCUMENTED (from ENSv2 docs), ABI NOT YET VERIFIED ON DEPLOYED CONTRACT.
interface IEnhancedAccessControl {
    // =========================================================================
    // ERRORS
    // =========================================================================

    /// @notice Emitted when an account lacks required roles for a resource
    error EACUnauthorizedAccountRoles(uint256 resource, address account, uint256 roles);

    // =========================================================================
    // EVENTS
    // =========================================================================

    event RolesGranted(uint256 indexed resource, address indexed account, uint256 roles);
    event RolesRevoked(uint256 indexed resource, address indexed account, uint256 roles);

    // =========================================================================
    // ROLE CONSTANTS
    // =========================================================================
    // NOTE: These are the ENSv2 EAC role bitmask constants.
    // The actual numeric values are defined in the deployed contracts.
    // Values below are based on documented ENSv2 architecture patterns.
    // MUST BE VERIFIED against deployed contract bytecode during on-chain spike.
    //
    // Pattern: Each role occupies one bit. Admin role = role << 1 (or doubled).
    // e.g. if ROLE_SET_TEXT = 1 << 32, then ROLE_SET_TEXT_ADMIN = 1 << 33

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /// @notice Grant roles to an account for a specific resource
    /// @dev Caller must hold the ADMIN role for every role being granted.
    ///      Reverts for ROOT_RESOURCE; use grantRootRoles instead.
    /// @param resource The resource identifier (namehash, text key hash, etc.)
    /// @param account The address to grant roles to
    /// @param roles Bitmask of roles to grant
    function grantRoles(uint256 resource, address account, uint256 roles) external;

    /// @notice Revoke roles from an account for a specific resource
    /// @dev Caller must hold the ADMIN role for every role being revoked.
    ///      Reverts for ROOT_RESOURCE; use revokeRootRoles instead.
    /// @param resource The resource identifier
    /// @param account The address to revoke roles from
    /// @param roles Bitmask of roles to revoke
    function revokeRoles(uint256 resource, address account, uint256 roles) external;

    /// @notice Grant root-level roles (applies contract-wide)
    /// @dev ROOT_RESOURCE = 0x0. Root roles override all resource-scoped checks.
    /// @param account The address to grant root roles to
    /// @param roles Bitmask of roles to grant at root level
    function grantRootRoles(address account, uint256 roles) external;

    /// @notice Revoke root-level roles
    /// @param account The address to revoke root roles from
    /// @param roles Bitmask of roles to revoke at root level
    function revokeRootRoles(address account, uint256 roles) external;

    /// @notice Check if an account has specific roles for a resource
    /// @param resource The resource identifier
    /// @param account The address to check
    /// @param roles Bitmask of roles to verify
    /// @return True if account has ALL specified roles for the resource
    function hasRoles(uint256 resource, address account, uint256 roles) external view returns (bool);

    /// @notice Get all roles an account has for a specific resource
    /// @param resource The resource identifier
    /// @param account The address to query
    /// @return Bitmask of all roles held by account for resource
    function getRoles(uint256 resource, address account) external view returns (uint256);

    /// @notice Get root roles for an account
    /// @param account The address to query
    /// @return Bitmask of root-level roles
    function getRootRoles(address account) external view returns (uint256);
}
