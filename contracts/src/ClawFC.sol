// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IClawSocietyManager} from "./interfaces/IClawSocietyManager.sol";

/// @title ClawFC — On-Chain Street Football for Claw Society
/// @notice 5v5 matches where each seat is a football player.
///         Player rating = seat price. Higher price = more tax = better player.
///         Matches resolved deterministically on-chain with pseudo-random simulation.
contract ClawFC is ReentrancyGuard {
    // ──────────────────────────── Constants ────────────────────────────────────

    uint256 public constant TEAM_SIZE = 5;
    uint256 public constant NUM_PLAYS = 10;
    uint256 public constant GOAL_CHANCE_BPS = 2500; // 25% chance per play
    uint256 public constant FEE_BPS = 500;           // 5% fee on stakes
    uint256 public constant EMPTY_SLOT = 100;         // seatId >= 100 = empty

    // ──────────────────────────── State ────────────────────────────────────────

    IClawSocietyManager public immutable manager;
    address public owner;
    address public feeReceiver;

    struct Match {
        address  home;
        address  away;
        uint256[5] homeSeatIds;
        uint256[5] awaySeatIds;
        uint128  stake;
        uint64   createdAt;
        uint8    homeGoals;
        uint8    awayGoals;
        uint8    status; // 0=open, 1=resolved, 2=cancelled
        uint256  seed;   // block.prevrandao at resolution (for frontend replay)
    }

    Match[] public matches;

    struct Record {
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint32 goalsFor;
        uint32 goalsAgainst;
        uint32 matchesPlayed;
    }

    mapping(address => Record) public records;

    // ──────────────────────────── Events ───────────────────────────────────────

    event MatchCreated(uint256 indexed matchId, address indexed home, uint256 stake);
    event MatchResolved(
        uint256 indexed matchId,
        address indexed winner,
        uint8 homeGoals,
        uint8 awayGoals,
        uint256 homePower,
        uint256 awayPower
    );
    event MatchCancelled(uint256 indexed matchId);

    // ──────────────────────────── Errors ──────────────────────────────────────

    error NotHolder();
    error OnlyOwner();
    error InvalidMatch();
    error InvalidTeam();
    error DuplicateSeat();
    error InsufficientStake();
    error MatchNotOpen();
    error CantPlayYourself();
    error TransferFailed();

    // ──────────────────────────── Modifiers ───────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ──────────────────────────── Constructor ─────────────────────────────────

    constructor(address _manager, address _feeReceiver) {
        manager = IClawSocietyManager(_manager);
        owner = msg.sender;
        feeReceiver = _feeReceiver;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          MATCH LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create an open match. Pick up to 5 of your seats (use 100+ for
    ///         empty slots). Attach ETH as stake (0 for friendly).
    function createMatch(uint256[5] calldata seatIds)
        external
        payable
        nonReentrant
        returns (uint256 matchId)
    {
        _validateTeam(seatIds, msg.sender);

        matchId = matches.length;
        matches.push();
        Match storage m = matches[matchId];
        m.home = msg.sender;
        m.homeSeatIds = seatIds;
        m.stake = uint128(msg.value);
        m.createdAt = uint64(block.timestamp);
        // status = 0 (open) by default

        emit MatchCreated(matchId, msg.sender, msg.value);
    }

    /// @notice Accept an open match, submit your team, and resolve instantly.
    ///         Must send at least the match stake. Excess is refunded.
    function acceptMatch(uint256 matchId, uint256[5] calldata seatIds)
        external
        payable
        nonReentrant
    {
        if (matchId >= matches.length) revert InvalidMatch();
        Match storage m = matches[matchId];
        if (m.status != 0) revert MatchNotOpen();
        if (msg.sender == m.home) revert CantPlayYourself();
        if (msg.value < m.stake) revert InsufficientStake();

        _validateTeam(seatIds, msg.sender);

        m.away = msg.sender;
        m.awaySeatIds = seatIds;
        m.seed = block.prevrandao;
        m.status = 1; // resolved

        // Current seat prices determine team power (reflects real-time tax burden)
        uint256 homePower = _teamPower(m.homeSeatIds, m.home);
        uint256 awayPower = _teamPower(m.awaySeatIds, m.away);

        // Deterministic simulation
        (uint8 hg, uint8 ag) = _simulate(matchId, homePower, awayPower);
        m.homeGoals = hg;
        m.awayGoals = ag;

        // Update season records
        _updateRecords(m.home, m.away, hg, ag);

        // Settle ETH stakes
        _settle(m.home, m.away, m.stake, hg, ag);

        // Refund excess
        if (msg.value > m.stake) {
            _send(msg.sender, msg.value - m.stake);
        }

        address winner = hg > ag ? m.home : (ag > hg ? m.away : address(0));
        emit MatchResolved(matchId, winner, hg, ag, homePower, awayPower);
    }

    /// @notice Cancel an open match (home only). Stake refunded.
    function cancelMatch(uint256 matchId) external nonReentrant {
        if (matchId >= matches.length) revert InvalidMatch();
        Match storage m = matches[matchId];
        if (m.status != 0) revert MatchNotOpen();
        if (msg.sender != m.home) revert OnlyOwner();

        m.status = 2;
        if (m.stake > 0) _send(m.home, m.stake);

        emit MatchCancelled(matchId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                           INTERNAL LOGIC
    // ═══════════════════════════════════════════════════════════════════════════

    function _validateTeam(uint256[5] calldata seatIds, address player) internal view {
        for (uint256 i; i < TEAM_SIZE; ++i) {
            if (seatIds[i] >= EMPTY_SLOT) continue; // empty slot

            (address holder,,,,,) = manager.seats(seatIds[i]);
            if (holder != player) revert NotHolder();

            // No duplicates
            for (uint256 j = i + 1; j < TEAM_SIZE; ++j) {
                if (seatIds[j] < EMPTY_SLOT && seatIds[i] == seatIds[j]) {
                    revert DuplicateSeat();
                }
            }
        }
    }

    /// @dev Team power = sum of seat prices for seats still owned by player.
    ///      Lost seats (bought out since match creation) contribute 0.
    function _teamPower(uint256[5] storage seatIds, address player)
        internal
        view
        returns (uint256 power)
    {
        for (uint256 i; i < TEAM_SIZE; ++i) {
            if (seatIds[i] >= EMPTY_SLOT) continue;
            (address holder, uint128 price,,,,) = manager.seats(seatIds[i]);
            if (holder == player) {
                power += price;
            }
        }
    }

    /// @dev Deterministic match simulation. 10 plays, each has 25% chance of
    ///      producing a goal. When a goal happens, it goes to the team with
    ///      probability proportional to their power.
    function _simulate(uint256 matchId, uint256 homePower, uint256 awayPower)
        internal
        view
        returns (uint8 homeGoals, uint8 awayGoals)
    {
        uint256 totalPower = homePower + awayPower;
        if (totalPower == 0) totalPower = 2; // coin flip if both 0

        for (uint256 i; i < NUM_PLAYS; ++i) {
            uint256 seed = uint256(keccak256(abi.encode(matchId, i, block.prevrandao)));
            uint256 roll = seed % 10000;

            if (roll < GOAL_CHANCE_BPS) {
                uint256 goalSeed = (seed >> 16) % totalPower;
                if (goalSeed < homePower) {
                    homeGoals++;
                } else {
                    awayGoals++;
                }
            }
        }
    }

    function _updateRecords(address home, address away, uint8 hg, uint8 ag) internal {
        records[home].matchesPlayed++;
        records[away].matchesPlayed++;
        records[home].goalsFor += uint32(hg);
        records[home].goalsAgainst += uint32(ag);
        records[away].goalsFor += uint32(ag);
        records[away].goalsAgainst += uint32(hg);

        if (hg > ag) {
            records[home].wins++;
            records[away].losses++;
        } else if (ag > hg) {
            records[away].wins++;
            records[home].losses++;
        } else {
            records[home].draws++;
            records[away].draws++;
        }
    }

    function _settle(address home, address away, uint256 stake, uint8 hg, uint8 ag) internal {
        if (stake == 0) return;

        uint256 totalPot = stake * 2;
        uint256 fee = (totalPot * FEE_BPS) / 10000;
        uint256 payout = totalPot - fee;

        if (fee > 0) _send(feeReceiver, fee);

        if (hg > ag) {
            _send(home, payout);
        } else if (ag > hg) {
            _send(away, payout);
        } else {
            // Draw: split evenly
            uint256 half = payout / 2;
            _send(home, half);
            _send(away, payout - half);
        }
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                             VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function totalMatches() external view returns (uint256) {
        return matches.length;
    }

    function getMatch(uint256 matchId)
        external
        view
        returns (
            address home,
            address away,
            uint256[5] memory homeSeatIds,
            uint256[5] memory awaySeatIds,
            uint256 stake,
            uint256 seed,
            uint8 homeGoals,
            uint8 awayGoals,
            uint8 status,
            uint64 createdAt
        )
    {
        Match storage m = matches[matchId];
        return (
            m.home, m.away,
            m.homeSeatIds, m.awaySeatIds,
            m.stake, m.seed,
            m.homeGoals, m.awayGoals,
            m.status, m.createdAt
        );
    }

    function getRecord(address player)
        external
        view
        returns (uint32 wins, uint32 losses, uint32 draws, uint32 gf, uint32 ga, uint32 mp)
    {
        Record memory r = records[player];
        return (r.wins, r.losses, r.draws, r.goalsFor, r.goalsAgainst, r.matchesPlayed);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                               ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        feeReceiver = _feeReceiver;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
