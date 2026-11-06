// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockPermissionedResolver
/// @notice A local mock of ENSv2 PermissionedResolver for Foundry testing.
///
/// PURPOSE: To test the QuoteSeal permission isolation model LOCALLY before
/// deploying and verifying on Sepolia.
///
/// MOCK STATUS: This is a LOCAL SIMULATION of the ENSv2 permission model.
/// It faithfully implements the documented EAC architecture:
///   - Resource-scoped roles (uint256 bitmask)
///   - ROOT_RESOURCE (0) overrides all scoped checks
///   - Admin roles control who can grant/revoke each role
///   - UUPS upgrade simulation
///
/// WHAT THIS PROVES: The correctness of QuoteSeal's permission isolation DESIGN.
/// WHAT REQUIRES SEPOLIA VERIFICATION: Exact role bitmask values, actual ABI
/// function selectors, deployed factory address, and proxy behavior.
///
/// VERIFICATION STATUS: MOCKED (architecture verified against ENSv2 docs).
/// Must be followed by on-chain Sepolia verification.
contract MockPermissionedResolver {
    // =========================================================================
    // ROLE CONSTANTS
    // =========================================================================
    // Based on ENSv2 EAC documented architecture (bit-shifted uint256 bitmasks).
    // ACTUAL VALUES must be verified against deployed contract.
    // Using documented pattern: operational roles + admin counterpart at bit+1.

    uint256 public constant ROOT_RESOURCE = 0;

    // Operational roles (powers of 2)
    uint256 public constant ROLE_SET_TEXT = 1 << 32;         // Write text records
    uint256 public constant ROLE_SET_ADDR = 1 << 34;         // Write address records
    uint256 public constant ROLE_SET_CONTENTHASH = 1 << 36;  // Write contenthash
    uint256 public constant ROLE_UPGRADE = 1 << 100;         // Upgrade proxy impl
    uint256 public constant ROLE_LINK = 1 << 102;            // Relink node

    // Admin roles (allow granting/revoking the corresponding operational role)
    uint256 public constant ROLE_SET_TEXT_ADMIN = 1 << 33;        // Admin of ROLE_SET_TEXT
    uint256 public constant ROLE_SET_ADDR_ADMIN = 1 << 35;        // Admin of ROLE_SET_ADDR
    uint256 public constant ROLE_SET_CONTENTHASH_ADMIN = 1 << 37; // Admin of ROLE_SET_CONTENTHASH
    uint256 public constant ROLE_UPGRADE_ADMIN = 1 << 101;        // Admin of ROLE_UPGRADE
    uint256 public constant ROLE_LINK_ADMIN = 1 << 103;           // Admin of ROLE_LINK

    // Super-admin: can grant/revoke all roles including at ROOT_RESOURCE
    uint256 public constant ROLE_SUPERADMIN = type(uint256).max;

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    address public owner;
    address public implementation; // Current proxy implementation address

    // EAC role storage: resource => account => rolesBitmask
    mapping(uint256 resource => mapping(address account => uint256 roles)) private _roles;

    // Resolver storage: node => key => value
    mapping(bytes32 node => mapping(string key => string value)) private _textRecords;
    mapping(bytes32 node => address) private _addresses;

    // For ERC1155 approval tracking
    mapping(address owner_ => mapping(address operator => bool)) private _operatorApprovals;

    // Track whether the resolver has been "upgraded" (simulates UUPS upgrade)
    bool public isUpgraded;
    address public upgradedTo;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event RolesGranted(uint256 indexed resource, address indexed account, uint256 roles);
    event RolesRevoked(uint256 indexed resource, address indexed account, uint256 roles);
    event TextChanged(bytes32 indexed node, string indexed key, string value);
    event AddressChanged(bytes32 indexed node, address addr);
    event Upgraded(address indexed newImplementation);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error EACUnauthorizedAccountRoles(uint256 resource, address account, uint256 roles);
    error EACRootResourceNotAllowed();
    error Unauthorized(string reason);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _owner) {
        owner = _owner;
        implementation = address(this); // Self points to self initially (mock)

        // Owner starts with SUPERADMIN at ROOT_RESOURCE
        _roles[ROOT_RESOURCE][_owner] = ROLE_SUPERADMIN;

        emit RolesGranted(ROOT_RESOURCE, _owner, ROLE_SUPERADMIN);
    }

    // =========================================================================
    // EAC MODIFIERS
    // =========================================================================

    /// @dev Check that msg.sender holds the required admin roles for the resource.
    ///      ROOT_RESOURCE grants override all resource-scoped checks.
    function _requireAdminRoles(uint256 resource, uint256 adminRoles) internal view {
        // Check if caller has SUPERADMIN at ROOT level (overrides everything)
        if (_roles[ROOT_RESOURCE][msg.sender] & ROLE_SUPERADMIN == ROLE_SUPERADMIN) {
            return;
        }
        // Check if caller has the specific admin roles at ROOT_RESOURCE level
        if (_roles[ROOT_RESOURCE][msg.sender] & adminRoles == adminRoles) {
            return;
        }
        // Check if caller has the admin roles for the specific resource
        if (resource != ROOT_RESOURCE && _roles[resource][msg.sender] & adminRoles == adminRoles) {
            return;
        }
        revert EACUnauthorizedAccountRoles(resource, msg.sender, adminRoles);
    }

    /// @dev Check that msg.sender holds the required operational roles.
    ///      ROOT_RESOURCE grants override all resource-scoped checks.
    function _requireRoles(uint256 resource, uint256 requiredRoles) internal view {
        // Check ROOT_RESOURCE level first (root overrides scoped)
        if (_roles[ROOT_RESOURCE][msg.sender] & requiredRoles == requiredRoles) {
            return;
        }
        // Check resource-scoped roles
        if (resource != ROOT_RESOURCE && _roles[resource][msg.sender] & requiredRoles == requiredRoles) {
            return;
        }
        revert EACUnauthorizedAccountRoles(resource, msg.sender, requiredRoles);
    }

    // =========================================================================
    // EAC: ROLE MANAGEMENT FUNCTIONS
    // =========================================================================

    /// @notice Grant roles to an account for a specific resource
    /// @dev Rejects ROOT_RESOURCE to prevent accidental global escalations
    function grantRoles(uint256 resource, address account, uint256 roles) external {
        if (resource == ROOT_RESOURCE) revert EACRootResourceNotAllowed();

        // Determine which admin roles are needed to grant these operational roles
        uint256 requiredAdminRoles = _computeAdminRoles(roles);
        _requireAdminRoles(resource, requiredAdminRoles);

        _roles[resource][account] |= roles;
        emit RolesGranted(resource, account, roles);
    }

    /// @notice Revoke roles from an account for a specific resource
    function revokeRoles(uint256 resource, address account, uint256 roles) external {
        if (resource == ROOT_RESOURCE) revert EACRootResourceNotAllowed();

        uint256 requiredAdminRoles = _computeAdminRoles(roles);
        _requireAdminRoles(resource, requiredAdminRoles);

        _roles[resource][account] &= ~roles;
        emit RolesRevoked(resource, account, roles);
    }

    /// @notice Grant root-level roles (applies contract-wide)
    /// @dev Only SUPERADMIN can grant root roles to others
    function grantRootRoles(address account, uint256 roles) external {
        // Only SUPERADMIN at ROOT can grant root roles
        if (_roles[ROOT_RESOURCE][msg.sender] & ROLE_SUPERADMIN != ROLE_SUPERADMIN) {
            revert EACUnauthorizedAccountRoles(ROOT_RESOURCE, msg.sender, ROLE_SUPERADMIN);
        }
        _roles[ROOT_RESOURCE][account] |= roles;
        emit RolesGranted(ROOT_RESOURCE, account, roles);
    }

    /// @notice Revoke root-level roles
    function revokeRootRoles(address account, uint256 roles) external {
        if (_roles[ROOT_RESOURCE][msg.sender] & ROLE_SUPERADMIN != ROLE_SUPERADMIN) {
            revert EACUnauthorizedAccountRoles(ROOT_RESOURCE, msg.sender, ROLE_SUPERADMIN);
        }
        _roles[ROOT_RESOURCE][account] &= ~roles;
        emit RolesRevoked(ROOT_RESOURCE, account, roles);
    }

    /// @notice Check if account has specific roles for a resource
    function hasRoles(uint256 resource, address account, uint256 roles) external view returns (bool) {
        // ROOT overrides
        if (_roles[ROOT_RESOURCE][account] & roles == roles) return true;
        if (resource != ROOT_RESOURCE && _roles[resource][account] & roles == roles) return true;
        return false;
    }

    /// @notice Get all roles for an account at a specific resource
    function getRoles(uint256 resource, address account) external view returns (uint256) {
        return _roles[resource][account];
    }

    /// @notice Get root-level roles for an account
    function getRootRoles(address account) external view returns (uint256) {
        return _roles[ROOT_RESOURCE][account];
    }

    // =========================================================================
    // TEXT RECORD FUNCTIONS
    // =========================================================================

    /// @notice Compute the resource identifier for a text key on a node
    /// @dev In ENSv2, text key resources are computed as keccak256(node, key).
    ///      This allows per-key permission scoping.
    ///      VERIFICATION: Exact resource computation must be verified on Sepolia.
    function computeTextResource(bytes32 node, string calldata key) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(node, key)));
    }

    /// @notice Set a text record
    /// @dev Requires ROLE_SET_TEXT for computeTextResource(node, key)
    ///      OR ROLE_SET_TEXT at ROOT_RESOURCE level
    function setText(bytes32 node, string calldata key, string calldata value) external {
        uint256 resource = computeTextResource(node, key);
        _requireRoles(resource, ROLE_SET_TEXT);

        _textRecords[node][key] = value;
        emit TextChanged(node, key, value);
    }

    /// @notice Get a text record
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _textRecords[node][key];
    }

    // =========================================================================
    // ADDRESS FUNCTIONS
    // =========================================================================

    function setAddr(bytes32 node, address addr_) external {
        _requireRoles(uint256(node), ROLE_SET_ADDR);
        _addresses[node] = addr_;
        emit AddressChanged(node, addr_);
    }

    function addr(bytes32 node) external view returns (address) {
        return _addresses[node];
    }

    // =========================================================================
    // UPGRADE FUNCTIONS (UUPS simulation)
    // =========================================================================

    /// @notice Upgrade the resolver implementation
    /// @dev SECURITY CRITICAL: Requires ROLE_UPGRADE at ROOT_RESOURCE or owner.
    ///      If the owner retains ROLE_UPGRADE, they can silently bypass all EAC
    ///      by deploying a new implementation with no access control.
    function upgradeTo(address newImpl) external {
        // Check ROLE_UPGRADE at ROOT level only (upgrade is a root-level operation)
        if (_roles[ROOT_RESOURCE][msg.sender] & ROLE_UPGRADE != ROLE_UPGRADE) {
            revert EACUnauthorizedAccountRoles(ROOT_RESOURCE, msg.sender, ROLE_UPGRADE);
        }

        // SIMULATED: Mark as upgraded and record new implementation
        isUpgraded = true;
        upgradedTo = newImpl;
        implementation = newImpl;

        emit Upgraded(newImpl);
    }

    // =========================================================================
    // ERC-1155 OPERATOR APPROVAL (from Registry — simulated on resolver)
    // =========================================================================

    /// @notice Approve an operator to act on behalf of msg.sender
    /// @dev SECURITY NOTE: In ENSv2, ERC-1155 operator approvals and resolver
    ///      roles are DECOUPLED by design. An approved ERC-1155 operator does NOT
    ///      inherit the owner's resolver roles. This must be verified on Sepolia.
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    // =========================================================================
    // OWNER MANAGEMENT (mimics UUPS ownable pattern)
    // =========================================================================

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized("not owner");

        // Transfer owner's ROOT_RESOURCE roles to new owner
        _roles[ROOT_RESOURCE][newOwner] = _roles[ROOT_RESOURCE][owner];
        _roles[ROOT_RESOURCE][owner] = 0;
        owner = newOwner;
    }

    function renounceOwnership() external {
        if (msg.sender != owner) revert Unauthorized("not owner");
        _roles[ROOT_RESOURCE][owner] = 0;
        owner = address(0);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /// @dev Compute which admin roles are required to grant/revoke the given roles
    ///      In the EAC model, each operational role has a corresponding admin role.
    ///      Admin roles are the operational role with the next bit set.
    function _computeAdminRoles(uint256 roles) internal pure returns (uint256 adminRoles) {
        // For each set bit in roles, set the corresponding admin bit
        // Pattern: admin_bit = operational_bit << 1
        uint256 temp = roles;
        while (temp != 0) {
            uint256 bit = temp & (~temp + 1); // isolate lowest set bit
            adminRoles |= (bit << 1);         // admin is next bit
            temp &= temp - 1;                 // clear lowest set bit
        }
    }
}
