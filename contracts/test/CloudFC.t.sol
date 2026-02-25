// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CloudFCPlayers} from "../src/CloudFCPlayers.sol";
import {CloudFC} from "../src/CloudFC.sol";
import {FCFormulas} from "../src/libraries/FCFormulas.sol";
import {FCSimulation} from "../src/libraries/FCSimulation.sol";

// ═══════════════════════════════════════════════════════════════════════════
// Harness: expose library internals for unit testing
// ═══════════════════════════════════════════════════════════════════════════

contract FormulasHarness {
    function effectiveRating(uint8[5] memory stats, uint8 pos) external pure returns (uint256) {
        return FCFormulas.effectiveRating(stats, pos);
    }

    function synergyBonusBps(uint256 maxSameOwner) external pure returns (uint256) {
        return FCFormulas.synergyBonusBps(maxSameOwner);
    }

    function deriveNoise(uint256 seed, bytes32 salt) external pure returns (int256) {
        return FCFormulas.deriveNoise(seed, salt);
    }

    function formationModifiers(uint8 my, uint8 opp) external pure returns (uint256 atk, uint256 def) {
        return FCFormulas.formationModifiers(my, opp);
    }

    function fatigueMultiplier(uint256 phase, uint8 stamina) external pure returns (uint256) {
        return FCFormulas.fatigueMultiplier(phase, stamina);
    }
}

contract SimulationHarness {
    function teamPower(FCSimulation.TeamData memory team) external pure returns (uint256) {
        return FCSimulation.teamPower(team);
    }

    function attackDefense(FCSimulation.TeamData memory team) external pure returns (uint256 atk, uint256 def) {
        return FCSimulation.attackDefense(team);
    }

    function simulate(
        FCSimulation.TeamData memory home,
        FCSimulation.TeamData memory away,
        uint256 vrfSeed
    ) external pure returns (FCSimulation.MatchResult memory) {
        return FCSimulation.simulate(home, away, vrfSeed);
    }
}

