// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RotationController.sol";

contract RotationControllerTest is Test {
    RotationController public controller;

    address public owner = address(1);
    address public treasury = address(2);
    address public approver = address(3);
    address public attacker = address(4);

    uint256 public constant DELAY = 90; // 90 seconds
    string public constant INITIAL_PAY_TO = "0.0.12345";
    string public constant NEW_PAY_TO = "0.0.99999";

    function setUp() public {
        vm.prank(owner);
        controller = new RotationController(treasury, approver, DELAY, INITIAL_PAY_TO);
    }

    function testInitialState() public view {
        assertEq(controller.activePayTo(), INITIAL_PAY_TO);
        assertEq(controller.treasury(), treasury);
        assertEq(controller.approver(), approver);
        assertEq(controller.rotationDelay(), DELAY);
    }

    function testProposeRotation() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);
        assertEq(id, 1);

        RotationController.Rotation memory r = controller.getRotation(id);
        assertEq(r.currentPayTo, INITIAL_PAY_TO);
        assertEq(r.pendingPayTo, NEW_PAY_TO);
        assertEq(uint256(r.status), uint256(RotationController.RotationStatus.PROPOSED));
        assertEq(controller.activePayTo(), INITIAL_PAY_TO); // Active remains unchanged
    }

    function testUnauthorizedProposeFails() public {
        vm.prank(attacker);
        vm.expectRevert(RotationController.Unauthorized.selector);
        controller.proposeRotation(NEW_PAY_TO);
    }

    function testApproveRotation() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);

        vm.prank(approver);
        controller.approveRotation(id);

        RotationController.Rotation memory r = controller.getRotation(id);
        assertEq(uint256(r.status), uint256(RotationController.RotationStatus.APPROVED));
        assertEq(r.effectiveAt, block.timestamp + DELAY);
    }

    function testUnauthorizedApproveFails() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);

        vm.prank(attacker);
        vm.expectRevert(RotationController.Unauthorized.selector);
        controller.approveRotation(id);
    }

    function testEarlyActivateFails() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);

        vm.prank(approver);
        controller.approveRotation(id);

        // Fast forward 50 seconds (less than 90s delay)
        vm.warp(block.timestamp + 50);

        vm.expectRevert(
            abi.encodeWithSelector(
                RotationController.DelayNotMet.selector,
                block.timestamp,
                block.timestamp + 40
            )
        );
        controller.activate(id);
    }

    function testActivateAfterDelaySucceeds() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);

        vm.prank(approver);
        controller.approveRotation(id);

        // Fast forward 91 seconds
        vm.warp(block.timestamp + 91);

        controller.activate(id);

        assertEq(controller.activePayTo(), NEW_PAY_TO);
        RotationController.Rotation memory r = controller.getRotation(id);
        assertEq(uint256(r.status), uint256(RotationController.RotationStatus.ACTIVE));
    }

    function testRevokePendingRotation() public {
        vm.prank(treasury);
        uint256 id = controller.proposeRotation(NEW_PAY_TO);

        vm.prank(treasury);
        controller.revoke(id);

        RotationController.Rotation memory r = controller.getRotation(id);
        assertEq(uint256(r.status), uint256(RotationController.RotationStatus.REVOKED));

        // Approving or activating a revoked rotation should fail
        vm.prank(approver);
        vm.expectRevert();
        controller.approveRotation(id);
    }
}
