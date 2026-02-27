// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";

/// @notice Sets the imageBaseURI on CloudFCPlayers so tokenURI includes image links.
///         tokenURI concatenates: imageBaseURI + tokenId (no trailing slash needed in URI).
///         Result: image = "https://clawsociety.fun/api/card/42"
///
/// Usage:
///   CLOUDFC_PLAYERS=0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4 \
///   forge script script/SetImageBaseURI.s.sol --rpc-url base --broadcast --verify
contract SetImageBaseURI is Script {
    function run() external {
        address playersAddr = vm.envAddress("CLOUDFC_PLAYERS");
        CloudFCPlayers players = CloudFCPlayers(playersAddr);

        string memory uri = "https://clawsociety.fun/api/card/";

        vm.startBroadcast();
        players.setImageBaseURI(uri);
        vm.stopBroadcast();

        console2.log("imageBaseURI set to:", uri);
        console2.log("Players contract:", playersAddr);
    }
}
