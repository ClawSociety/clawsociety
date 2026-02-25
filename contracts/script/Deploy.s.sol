// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ClawSocietyManager} from "../src/ClawSocietyManager.sol";

contract Deploy is Script {
    function run() external {
        address protocolFeeReceiver = vm.envAddress("PROTOCOL_FEE_RECEIVER");
        address creatorFeeReceiver = vm.envAddress("CREATOR_FEE_RECEIVER");

        vm.startBroadcast();

        ClawSocietyManager manager = new ClawSocietyManager(
            protocolFeeReceiver,
            creatorFeeReceiver
        );

        console2.log("ClawSocietyManager deployed at:", address(manager));
        console2.log("Owner:", manager.owner());

        vm.stopBroadcast();
    }
}
