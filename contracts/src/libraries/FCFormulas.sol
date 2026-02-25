// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FCFormulas — Pure math helpers for CloudFC
/// @notice Logistic win probability, VRF noise derivation, synergy, positional effectiveness
library FCFormulas {
    // ──────────────────────────── Constants ────────────────────────────────

    uint256 internal constant BPS = 10_000;
    uint256 internal constant NOISE_CAP_BPS = 800; // +/-8% max VRF swing

    // Positional weight tables (BPS)
    // Columns: SPD, PAS, SHO, DEF, STA
    // Row 0 = GK, 1 = DEF, 2 = MID, 3 = FWD

    function _posWeight(uint8 pos, uint8 stat) internal pure returns (uint256) {
        // pos: 0=GK, 1=DEF, 2=MID, 3=FWD
        // stat: 0=SPD, 1=PAS, 2=SHO, 3=DEF, 4=STA
        uint256[5][4] memory w = [
            [uint256(1000), 1000, 500, 4000, 3500],  // GK
            [uint256(2000), 1500, 500, 3500, 2500],   // DEF
            [uint256(2000), 3000, 1500, 1500, 2000],   // MID
            [uint256(2500), 1500, 3500, 500, 2000]     // FWD
        ];
        return w[pos][stat];
    }

    // ──────────────────────────── Effective Rating ─────────────────────────

    /// @notice Weighted rating for a player in a given position
    /// @param stats Packed [speed, passing, shooting, defense, stamina] (0-100 each)
    /// @param pos 0=GK, 1=DEF, 2=MID, 3=FWD
    /// @return rating Effective rating (0-100 scale, in BPS for precision)
    function effectiveRating(uint8[5] memory stats, uint8 pos) internal pure returns (uint256 rating) {
        for (uint8 i; i < 5; ++i) {
            rating += uint256(stats[i]) * _posWeight(pos, i);
        }
        // rating is now in BPS (e.g. stat=80 * weight=3500 summed). Divide by BPS to get 0-100 scale
        // But we keep it in BPS for precision (multiply by 100 equivalent)
        // Final: rating = sum / 10000 → but we keep *100 for internal precision
        // Actually: each stat 0-100, weight sums to 10000. So max = 100 * 10000 = 1_000_000
        // We want result in "effective points * 100" for precision
        // effectiveRating = Σ(stat_i × weight_i) / 10000 → range 0-100
        // Keep as raw sum / 100 for better precision (range 0-10000)
        rating = rating / 100; // range 0-10000 (i.e. 0.00-100.00 in centibps)
    }

    // ──────────────────────────── Synergy Bonus ───────────────────────────

    /// @notice Synergy bonus for same-owner players on a squad
    /// @param maxSameOwnerCount How many players share the most common owner
    /// @return bonusBps Bonus in BPS (e.g. 150 = 1.5%)
    function synergyBonusBps(uint256 maxSameOwnerCount) internal pure returns (uint256 bonusBps) {
        if (maxSameOwnerCount <= 1) return 0;
        // 1.5% per additional same-owner player, capped at 5%
        bonusBps = (maxSameOwnerCount - 1) * 150;
        if (bonusBps > 500) bonusBps = 500;
    }

    // ──────────────────────────── VRF Noise ───────────────────────────────

    /// @notice Derive noise from VRF seed. Returns value in [-NOISE_CAP_BPS, +NOISE_CAP_BPS]
    function deriveNoise(uint256 seed, bytes32 salt) internal pure returns (int256) {
        uint256 h = uint256(keccak256(abi.encodePacked(seed, salt)));
        int256 raw = int256(h % (2 * NOISE_CAP_BPS + 1)) - int256(NOISE_CAP_BPS);
        return raw; // in BPS
    }

    // ──────────────────────────── Formation Modifiers ─────────────────────

    /// @notice Formation attack/defense modifiers with RPS counters
    /// @param myFormation 0=balanced, 1=offensive, 2=defensive
    /// @param oppFormation opponent's formation
    /// @return atkMod attack modifier in BPS (10000 = 1.0x)
    /// @return defMod defense modifier in BPS
    function formationModifiers(uint8 myFormation, uint8 oppFormation)
        internal
        pure
        returns (uint256 atkMod, uint256 defMod)
    {
        // Base modifiers
        if (myFormation == 0) {
            // Balanced 1-2-2
            atkMod = BPS;
            defMod = BPS;
        } else if (myFormation == 1) {
            // Offensive 1-1-3
            atkMod = 10800; // 1.08x
            defMod = 9200;  // 0.92x
        } else {
            // Defensive 1-3-1
            atkMod = 9200;
            defMod = 10800;
        }

        // RPS counter bonuses
        // Offensive beats Balanced: +5% attack
        // Defensive beats Offensive: +5% defense
        // Balanced beats Defensive: +3% both
        if (myFormation == 1 && oppFormation == 0) {
            atkMod += 500;
        } else if (myFormation == 2 && oppFormation == 1) {
            defMod += 500;
        } else if (myFormation == 0 && oppFormation == 2) {
            atkMod += 300;
            defMod += 300;
        }
    }

    // ──────────────────────────── Stamina Decay ──────────────────────────

    /// @notice Fatigue multiplier for a phase. Returns value in BPS.
    /// @param phase Current phase (0-9)
    /// @param stamina Player stamina stat (0-100)
    function fatigueMultiplier(uint256 phase, uint8 stamina) internal pure returns (uint256) {
        // fatigue = 1 - (phase/10) × (1 - stamina/120)
        // In BPS: 10000 - (phase * 1000) * (120 - stamina) / 120
        uint256 decay = (phase * 1000 * (120 - uint256(stamina))) / 120;
        if (decay > BPS) return 0;
        return BPS - decay;
    }
}
