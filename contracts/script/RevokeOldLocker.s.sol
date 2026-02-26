// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";

/// @notice Revokes locker role from old CloudFC after all pending matches are resolved.
///         Run this ONLY after match 7 on old CloudFC is cancelled/resolved.
///
/// Usage:
///   CLOUDFC_PLAYERS=0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4 \
///   OLD_CLOUDFC=0x5D355C20E93F9fC26c1de3026eD79235ac090048 \
///   forge script script/RevokeOldLocker.s.sol --rpc-url base --broadcast
contract RevokeOldLocker is Script {
    function run() external {
        address playersAddr = vm.envAddress("CLOUDFC_PLAYERS");
        address oldFcAddr = vm.envAddress("OLD_CLOUDFC");

        CloudFCPlayers players = CloudFCPlayers(playersAddr);

        vm.startBroadcast();

        players.setLocker(oldFcAddr, false);
        console2.log("Old CloudFC locker revoked:", oldFcAddr);

        vm.stopBroadcast();
    }
}
