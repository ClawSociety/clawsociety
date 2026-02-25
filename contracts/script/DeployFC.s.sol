// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ClawFC} from "../src/ClawFC.sol";

contract DeployFC is Script {
    function run() external {
        address managerAddress = vm.envAddress("MANAGER_ADDRESS");
        address feeReceiver = vm.envAddress("FEE_RECEIVER");

        vm.startBroadcast();

        ClawFC fc = new ClawFC(managerAddress, feeReceiver);

        console2.log("ClawFC deployed at:", address(fc));
        console2.log("Manager:", address(fc.manager()));
        console2.log("Fee Receiver:", fc.feeReceiver());

        vm.stopBroadcast();
    }
}
