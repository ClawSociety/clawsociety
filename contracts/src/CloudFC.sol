// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {CloudFCPlayers} from "./CloudFCPlayers.sol";
import {FCSimulation} from "./libraries/FCSimulation.sol";
import {FCFormulas} from "./libraries/FCFormulas.sol";

/// @title CloudFC V2 — Player-Centric 5v5 Street Football
/// @notice V2 changes: 65/30/5/0 reward split, match types (Ranked/Friendly/Tournament),
///         friendlyMatch() with no stakes, removed dead PERF_ constants.
contract CloudFC is ReentrancyGuard, Pausable {
    // ──────────────────────────── Constants ────────────────────────────────

    uint256 public constant TEAM_SIZE = 5;
    uint256 public constant WINNER_BPS = 6500;   // 65% to winner
    uint256 public constant LOSER_BPS = 3000;    // 30% to loser
    uint256 public constant PROTOCOL_BPS = 500;  // 5% protocol
    // No treasury cut — treasury grows from lootbox fees
    // Break-even win rate: ~57.14% (down from 71.43%)

    // ──────────────────────────── Enums ──────────────────────────────────

    enum MatchType { Ranked, Friendly, Tournament }

    // ──────────────────────────── Errors ──────────────────────────────────

    error OnlyOwner();
    error InvalidSquad();
    error NotPlayerOwner();
    error PlayerInActiveMatch();
    error DuplicatePlayer();
    error InvalidFormation();
    error MatchNotPending();
    error InsufficientStake();
    error CantPlayYourself();
    error NotMatchCreator();
    error NothingToClaim();
    error TransferFailed();
    error InvalidMatch();
    error InvalidAddress();
    error SamePlayerBothTeams();
    error NotTournamentRole();

    // ──────────────────────────── Events ──────────────────────────────────

    event SquadCreated(uint256 indexed squadId, address indexed creator, uint256[5] playerIds, uint8 formation);
    event MatchCreated(uint256 indexed matchId, uint256 indexed homeSquadId, uint128 stake, MatchType matchType);
    event MatchResolved(
        uint256 indexed matchId,
        uint8 homeGoals,
        uint8 awayGoals,
        uint256 homePower,
        uint256 awayPower,
        uint256 seed
    );
    event MatchCancelled(uint256 indexed matchId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProtocolFeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    // ──────────────────────────── Structs ─────────────────────────────────

    struct Squad {
        uint256[5] playerIds;
        address[5] owners;       // snapshot of owners at squad creation
        uint8 formation;         // 0=balanced, 1=offensive, 2=defensive
        address creator;
    }

    struct Match {
        uint256 homeSquadId;
        uint256 awaySquadId;
        uint128 stake;           // ETH per side
        uint64 createdAt;
        uint8 homeGoals;
        uint8 awayGoals;
        uint8 status;            // 0=pending, 1=resolved, 2=cancelled
        MatchType matchType;
        uint256 seed;            // block.prevrandao
        uint256 totalPool;       // homeStake + awayStake
    }

    struct Record {
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint32 goalsFor;
        uint32 goalsAgainst;
        uint32 matchesPlayed;
    }

    // ──────────────────────────── State ───────────────────────────────────

    CloudFCPlayers public immutable players;
    address public owner;
    address public protocolFeeReceiver;

    Squad[] public squads;
    Match[] public matches;

    mapping(address => Record) public records;
    mapping(address => uint256) public claimable;
    mapping(uint256 => uint256) public playerActiveMatch; // playerId => matchId+1 (0 = not active)
    mapping(address => bool) public tournamentRole;       // authorized tournament contracts

    // ──────────────────────────── Modifiers ───────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ──────────────────────────── Constructor ─────────────────────────────

    constructor(address _players, address _protocolFeeReceiver) {
        players = CloudFCPlayers(_players);
        owner = msg.sender;
        protocolFeeReceiver = _protocolFeeReceiver;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          SQUAD MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Create a squad of 5 players with a formation choice
    function createSquad(uint256[5] calldata playerIds, uint8 formation)
        external
        whenNotPaused
        returns (uint256 squadId)
    {
        if (formation > 2) revert InvalidFormation();

        address[5] memory owners;
        for (uint256 i; i < TEAM_SIZE; ++i) {
            address pOwner = players.ownerOf(playerIds[i]);
            if (pOwner != msg.sender) revert NotPlayerOwner();

            for (uint256 j; j < i; ++j) {
                if (playerIds[i] == playerIds[j]) revert DuplicatePlayer();
            }

            if (playerActiveMatch[playerIds[i]] != 0) revert PlayerInActiveMatch();

            owners[i] = pOwner;
        }

        squadId = squads.length;
        squads.push();
        Squad storage s = squads[squadId];
        s.playerIds = playerIds;
        s.owners = owners;
        s.formation = formation;
        s.creator = msg.sender;

        emit SquadCreated(squadId, msg.sender, playerIds, formation);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          MATCH LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Create a ranked match with ETH stake
    function createMatch(uint256 squadId)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 matchId)
    {
        matchId = _createMatchInternal(squadId, MatchType.Ranked);
    }

    /// @notice Create a friendly match (no stake, no rewards, still recorded)
    function friendlyMatch(uint256 squadId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 matchId)
    {
        matchId = _createMatchInternal(squadId, MatchType.Friendly);
    }

    function _createMatchInternal(uint256 squadId, MatchType mType)
        internal
        returns (uint256 matchId)
    {
        if (squadId >= squads.length) revert InvalidSquad();
        Squad storage squad = squads[squadId];
        if (squad.creator != msg.sender) revert NotPlayerOwner();

        for (uint256 i; i < TEAM_SIZE; ++i) {
            if (players.ownerOf(squad.playerIds[i]) != msg.sender) revert NotPlayerOwner();
            if (playerActiveMatch[squad.playerIds[i]] != 0) revert PlayerInActiveMatch();
        }

        matchId = matches.length;
        matches.push();
        Match storage m = matches[matchId];
        m.homeSquadId = squadId;
        m.stake = uint128(msg.value);
        m.createdAt = uint64(block.timestamp);
        m.matchType = mType;

        for (uint256 i; i < TEAM_SIZE; ++i) {
            playerActiveMatch[squad.playerIds[i]] = matchId + 1;
            players.lockPlayer(squad.playerIds[i]);
        }

        emit MatchCreated(matchId, squadId, uint128(msg.value), mType);
    }

    /// @notice Accept a match with your squad
    function acceptMatch(uint256 matchId, uint256 squadId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (matchId >= matches.length) revert InvalidMatch();
        if (squadId >= squads.length) revert InvalidSquad();

        Match storage m = matches[matchId];
        if (m.status != 0) revert MatchNotPending();
        if (msg.value < m.stake) revert InsufficientStake();

        Squad storage awaySquad = squads[squadId];
        if (awaySquad.creator != msg.sender) revert NotPlayerOwner();

        Squad storage homeSquad = squads[m.homeSquadId];
        if (homeSquad.creator == msg.sender) revert CantPlayYourself();

        for (uint256 i; i < TEAM_SIZE; ++i) {
            if (players.ownerOf(awaySquad.playerIds[i]) != msg.sender) revert NotPlayerOwner();
            if (playerActiveMatch[awaySquad.playerIds[i]] != 0) revert PlayerInActiveMatch();
            for (uint256 j; j < TEAM_SIZE; ++j) {
                if (awaySquad.playerIds[i] == homeSquad.playerIds[j]) revert SamePlayerBothTeams();
            }
        }

        m.awaySquadId = squadId;
        m.seed = block.prevrandao;
        m.status = 1; // resolved

        for (uint256 i; i < TEAM_SIZE; ++i) {
            playerActiveMatch[awaySquad.playerIds[i]] = matchId + 1;
            players.lockPlayer(awaySquad.playerIds[i]);
        }

        FCSimulation.TeamData memory homeData = _buildTeamData(homeSquad);
        FCSimulation.TeamData memory awayData = _buildTeamData(awaySquad);
        FCSimulation.MatchResult memory result = FCSimulation.simulate(homeData, awayData, m.seed);

        m.homeGoals = result.homeGoals;
        m.awayGoals = result.awayGoals;
        m.totalPool = m.stake * 2;

        _updateRecords(homeSquad.creator, awaySquad.creator, result.homeGoals, result.awayGoals);

        // Only settle rewards for ranked matches with stakes
        if (m.matchType == MatchType.Ranked) {
            _settleRewards(homeSquad, awaySquad, result, m.stake);
        }

        _unlockSquad(homeSquad, matchId);
        _unlockSquad(awaySquad, matchId);

        if (msg.value > m.stake) {
            _send(msg.sender, msg.value - m.stake);
        }

        emit MatchResolved(matchId, result.homeGoals, result.awayGoals, result.homePower, result.awayPower, m.seed);
    }

    /// @notice Cancel a pending match (creator only). Stake refunded.
    function cancelMatch(uint256 matchId) external nonReentrant {
        if (matchId >= matches.length) revert InvalidMatch();
        Match storage m = matches[matchId];
        if (m.status != 0) revert MatchNotPending();

        Squad storage homeSquad = squads[m.homeSquadId];
        if (homeSquad.creator != msg.sender) revert NotMatchCreator();

        m.status = 2;
        _unlockSquad(homeSquad, matchId);

        if (m.stake > 0) _send(msg.sender, m.stake);

        emit MatchCancelled(matchId);
    }

    /// @notice Claim accumulated rewards
    function claimRewards() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                           INTERNAL LOGIC
    // ═══════════════════════════════════════════════════════════════════════

    function _buildTeamData(Squad storage squad)
        internal
        view
        returns (FCSimulation.TeamData memory data)
    {
        data.formation = squad.formation;

        uint8[5] memory positions;
        if (squad.formation == 0) {
            positions = [uint8(0), 1, 1, 2, 3];
        } else if (squad.formation == 1) {
            positions = [uint8(0), 1, 2, 3, 3];
        } else {
            positions = [uint8(0), 1, 1, 1, 3];
        }
        data.positions = positions;

        uint256 maxSame;
        for (uint256 i; i < TEAM_SIZE; ++i) {
            data.playerStats[i] = players.getStatsArray(squad.playerIds[i]);

            uint256 count = 1;
            for (uint256 j; j < TEAM_SIZE; ++j) {
                if (j != i && squad.owners[i] == squad.owners[j]) count++;
            }
            if (count > maxSame) maxSame = count;
        }
        data.maxSameOwner = maxSame;
    }

    function _settleRewards(
        Squad storage home,
        Squad storage away,
        FCSimulation.MatchResult memory result,
        uint256 stake
    ) internal {
        if (stake == 0) return;

        uint256 totalPool = stake * 2;
        uint256 protocolFee = totalPool * PROTOCOL_BPS / 10_000;

        claimable[protocolFeeReceiver] += protocolFee;

        uint256 remaining = totalPool - protocolFee;

        uint256 homePool;
        uint256 awayPool;

        if (result.homeGoals > result.awayGoals) {
            homePool = remaining * WINNER_BPS / (WINNER_BPS + LOSER_BPS);
            awayPool = remaining - homePool;
        } else if (result.awayGoals > result.homeGoals) {
            awayPool = remaining * WINNER_BPS / (WINNER_BPS + LOSER_BPS);
            homePool = remaining - awayPool;
        } else {
            homePool = remaining / 2;
            awayPool = remaining - homePool;
        }

        _distributeTeamRewards(home, homePool);
        _distributeTeamRewards(away, awayPool);
    }

    function _distributeTeamRewards(
        Squad storage squad,
        uint256 pool
    ) internal {
        if (pool == 0) return;

        uint256 totalWeight;
        uint256[5] memory weights;

        uint8[5] memory positions;
        if (squad.formation == 0) {
            positions = [uint8(0), 1, 1, 2, 3];
        } else if (squad.formation == 1) {
            positions = [uint8(0), 1, 2, 3, 3];
        } else {
            positions = [uint8(0), 1, 1, 1, 3];
        }

        for (uint256 i; i < TEAM_SIZE; ++i) {
            uint8[5] memory stats = players.getStatsArray(squad.playerIds[i]);
            weights[i] = FCFormulas.effectiveRating(stats, positions[i]);
            totalWeight += weights[i];
        }

        if (totalWeight == 0) {
            uint256 perPlayer = pool / TEAM_SIZE;
            for (uint256 i; i < TEAM_SIZE; ++i) {
                claimable[squad.owners[i]] += perPlayer;
            }
            claimable[squad.owners[0]] += pool - perPlayer * TEAM_SIZE;
            return;
        }

        uint256 distributed;
        for (uint256 i; i < TEAM_SIZE; ++i) {
            uint256 share;
            if (i == TEAM_SIZE - 1) {
                share = pool - distributed;
            } else {
                share = pool * weights[i] / totalWeight;
            }
            claimable[squad.owners[i]] += share;
            distributed += share;
        }
    }

    function _unlockSquad(Squad storage squad, uint256 matchId) internal {
        for (uint256 i; i < TEAM_SIZE; ++i) {
            uint256 pid = squad.playerIds[i];
            if (playerActiveMatch[pid] == matchId + 1) {
                playerActiveMatch[pid] = 0;
                players.unlockPlayer(pid);
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

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                             VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function totalMatches() external view returns (uint256) {
        return matches.length;
    }

    function totalSquads() external view returns (uint256) {
        return squads.length;
    }

    function getMatch(uint256 matchId)
        external
        view
        returns (
            uint256 homeSquadId,
            uint256 awaySquadId,
            uint128 stake,
            uint256 seed,
            uint8 homeGoals,
            uint8 awayGoals,
            uint8 status,
            uint64 createdAt,
            uint256 totalPool
        )
    {
        Match storage m = matches[matchId];
        return (
            m.homeSquadId, m.awaySquadId,
            m.stake, m.seed,
            m.homeGoals, m.awayGoals,
            m.status, m.createdAt,
            m.totalPool
        );
    }

    function getMatchType(uint256 matchId) external view returns (MatchType) {
        return matches[matchId].matchType;
    }

    function getSquad(uint256 squadId)
        external
        view
        returns (
            uint256[5] memory playerIds,
            address[5] memory owners,
            uint8 formation,
            address creator
        )
    {
        Squad storage s = squads[squadId];
        return (s.playerIds, s.owners, s.formation, s.creator);
    }

    function getRecord(address player)
        external
        view
        returns (uint32 wins, uint32 losses, uint32 draws, uint32 gf, uint32 ga, uint32 mp)
    {
        Record memory r = records[player];
        return (r.wins, r.losses, r.draws, r.goalsFor, r.goalsAgainst, r.matchesPlayed);
    }

    function getSquadPower(uint256 squadId) external view returns (uint256) {
        Squad storage s = squads[squadId];
        FCSimulation.TeamData memory data = _buildTeamData(s);
        return FCSimulation.teamPower(data);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                               ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    function setProtocolFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert InvalidAddress();
        address old = protocolFeeReceiver;
        protocolFeeReceiver = _receiver;
        emit ProtocolFeeReceiverUpdated(old, _receiver);
    }

    function setTournamentRole(address _addr, bool _authorized) external onlyOwner {
        tournamentRole[_addr] = _authorized;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
