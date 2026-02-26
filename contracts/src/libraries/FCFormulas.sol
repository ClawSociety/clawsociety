// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FCFormulas V2 — Pure math helpers for CloudFC
/// @notice Positional effectiveness, VRF noise (attack+defense), symmetric RPS, diminishing returns
library FCFormulas {
    // ──────────────────────────── Constants ────────────────────────────────

    uint256 internal constant BPS = 10_000;
    uint256 internal constant NOISE_CAP_BPS = 800; // +/-8% max VRF swing

    // Positional weight tables (BPS)
    // Columns: SPD, PAS, SHO, DEF, STA
    // Row 0 = GK, 1 = DEF, 2 = MID, 3 = FWD

    function _posWeight(uint8 pos, uint8 stat) internal pure returns (uint256) {
        uint256[5][4] memory w = [
            [uint256(1000), 1000, 500, 4000, 3500],  // GK
            [uint256(2000), 1500, 500, 3500, 2500],   // DEF
            [uint256(2000), 3000, 1500, 1500, 2000],   // MID
            [uint256(2500), 1500, 3500, 500, 2000]     // FWD
        ];
        return w[pos][stat];
    }

    // ──────────────────────────── Diminishing Returns ────────────────────

    /// @notice Apply diminishing returns: effectiveStat = 100 * (stat/100)^0.85
    /// @dev Uses a piecewise linear approximation for gas efficiency.
    ///      Exact values: 20→23, 40→43, 60→62, 80→82, 95→93, 100→100
    ///      Compresses top-end stats without eliminating the gap.
    function _diminish(uint8 stat) internal pure returns (uint256) {
        if (stat == 0) return 0;
        if (stat >= 100) return 100;
        // Piecewise linear approximation of 100 * (x/100)^0.85
        // Breakpoints: [0,0], [20,23], [40,43], [60,62], [80,82], [100,100]
        uint256 s = uint256(stat);
        if (s <= 20) {
            // 0→0, 20→23: slope = 23/20 = 1.15
            return s * 23 / 20;
        } else if (s <= 40) {
            // 20→23, 40→43: slope = 20/20 = 1.0
            return 23 + (s - 20) * 20 / 20;
        } else if (s <= 60) {
            // 40→43, 60→62: slope = 19/20 = 0.95
            return 43 + (s - 40) * 19 / 20;
        } else if (s <= 80) {
            // 60→62, 80→82: slope = 20/20 = 1.0
            return 62 + (s - 60) * 20 / 20;
        } else {
            // 80→82, 100→100: slope = 18/20 = 0.9
            return 82 + (s - 80) * 18 / 20;
        }
    }

    // ──────────────────────────── Effective Rating ─────────────────────────

    /// @notice Weighted rating for a player in a given position
    /// @param stats Packed [speed, passing, shooting, defense, stamina] (0-100 each)
    /// @param pos 0=GK, 1=DEF, 2=MID, 3=FWD
    /// @param useDiminishing Whether to apply diminishing returns
    /// @return rating Effective rating in centibps (0-10000 range)
    function effectiveRating(uint8[5] memory stats, uint8 pos, bool useDiminishing)
        internal
        pure
        returns (uint256 rating)
    {
        for (uint8 i; i < 5; ++i) {
            uint256 s = useDiminishing ? _diminish(stats[i]) : uint256(stats[i]);
            rating += s * _posWeight(pos, i);
        }
        rating = rating / 100; // range 0-10000
    }

    /// @notice Legacy overload without diminishing returns flag
    function effectiveRating(uint8[5] memory stats, uint8 pos) internal pure returns (uint256) {
        return effectiveRating(stats, pos, false);
    }

    // ──────────────────────────── Synergy Bonus ───────────────────────────

    /// @notice Synergy bonus for same-owner players on a squad
    /// @param maxSameOwnerCount How many players share the most common owner
    /// @return bonusBps Bonus in BPS (e.g. 150 = 1.5%)
    function synergyBonusBps(uint256 maxSameOwnerCount) internal pure returns (uint256 bonusBps) {
        if (maxSameOwnerCount <= 1) return 0;
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

    /// @notice Formation attack/defense modifiers with symmetric RPS counters
    /// @dev V2: All counters now give +5% (balanced was +3% in V1)
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
            atkMod = BPS;
            defMod = BPS;
        } else if (myFormation == 1) {
            atkMod = 10800; // 1.08x
            defMod = 9200;  // 0.92x
        } else {
            atkMod = 9200;
            defMod = 10800;
        }

        // Symmetric RPS counter bonuses (all +5%)
        if (myFormation == 1 && oppFormation == 0) {
            // Offensive beats Balanced: +5% attack
            atkMod += 500;
        } else if (myFormation == 2 && oppFormation == 1) {
            // Defensive beats Offensive: +5% defense
            defMod += 500;
        } else if (myFormation == 0 && oppFormation == 2) {
            // Balanced beats Defensive: +2.5% each (total +5%)
            atkMod += 250;
            defMod += 250;
        }
    }

    // ──────────────────────────── Stamina Decay ──────────────────────────

    /// @notice Fatigue multiplier for a phase. Returns value in BPS.
    /// @param phase Current phase (0-9)
    /// @param stamina Player stamina stat (0-100)
    function fatigueMultiplier(uint256 phase, uint8 stamina) internal pure returns (uint256) {
        uint256 decay = (phase * 1000 * (120 - uint256(stamina))) / 120;
        if (decay > BPS) return 0;
        return BPS - decay;
    }
}
