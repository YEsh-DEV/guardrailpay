// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockPermissionedRegistry
/// @notice A local mock of ENSv2 Permissioned Registry for Foundry testing.
///
/// PURPOSE: Models the registry-level permissions for resolver assignment.
/// A key security concern for QuoteSeal is whether the merchant name owner
/// can point their ENS name at a rogue resolver, bypassing all resolver-level
/// EAC restrictions.
///
/// MOCK STATUS: Local simulation. Deployed Sepolia registry ABI must be verified.
contract MockPermissionedRegistry {
    // =========================================================================
    // ROLE CONSTANTS
    // =========================================================================

    uint256 public constant ROOT_RESOURCE = 0;
    uint256 public constant ROLE_SET_RESOLVER = 1 << 10;       // Change resolver for a name
    uint256 public constant ROLE_SET_RESOLVER_ADMIN = 1 << 11; // Admin of ROLE_SET_RESOLVER
    uint256 public constant ROLE_SET_OWNER = 1 << 12;          // Transfer name ownership
    uint256 public constant ROLE_SET_OWNER_ADMIN = 1 << 13;    // Admin of ROLE_SET_OWNER
    uint256 public constant ROLE_SUPERADMIN = type(uint256).max;

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    // Name records: namehash => NameRecord
    struct NameRecord {
        address owner;
        address resolver;
        uint64 expiry; // 0 = no expiry
    }

    mapping(bytes32 node => NameRecord) private _names;
    mapping(uint256 resource => mapping(address account => uint256 roles)) private _roles;

    // ERC-1155 operator approvals (name tokens can be transferred by approved operators)
    mapping(address owner_ => mapping(address operator => bool)) private _operatorApprovals;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event ResolverChanged(bytes32 indexed node, address resolver);
    event OwnerChanged(bytes32 indexed node, address owner);
    event ExpiryUpdated(bytes32 indexed node, uint64 expiry);
    event RolesGranted(uint256 indexed resource, address indexed account, uint256 roles);
    event RolesRevoked(uint256 indexed resource, address indexed account, uint256 roles);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error EACUnauthorizedAccountRoles(uint256 resource, address account, uint256 roles);
    error Unauthorized(string reason);

    // =========================================================================
    // REGISTRY SETUP (test helper - not on deployed contract)
    // =========================================================================

    constructor() {}

    /// @notice Register a name in the registry (test helper)
    function registerName(bytes32 node, address nameOwner, address resolver_, uint64 expiry_) external {
        _names[node] = NameRecord({owner: nameOwner, resolver: resolver_, expiry: expiry_});
        // Owner gets root roles over their name's resource
        _roles[uint256(node)][nameOwner] |= ROLE_SET_RESOLVER | ROLE_SET_OWNER;
        emit OwnerChanged(node, nameOwner);
        emit ResolverChanged(node, resolver_);
    }

    // =========================================================================
    // EAC INTERNALS
    // =========================================================================

    function _requireRoles(uint256 resource, address account, uint256 roles) internal view {
        // ROOT_RESOURCE overrides everything
        if (_roles[ROOT_RESOURCE][account] & roles == roles) return;
        // Resource-scoped roles
        if (resource != ROOT_RESOURCE && _roles[resource][account] & roles == roles) return;
        revert EACUnauthorizedAccountRoles(resource, account, roles);
    }

    function _requireAdminRoles(uint256 resource, address account, uint256 adminRoles) internal view {
        if (_roles[ROOT_RESOURCE][account] & ROLE_SUPERADMIN == ROLE_SUPERADMIN) return;
        if (_roles[ROOT_RESOURCE][account] & adminRoles == adminRoles) return;
        if (resource != ROOT_RESOURCE && _roles[resource][account] & adminRoles == adminRoles) return;
        revert EACUnauthorizedAccountRoles(resource, account, adminRoles);
    }

    // =========================================================================
    // NAME MANAGEMENT FUNCTIONS
    // =========================================================================

    /// @notice Change the resolver for a name
    /// @dev SECURITY CRITICAL for QuoteSeal:
    ///      If the merchant owner retains ROLE_SET_RESOLVER for their name node,
    ///      they can silently point the name at a rogue resolver, bypassing all
    ///      QuoteSeal's resolver-level EAC hardening.
    ///      MITIGATION: After hardening, revoke ROLE_SET_RESOLVER from owner,
    ///      or QuoteSeal pins the resolver address in trust anchors and treats
    ///      any change as HOLD requiring explicit re-trust.
    function setResolver(bytes32 node, address newResolver) external {
        _requireRoles(uint256(node), msg.sender, ROLE_SET_RESOLVER);

        address oldResolver = _names[node].resolver;
        _names[node].resolver = newResolver;

        emit ResolverChanged(node, newResolver);
    }

    function resolver(bytes32 node) external view returns (address) {
        return _names[node].resolver;
    }

    function owner(bytes32 node) external view returns (address) {
        return _names[node].owner;
    }

    function expiry(bytes32 node) external view returns (uint64) {
        return _names[node].expiry;
    }

    function setExpiry(bytes32 node, uint64 newExpiry) external {
        // Only owner or SUPERADMIN can change expiry (simplified mock)
        if (msg.sender != _names[node].owner && _roles[ROOT_RESOURCE][msg.sender] == 0) {
            revert Unauthorized("not owner");
        }
        _names[node].expiry = newExpiry;
        emit ExpiryUpdated(node, newExpiry);
    }

    // =========================================================================
    // ROLE MANAGEMENT (ERC-like)
    // =========================================================================

    function grantRoles(uint256 resource, address account, uint256 roles) external {
        uint256 adminRoles = _computeAdminRoles(roles);
        _requireAdminRoles(resource, msg.sender, adminRoles);
        _roles[resource][account] |= roles;
        emit RolesGranted(resource, account, roles);
    }

    function revokeRoles(uint256 resource, address account, uint256 roles) external {
        uint256 adminRoles = _computeAdminRoles(roles);
        _requireAdminRoles(resource, msg.sender, adminRoles);
        _roles[resource][account] &= ~roles;
        emit RolesRevoked(resource, account, roles);
    }

    function getRoles(uint256 resource, address account) external view returns (uint256) {
        return _roles[resource][account];
    }

    function hasRoles(uint256 resource, address account, uint256 roles) external view returns (bool) {
        if (_roles[ROOT_RESOURCE][account] & roles == roles) return true;
        return _roles[resource][account] & roles == roles;
    }

    // =========================================================================
    // ERC-1155 OPERATOR APPROVAL
    // =========================================================================

    /// @notice Grant operator approval (simulates ERC-1155 setApprovalForAll)
    /// @dev SECURITY NOTE: In ENSv2, ERC-1155 operator approval allows the
    ///      operator to TRANSFER name tokens. It does NOT grant resolver roles.
    ///      However, if the recipient of a transfer is an attacker, and
    ///      the registry auto-assigns resolver roles upon token receipt,
    ///      this could become a bypass vector.
    ///      FINDING: ENSv2 decouples token ownership from resolver roles.
    ///      Token transfer DOES NOT automatically inherit prior owner's roles.
    ///      This must be VERIFIED against deployed registry behavior.
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    /// @notice Simulate a name token transfer (ERC-1155 safeTransferFrom)
    /// @dev SECURITY: When a name token is transferred, the new owner does NOT
    ///      automatically gain resolver roles from the old owner. The resolver roles
    ///      remain assigned in the resolver contract. This models the ENSv2
    ///      decoupling of token ownership and access control.
    function transferName(bytes32 node, address from, address to) external {
        // Caller must be from, or approved operator
        require(
            msg.sender == from || _operatorApprovals[from][msg.sender],
            "not authorized"
        );
        require(_names[node].owner == from, "not name owner");

        _names[node].owner = to;
        // NOTE: The old owner's RESOLVER ROLES are NOT transferred.
        // The new owner gets the same REGISTRY-level roles (SET_RESOLVER, SET_OWNER)
        // but NOT the resolver's EAC role assignments.
        _roles[uint256(node)][to] |= ROLE_SET_RESOLVER | ROLE_SET_OWNER;
        // Revoke from old owner
        _roles[uint256(node)][from] = 0;

        emit OwnerChanged(node, to);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function _computeAdminRoles(uint256 roles) internal pure returns (uint256 adminRoles) {
        uint256 temp = roles;
        while (temp != 0) {
            uint256 bit = temp & (~temp + 1);
            adminRoles |= (bit << 1);
            temp &= temp - 1;
        }
    }
}
