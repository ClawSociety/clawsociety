// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CloudFCPlayers} from "./CloudFCPlayers.sol";

/// @title CloudFCLootbox — Pay ETH, receive 5 random players (a full squad)
/// @notice Stats generated deterministically from block.prevrandao seed.
///         Tier system: Bronze (60%), Silver (25%), Gold (12%), Diamond (3%).
///         Revenue uses pull-claim pattern to avoid DoS from reverting receivers.
contract CloudFCLootbox is Pausable, ReentrancyGuard {
    // ──────────────────────────── Errors ──────────────────────────────────
    error OnlyOwner();
    error InsufficientPayment();
    error TransferFailed();
    error InvalidWeights();
    error InvalidPrice();
    error PackNotFound();
    error InvalidAddress();
    error NothingToWithdraw();

    // ──────────────────────────── Events ──────────────────────────────────
    event PackOpened(
        address indexed buyer,
        uint256 indexed packId,
        uint256[5] playerIds,
        uint8[5] tiers
    );
    event PackPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TierWeightsUpdated(uint16[4] weights);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event ProtocolFeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    // ──────────────────────────── Structs ─────────────────────────────────
    struct PackRecord {
        address buyer;
        uint256[5] playerIds;
        uint64 timestamp;
    }

    // ──────────────────────────── Constants ───────────────────────────────
    uint256 public constant TEAM_SIZE = 5;
    uint256 public constant TREASURY_BPS = 8000; // 80% treasury
    uint256 public constant PROTOCOL_BPS = 2000; // 20% protocol

    // ──────────────────────────── State ───────────────────────────────────
    CloudFCPlayers public immutable players;
    address public owner;
    address public treasuryReceiver;
    address public protocolFeeReceiver;

    uint256 public packPrice = 0.005 ether;
    uint256 private _packNonce;

    /// @notice Tier weight thresholds (cumulative out of 10000)
    uint16[4] public tierWeights = [6000, 8500, 9700, 10000];

    PackRecord[] public packs;

    /// @notice Pull-claim balances (treasury + protocol revenue accumulates here)
    mapping(address => uint256) public pendingRevenue;

    // ──────────────────────────── Modifiers ───────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ──────────────────────────── Constructor ─────────────────────────────
    constructor(
        address _players,
        address _treasuryReceiver,
        address _protocolFeeReceiver
    ) {
        players = CloudFCPlayers(_players);
        owner = msg.sender;
        treasuryReceiver = _treasuryReceiver;
        protocolFeeReceiver = _protocolFeeReceiver;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          PACK OPENING
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Open a pack of 5 random players. Sends ETH, receives 5 NFTs.
    ///         Overpayment above packPrice is refunded.
    function openPack()
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[5] memory playerIds)
    {
        if (msg.value < packPrice) revert InsufficientPayment();

        // Generate base seed
        bytes32 baseSeed = keccak256(abi.encode(block.prevrandao, msg.sender, _packNonce++));

        uint8[5] memory tiers;

        for (uint256 i; i < TEAM_SIZE; ++i) {
            bytes32 playerSeed = keccak256(abi.encode(baseSeed, i));

            // Tier selection
            uint256 tierRoll = uint256(playerSeed) % 10000;
            uint8 tier = _selectTier(tierRoll);
            tiers[i] = tier;

            // Get stat range for tier
            (uint8 minStat, uint8 maxStat) = _tierRange(tier);
            uint8 range = maxStat - minStat + 1;

            // Generate 5 stats
            uint8 spd = minStat + uint8(uint256(keccak256(abi.encode(playerSeed, uint256(0)))) % range);
            uint8 pas = minStat + uint8(uint256(keccak256(abi.encode(playerSeed, uint256(1)))) % range);
            uint8 sho = minStat + uint8(uint256(keccak256(abi.encode(playerSeed, uint256(2)))) % range);
            uint8 def = minStat + uint8(uint256(keccak256(abi.encode(playerSeed, uint256(3)))) % range);
            uint8 sta = minStat + uint8(uint256(keccak256(abi.encode(playerSeed, uint256(4)))) % range);

            playerIds[i] = players.mintByMinter(msg.sender, spd, pas, sho, def, sta);
        }

        // Store pack record
        uint256 packId = packs.length;
        packs.push();
        PackRecord storage record = packs[packId];
        record.buyer = msg.sender;
        record.playerIds = playerIds;
        record.timestamp = uint64(block.timestamp);

        // Split revenue via pull pattern (no push = no DoS)
        uint256 payment = packPrice;
        uint256 treasuryAmount = payment * TREASURY_BPS / 10000;
        uint256 protocolAmount = payment - treasuryAmount;

        pendingRevenue[treasuryReceiver] += treasuryAmount;
        pendingRevenue[protocolFeeReceiver] += protocolAmount;

        // Refund overpayment
        if (msg.value > payment) {
            _send(msg.sender, msg.value - payment);
        }

        emit PackOpened(msg.sender, packId, playerIds, tiers);
    }

    /// @notice Withdraw accumulated revenue (treasury or protocol)
    function withdrawRevenue() external nonReentrant {
        uint256 amount = pendingRevenue[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingRevenue[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function totalPacks() external view returns (uint256) {
        return packs.length;
    }

    function getPackRecord(uint256 packId) external view returns (PackRecord memory) {
        if (packId >= packs.length) revert PackNotFound();
        return packs[packId];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    function setPackPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        uint256 oldPrice = packPrice;
        packPrice = newPrice;
        emit PackPriceUpdated(oldPrice, newPrice);
    }

    function setTierWeights(uint16[4] calldata weights) external onlyOwner {
        if (weights[0] == 0 || weights[3] != 10000) revert InvalidWeights();
        for (uint256 i = 1; i < 4; ++i) {
            if (weights[i] <= weights[i - 1]) revert InvalidWeights();
        }
        tierWeights = weights;
        emit TierWeightsUpdated(weights);
    }

    function setTreasuryReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert InvalidAddress();
        address old = treasuryReceiver;
        treasuryReceiver = _receiver;
        emit TreasuryReceiverUpdated(old, _receiver);
    }

    function setProtocolFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert InvalidAddress();
        address old = protocolFeeReceiver;
        protocolFeeReceiver = _receiver;
        emit ProtocolFeeReceiverUpdated(old, _receiver);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ═══════════════════════════════════════════════════════════════════════
    //                          INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function _selectTier(uint256 roll) internal view returns (uint8) {
        if (roll < tierWeights[0]) return 0;
        if (roll < tierWeights[1]) return 1;
        if (roll < tierWeights[2]) return 2;
        return 3;
    }

    function _tierRange(uint8 tier) internal pure returns (uint8 min, uint8 max) {
        if (tier == 0) return (25, 55);
        if (tier == 1) return (45, 75);
        if (tier == 2) return (65, 90);
        return (80, 100);
    }

    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
