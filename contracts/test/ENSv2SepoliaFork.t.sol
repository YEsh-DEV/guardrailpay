// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

/// @notice Read-only integration check against ENS's published Sepolia deployments.
/// Run explicitly with ENS_SEPOLIA_RPC_URL set; this suite sends no transactions.
contract ENSv2SepoliaForkTest is Test {
    address private constant RESOLVER_IMPL = 0x115eb53F0c60696633855F90b138178Fb40b2b2C;
    address private constant ETH_REGISTRY = 0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4;
    address private constant ROOT_REGISTRY = 0xB458D6a3a77919449d03e7A6903C26827c1eC43f;
    address private constant UNIVERSAL_RESOLVER_V2 = 0x24E1D8e068620B647CA097f961A61055f4f42D72;

    function testPublishedSepoliaImplementationsAndResolverInterface() public {
        string memory rpc = vm.envOr("ENS_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 11155111);
        assertGt(RESOLVER_IMPL.code.length, 0);
        assertGt(ETH_REGISTRY.code.length, 0);
        assertGt(ROOT_REGISTRY.code.length, 0);
        assertGt(UNIVERSAL_RESOLVER_V2.code.length, 0);

        (bool ok, bytes memory result) = RESOLVER_IMPL.staticcall(
            abi.encodeWithSelector(bytes4(keccak256("supportsInterface(bytes4)")), bytes4(0x9061b923))
        );
        assertTrue(ok, "published resolver lacks supportsInterface");
        assertTrue(abi.decode(result, (bool)), "published resolver lacks ENSIP-10 resolve");
    }
}
