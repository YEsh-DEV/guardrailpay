// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockPermissionedResolver} from "./MockPermissionedResolver.sol";

/// @title MockRotationController
/// @notice Minimal RotationController that holds only the required resolver permission
/// @dev This is the ONLY entity that should be able to write quoteseal.activePayTo.
///      Used in Spike 1 to prove the permission isolation model works.
///
///      SCOPE: This is NOT the full RotationController (Spike 4).
///      This minimal contract only demonstrates the payout-key write permission.
contract MockRotationController {
    // =========================================================================
    // STATE
    // =========================================================================

    address public owner; // The QuoteSeal system administrator
    MockPermissionedResolver public resolver;
    bytes32 public merchantNode;

    // QuoteSeal profile key constants
    string public constant KEY_ACTIVE_PAY_TO = "quoteseal.activePayTo";
    string public constant KEY_PENDING_PAY_TO = "quoteseal.pendingPayTo";
    string public constant KEY_ROTATION_STATUS = "quoteseal.rotationStatus";
    string public constant KEY_PROFILE_VERSION = "quoteseal.profileVersion";

    // =========================================================================
    // EVENTS
    // =========================================================================

    event PayoutUpdated(bytes32 indexed node, string oldPayTo, string newPayTo);
    event ControllerInitialized(address resolver, bytes32 node);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error NotOwner();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _owner, address _resolver, bytes32 _merchantNode) {
        owner = _owner;
        resolver = MockPermissionedResolver(_resolver);
        merchantNode = _merchantNode;
        emit ControllerInitialized(_resolver, _merchantNode);
    }

    // =========================================================================
    // THE CRITICAL FUNCTION: Update payout address
    // =========================================================================

    /// @notice Update the active payout address in ENS
    /// @dev This is the ONLY function that calls setText for quoteseal.activePayTo.
    ///      In production: requires World ID approval + delay (Spike 4).
    ///      Here: only verifies the resolver permits this call.
    function updateActivePayTo(string calldata newPayTo) external {
        if (msg.sender != owner) revert NotOwner();

        // Read old value for event
        string memory oldPayTo = resolver.text(merchantNode, KEY_ACTIVE_PAY_TO);

        // This call will succeed ONLY if this contract holds
        // ROLE_SET_TEXT for computeTextResource(merchantNode, KEY_ACTIVE_PAY_TO)
        resolver.setText(merchantNode, KEY_ACTIVE_PAY_TO, newPayTo);

        emit PayoutUpdated(merchantNode, oldPayTo, newPayTo);
    }

    /// @notice Update rotation status record (informational mirror)
    function updateRotationStatus(string calldata status) external {
        if (msg.sender != owner) revert NotOwner();
        resolver.setText(merchantNode, KEY_ROTATION_STATUS, status);
    }

    /// @notice Update profile version after activation
    function updateProfileVersion(string calldata version) external {
        if (msg.sender != owner) revert NotOwner();
        resolver.setText(merchantNode, KEY_PROFILE_VERSION, version);
    }
}
