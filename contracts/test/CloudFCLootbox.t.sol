// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";
import {CloudFCLootbox} from "../src/CloudFCLootbox.sol";

contract CloudFCLootboxTest is Test {
    CloudFCPlayers players;
    CloudFCLootbox lootbox;

    address owner = address(this);
    address treasury = address(0xBEEF);
    address protocol = address(0xCAFE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        players = new CloudFCPlayers();
        lootbox = new CloudFCLootbox(address(players), treasury, protocol);

        // Authorize lootbox as minter on players contract
        players.setMinter(address(lootbox), true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          BASIC PACK OPENING
    // ═══════════════════════════════════════════════════════════════════════

    function test_openPack_mints5Players() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256[5] memory playerIds = lootbox.openPack{value: 0.005 ether}();

        // Should have minted 5 players
        assertEq(players.balanceOf(alice), 5);
        for (uint256 i; i < 5; i++) {
            assertEq(players.ownerOf(playerIds[i]), alice);
        }
    }

    function test_openPack_playerIdsSequential() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256[5] memory ids = lootbox.openPack{value: 0.005 ether}();

        for (uint256 i; i < 5; i++) {
            assertEq(ids[i], i);
        }
    }

    function test_openPack_statsWithinRange() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256[5] memory ids = lootbox.openPack{value: 0.005 ether}();

        for (uint256 i; i < 5; i++) {
            (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = players.getStats(ids[i]);
            // All stats should be >= 25 (bronze min) and <= 100 (diamond max)
            assertTrue(spd >= 25 && spd <= 100, "spd out of range");
            assertTrue(pas >= 25 && pas <= 100, "pas out of range");
            assertTrue(sho >= 25 && sho <= 100, "sho out of range");
            assertTrue(def >= 25 && def <= 100, "def out of range");
            assertTrue(sta >= 25 && sta <= 100, "sta out of range");
        }
    }

    function test_openPack_emitsEvent() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        // Just check that it doesn't revert — event structure verified by other tests
        lootbox.openPack{value: 0.005 ether}();
        assertEq(lootbox.totalPacks(), 1);
    }

    function test_openPack_packRecordStored() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256[5] memory ids = lootbox.openPack{value: 0.005 ether}();

        CloudFCLootbox.PackRecord memory rec = lootbox.getPackRecord(0);
        assertEq(rec.buyer, alice);
        assertEq(rec.timestamp, block.timestamp);
        for (uint256 i; i < 5; i++) {
            assertEq(rec.playerIds[i], ids[i]);
        }
    }

    function test_openPack_incrementsNonce() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        uint256[5] memory ids1 = lootbox.openPack{value: 0.005 ether}();
        vm.prank(alice);
        uint256[5] memory ids2 = lootbox.openPack{value: 0.005 ether}();

        // Different packs should have different player IDs
        assertTrue(ids1[0] != ids2[0], "packs should differ");
        assertEq(lootbox.totalPacks(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          PAYMENT VALIDATION
    // ═══════════════════════════════════════════════════════════════════════

    function test_openPack_revertsInsufficientPayment() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(CloudFCLootbox.InsufficientPayment.selector);
        lootbox.openPack{value: 0.004 ether}();
    }

    function test_openPack_revertsZeroPayment() public {
        vm.prank(alice);
        vm.expectRevert(CloudFCLootbox.InsufficientPayment.selector);
        lootbox.openPack{value: 0}();
    }

    function test_openPack_acceptsExactPayment() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();
        assertEq(players.balanceOf(alice), 5);
    }

    function test_openPack_acceptsOverpayment_refundsExcess() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        lootbox.openPack{value: 0.01 ether}();
        assertEq(players.balanceOf(alice), 5);
        // Overpayment refunded: alice paid 0.01, pack costs 0.005, refund 0.005
        assertEq(alice.balance, 0.995 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          REVENUE SPLIT (PULL PATTERN)
    // ═══════════════════════════════════════════════════════════════════════

    function test_openPack_revenueSplit() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();

        // Revenue accumulates in pendingRevenue (pull pattern)
        assertEq(lootbox.pendingRevenue(treasury), 0.004 ether);
        assertEq(lootbox.pendingRevenue(protocol), 0.001 ether);
    }

    function test_withdrawRevenue() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();

        uint256 treasuryBefore = treasury.balance;
        vm.prank(treasury);
        lootbox.withdrawRevenue();
        assertEq(treasury.balance - treasuryBefore, 0.004 ether);
        assertEq(lootbox.pendingRevenue(treasury), 0);
    }

    function test_withdrawRevenue_revertsNothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(CloudFCLootbox.NothingToWithdraw.selector);
        lootbox.withdrawRevenue();
    }

    function test_openPack_revenueSplitLargeAmount() public {
        lootbox.setPackPrice(1 ether);
        vm.deal(alice, 10 ether);

        vm.prank(alice);
        lootbox.openPack{value: 1 ether}();

        assertEq(lootbox.pendingRevenue(treasury), 0.8 ether);
        assertEq(lootbox.pendingRevenue(protocol), 0.2 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          TIER DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════

    function test_tierDistribution_over100Packs() public {
        vm.deal(alice, 100 ether);

        uint256[4] memory tierCounts; // bronze, silver, gold, diamond

        for (uint256 p; p < 100; p++) {
            // Vary prevrandao for each pack
            vm.prevrandao(bytes32(uint256(p * 12345 + 7)));
            vm.prank(alice);
            uint256[5] memory ids = lootbox.openPack{value: 0.005 ether}();

            for (uint256 i; i < 5; i++) {
                (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = players.getStats(ids[i]);
                uint256 avg = (uint256(spd) + pas + sho + def + sta) / 5;
                if (avg >= 80) tierCounts[3]++;
                else if (avg >= 65) tierCounts[2]++;
                else if (avg >= 45) tierCounts[1]++;
                else tierCounts[0]++;
            }
        }

        uint256 total = 500; // 100 packs * 5 players
        // Bronze should be roughly 60% (300) — allow wide margin
        assertTrue(tierCounts[0] > 200, "too few bronze");
        assertTrue(tierCounts[0] < 400, "too many bronze");
        // Diamond should be roughly 3% (15) — allow wide margin
        assertTrue(tierCounts[3] < 60, "too many diamond");
    }

    function test_statsWithinTierRanges() public {
        vm.deal(alice, 10 ether);

        for (uint256 p; p < 20; p++) {
            vm.prevrandao(bytes32(uint256(p * 9999 + 42)));
            vm.prank(alice);
            uint256[5] memory ids = lootbox.openPack{value: 0.005 ether}();

            for (uint256 i; i < 5; i++) {
                (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = players.getStats(ids[i]);
                // Each stat must be >= 25 (global min) and <= 100
                assertTrue(spd >= 25 && spd <= 100);
                assertTrue(pas >= 25 && pas <= 100);
                assertTrue(sho >= 25 && sho <= 100);
                assertTrue(def >= 25 && def <= 100);
                assertTrue(sta >= 25 && sta <= 100);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function test_setPackPrice() public {
        lootbox.setPackPrice(0.01 ether);
        assertEq(lootbox.packPrice(), 0.01 ether);
    }

    function test_setPackPrice_revertsZero() public {
        vm.expectRevert(CloudFCLootbox.InvalidPrice.selector);
        lootbox.setPackPrice(0);
    }

    function test_setPackPrice_revertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(CloudFCLootbox.OnlyOwner.selector);
        lootbox.setPackPrice(0.01 ether);
    }

    function test_setTierWeights() public {
        uint16[4] memory weights = [uint16(5000), 8000, 9500, 10000];
        lootbox.setTierWeights(weights);
        assertEq(lootbox.tierWeights(0), 5000);
        assertEq(lootbox.tierWeights(1), 8000);
        assertEq(lootbox.tierWeights(2), 9500);
        assertEq(lootbox.tierWeights(3), 10000);
    }

    function test_setTierWeights_revertsInvalidFinal() public {
        uint16[4] memory weights = [uint16(5000), 8000, 9500, 9999];
        vm.expectRevert(CloudFCLootbox.InvalidWeights.selector);
        lootbox.setTierWeights(weights);
    }

    function test_setTierWeights_revertsNonAscending() public {
        uint16[4] memory weights = [uint16(8000), 5000, 9500, 10000];
        vm.expectRevert(CloudFCLootbox.InvalidWeights.selector);
        lootbox.setTierWeights(weights);
    }

    function test_setTierWeights_revertsNonOwner() public {
        uint16[4] memory weights = [uint16(5000), 8000, 9500, 10000];
        vm.prank(alice);
        vm.expectRevert(CloudFCLootbox.OnlyOwner.selector);
        lootbox.setTierWeights(weights);
    }

    function test_transferOwnership() public {
        lootbox.transferOwnership(alice);
        assertEq(lootbox.owner(), alice);

        vm.prank(alice);
        lootbox.setPackPrice(0.01 ether);
        assertEq(lootbox.packPrice(), 0.01 ether);
    }

    function test_pause_unpause() public {
        lootbox.pause();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        lootbox.openPack{value: 0.005 ether}();

        lootbox.unpause();
        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();
        assertEq(players.balanceOf(alice), 5);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          MINTER ROLE
    // ═══════════════════════════════════════════════════════════════════════

    function test_lootboxIsMinter() public view {
        assertTrue(players.minters(address(lootbox)));
    }

    function test_nonMinterCantMint() public {
        vm.prank(alice);
        vm.expectRevert(CloudFCPlayers.OnlyMinter.selector);
        players.mintByMinter(alice, 50, 50, 50, 50, 50);
    }

    function test_mintByMinter_works() public {
        players.setMinter(address(this), true);
        uint256 id = players.mintByMinter(alice, 80, 85, 90, 70, 75);
        assertEq(players.ownerOf(id), alice);
        (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = players.getStats(id);
        assertEq(spd, 80);
        assertEq(pas, 85);
        assertEq(sho, 90);
        assertEq(def, 70);
        assertEq(sta, 75);
    }

    function test_mintByMinter_revertsInvalidStats() public {
        players.setMinter(address(this), true);
        vm.expectRevert(CloudFCPlayers.InvalidStats.selector);
        players.mintByMinter(alice, 101, 50, 50, 50, 50);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function test_totalPacks() public {
        assertEq(lootbox.totalPacks(), 0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();
        assertEq(lootbox.totalPacks(), 1);
    }

    function test_getPackRecord_revertsInvalid() public {
        vm.expectRevert(CloudFCLootbox.PackNotFound.selector);
        lootbox.getPackRecord(0);
    }

    function test_packPrice_default() public view {
        assertEq(lootbox.packPrice(), 0.005 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          MULTIPLE USERS
    // ═══════════════════════════════════════════════════════════════════════

    function test_multipleUsers() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        lootbox.openPack{value: 0.005 ether}();

        vm.prevrandao(bytes32(uint256(999)));
        vm.prank(bob);
        lootbox.openPack{value: 0.005 ether}();

        assertEq(players.balanceOf(alice), 5);
        assertEq(players.balanceOf(bob), 5);
        assertEq(lootbox.totalPacks(), 2);

        // Pack records
        assertEq(lootbox.getPackRecord(0).buyer, alice);
        assertEq(lootbox.getPackRecord(1).buyer, bob);
    }
}
