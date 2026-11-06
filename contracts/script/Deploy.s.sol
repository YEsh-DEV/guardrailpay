// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RotationController.sol";

contract DeployScript is Script {
    function run() external returns (RotationController) {
        address treasury = vm.envOr("ROTATION_TREASURY", msg.sender);
        address approver = vm.envOr("ROTATION_APPROVER", msg.sender);
        uint256 delay = vm.envOr("ROTATION_DELAY_SECONDS", uint256(90));
        string memory initialPayTo = vm.envOr("INITIAL_PAY_TO", string("0.0.12345"));

        vm.startBroadcast();
        RotationController controller = new RotationController(
            treasury,
            approver,
            delay,
            initialPayTo
        );
        vm.stopBroadcast();

        return controller;
    }
}