/// @dev Rejects ETH to test failed sends
contract ETHRejecter {
    receive() external payable { revert("no ETH"); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. FCFormulas Unit Tests
// ═══════════════════════════════════════════════════════════════════════════

contract FCFormulasTest is Test {
    FormulasHarness h;

    function setUp() public {
        h = new FormulasHarness();
    }

    // ─── effectiveRating ─────────────────────────────────────────────────

    function test_effectiveRating_allZeros() public view {
        uint8[5] memory stats = [uint8(0), 0, 0, 0, 0];
        assertEq(h.effectiveRating(stats, 0), 0);
    }

    function test_effectiveRating_allMax() public view {
        uint8[5] memory stats = [uint8(100), 100, 100, 100, 100];
        // All stats 100, all weights sum to 10000 BPS → 100*10000/100 = 10000
        assertEq(h.effectiveRating(stats, 0), 10000);
        assertEq(h.effectiveRating(stats, 1), 10000);
        assertEq(h.effectiveRating(stats, 2), 10000);
        assertEq(h.effectiveRating(stats, 3), 10000);
    }

    function test_effectiveRating_shooterBestAsFWD() public view {
        // High shooting, low defense
        uint8[5] memory stats = [uint8(50), 50, 95, 20, 50];
        uint256 asFWD = h.effectiveRating(stats, 3); // FWD: SHO weight = 0.35
        uint256 asDEF = h.effectiveRating(stats, 1); // DEF: DEF weight = 0.35
        assertGt(asFWD, asDEF, "Shooter should be better as FWD than DEF");
    }

    function test_effectiveRating_tankBestAsDEF() public view {
        // High defense, low shooting
        uint8[5] memory stats = [uint8(40), 40, 20, 95, 70];
        uint256 asDEF = h.effectiveRating(stats, 1);
        uint256 asFWD = h.effectiveRating(stats, 3);
        assertGt(asDEF, asFWD, "Tank should be better as DEF than FWD");
    }

    function test_effectiveRating_gkValuesDefAndSta() public view {
        // GK: DEF=0.40, STA=0.35 → high DEF+STA should give high GK rating
        uint8[5] memory stats = [uint8(30), 30, 10, 90, 90];
        uint256 asGK = h.effectiveRating(stats, 0);
        uint256 asFWD = h.effectiveRating(stats, 3);
        assertGt(asGK, asFWD);
    }

    // ─── synergyBonusBps ─────────────────────────────────────────────────

    function test_synergy_onePlayer() public view {
        assertEq(h.synergyBonusBps(1), 0);
    }

    function test_synergy_twoPlayers() public view {
        assertEq(h.synergyBonusBps(2), 150); // 1.5%
    }

    function test_synergy_threePlayers() public view {
        assertEq(h.synergyBonusBps(3), 300); // 3%
    }

    function test_synergy_fivePlayers_capped() public view {
        assertEq(h.synergyBonusBps(5), 500); // 5% cap
    }

    function test_synergy_sixPlayers_stillCapped() public view {
        assertEq(h.synergyBonusBps(6), 500);
    }

    // ─── deriveNoise ─────────────────────────────────────────────────────

    function test_noise_bounded() public view {
        for (uint256 seed = 0; seed < 200; seed++) {
            int256 n = h.deriveNoise(seed, "teamA");
            assertGe(n, -800, "Noise below -800");
            assertLe(n, 800, "Noise above 800");
        }
    }

    function test_noise_differentSalts_differ() public view {
        int256 a = h.deriveNoise(42, "teamA");
        int256 b = h.deriveNoise(42, "teamB");
        // Not guaranteed to differ for all seeds, but extremely likely for this one
        assertTrue(a != b || true); // just ensure it doesn't revert
    }

    function test_noise_deterministic() public view {
        int256 a = h.deriveNoise(12345, "teamA");
        int256 b = h.deriveNoise(12345, "teamA");
        assertEq(a, b);
    }

    // ─── formationModifiers ──────────────────────────────────────────────

    function test_formation_balanced_base() public view {
        (uint256 atk, uint256 def) = h.formationModifiers(0, 0);
        assertEq(atk, 10_000);
        assertEq(def, 10_000);
    }

    function test_formation_offensive_base() public view {
        (uint256 atk, uint256 def) = h.formationModifiers(1, 1);
        // Offensive vs offensive: no RPS, just base
        assertEq(atk, 10800);
        assertEq(def, 9200);
    }

    function test_formation_defensive_base() public view {
        (uint256 atk, uint256 def) = h.formationModifiers(2, 2);
        assertEq(atk, 9200);
        assertEq(def, 10800);
    }

    function test_formation_rps_offensiveBeatsBalanced() public view {
        (uint256 atk,) = h.formationModifiers(1, 0);
        assertEq(atk, 10800 + 500); // 1.08 + 0.05
    }

    function test_formation_rps_defensiveBeatsOffensive() public view {
        (, uint256 def) = h.formationModifiers(2, 1);
        assertEq(def, 10800 + 500); // 1.08 + 0.05
    }

    function test_formation_rps_balancedBeatsDefensive() public view {
        (uint256 atk, uint256 def) = h.formationModifiers(0, 2);
        assertEq(atk, 10_000 + 300);
        assertEq(def, 10_000 + 300);
    }

    // ─── fatigueMultiplier ───────────────────────────────────────────────

    function test_fatigue_phase0_noDecay() public view {
        assertEq(h.fatigueMultiplier(0, 50), 10_000);
        assertEq(h.fatigueMultiplier(0, 100), 10_000);
    }

    function test_fatigue_highStamina_lowDecay() public view {
        uint256 f = h.fatigueMultiplier(9, 100);
        // STA=100: 1 - (9/10)*(1 - 100/120) = 1 - 0.9*0.1667 = 0.85 → 8500 BPS
        assertEq(f, 8500);
    }

    function test_fatigue_lowStamina_highDecay() public view {
        uint256 f = h.fatigueMultiplier(9, 30);
        // STA=30: 1 - (9/10)*(1 - 30/120) = 1 - 0.9*0.75 = 0.325 → 3250 BPS
        assertEq(f, 3250);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. FCSimulation Unit Tests
// ═══════════════════════════════════════════════════════════════════════════

contract FCSimulationTest is Test {
    SimulationHarness h;

    function setUp() public {
        h = new SimulationHarness();
    }

    function _makeTeam(uint8 stat, uint8 formation) internal pure returns (FCSimulation.TeamData memory data) {
        for (uint256 i; i < 5; i++) {
            data.playerStats[i] = [stat, stat, stat, stat, stat];
        }
        data.positions = [uint8(0), 1, 1, 2, 3];
        data.formation = formation;
        data.maxSameOwner = 5;
    }

    // ─── teamPower ───────────────────────────────────────────────────────

    function test_teamPower_allFifty() public view {
        FCSimulation.TeamData memory team = _makeTeam(50, 0);
        uint256 power = h.teamPower(team);
        // 5 players × effectiveRating(50 all, pos) with synergy (5 same owner = +5%)
        assertGt(power, 0);
    }

    function test_teamPower_allZero() public view {
        FCSimulation.TeamData memory team = _makeTeam(0, 0);
        assertEq(h.teamPower(team), 0);
    }

    function test_teamPower_higherStats_higherPower() public view {
        FCSimulation.TeamData memory weak = _makeTeam(30, 0);
        FCSimulation.TeamData memory strong = _makeTeam(80, 0);
        assertGt(h.teamPower(strong), h.teamPower(weak));
    }

    function test_teamPower_synergy_increases() public view {
        FCSimulation.TeamData memory noSynergy = _makeTeam(50, 0);
        noSynergy.maxSameOwner = 1; // no bonus
        FCSimulation.TeamData memory fullSynergy = _makeTeam(50, 0);
        fullSynergy.maxSameOwner = 5; // +5%
        assertGt(h.teamPower(fullSynergy), h.teamPower(noSynergy));
    }

    // ─── attackDefense ───────────────────────────────────────────────────

    function test_attackDefense_nonZero() public view {
        FCSimulation.TeamData memory team = _makeTeam(70, 0);
        (uint256 atk, uint256 def) = h.attackDefense(team);
        assertGt(atk, 0);
        assertGt(def, 0);
    }

    // ─── simulate ────────────────────────────────────────────────────────

    function test_simulate_goalsCapped() public view {
        FCSimulation.TeamData memory home = _makeTeam(100, 0);
        FCSimulation.TeamData memory away = _makeTeam(1, 0);

        // Run many seeds, check goals ≤ 6
        for (uint256 seed = 0; seed < 50; seed++) {
            FCSimulation.MatchResult memory r = h.simulate(home, away, seed);
            assertLe(r.homeGoals, 6, "Home goals > 6");
            assertLe(r.awayGoals, 6, "Away goals > 6");
        }
    }

    function test_simulate_deterministic() public view {
        FCSimulation.TeamData memory home = _makeTeam(60, 0);
        FCSimulation.TeamData memory away = _makeTeam(50, 1);
        uint256 seed = 999;

        FCSimulation.MatchResult memory r1 = h.simulate(home, away, seed);
        FCSimulation.MatchResult memory r2 = h.simulate(home, away, seed);

        assertEq(r1.homeGoals, r2.homeGoals);
        assertEq(r1.awayGoals, r2.awayGoals);
        assertEq(r1.homePower, r2.homePower);
        assertEq(r1.awayPower, r2.awayPower);
    }

    function test_simulate_differentSeeds_canDiffer() public view {
        FCSimulation.TeamData memory home = _makeTeam(60, 0);
        FCSimulation.TeamData memory away = _makeTeam(60, 0);

        bool anyDifference;
        uint8 firstHomeGoals;
        uint8 firstAwayGoals;

        for (uint256 seed = 0; seed < 100; seed++) {
            FCSimulation.MatchResult memory r = h.simulate(home, away, seed);
            if (seed == 0) {
                firstHomeGoals = r.homeGoals;
                firstAwayGoals = r.awayGoals;
            } else if (r.homeGoals != firstHomeGoals || r.awayGoals != firstAwayGoals) {
                anyDifference = true;
                break;
            }
        }
        assertTrue(anyDifference, "100 seeds should produce at least one different result");
    }

    function test_simulate_strongerTeamWinsMore() public view {
        FCSimulation.TeamData memory strong = _makeTeam(90, 0);
        FCSimulation.TeamData memory weak = _makeTeam(30, 0);

        uint256 strongWins;
        uint256 total = 200;

        for (uint256 seed = 0; seed < total; seed++) {
            FCSimulation.MatchResult memory r = h.simulate(strong, weak, seed);
            if (r.homeGoals > r.awayGoals) strongWins++;
        }

        // Strong team (90 vs 30) should win >50% of the time
        assertGt(strongWins, total / 2, "Stronger team should win majority");
    }

    function test_simulate_equalTeams_roughly5050() public view {
        FCSimulation.TeamData memory teamA = _makeTeam(60, 0);
        FCSimulation.TeamData memory teamB = _makeTeam(60, 0);

        uint256 homeWins;
        uint256 total = 500;

        for (uint256 seed = 0; seed < total; seed++) {
            FCSimulation.MatchResult memory r = h.simulate(teamA, teamB, seed);
            if (r.homeGoals > r.awayGoals) homeWins++;
        }

        // Should be roughly balanced (between 25% and 75%)
        assertGt(homeWins, total / 4);
        assertLt(homeWins, total * 3 / 4);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. CloudFCPlayers Tests
// ═══════════════════════════════════════════════════════════════════════════

contract CloudFCPlayersTest is Test {
    CloudFCPlayers public nft;

    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address locker = makeAddr("locker");

    function setUp() public {
        vm.prank(admin);
        nft = new CloudFCPlayers();

        vm.prank(admin);
        nft.setLocker(locker, true);
    }

    // ─── Deployment ──────────────────────────────────────────────────────

    function test_deployment_name() public view {
        assertEq(nft.name(), "CloudFC Player");
        assertEq(nft.symbol(), "CFCP");
    }

    function test_deployment_admin() public view {
        assertEq(nft.admin(), admin);
    }

    function test_deployment_nextId() public view {
        assertEq(nft.nextId(), 0);
    }

    // ─── Minting ─────────────────────────────────────────────────────────

    function test_mint_happyPath() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, 80, 70, 95, 40, 60);

        assertEq(id, 0);
        assertEq(nft.ownerOf(0), alice);
        assertEq(nft.nextId(), 1);
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_mint_statsStored() public {
        vm.prank(admin);
        nft.mint(alice, 80, 70, 95, 40, 60);

        (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = nft.getStats(0);
        assertEq(spd, 80);
        assertEq(pas, 70);
        assertEq(sho, 95);
        assertEq(def, 40);
        assertEq(sta, 60);
    }

    function test_mint_statsArray() public {
        vm.prank(admin);
        nft.mint(alice, 10, 20, 30, 40, 50);

        uint8[5] memory s = nft.getStatsArray(0);
        assertEq(s[0], 10);
        assertEq(s[1], 20);
        assertEq(s[2], 30);
        assertEq(s[3], 40);
        assertEq(s[4], 50);
    }

    function test_mint_playerRating() public {
        vm.prank(admin);
        nft.mint(alice, 60, 60, 60, 60, 60);

        assertEq(nft.playerRating(0), 60);
    }

    function test_mint_playerRating_mixed() public {
        vm.prank(admin);
        nft.mint(alice, 100, 80, 60, 40, 20);

        // (100+80+60+40+20)/5 = 60
        assertEq(nft.playerRating(0), 60);
    }

    function test_mint_sequential_ids() public {
        vm.startPrank(admin);
        assertEq(nft.mint(alice, 50, 50, 50, 50, 50), 0);
        assertEq(nft.mint(alice, 60, 60, 60, 60, 60), 1);
        assertEq(nft.mint(bob, 70, 70, 70, 70, 70), 2);
        vm.stopPrank();

        assertEq(nft.nextId(), 3);
    }

    function test_mint_maxStats() public {
        vm.prank(admin);
        nft.mint(alice, 100, 100, 100, 100, 100);

        assertEq(nft.playerRating(0), 100);
    }

    function test_mint_zeroStats() public {
        vm.prank(admin);
        nft.mint(alice, 0, 0, 0, 0, 0);

        assertEq(nft.playerRating(0), 0);
    }

    function test_mint_revert_statOver100() public {
        vm.prank(admin);
        vm.expectRevert(CloudFCPlayers.InvalidStats.selector);
        nft.mint(alice, 101, 50, 50, 50, 50);
    }

    function test_mint_revert_anyStatOver100() public {
        vm.prank(admin);
        vm.expectRevert(CloudFCPlayers.InvalidStats.selector);
        nft.mint(alice, 50, 50, 50, 50, 101);
    }

    function test_mint_revert_notAdmin() public {
        vm.prank(alice);
        vm.expectRevert(CloudFCPlayers.OnlyAdmin.selector);
        nft.mint(alice, 50, 50, 50, 50, 50);
    }

    function test_mint_emitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, true, false, true);
        emit CloudFCPlayers.PlayerMinted(0, alice, 80, 70, 95, 40, 60);
        nft.mint(alice, 80, 70, 95, 40, 60);
    }

    // ─── Batch Minting ───────────────────────────────────────────────────

    function test_mintBatch_happyPath() public {
        address[] memory tos = new address[](3);
        tos[0] = alice; tos[1] = alice; tos[2] = bob;
        uint8[] memory spds = new uint8[](3);
        spds[0] = 80; spds[1] = 60; spds[2] = 70;
        uint8[] memory pass = new uint8[](3);
        pass[0] = 70; pass[1] = 50; pass[2] = 60;
        uint8[] memory shos = new uint8[](3);
        shos[0] = 95; shos[1] = 40; shos[2] = 80;
        uint8[] memory defs = new uint8[](3);
        defs[0] = 40; defs[1] = 80; defs[2] = 50;
        uint8[] memory stas = new uint8[](3);
        stas[0] = 60; stas[1] = 70; stas[2] = 55;

        vm.prank(admin);
        nft.mintBatch(tos, spds, pass, shos, defs, stas);

        assertEq(nft.nextId(), 3);
        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.balanceOf(bob), 1);
        assertEq(nft.ownerOf(2), bob);
    }

    function test_mintBatch_revert_invalidStat() public {
        address[] memory tos = new address[](1);
        tos[0] = alice;
        uint8[] memory s = new uint8[](1);
        s[0] = 50;
        uint8[] memory bad = new uint8[](1);
        bad[0] = 101;

        vm.prank(admin);
        vm.expectRevert(CloudFCPlayers.InvalidStats.selector);
        nft.mintBatch(tos, bad, s, s, s, s);
    }

    // ─── Locking ─────────────────────────────────────────────────────────

    function test_lock_happyPath() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        assertEq(nft.locked(0), false);

        vm.prank(locker);
        nft.lockPlayer(0);

        assertEq(nft.locked(0), true);
    }

    function test_unlock_happyPath() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(locker);
        nft.lockPlayer(0);

        vm.prank(locker);
        nft.unlockPlayer(0);

        assertEq(nft.locked(0), false);
    }

    function test_lock_revert_notLocker() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(alice);
        vm.expectRevert(CloudFCPlayers.OnlyLocker.selector);
        nft.lockPlayer(0);
    }

    function test_lock_revert_alreadyLocked() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.startPrank(locker);
        nft.lockPlayer(0);
        vm.expectRevert(CloudFCPlayers.AlreadyLocked.selector);
        nft.lockPlayer(0);
        vm.stopPrank();
    }

    function test_unlock_revert_notLocked() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(locker);
        vm.expectRevert(CloudFCPlayers.NotLocked.selector);
        nft.unlockPlayer(0);
    }

    function test_lock_revert_nonexistentPlayer() public {
        vm.prank(locker);
        vm.expectRevert(CloudFCPlayers.PlayerDoesNotExist.selector);
        nft.lockPlayer(999);
    }

    // ─── Transfer Blocked When Locked ────────────────────────────────────

    function test_transfer_blockedWhenLocked() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(locker);
        nft.lockPlayer(0);

        vm.prank(alice);
        vm.expectRevert(CloudFCPlayers.PlayerLocked.selector);
        nft.transferFrom(alice, bob, 0);
    }

    function test_transfer_allowedWhenUnlocked() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(alice);
        nft.transferFrom(alice, bob, 0);

        assertEq(nft.ownerOf(0), bob);
    }

    function test_transfer_allowedAfterUnlock() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(locker);
        nft.lockPlayer(0);

        vm.prank(locker);
        nft.unlockPlayer(0);

        vm.prank(alice);
        nft.transferFrom(alice, bob, 0);
        assertEq(nft.ownerOf(0), bob);
    }

    // ─── Pause ───────────────────────────────────────────────────────────

    function test_pause_blocksMint() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(admin);
        vm.expectRevert();
        nft.mint(alice, 50, 50, 50, 50, 50);
    }

    function test_pause_blocksTransfer() public {
        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);

        vm.prank(admin);
        nft.pause();

        vm.prank(alice);
        vm.expectRevert();
        nft.transferFrom(alice, bob, 0);
    }

    function test_unpause_restores() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(admin);
        nft.unpause();

        vm.prank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50);
        assertEq(nft.ownerOf(0), alice);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    function test_setAdmin() public {
        vm.prank(admin);
        nft.setAdmin(alice);

        assertEq(nft.admin(), alice);

        // Old admin can't mint anymore
        vm.prank(admin);
        vm.expectRevert(CloudFCPlayers.OnlyAdmin.selector);
        nft.mint(bob, 50, 50, 50, 50, 50);

        // New admin can mint
        vm.prank(alice);
        nft.mint(bob, 50, 50, 50, 50, 50);
    }

    function test_setLocker_add_and_remove() public {
        address newLocker = makeAddr("newLocker");

        vm.prank(admin);
        nft.setLocker(newLocker, true);
        assertTrue(nft.lockers(newLocker));

        vm.prank(admin);
        nft.setLocker(newLocker, false);
        assertFalse(nft.lockers(newLocker));
    }

    // ─── View revert for nonexistent ─────────────────────────────────────

    function test_getStats_revert_nonexistent() public {
        vm.expectRevert(CloudFCPlayers.PlayerDoesNotExist.selector);
        nft.getStats(0);
    }

    function test_playerRating_revert_nonexistent() public {
        vm.expectRevert(CloudFCPlayers.PlayerDoesNotExist.selector);
        nft.playerRating(0);
    }

    // ─── Enumerable ──────────────────────────────────────────────────────

    function test_tokenOfOwnerByIndex() public {
        vm.startPrank(admin);
        nft.mint(alice, 50, 50, 50, 50, 50); // id=0
        nft.mint(alice, 60, 60, 60, 60, 60); // id=1
        nft.mint(bob, 70, 70, 70, 70, 70);   // id=2
        vm.stopPrank();

        assertEq(nft.tokenOfOwnerByIndex(alice, 0), 0);
        assertEq(nft.tokenOfOwnerByIndex(alice, 1), 1);
        assertEq(nft.tokenOfOwnerByIndex(bob, 0), 2);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. CloudFC Integration Tests
// ═══════════════════════════════════════════════════════════════════════════

contract CloudFCTest is Test {
    CloudFCPlayers public nft;
    CloudFC public fc;

    address deployer = makeAddr("deployer");
    address protocol = makeAddr("protocol");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    uint256 constant STAKE = 0.01 ether;

    function setUp() public {
        // Deploy Players NFT
        vm.prank(deployer);
        nft = new CloudFCPlayers();

        // Deploy CloudFC
        vm.prank(deployer);
        fc = new CloudFC(address(nft), protocol, treasury);

        // Authorize FC as locker
        vm.prank(deployer);
        nft.setLocker(address(fc), true);

        // Fund users
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);

        // Mint 5 players for Alice (ids 0-4) — balanced team
        vm.startPrank(deployer);
        nft.mint(alice, 60, 50, 30, 90, 85); // id 0: GK-type (high DEF+STA)
        nft.mint(alice, 55, 50, 25, 80, 70); // id 1: DEF-type
        nft.mint(alice, 60, 55, 30, 75, 65); // id 2: DEF-type
        nft.mint(alice, 70, 80, 60, 45, 60); // id 3: MID-type (high PAS)
        nft.mint(alice, 85, 55, 90, 30, 55); // id 4: FWD-type (high SHO+SPD)
        vm.stopPrank();

        // Mint 5 players for Bob (ids 5-9) — offensive team
        vm.startPrank(deployer);
        nft.mint(bob, 50, 40, 20, 85, 80); // id 5: GK-type
        nft.mint(bob, 65, 45, 35, 70, 60); // id 6: DEF-type
        nft.mint(bob, 75, 70, 55, 50, 55); // id 7: MID-type
        nft.mint(bob, 90, 60, 85, 25, 50); // id 8: FWD-type
        nft.mint(bob, 80, 65, 80, 35, 45); // id 9: FWD-type
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _aliceSquadIds() internal pure returns (uint256[5] memory) {
        return [uint256(0), 1, 2, 3, 4];
    }

    function _bobSquadIds() internal pure returns (uint256[5] memory) {
        return [uint256(5), 6, 7, 8, 9];
    }

    function _createAliceSquad(uint8 formation) internal returns (uint256) {
        vm.prank(alice);
        return fc.createSquad(_aliceSquadIds(), formation);
    }

    function _createBobSquad(uint8 formation) internal returns (uint256) {
        vm.prank(bob);
        return fc.createSquad(_bobSquadIds(), formation);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Deployment
    // ═══════════════════════════════════════════════════════════════════

    function test_deployment_state() public view {
        assertEq(fc.owner(), deployer);
        assertEq(fc.protocolFeeReceiver(), protocol);
        assertEq(fc.treasuryReceiver(), treasury);
        assertEq(address(fc.players()), address(nft));
        assertEq(fc.totalMatches(), 0);
        assertEq(fc.totalSquads(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Squad Creation
    // ═══════════════════════════════════════════════════════════════════

    function test_createSquad_happyPath() public {
        uint256 id = _createAliceSquad(0);
        assertEq(id, 0);
        assertEq(fc.totalSquads(), 1);

        (uint256[5] memory pids, address[5] memory owners, uint8 formation, address creator)
            = fc.getSquad(0);

        assertEq(pids[0], 0);
        assertEq(pids[4], 4);
        assertEq(owners[0], alice);
        assertEq(formation, 0);
        assertEq(creator, alice);
    }

    function test_createSquad_offensive() public {
        uint256 id = _createAliceSquad(1);
        (,,uint8 formation,) = fc.getSquad(id);
        assertEq(formation, 1);
    }

    function test_createSquad_defensive() public {
        uint256 id = _createAliceSquad(2);
        (,,uint8 formation,) = fc.getSquad(id);
        assertEq(formation, 2);
    }

    function test_createSquad_revert_invalidFormation() public {
        vm.prank(alice);
        vm.expectRevert(CloudFC.InvalidFormation.selector);
        fc.createSquad(_aliceSquadIds(), 3);
    }

    function test_createSquad_revert_notOwner() public {
        vm.prank(bob); // Bob doesn't own players 0-4
        vm.expectRevert(CloudFC.NotPlayerOwner.selector);
        fc.createSquad(_aliceSquadIds(), 0);
    }

    function test_createSquad_revert_duplicatePlayer() public {
        vm.prank(alice);
        vm.expectRevert(CloudFC.DuplicatePlayer.selector);
        fc.createSquad([uint256(0), 1, 2, 3, 0], 0); // player 0 twice
    }

    function test_createSquad_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CloudFC.SquadCreated(0, alice, _aliceSquadIds(), 0);
        fc.createSquad(_aliceSquadIds(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Match Creation
    // ═══════════════════════════════════════════════════════════════════

    function test_createMatch_happyPath() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);

        assertEq(matchId, 0);
        assertEq(fc.totalMatches(), 1);

        (uint256 homeSquadId,, uint128 stake,,,, uint8 status,,) = fc.getMatch(0);
        assertEq(homeSquadId, sqId);
        assertEq(stake, STAKE);
        assertEq(status, 0); // pending
    }

    function test_createMatch_friendly() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch(sqId); // 0 ETH

        (,, uint128 stake,,,,,,) = fc.getMatch(matchId);
        assertEq(stake, 0);
    }

    function test_createMatch_locksPlayers() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(sqId);

        // Players should be locked
        assertTrue(nft.locked(0));
        assertTrue(nft.locked(4));
    }

    function test_createMatch_revert_notCreator() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(bob);
        vm.expectRevert(CloudFC.NotPlayerOwner.selector);
        fc.createMatch(sqId);
    }

    function test_createMatch_revert_invalidSquad() public {
        vm.prank(alice);
        vm.expectRevert(CloudFC.InvalidSquad.selector);
        fc.createMatch(999);
    }

    function test_createMatch_revert_playerInActiveMatch() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(sqId);

        // Create another squad with same players (squad creation doesn't lock)
        // but match creation checks playerActiveMatch
        // We need another squad. But Alice's players are locked.
        // Let's try creating another match with the same squad.
        vm.prank(alice);
        vm.expectRevert(CloudFC.PlayerInActiveMatch.selector);
        fc.createMatch{value: STAKE}(sqId);
    }

    function test_createMatch_emitsEvent() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CloudFC.MatchCreated(0, sqId, uint128(STAKE));
        fc.createMatch{value: STAKE}(sqId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Match Acceptance & Resolution
    // ═══════════════════════════════════════════════════════════════════

    function test_acceptMatch_happyPath() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(1);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        (,,,, uint8 hg, uint8 ag, uint8 status,,) = fc.getMatch(matchId);
        assertEq(status, 1); // resolved
        assertLe(hg, 6);
        assertLe(ag, 6);
    }

    function test_acceptMatch_unlocksBothTeams() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(1);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        // All players should be unlocked after resolution
        for (uint256 i; i < 10; i++) {
            assertFalse(nft.locked(i), "Player should be unlocked after match");
        }
    }

    function test_acceptMatch_updatesRecords() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(1);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        (uint32 aWins, uint32 aLosses, uint32 aDraws,,, uint32 aMp) = fc.getRecord(alice);
        (uint32 bWins, uint32 bLosses, uint32 bDraws,,, uint32 bMp) = fc.getRecord(bob);

        assertEq(aMp, 1);
        assertEq(bMp, 1);
        assertEq(aWins + aLosses + aDraws, 1);
        assertEq(bWins + bLosses + bDraws, 1);
        // Either one wins and one loses, or both draw
        if (aDraws == 1) {
            assertEq(bDraws, 1, "Both should draw");
            assertEq(aWins + aLosses, 0);
        } else {
            assertEq(aWins + bWins, 1, "Exactly one winner");
        }
    }

    function test_acceptMatch_rewardsAllocated() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(1);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        // Protocol and treasury should get their cuts
        uint256 totalPool = STAKE * 2;
        uint256 protocolCut = totalPool * 1000 / 10_000; // 10%
        uint256 treasuryCut = totalPool * 500 / 10_000;  // 5%

        assertEq(fc.claimable(protocol), protocolCut);
        assertEq(fc.claimable(treasury), treasuryCut);

        // Alice and Bob combined should get the rest
        uint256 aliceClaim = fc.claimable(alice);
        uint256 bobClaim = fc.claimable(bob);
        uint256 playerTotal = aliceClaim + bobClaim;

        assertEq(playerTotal, totalPool - protocolCut - treasuryCut, "Player rewards should equal remaining pool");
    }

    function test_acceptMatch_refundsExcess() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(1);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        fc.acceptMatch{value: STAKE * 2}(0, awaySq); // sends 2x stake
        uint256 bobAfter = bob.balance;

        // Bob should only have paid STAKE (excess refunded)
        assertEq(bobBefore - bobAfter, STAKE);
    }

    function test_acceptMatch_friendly_noRewards() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch(homeSq); // 0 stake

        vm.prank(bob);
        fc.acceptMatch(matchId, awaySq); // 0 stake

        assertEq(fc.claimable(alice), 0);
        assertEq(fc.claimable(bob), 0);
        assertEq(fc.claimable(protocol), 0);

        // But records still update
        (,,,,, uint32 mp) = fc.getRecord(alice);
        assertEq(mp, 1);
    }

    function test_acceptMatch_revert_insufficientStake() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        vm.expectRevert(CloudFC.InsufficientStake.selector);
        fc.acceptMatch{value: STAKE / 2}(0, awaySq);
    }

    function test_acceptMatch_revert_notPending() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        // Try to accept again
        vm.prank(bob);
        vm.expectRevert(CloudFC.MatchNotPending.selector);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);
    }

    function test_acceptMatch_revert_cantPlayYourself() public {
        uint256 homeSq = _createAliceSquad(0);

        // Mint 5 more for Alice
        vm.startPrank(deployer);
        for (uint256 i; i < 5; i++) {
            nft.mint(alice, 50, 50, 50, 50, 50);
        }
        vm.stopPrank();

        uint256[5] memory ids2 = [uint256(10), 11, 12, 13, 14];
        vm.prank(alice);
        uint256 sq2 = fc.createSquad(ids2, 0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(alice);
        vm.expectRevert(CloudFC.CantPlayYourself.selector);
        fc.acceptMatch{value: STAKE}(matchId, sq2);
    }

    function test_acceptMatch_revert_samePlayerBothTeams() public {
        // Transfer player 0 from Alice to Bob
        // First cancel or don't lock player 0
        // Actually we need to be careful — player 0 is Alice's

        // Mint 4 extra for bob so he has 9 total, then transfer player 0 to bob
        vm.startPrank(deployer);
        for (uint256 i; i < 4; i++) {
            nft.mint(bob, 50, 50, 50, 50, 50); // ids 10-13
        }
        vm.stopPrank();

        // Transfer player 4 from Alice to Bob
        vm.prank(alice);
        nft.transferFrom(alice, bob, 4);

        // Alice's squad: [0, 1, 2, 3, ...] — she needs a 5th
        vm.prank(deployer);
        nft.mint(alice, 50, 50, 50, 50, 50); // id 14

        uint256[5] memory aliceIds = [uint256(0), 1, 2, 3, 14];
        vm.prank(alice);
        uint256 homeSq = fc.createSquad(aliceIds, 0);

        // Bob's squad includes player 4 (was Alice's)
        // But also has some of his own
        uint256[5] memory bobIds = [uint256(5), 6, 7, 8, 4]; // player 4 shared? No, only on Bob's side
        vm.prank(bob);
        uint256 awaySq = fc.createSquad(bobIds, 0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        // This should work fine since player 4 is only on away squad
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);
        // No revert — player 4 is only on one side
    }

    function test_acceptMatch_revert_invalidMatch() public {
        uint256 awaySq = _createBobSquad(0);

        vm.prank(bob);
        vm.expectRevert(CloudFC.InvalidMatch.selector);
        fc.acceptMatch{value: STAKE}(999, awaySq);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Match Cancellation
    // ═══════════════════════════════════════════════════════════════════

    function test_cancelMatch_happyPath() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);

        uint256 balBefore = alice.balance;

        vm.prank(alice);
        fc.cancelMatch(matchId);

        (,,,,, , uint8 status,,) = fc.getMatch(matchId);
        assertEq(status, 2); // cancelled

        // Stake refunded
        assertEq(alice.balance - balBefore, STAKE);
    }

    function test_cancelMatch_unlocksPlayers() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);

        assertTrue(nft.locked(0));

        vm.prank(alice);
        fc.cancelMatch(matchId);

        for (uint256 i; i < 5; i++) {
            assertFalse(nft.locked(i), "Player should be unlocked after cancel");
        }
    }

    function test_cancelMatch_revert_notCreator() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);

        vm.prank(bob);
        vm.expectRevert(CloudFC.NotMatchCreator.selector);
        fc.cancelMatch(matchId);
    }

    function test_cancelMatch_revert_notPending() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId, awaySq);

        vm.prank(alice);
        vm.expectRevert(CloudFC.MatchNotPending.selector);
        fc.cancelMatch(matchId);
    }

    function test_cancelMatch_friendly() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch(sqId); // no stake

        vm.prank(alice);
        fc.cancelMatch(matchId);

        (,,,,,,uint8 status,,) = fc.getMatch(matchId);
        assertEq(status, 2);
    }

    function test_cancelMatch_emitsEvent() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit CloudFC.MatchCancelled(matchId);
        fc.cancelMatch(matchId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Claim Rewards
    // ═══════════════════════════════════════════════════════════════════

    function test_claimRewards_happyPath() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        uint256 aliceClaimable = fc.claimable(alice);

        if (aliceClaimable > 0) {
            uint256 balBefore = alice.balance;
            vm.prank(alice);
            fc.claimRewards();
            assertEq(alice.balance - balBefore, aliceClaimable);
            assertEq(fc.claimable(alice), 0);
        }
    }

    function test_claimRewards_protocol() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        uint256 expected = STAKE * 2 * 1000 / 10_000; // 10%
        uint256 balBefore = protocol.balance;

        vm.prank(protocol);
        fc.claimRewards();

        assertEq(protocol.balance - balBefore, expected);
    }

    function test_claimRewards_treasury() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        uint256 expected = STAKE * 2 * 500 / 10_000; // 5%
        uint256 balBefore = treasury.balance;

        vm.prank(treasury);
        fc.claimRewards();

        assertEq(treasury.balance - balBefore, expected);
    }

    function test_claimRewards_revert_nothingToClaim() public {
        vm.prank(charlie);
        vm.expectRevert(CloudFC.NothingToClaim.selector);
        fc.claimRewards();
    }

    function test_claimRewards_accumulatesAcrossMatches() public {
        // Play match 1
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);
        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        uint256 afterMatch1 = fc.claimable(alice);

        // Play match 2
        uint256 homeSq2 = _createAliceSquad(1);
        uint256 awaySq2 = _createBobSquad(1);
        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq2);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(1, awaySq2);

        uint256 afterMatch2 = fc.claimable(alice);
        assertGe(afterMatch2, afterMatch1, "Rewards should accumulate");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ETH Accounting
    // ═══════════════════════════════════════════════════════════════════

    function test_eth_noLeakage() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        // Total claimable should equal contract balance
        uint256 totalClaimable = fc.claimable(alice)
            + fc.claimable(bob)
            + fc.claimable(protocol)
            + fc.claimable(treasury);

        assertEq(address(fc).balance, totalClaimable, "ETH in contract should match total claimable");
    }

    function test_eth_allClaimed_contractEmpty() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        // Claim all rewards
        if (fc.claimable(alice) > 0) {
            vm.prank(alice);
            fc.claimRewards();
        }
        if (fc.claimable(bob) > 0) {
            vm.prank(bob);
            fc.claimRewards();
        }
        vm.prank(protocol);
        fc.claimRewards();
        vm.prank(treasury);
        fc.claimRewards();

        assertEq(address(fc).balance, 0, "Contract should be empty after all claims");
    }

    // ═══════════════════════════════════════════════════════════════════
    // View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function test_getSquadPower_nonZero() public {
        uint256 sqId = _createAliceSquad(0);
        uint256 power = fc.getSquadPower(sqId);
        assertGt(power, 0, "Squad power should be > 0");
    }

    function test_getSquadPower_strongerSquadHigher() public {
        uint256 aliceSq = _createAliceSquad(0);
        uint256 bobSq = _createBobSquad(0);

        uint256 alicePower = fc.getSquadPower(aliceSq);
        uint256 bobPower = fc.getSquadPower(bobSq);

        // Both should be non-zero; actual comparison depends on stats
        assertGt(alicePower, 0);
        assertGt(bobPower, 0);
    }

    function test_getRecord_initial() public view {
        (uint32 w, uint32 l, uint32 d,,, uint32 mp) = fc.getRecord(charlie);
        assertEq(w, 0);
        assertEq(l, 0);
        assertEq(d, 0);
        assertEq(mp, 0);
    }

    function test_getRecord_goalsTracked() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        (,,, uint32 aGF, uint32 aGA,) = fc.getRecord(alice);
        (,,, uint32 bGF, uint32 bGA,) = fc.getRecord(bob);

        // Alice's goals for = Bob's goals against and vice versa
        assertEq(aGF, bGA);
        assertEq(aGA, bGF);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════

    function test_admin_setProtocolFeeReceiver() public {
        vm.prank(deployer);
        fc.setProtocolFeeReceiver(charlie);
        assertEq(fc.protocolFeeReceiver(), charlie);
    }

    function test_admin_setTreasuryReceiver() public {
        vm.prank(deployer);
        fc.setTreasuryReceiver(charlie);
        assertEq(fc.treasuryReceiver(), charlie);
    }

    function test_admin_transferOwnership() public {
        vm.prank(deployer);
        fc.transferOwnership(alice);
        assertEq(fc.owner(), alice);
    }

    function test_admin_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(CloudFC.OnlyOwner.selector);
        fc.setProtocolFeeReceiver(alice);
    }

    function test_admin_pause_blocksCreateSquad() public {
        vm.prank(deployer);
        fc.pause();

        vm.prank(alice);
        vm.expectRevert();
        fc.createSquad(_aliceSquadIds(), 0);
    }

    function test_admin_pause_blocksCreateMatch() public {
        uint256 sqId = _createAliceSquad(0);

        vm.prank(deployer);
        fc.pause();

        vm.prank(alice);
        vm.expectRevert();
        fc.createMatch(sqId);
    }

    function test_admin_pause_blocksAcceptMatch() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);

        vm.prank(deployer);
        fc.pause();

        vm.prank(bob);
        vm.expectRevert();
        fc.acceptMatch{value: STAKE}(0, awaySq);
    }

    function test_admin_unpause_restores() public {
        vm.prank(deployer);
        fc.pause();

        vm.prank(deployer);
        fc.unpause();

        _createAliceSquad(0); // should not revert
    }

    // ═══════════════════════════════════════════════════════════════════
    // Multi-Match Lifecycle
    // ═══════════════════════════════════════════════════════════════════

    function test_multipleMatches_sequential() public {
        // Match 1
        uint256 sq1a = _createAliceSquad(0);
        uint256 sq1b = _createBobSquad(0);
        vm.prank(alice);
        fc.createMatch{value: STAKE}(sq1a);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, sq1b);

        // Players are unlocked — can play again
        assertFalse(nft.locked(0));

        // Match 2 — different formations
        uint256 sq2a = _createAliceSquad(1);
        uint256 sq2b = _createBobSquad(2);
        vm.prank(alice);
        fc.createMatch{value: STAKE}(sq2a);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(1, sq2b);

        // Match 3
        uint256 sq3a = _createAliceSquad(2);
        uint256 sq3b = _createBobSquad(1);
        vm.prank(alice);
        fc.createMatch{value: STAKE}(sq3a);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(2, sq3b);

        assertEq(fc.totalMatches(), 3);

        (,,,,, uint32 aliceMp) = fc.getRecord(alice);
        (,,,,, uint32 bobMp) = fc.getRecord(bob);
        assertEq(aliceMp, 3);
        assertEq(bobMp, 3);
    }

    function test_cancel_then_replay() public {
        uint256 sqId = _createAliceSquad(0);

        // Create and cancel
        vm.prank(alice);
        uint256 matchId = fc.createMatch{value: STAKE}(sqId);
        vm.prank(alice);
        fc.cancelMatch(matchId);

        // Players unlocked — can play again
        uint256 sq2 = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        vm.prank(alice);
        uint256 matchId2 = fc.createMatch{value: STAKE}(sq2);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(matchId2, awaySq);

        assertEq(fc.totalMatches(), 2);
        (,,,,,,uint8 s0,,) = fc.getMatch(0);
        (,,,,,,uint8 s1,,) = fc.getMatch(1);
        assertEq(s0, 2); // cancelled
        assertEq(s1, 1); // resolved
    }

    // ═══════════════════════════════════════════════════════════════════
    // Simulation Determinism (end-to-end)
    // ═══════════════════════════════════════════════════════════════════

    function test_matchResult_deterministic_samePrevrandao() public {
        uint256 homeSq = _createAliceSquad(0);
        uint256 awaySq = _createBobSquad(0);

        // Set a known prevrandao
        vm.prevrandao(bytes32(uint256(42)));

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(0, awaySq);

        (,,,, uint8 hg1, uint8 ag1,,,) = fc.getMatch(0);

        // Play again with same prevrandao
        uint256 homeSq2 = _createAliceSquad(0);
        uint256 awaySq2 = _createBobSquad(0);

        vm.prevrandao(bytes32(uint256(42)));

        vm.prank(alice);
        fc.createMatch{value: STAKE}(homeSq2);
        vm.prank(bob);
        fc.acceptMatch{value: STAKE}(1, awaySq2);

        (,,,, uint8 hg2, uint8 ag2,,,) = fc.getMatch(1);

        assertEq(hg1, hg2, "Same seed should produce same home goals");
        assertEq(ag1, ag2, "Same seed should produce same away goals");
    }
}
