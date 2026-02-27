// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";

/// @notice Mints 10 ultra-rare god-tier players (OVR 94-95) via mintBatch.
///         Two archetypes: 5 "Legends" (attack-focused) + 5 "Titans" (defense-focused).
///         All are Diamond tier (avg >= 80). Minted to admin wallet.
///
/// Usage:
///   CLOUDFC_PLAYERS=0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4 \
///   MINT_TO=0xYourAdminWallet \
///   forge script script/MintUltraRares.s.sol --rpc-url base --broadcast --verify
contract MintUltraRares is Script {
    function run() external {
        address playersAddr = vm.envAddress("CLOUDFC_PLAYERS");
        address mintTo = vm.envAddress("MINT_TO");

        CloudFCPlayers players = CloudFCPlayers(playersAddr);

        // 10 players: 5 Legends (attack) + 5 Titans (defense)
        uint256 count = 10;
        address[] memory recipients = new address[](count);
        uint8[] memory speeds   = new uint8[](count);
        uint8[] memory passings = new uint8[](count);
        uint8[] memory shootings = new uint8[](count);
        uint8[] memory defenses = new uint8[](count);
        uint8[] memory staminas = new uint8[](count);

        for (uint256 i; i < count; ++i) {
            recipients[i] = mintTo;
        }

        // ── Legends (Attack-focused) ──────────────────────────
        // #1: OVR 95
        speeds[0] = 98;  passings[0] = 95;  shootings[0] = 100; defenses[0] = 90;  staminas[0] = 92;
        // #2: OVR 94
        speeds[1] = 100; passings[1] = 93;  shootings[1] = 96;  defenses[1] = 91;  staminas[1] = 90;
        // #3: OVR ~94.8
        speeds[2] = 94;  passings[2] = 100; shootings[2] = 93;  defenses[2] = 92;  staminas[2] = 95;
        // #4: OVR ~94.8
        speeds[3] = 97;  passings[3] = 96;  shootings[3] = 98;  defenses[3] = 90;  staminas[3] = 93;
        // #5: OVR ~94.4
        speeds[4] = 95;  passings[4] = 98;  shootings[4] = 95;  defenses[4] = 93;  staminas[4] = 91;

        // ── Titans (Defense-focused) ──────────────────────────
        // #6: OVR ~94.8
        speeds[5] = 91;  passings[5] = 95;  shootings[5] = 90;  defenses[5] = 100; staminas[5] = 98;
        // #7: OVR ~94.6
        speeds[6] = 90;  passings[6] = 93;  shootings[6] = 92;  defenses[6] = 98;  staminas[6] = 100;
        // #8: OVR ~94.8
        speeds[7] = 93;  passings[7] = 97;  shootings[7] = 91;  defenses[7] = 96;  staminas[7] = 97;
        // #9: OVR ~94.2
        speeds[8] = 92;  passings[8] = 94;  shootings[8] = 90;  defenses[8] = 99;  staminas[8] = 96;
        // #10: OVR 95
        speeds[9] = 90;  passings[9] = 96;  shootings[9] = 93;  defenses[9] = 97;  staminas[9] = 99;

        vm.startBroadcast();
        players.mintBatch(recipients, speeds, passings, shootings, defenses, staminas);
        vm.stopBroadcast();

        console2.log("=== 10 Ultra-Rare Players Minted ===");
        console2.log("Minted to:", mintTo);
        console2.log("Players contract:", playersAddr);
        console2.log("Check nextId() for new token IDs");
    }
}
