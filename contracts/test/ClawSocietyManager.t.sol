// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ClawSocietyManager} from "../src/ClawSocietyManager.sol";
import {GridLayout} from "../src/libraries/GridLayout.sol";

/// @dev Malicious contract that attempts reentrancy during buyout ETH callback
contract ReentrantAttacker {
    ClawSocietyManager public manager;

    constructor(ClawSocietyManager _manager) {
        manager = _manager;
    }

    function claimSeat(uint256 seatId, uint256 price) external payable {
        manager.claimSeat{value: msg.value}(seatId, price);
    }

    receive() external payable {
        // Attempt reentrancy: withdraw deposit while buyout is in progress
        manager.withdrawDeposit(0, 1);
    }
}

contract ClawSocietyManagerTest is Test {
    ClawSocietyManager public manager;

    address public deployer = makeAddr("deployer");
    address public protocolFee = makeAddr("protocolFee");
    address public creatorFee = makeAddr("creatorFee");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    uint256 constant PRICE = 0.1 ether;       // 0.1 ETH
    uint256 constant DEPOSIT = 1 ether;        // 1 ETH
    uint256 constant ETH_001 = 0.001 ether;    // 0.001 ETH

    function setUp() public {
        vm.prank(deployer);
        manager = new ClawSocietyManager(
            protocolFee,
            creatorFee
        );

        // Fund users
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(charlie, 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. Deployment & Grid Layout
    // ═══════════════════════════════════════════════════════════════════════

    function test_deployment_initialState() public view {
        assertEq(manager.owner(), deployer);
        assertEq(manager.totalActiveWeight(), 0);
        assertEq(manager.globalRewardPerWeight(), 0);
        assertEq(manager.serverFundBalance(), 0);
        assertEq(manager.societyAutonomous(), false);
    }

    function test_deployment_gridLayout() public view {
        // Check center tile is Server Farm (type 0)
        (, , , , , uint8 buildingType55) = manager.seats(55);
        assertEq(buildingType55, 0, "Center should be Server Farm");

        // Check banks (type 1)
        (, , , , , uint8 buildingType45) = manager.seats(45);
        assertEq(buildingType45, 1, "Seat 45 should be Bank");
        (, , , , , uint8 buildingType54) = manager.seats(54);
        assertEq(buildingType54, 1, "Seat 54 should be Bank");

        // Check corner is Park (type 9)
        (, , , , , uint8 buildingType0) = manager.seats(0);
        assertEq(buildingType0, 9, "Seat 0 should be Park");
    }

    function test_deployment_buildingTypeCounts() public view {
        uint8[100] memory layout = GridLayout.getLayout();
        uint256[10] memory counts;
        for (uint256 i; i < 100; ++i) {
            counts[layout[i]]++;
        }
        assertEq(counts[0], 1,  "ServerFarm count");
        assertEq(counts[1], 2,  "Bank count");
        assertEq(counts[2], 4,  "AILab count");
        assertEq(counts[3], 6,  "Arena count");
        assertEq(counts[4], 8,  "Market count");
        assertEq(counts[5], 10, "Factory count");
        assertEq(counts[6], 14, "Cafe count");
        assertEq(counts[7], 12, "Club count");
        assertEq(counts[8], 20, "Quarters count");
        assertEq(counts[9], 23, "Park count");
    }

    function test_deployment_multipliers() public view {
        assertEq(manager.getSeatMultiplier(55), 2000); // Server Farm
        assertEq(manager.getSeatMultiplier(45), 1800); // Bank
        assertEq(manager.getSeatMultiplier(44), 1500); // AI Lab
        assertEq(manager.getSeatMultiplier(34), 1300); // Arena
        assertEq(manager.getSeatMultiplier(33), 1200); // Market
        assertEq(manager.getSeatMultiplier(23), 1100); // Factory
        assertEq(manager.getSeatMultiplier(22), 1000); // Cafe
        assertEq(manager.getSeatMultiplier(11), 900);  // Club
        assertEq(manager.getSeatMultiplier(1),  800);  // Quarters
        assertEq(manager.getSeatMultiplier(0),  700);  // Park
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. Claiming
    // ═══════════════════════════════════════════════════════════════════════

    function test_claimSeat_happyPath() public {
        // Seat 0 is a Park (type 9, multiplier 700)
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        (address holder, uint128 price, uint128 deposit, , , ) = manager.seats(0);
        assertEq(holder, alice);
        assertEq(price, PRICE);
        assertEq(deposit, DEPOSIT);
        assertEq(manager.totalActiveWeight(), 700);
    }

    function test_claimSeat_centerTile() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(55, PRICE);

        assertEq(manager.totalActiveWeight(), 2000); // Server Farm = 2000
    }

    function test_claimSeat_revert_occupied() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.SeatOccupied.selector);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);
    }

    function test_claimSeat_revert_invalidSeat() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.InvalidSeat.selector);
        manager.claimSeat{value: DEPOSIT}(100, PRICE);
    }

    function test_claimSeat_revert_zeroPrice() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.ZeroPrice.selector);
        manager.claimSeat{value: DEPOSIT}(0, 0);
    }

    function test_claimSeat_revert_zeroDeposit() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.ZeroAmount.selector);
        manager.claimSeat{value: 0}(0, PRICE);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. Buyouts
    // ═══════════════════════════════════════════════════════════════════════

    function test_buyout_happyPath() public {
        // Alice claims seat 0 at 0.1 ETH
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        uint256 aliceBefore = alice.balance;

        // Bob buys out at current price (0.1 ETH) + 0.5 ETH deposit
        vm.prank(bob);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, 0.2 ether, PRICE);

        (address holder, uint128 price, uint128 deposit, , , ) = manager.seats(0);
        assertEq(holder, bob);
        assertEq(price, 0.2 ether);
        assertEq(deposit, 0.5 ether); // payment - currentPrice

        // Alice received: 80% of 0.1 ETH (0.08) + deposit (1.0) = 1.08 ETH
        uint256 aliceAfter = alice.balance;
        assertEq(aliceAfter - aliceBefore, 0.08 ether + DEPOSIT);

        // Protocol got 6% of price = 0.006 ETH
        assertEq(protocolFee.balance, 0.006 ether);
        // Creator got 14% of price = 0.014 ETH
        assertEq(creatorFee.balance, 0.014 ether);
    }

    function test_buyout_revert_slippage() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.SlippageExceeded.selector);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, PRICE, 0.05 ether); // maxPrice=0.05 < current=0.1
    }

    function test_buyout_revert_insufficientPayment() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.InsufficientPayment.selector);
        manager.buyoutSeat{value: 0.05 ether}(0, PRICE, PRICE); // payment < price
    }

    function test_buyout_revert_emptySeat() public {
        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.SeatEmpty.selector);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, PRICE, PRICE);
    }

    function test_buyout_revert_ownSeat() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.SeatOccupied.selector);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, PRICE, PRICE);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. Tax
    // ═══════════════════════════════════════════════════════════════════════

    function test_tax_continuousDrain() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Advance 1 week
        vm.warp(block.timestamp + 604_800);

        // Tax = 0.1 ETH * 500 / 10000 = 0.005 ETH for 1 week
        uint256 expectedTax = (PRICE * 500) / 10_000;
        assertEq(manager.accruedTax(0), expectedTax);

        // Poke tax to apply it
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        (, , uint128 deposit, , , ) = manager.seats(0);
        assertEq(deposit, DEPOSIT - expectedTax);
    }

    function test_tax_forfeiture() public {
        // Alice claims with small deposit (0.01 ETH) at price 0.1 ETH
        vm.prank(alice);
        manager.claimSeat{value: 0.01 ether}(0, PRICE);

        // Tax rate is 5%/week. At 0.1 ETH price, tax = 0.005 ETH/week
        // 0.01 ETH deposit lasts 2 weeks
        vm.warp(block.timestamp + 3 * 604_800); // 3 weeks — exceeds deposit

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        (address holder, , , , , ) = manager.seats(0);
        assertEq(holder, address(0), "Seat should be forfeited");
        assertEq(manager.totalActiveWeight(), 0);
    }

    function test_tax_pokeTaxPermissionless() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.warp(block.timestamp + 604_800);

        // Anyone can poke tax
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        vm.prank(charlie); // charlie is not the holder
        manager.pokeTax(ids);

        (, , uint128 deposit, , , ) = manager.seats(0);
        uint256 expectedTax = (PRICE * 500) / 10_000;
        assertEq(deposit, DEPOSIT - expectedTax);
    }

    function test_tax_serverFundContribution() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.warp(block.timestamp + 604_800);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        // Tax = 0.005 ETH. Server fund gets 5% of tax = 0.00025 ETH
        uint256 expectedTax = (PRICE * 500) / 10_000;
        uint256 expectedServerCut = (expectedTax * 500) / 10_000;
        assertEq(manager.serverFundBalance(), expectedServerCut);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. Fee Distribution
    // ═══════════════════════════════════════════════════════════════════════

    function test_distributeFees_singleHolder() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE); // Park, weight=700

        // Distribute 1 ETH
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        // Alice should get all 1 ETH (only holder, minor rounding possible)
        uint256 pending = manager.pendingFees(0);
        assertApproxEqAbs(pending, 1 ether, 1);
    }

    function test_distributeFees_weightedDistribution() public {
        // Alice claims Park (weight=700)
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Bob claims Server Farm (weight=2000)
        vm.prank(bob);
        manager.claimSeat{value: DEPOSIT}(55, PRICE);

        // Total weight = 2700

        // Distribute 2.7 ETH
        vm.deal(address(this), 2.7 ether);
        manager.distributeFees{value: 2.7 ether}();

        uint256 alicePending = manager.pendingFees(0);
        uint256 bobPending = manager.pendingFees(55);

        // Alice: 700/2700 * 2.7 ETH = 0.7 ETH
        assertApproxEqAbs(alicePending, 0.7 ether, 1e6); // ~1 gwei tolerance
        // Bob: 2000/2700 * 2.7 ETH = 2.0 ETH
        assertApproxEqAbs(bobPending, 2.0 ether, 1e6);
    }

    function test_distributeFees_claimEth() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        uint256 aliceBefore = alice.balance;

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        vm.prank(alice);
        manager.claimFees(ids);

        assertApproxEqAbs(alice.balance - aliceBefore, 1 ether, 1);
    }

    function test_distributeFees_noActiveSeats_fallbackToCreator() public {
        // Distribute with no active seats → goes to creator
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        assertEq(creatorFee.balance, 1 ether);
    }

    function test_distributeFees_revert_zeroAmount() public {
        vm.expectRevert(ClawSocietyManager.ZeroAmount.selector);
        manager.distributeFees{value: 0}();
    }

    function test_distributeFees_lazyAccumulation() public {
        // Alice claims first
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Distribute 1 ETH
        vm.deal(address(this), 2 ether);
        manager.distributeFees{value: 1 ether}();

        // Bob claims after distribution
        vm.prank(bob);
        manager.claimSeat{value: DEPOSIT}(55, PRICE);

        // Bob should have 0 pending (joined after distribution)
        assertEq(manager.pendingFees(55), 0);

        // Alice should have ~1 ETH (minor rounding)
        assertApproxEqAbs(manager.pendingFees(0), 1 ether, 1);

        // New distribution
        manager.distributeFees{value: 1 ether}();

        // Now both should have pending fees from second distribution
        uint256 aliceTotal = manager.pendingFees(0);
        uint256 bobTotal = manager.pendingFees(55);

        // Alice: ~1 ETH (first) + 700/2700 * 1 ETH (second)
        // Bob: 2000/2700 * 1 ETH (second only)
        assertGt(aliceTotal, 1 ether - 1);
        assertGt(bobTotal, 0);
        assertApproxEqAbs(aliceTotal + bobTotal, 2 ether, 1e6);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. Server Fund
    // ═══════════════════════════════════════════════════════════════════════

    function test_serverFund_accumulation() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.warp(block.timestamp + 604_800);
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        // Tax = 0.005 ETH. Server fund gets 5% = 0.00025 ETH
        assertGt(manager.serverFundBalance(), 0);
        assertEq(manager.societyAutonomous(), false);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 7. Price Changes
    // ═══════════════════════════════════════════════════════════════════════

    function test_setPrice_happyPath() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Wait cooldown
        vm.warp(block.timestamp + 1201);

        vm.prank(alice);
        manager.setPrice(0, 0.2 ether);

        (, uint128 price, , , , ) = manager.seats(0);
        assertEq(price, 0.2 ether);
    }

    function test_setPrice_revert_cooldown() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Try to change price before cooldown
        vm.warp(block.timestamp + 600); // Only 10 minutes

        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.PriceCooldown.selector);
        manager.setPrice(0, 0.2 ether);
    }

    function test_setPrice_revert_notHolder() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.warp(block.timestamp + 1201);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.NotHolder.selector);
        manager.setPrice(0, 0.2 ether);
    }

    function test_setPrice_revert_zeroPrice() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.warp(block.timestamp + 1201);

        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.ZeroPrice.selector);
        manager.setPrice(0, 0);
    }

    function test_setPrice_appliesTaxFirst() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Advance 1 week so tax accrues
        vm.warp(block.timestamp + 604_800);

        vm.prank(alice);
        manager.setPrice(0, 0.2 ether);

        // Deposit should have been reduced by tax
        (, , uint128 deposit, , , ) = manager.seats(0);
        uint256 expectedTax = (PRICE * 500) / 10_000;
        assertEq(deposit, DEPOSIT - expectedTax);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 8. Deposits
    // ═══════════════════════════════════════════════════════════════════════

    function test_addDeposit() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(alice);
        manager.addDeposit{value: 0.5 ether}(0);

        (, , uint128 deposit, , , ) = manager.seats(0);
        assertEq(deposit, 1.5 ether);
    }

    function test_withdrawDeposit() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        uint256 before = alice.balance;

        vm.prank(alice);
        manager.withdrawDeposit(0, 0.2 ether);

        (, , uint128 deposit, , , ) = manager.seats(0);
        assertEq(deposit, 0.8 ether);
        assertEq(alice.balance - before, 0.2 ether);
    }

    function test_withdrawDeposit_revert_insufficient() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.InsufficientDeposit.selector);
        manager.withdrawDeposit(0, 2 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 9. Abandon
    // ═══════════════════════════════════════════════════════════════════════

    function test_abandon_happyPath() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        uint256 before = alice.balance;

        vm.prank(alice);
        manager.abandonSeat(0);

        (address holder, , , , , ) = manager.seats(0);
        assertEq(holder, address(0));
        assertEq(manager.totalActiveWeight(), 0);

        // Got deposit back
        assertEq(alice.balance - before, DEPOSIT);
    }

    function test_abandon_withPendingFees() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Distribute some ETH
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        uint256 ethBefore = alice.balance;

        vm.prank(alice);
        manager.abandonSeat(0);

        // Should receive deposit + pending ETH fees (minor rounding possible)
        assertApproxEqAbs(alice.balance - ethBefore, DEPOSIT + 1 ether, 1);
    }

    function test_abandon_revert_notHolder() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.NotHolder.selector);
        manager.abandonSeat(0);
    }

    function test_abandon_afterTaxDrain() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Advance 1 week
        vm.warp(block.timestamp + 604_800);

        uint256 before = alice.balance;

        vm.prank(alice);
        manager.abandonSeat(0);

        // Should get deposit minus accrued tax
        uint256 expectedTax = (PRICE * 500) / 10_000;
        assertEq(alice.balance - before, DEPOSIT - expectedTax);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 10. Edge Cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_claimAfterForfeiture() public {
        // Alice claims with small deposit
        vm.prank(alice);
        manager.claimSeat{value: 0.003 ether}(0, PRICE); // 0.003 ETH deposit

        // Wait until forfeiture
        vm.warp(block.timestamp + 2 * 604_800); // 2 weeks

        // Bob can now claim (triggers forfeiture of Alice)
        vm.prank(bob);
        manager.claimSeat{value: 0.5 ether}(0, 0.05 ether);

        (address holder, , , , , ) = manager.seats(0);
        assertEq(holder, bob);
    }

    function test_getAllSeats() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        ClawSocietyManager.Seat[100] memory allSeats = manager.getAllSeats();
        assertEq(allSeats[0].holder, alice);
        assertEq(allSeats[0].price, PRICE);
        assertEq(allSeats[1].holder, address(0)); // unclaimed
    }

    function test_depositRunway() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Tax = 0.1 ETH * 5% / week = 0.005 ETH/week
        // Deposit = 1 ETH → runway = 200 weeks
        uint256 runway = manager.depositRunway(0);
        // runway = 1e18 * 604800 * 10000 / (1e17 * 500)
        //        = 1000 * 604800 * 10000 / (100 * 500) = 120960000
        assertEq(runway, 200 * 604_800); // 200 weeks in seconds
    }

    function test_acquireBatch() public {
        ClawSocietyManager.AcquireParams[] memory params = new ClawSocietyManager.AcquireParams[](3);

        params[0] = ClawSocietyManager.AcquireParams({
            seatId: 0,
            newPrice: PRICE,
            maxPrice: 0,
            payment: DEPOSIT
        });
        params[1] = ClawSocietyManager.AcquireParams({
            seatId: 1,
            newPrice: PRICE,
            maxPrice: 0,
            payment: DEPOSIT
        });
        params[2] = ClawSocietyManager.AcquireParams({
            seatId: 2,
            newPrice: PRICE,
            maxPrice: 0,
            payment: DEPOSIT
        });

        vm.prank(alice);
        manager.acquireBatch{value: 3 ether}(params);

        (address h0, , , , , ) = manager.seats(0);
        (address h1, , , , , ) = manager.seats(1);
        (address h2, , , , , ) = manager.seats(2);
        assertEq(h0, alice);
        assertEq(h1, alice);
        assertEq(h2, alice);
    }

    function test_receiveEth_autoDistribute() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Send ETH directly to contract
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(manager).call{value: 1 ether}("");
        assertTrue(ok);

        // Should auto-distribute (minor rounding possible)
        assertApproxEqAbs(manager.pendingFees(0), 1 ether, 1);
    }

    function test_buyout_transfersPendingEthToSeller() public {
        // Alice claims
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        // Distribute ETH
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        uint256 aliceEthBefore = alice.balance;

        // Bob buys out Alice
        vm.prank(bob);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, 0.2 ether, PRICE);

        // Alice should receive pending ETH + seller proceeds + deposit
        // Seller proceeds = 0.1 * 80% = 0.08 ETH, deposit = 1 ETH, pending = ~1 ETH
        assertApproxEqAbs(alice.balance - aliceEthBefore, 0.08 ether + DEPOSIT + 1 ether, 1);
    }

    function test_onERC721Received() public {
        bytes4 selector = manager.onERC721Received(address(0), address(0), 42, "");
        assertEq(selector, bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fuzz Tests
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_taxCalculation(uint128 price, uint32 elapsed) public pure {
        vm.assume(price > 0 && price < 1e18); // reasonable range
        vm.assume(elapsed > 0 && elapsed < 365 days);

        // Tax should never exceed deposit + be mathematically consistent
        uint256 tax = (uint256(price) * 500 * elapsed) / (604_800 * 10_000);
        assertLe(tax, uint256(price) * 52); // Max ~52 weeks of tax in a year
    }

    function testFuzz_claimAndAbandon(uint128 price, uint128 depositAmt) public {
        vm.assume(price > 0 && price < 100 ether);
        vm.assume(depositAmt > 0 && depositAmt < 100 ether);

        vm.deal(alice, uint256(depositAmt) + 1 ether);

        vm.prank(alice);
        manager.claimSeat{value: depositAmt}(0, price);

        uint256 before = alice.balance;

        vm.prank(alice);
        manager.abandonSeat(0);

        // Should get full deposit back (no time passed, no tax)
        assertEq(alice.balance - before, depositAmt);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 11. Security Fix Tests
    // ═══════════════════════════════════════════════════════════════════════

    /// Fix 1: Reentrancy during buyout ETH callback is blocked
    function test_reentrancy_withdrawDeposit_blocked() public {
        ReentrantAttacker attacker = new ReentrantAttacker(manager);
        vm.deal(address(attacker), 100 ether);
        attacker.claimSeat{value: DEPOSIT}(0, PRICE);

        // Distribute ETH to give attacker pending fees
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        // Bob buys out attacker — attacker's receive() tries reentrancy → reverts
        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.TransferFailed.selector);
        manager.buyoutSeat{value: PRICE + 0.5 ether}(0, 0.2 ether, PRICE);

        // Verify attacker still holds the seat (buyout failed, state unchanged)
        (address holder, , , , , ) = manager.seats(0);
        assertEq(holder, address(attacker), "Attacker should still hold seat");
    }

    /// Fix 3: claimFees events log actual amounts, not 0
    function test_claimFees_emitsCorrectAmounts() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        uint256 expectedAmount = manager.pendingFees(0);
        assertGt(expectedAmount, 0, "Should have pending fees");

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;

        vm.expectEmit(true, true, false, true);
        emit ClawSocietyManager.FeesClaimed(0, alice, expectedAmount);

        vm.prank(alice);
        manager.claimFees(ids);
    }

    /// Fix 4: serverFundGoal is now in ETH units and reachable
    function test_serverFund_goalReachable() public {
        vm.prank(deployer);
        manager.setServerFundGoal(0.01 ether); // 0.01 ETH goal

        vm.prank(alice);
        manager.claimSeat{value: 50 ether}(0, 10 ether); // price=10 ETH, deposit=50 ETH

        // 1 week: tax = 10 * 5% = 0.5 ETH. Server fund gets 5% = 0.025 ETH > 0.01 goal
        vm.warp(block.timestamp + 604_800);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        assertTrue(manager.societyAutonomous(), "Goal should be reachable with ETH units");
    }

    /// Fix 5: buyout with payment == price reverts (zero deposit)
    function test_buyout_revert_zeroDeposit() public {
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(bob);
        vm.expectRevert(ClawSocietyManager.InsufficientDeposit.selector);
        manager.buyoutSeat{value: PRICE}(0, PRICE, PRICE); // payment == price
    }

    /// Fix 6: constructor reverts on zero protocol fee receiver
    function test_constructor_revert_zeroProtocolReceiver() public {
        vm.expectRevert(ClawSocietyManager.ZeroAddress.selector);
        new ClawSocietyManager(address(0), creatorFee);
    }

    /// Fix 6: constructor reverts on zero creator fee receiver
    function test_constructor_revert_zeroCreatorReceiver() public {
        vm.expectRevert(ClawSocietyManager.ZeroAddress.selector);
        new ClawSocietyManager(protocolFee, address(0));
    }

    /// Fix 6: transferOwnership reverts on zero address
    function test_transferOwnership_revert_zeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(ClawSocietyManager.ZeroAddress.selector);
        manager.transferOwnership(address(0));
    }

    /// Fix 9: claimFees skips forfeited seats instead of reverting
    function test_claimFees_skipsForfeited() public {
        // Alice claims two seats
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);
        vm.prank(alice);
        manager.claimSeat{value: 0.003 ether}(1, PRICE); // small deposit — will forfeit

        // Distribute ETH
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        // Advance time to cause forfeiture of seat 1
        vm.warp(block.timestamp + 2 * 604_800);

        // Poke tax to forfeit seat 1
        uint256[] memory pokeIds = new uint256[](1);
        pokeIds[0] = 1;
        manager.pokeTax(pokeIds);

        // Verify seat 1 is forfeited
        (address holder1, , , , , ) = manager.seats(1);
        assertEq(holder1, address(0));

        // Alice claims fees for both seats — should skip forfeited seat 1
        uint256[] memory ids = new uint256[](2);
        ids[0] = 0;
        ids[1] = 1;

        uint256 ethBefore = alice.balance;
        vm.prank(alice);
        manager.claimFees(ids);

        assertGt(alice.balance - ethBefore, 0, "Should have received ETH from seat 0");
    }

    /// Fix 8: forfeited ETH is recoverable via withdrawCreatorEth
    function test_forfeiture_ethSentToCreator() public {
        vm.prank(alice);
        manager.claimSeat{value: 0.003 ether}(0, PRICE); // small deposit

        // Distribute ETH
        vm.deal(address(this), 1 ether);
        manager.distributeFees{value: 1 ether}();

        // Advance to cause forfeiture
        vm.warp(block.timestamp + 2 * 604_800);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        manager.pokeTax(ids);

        // Forfeited ETH should be in creatorPendingEth
        assertGt(manager.creatorPendingEth(), 0, "Forfeited ETH should be recoverable");

        uint256 creatorBefore = creatorFee.balance;
        manager.withdrawCreatorEth();
        assertGt(creatorFee.balance - creatorBefore, 0, "Creator should receive forfeited ETH");
        assertEq(manager.creatorPendingEth(), 0);
    }

    /// Fix 11: second NFT sent to contract no longer reverts (accepts silently)
    function test_onERC721Received_acceptsMultipleNFTs() public {
        // First NFT sets memeStreamNFT
        manager.onERC721Received(address(0), address(0), 42, "");
        assertEq(manager.memeStreamNFT(), address(this));
        assertEq(manager.memeStreamTokenId(), 42);

        // Second NFT succeeds (no longer reverts) but doesn't overwrite
        bytes4 selector = manager.onERC721Received(address(0), address(0), 43, "");
        assertEq(selector, bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")));
        assertEq(manager.memeStreamTokenId(), 42); // unchanged
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 12. External Call Functions (Flaunch Integration)
    // ═══════════════════════════════════════════════════════════════════════

    function test_execute_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.OnlyOwner.selector);
        manager.execute(address(0), 0, "");
    }

    function test_execute_callsTarget() public {
        // Deploy a simple target that we can verify was called
        MockTarget target = new MockTarget();

        vm.prank(deployer);
        bytes memory result = manager.execute(
            address(target),
            0,
            abi.encodeWithSignature("ping()")
        );

        assertEq(abi.decode(result, (uint256)), 42);
        assertTrue(target.wasCalled());
    }

    function test_execute_sendsValue() public {
        MockTarget target = new MockTarget();
        // Fund the manager so it can send ETH
        vm.deal(address(manager), 1 ether);

        vm.prank(deployer);
        manager.execute(address(target), 0.5 ether, abi.encodeWithSignature("ping()"));

        assertEq(address(target).balance, 0.5 ether);
    }

    function test_claimFlaunchFees_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.OnlyOwner.selector);
        manager.claimFlaunchFees(address(0));
    }

    function test_claimFlaunchFees_callsWithdrawFees() public {
        MockFeeEscrow escrow = new MockFeeEscrow();
        vm.deal(address(escrow), 1 ether);

        // Alice claims a seat so there's active weight for fee distribution
        vm.prank(alice);
        manager.claimSeat{value: DEPOSIT}(0, PRICE);

        vm.prank(deployer);
        manager.claimFlaunchFees(address(escrow));

        assertTrue(escrow.wasCalled());
        // The escrow sends 0.5 ETH to the manager, which auto-distributes via receive()
        assertApproxEqAbs(manager.pendingFees(0), 0.5 ether, 1);
    }

    function test_transferERC721_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(ClawSocietyManager.OnlyOwner.selector);
        manager.transferERC721(address(0), alice, 0);
    }

    function test_transferERC721_transfersNFT() public {
        MockERC721 nft = new MockERC721();
        nft.mint(address(manager), 1);

        assertEq(nft.ownerOf(1), address(manager));

        vm.prank(deployer);
        manager.transferERC721(address(nft), alice, 1);

        assertEq(nft.ownerOf(1), alice);
    }
}

/// @dev Mock target for testing execute()
contract MockTarget {
    bool public wasCalled;

    function ping() external payable returns (uint256) {
        wasCalled = true;
        return 42;
    }

    receive() external payable {}
}

/// @dev Mock FeeEscrow for testing claimFlaunchFees()
contract MockFeeEscrow {
    bool public wasCalled;

    function withdrawFees(address recipient, bool) external {
        wasCalled = true;
        // Send some ETH to simulate fee withdrawal
        (bool ok,) = recipient.call{value: 0.5 ether}("");
        require(ok, "Transfer failed");
    }

    receive() external payable {}
}

/// @dev Minimal ERC721 mock for testing transferERC721()
contract MockERC721 {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "Not owner");
        require(
            msg.sender == from || msg.sender == getApproved[tokenId],
            "Not authorized"
        );
        ownerOf[tokenId] = to;
    }

    function approve(address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == msg.sender, "Not owner");
        getApproved[tokenId] = to;
    }
}
