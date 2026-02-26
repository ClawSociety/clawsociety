// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";
import {CloudFC} from "../src/CloudFC.sol";

/// @notice Migrates CloudFC to V2: deploys new match engine, grants locker role.
///         Existing CloudFCPlayers and CloudFCLootbox remain unchanged.
///         NOTE: Old CloudFC locker is NOT revoked here — pending matches must
///         be cancelled/resolved first. Run RevokeOldLocker.s.sol after.
///
/// Usage:
///   PROTOCOL_FEE_RECEIVER=0x... \
///   CLOUDFC_PLAYERS=0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4 \
///   forge script script/MigrateCloudFCV2.s.sol --rpc-url base --broadcast --verify
contract MigrateCloudFCV2 is Script {
    function run() external {
        address protocolFeeReceiver = vm.envAddress("PROTOCOL_FEE_RECEIVER");
        address playersAddr = vm.envAddress("CLOUDFC_PLAYERS");

        CloudFCPlayers players = CloudFCPlayers(playersAddr);

        vm.startBroadcast();

        // 1. Deploy CloudFC V2
        CloudFC fcV2 = new CloudFC(playersAddr, protocolFeeReceiver);
        console2.log("CloudFC V2:", address(fcV2));

        // 2. Authorize V2 as locker on existing Players contract
        players.setLocker(address(fcV2), true);
        console2.log("CloudFC V2 authorized as locker");

        // NOTE: Old CloudFC locker NOT revoked — match 7 still pending with locked players.
        // Run RevokeOldLocker.s.sol after all old matches are resolved/cancelled.

        vm.stopBroadcast();

        // Summary
        console2.log("");
        console2.log("=== CloudFC V2 Migration Complete ===");
        console2.log("NEXT_PUBLIC_CLOUDFC_ADDRESS=", address(fcV2));
        console2.log("Players (unchanged):", playersAddr);
        console2.log("Old CloudFC: 0x5D355C20E93F9fC26c1de3026eD79235ac090048 (locker still active - revoke after pending matches clear)");
    }
}
