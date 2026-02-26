// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";
import {CloudFC} from "../src/CloudFC.sol";
import {CloudFCLootbox} from "../src/CloudFCLootbox.sol";

/// @notice Deploys CloudFC module: Players + Match Engine + Lootbox
///         Sets up minter/locker roles for cross-contract authorization.
///
/// Usage:
///   PROTOCOL_FEE_RECEIVER=0x... \
///   forge script script/DeployCloudFC.s.sol --rpc-url base --broadcast --verify
contract DeployCloudFC is Script {
    function run() external {
        address protocolFeeReceiver = vm.envAddress("PROTOCOL_FEE_RECEIVER");

        vm.startBroadcast();

        // 1. Deploy Players NFT
        CloudFCPlayers players = new CloudFCPlayers();
        console2.log("CloudFCPlayers:", address(players));

        // 2. Deploy Match Engine (V2: no treasury param)
        CloudFC fc = new CloudFC(address(players), protocolFeeReceiver);
        console2.log("CloudFC:", address(fc));

        // 3. Deploy Lootbox
        CloudFCLootbox lootbox = new CloudFCLootbox(address(players), protocolFeeReceiver, protocolFeeReceiver);
        console2.log("CloudFCLootbox:", address(lootbox));

        // 4. Authorize: CloudFC can lock/unlock players
        players.setLocker(address(fc), true);
        console2.log("CloudFC authorized as locker");

        // 5. Authorize: Lootbox can mint players
        players.setMinter(address(lootbox), true);
        console2.log("CloudFCLootbox authorized as minter");

        vm.stopBroadcast();

        // Summary
        console2.log("");
        console2.log("=== CloudFC Module Deployed ===");
        console2.log("NEXT_PUBLIC_CLOUDFC_PLAYERS_ADDRESS=", address(players));
        console2.log("NEXT_PUBLIC_CLOUDFC_ADDRESS=", address(fc));
        console2.log("NEXT_PUBLIC_CLOUDFC_LOOTBOX_ADDRESS=", address(lootbox));
    }
}
