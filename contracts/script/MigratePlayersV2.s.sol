// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";
import {CloudFC} from "../src/CloudFC.sol";
import {CloudFCLootbox} from "../src/CloudFCLootbox.sol";

/// @notice Full migration: deploy new Players V2, re-mint 90 existing players
///         with same stats/owners, mint 10 ultra-rares, deploy new CloudFC + Lootbox,
///         wire up roles.
///
/// Usage:
///   OLD_PLAYERS=0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4 \
///   OLD_LOOTBOX=0xC4D862407C95A23776675391bf86A4b92dd93317 \
///   forge script script/MigratePlayersV2.s.sol --rpc-url base --broadcast --verify
contract MigratePlayersV2 is Script {
    uint256 constant EXISTING_PLAYERS = 90;
    uint256 constant ULTRA_RARES = 10;
    string constant IMAGE_BASE_URI = "https://clawsociety.fun/api/card/";

    struct MigrationData {
        address[] owners;
        uint8[] speeds;
        uint8[] passings;
        uint8[] shootings;
        uint8[] defenses;
        uint8[] staminas;
    }

    function _readOldPlayers(CloudFCPlayers oldPlayers) internal view returns (MigrationData memory data) {
        data.owners = new address[](EXISTING_PLAYERS);
        data.speeds = new uint8[](EXISTING_PLAYERS);
        data.passings = new uint8[](EXISTING_PLAYERS);
        data.shootings = new uint8[](EXISTING_PLAYERS);
        data.defenses = new uint8[](EXISTING_PLAYERS);
        data.staminas = new uint8[](EXISTING_PLAYERS);

        for (uint256 i; i < EXISTING_PLAYERS; ++i) {
            data.owners[i] = oldPlayers.ownerOf(i);
            (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = oldPlayers.getStats(i);
            data.speeds[i] = spd;
            data.passings[i] = pas;
            data.shootings[i] = sho;
            data.defenses[i] = def;
            data.staminas[i] = sta;
        }
    }

    function _mintUltraRares(CloudFCPlayers newPlayers, address to) internal {
        for (uint256 i; i < ULTRA_RARES; ++i) {
            bytes32 seed = keccak256(abi.encode("ULTRA_RARE", i));
            uint8 spd = 85 + uint8(uint256(keccak256(abi.encode(seed, uint256(0)))) % 16);
            uint8 pas = 85 + uint8(uint256(keccak256(abi.encode(seed, uint256(1)))) % 16);
            uint8 sho = 85 + uint8(uint256(keccak256(abi.encode(seed, uint256(2)))) % 16);
            uint8 def = 85 + uint8(uint256(keccak256(abi.encode(seed, uint256(3)))) % 16);
            uint8 sta = 85 + uint8(uint256(keccak256(abi.encode(seed, uint256(4)))) % 16);
            newPlayers.mint(to, spd, pas, sho, def, sta);
        }
    }

    function run() external {
        CloudFCPlayers oldPlayers = CloudFCPlayers(vm.envAddress("OLD_PLAYERS"));
        CloudFCLootbox oldLootbox = CloudFCLootbox(vm.envAddress("OLD_LOOTBOX"));

        address protocolFeeReceiver = oldLootbox.protocolFeeReceiver();
        address treasuryReceiver = oldLootbox.treasuryReceiver();

        console2.log("Protocol fee receiver:", protocolFeeReceiver);
        console2.log("Treasury receiver:", treasuryReceiver);

        // Read all 90 players from old contract (view calls, no broadcast needed)
        console2.log("Reading 90 players from old contract...");
        MigrationData memory data = _readOldPlayers(oldPlayers);
        console2.log("All 90 players read successfully");

        // ── Broadcast all state-changing txs ──────────────────────────────
        vm.startBroadcast();

        // 1. Deploy new CloudFCPlayers
        CloudFCPlayers newPlayers = new CloudFCPlayers();
        console2.log("New CloudFCPlayers:", address(newPlayers));

        // 2. Batch mint 90 existing players (same stats + owners)
        newPlayers.mintBatch(
            data.owners, data.speeds, data.passings,
            data.shootings, data.defenses, data.staminas
        );
        console2.log("Minted 90 existing players");

        // 3. Set image base URI
        newPlayers.setImageBaseURI(IMAGE_BASE_URI);

        // 4. Mint 10 ultra-rares (tokenIds 90-99) to deployer
        _mintUltraRares(newPlayers, msg.sender);
        console2.log("Minted 10 ultra-rare players (IDs 90-99)");

        // 5. Deploy new CloudFC
        CloudFC newFC = new CloudFC(address(newPlayers), protocolFeeReceiver);
        console2.log("New CloudFC:", address(newFC));

        // 6. Grant locker role
        newPlayers.setLocker(address(newFC), true);

        // 7. Deploy new Lootbox
        CloudFCLootbox newLootbox = new CloudFCLootbox(
            address(newPlayers), treasuryReceiver, protocolFeeReceiver
        );
        console2.log("New CloudFCLootbox:", address(newLootbox));

        // 8. Grant minter role
        newPlayers.setMinter(address(newLootbox), true);

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────
        console2.log("");
        console2.log("========================================");
        console2.log("  MIGRATION COMPLETE");
        console2.log("========================================");
        console2.log("NEXT_PUBLIC_CLOUDFC_PLAYERS_ADDRESS=", address(newPlayers));
        console2.log("NEXT_PUBLIC_CLOUDFC_ADDRESS=", address(newFC));
        console2.log("NEXT_PUBLIC_CLOUDFC_LOOTBOX_ADDRESS=", address(newLootbox));
    }
}
