// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FCFormulas} from "./FCFormulas.sol";

/// @title FCSimulation — Pure deterministic match simulation
/// @notice Computes team power, Poisson goals, and match results from stats + VRF seed
library FCSimulation {
    uint256 internal constant BPS = 10_000;

    // BASE_LAMBDA = 1.3 → stored as 1300 (×1000)
    uint256 internal constant BASE_LAMBDA_X1000 = 1300;
    uint256 internal constant LAMBDA_MIN_X1000 = 300;  // 0.3
    uint256 internal constant LAMBDA_MAX_X1000 = 3500; // 3.5
    uint256 internal constant MAX_GOALS_PER_TEAM = 6;

    // ──────────────────────────── Structs ─────────────────────────────────

    struct TeamData {
        uint8[5][5] playerStats; // 5 players, each with 5 stats
        uint8[5] positions;      // role per player: 0=GK, 1=DEF, 2=MID, 3=FWD
        uint8 formation;         // 0=balanced, 1=offensive, 2=defensive
        uint256 maxSameOwner;    // for synergy
    }

    struct MatchResult {
        uint8 homeGoals;
        uint8 awayGoals;
        uint256 homePower;
        uint256 awayPower;
    }

    // ──────────────────────────── Team Power ──────────────────────────────

    function teamPower(TeamData memory team) internal pure returns (uint256 power) {
        for (uint256 i; i < 5; ++i) {
            power += FCFormulas.effectiveRating(team.playerStats[i], team.positions[i]);
        }
        uint256 synergy = FCFormulas.synergyBonusBps(team.maxSameOwner);
        power = power * (BPS + synergy) / BPS;
    }

    // ──────────────────────────── Attack/Defense Split ─────────────────────

    function attackDefense(TeamData memory team)
        internal
        pure
        returns (uint256 attack, uint256 defense)
    {
        uint256 fwdEff;
        uint256 midEff;
        uint256 defEff;
        uint256 gkEff;
        uint256 totalEff;

        for (uint256 i; i < 5; ++i) {
            uint256 eff = FCFormulas.effectiveRating(team.playerStats[i], team.positions[i]);
            totalEff += eff;
            if (team.positions[i] == 3) fwdEff += eff;
            else if (team.positions[i] == 2) midEff += eff;
            else if (team.positions[i] == 1) defEff += eff;
            else gkEff += eff;
        }

        uint256 avgEff = totalEff / 5;
        attack = (fwdEff * 4000 + midEff * 3500 + avgEff * 2500) / BPS;
        defense = (gkEff * 4000 + defEff * 3500 + avgEff * 2500) / BPS;

        uint256 synergy = FCFormulas.synergyBonusBps(team.maxSameOwner);
        attack = attack * (BPS + synergy) / BPS;
        defense = defense * (BPS + synergy) / BPS;
    }

    // ──────────────────────────── Apply Noise to Atk ──────────────────────

    function _applyNoise(uint256 atk, int256 noise) private pure returns (uint256) {
        if (noise >= 0) {
            return atk * (BPS + uint256(noise)) / BPS;
        } else {
            return atk * (BPS - uint256(-noise)) / BPS;
        }
    }

    // ──────────────────────────── Compute Effective Powers ─────────────────

    function _effectivePowers(
        TeamData memory home,
        TeamData memory away,
        uint256 vrfSeed
    ) private pure returns (uint256 homeAtk, uint256 homeDef, uint256 awayAtk, uint256 awayDef) {
        (homeAtk, homeDef) = attackDefense(home);
        (awayAtk, awayDef) = attackDefense(away);

        // Formation modifiers
        {
            (uint256 hAtkMod, uint256 hDefMod) = FCFormulas.formationModifiers(home.formation, away.formation);
            homeAtk = homeAtk * hAtkMod / BPS;
            homeDef = homeDef * hDefMod / BPS;
        }
        {
            (uint256 aAtkMod, uint256 aDefMod) = FCFormulas.formationModifiers(away.formation, home.formation);
            awayAtk = awayAtk * aAtkMod / BPS;
            awayDef = awayDef * aDefMod / BPS;
        }

        // VRF noise on attack
        homeAtk = _applyNoise(homeAtk, FCFormulas.deriveNoise(vrfSeed, "teamA"));
        awayAtk = _applyNoise(awayAtk, FCFormulas.deriveNoise(vrfSeed, "teamB"));
    }

    // ──────────────────────────── Simulate Match ──────────────────────────

    function simulate(
        TeamData memory home,
        TeamData memory away,
        uint256 vrfSeed
    ) internal pure returns (MatchResult memory result) {
        (uint256 homeAtk, uint256 homeDef, uint256 awayAtk, uint256 awayDef) =
            _effectivePowers(home, away, vrfSeed);

        // Lambda for Poisson
        uint256 lambdaHome = awayDef > 0
            ? _clamp(BASE_LAMBDA_X1000 * homeAtk / awayDef, LAMBDA_MIN_X1000, LAMBDA_MAX_X1000)
            : LAMBDA_MAX_X1000;
        uint256 lambdaAway = homeDef > 0
            ? _clamp(BASE_LAMBDA_X1000 * awayAtk / homeDef, LAMBDA_MIN_X1000, LAMBDA_MAX_X1000)
            : LAMBDA_MAX_X1000;

        // Poisson sample
        result.homeGoals = uint8(_poissonSample(lambdaHome, uint256(keccak256(abi.encode(vrfSeed, "homeGoals")))));
        result.awayGoals = uint8(_poissonSample(lambdaAway, uint256(keccak256(abi.encode(vrfSeed, "awayGoals")))));
        result.homePower = teamPower(home);
        result.awayPower = teamPower(away);
    }

    // ──────────────────────────── Poisson Sampler ─────────────────────────

    function _poissonSample(uint256 lambdaX1000, uint256 seed) private pure returns (uint256) {
        uint256 uniform = seed % 1_000_000;
        uint256 SCALE = 1e18;
        uint256 lambda18 = lambdaX1000 * SCALE / 1000;
        uint256 expNegLambda = _expNeg(lambda18);

        uint256 cdf = expNegLambda;
        uint256 pmf = expNegLambda;
        uint256 target = uniform * SCALE / 1_000_000;

        if (target < cdf) return 0;

        for (uint256 k = 1; k <= MAX_GOALS_PER_TEAM; ++k) {
            pmf = pmf * lambda18 / (k * SCALE);
            cdf += pmf;
            if (target < cdf) return k;
        }

        return MAX_GOALS_PER_TEAM;
    }

    /// @notice Approximate e^(-x) for x in [0, 3.5] with 18 decimal precision
    /// @dev Splits x into integer + fractional parts to avoid unsigned underflow.
    ///      e^(-x) = e^(-floor(x)) × e^(-frac(x))
    function _expNeg(uint256 x18) private pure returns (uint256) {
        uint256 SCALE = 1e18;
        // e^(-1) ≈ 0.367879441171442322
        uint256 EXP_NEG_1 = 367879441171442322;

        // Split into integer and fractional parts
        uint256 intPart = x18 / SCALE;
        uint256 fracPart = x18 % SCALE;

        // e^(-intPart) via repeated multiplication
        uint256 intResult = SCALE;
        for (uint256 i; i < intPart; ++i) {
            intResult = intResult * EXP_NEG_1 / SCALE;
        }

        // e^(-fracPart) via Taylor series (fracPart < 1, no underflow)
        uint256 res = SCALE;
        uint256 term = SCALE;
        for (uint256 i = 1; i <= 12; ++i) {
            term = term * fracPart / (i * SCALE);
            if (i % 2 == 1) {
                res -= term; // safe: fracPart < SCALE so partial sums stay positive
            } else {
                res += term;
            }
        }

        return intResult * res / SCALE;
    }

    function _clamp(uint256 val, uint256 lo, uint256 hi) private pure returns (uint256) {
        if (val < lo) return lo;
        if (val > hi) return hi;
        return val;
    }
}
