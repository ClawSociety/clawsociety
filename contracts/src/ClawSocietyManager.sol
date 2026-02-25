// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {GridLayout} from "./libraries/GridLayout.sol";

/// @title ClawSocietyManager
/// @notice Manages 100 Harberger-taxed seats in a 10x10 city grid.
///         Seats earn ETH from Flaunch trading fees, proportional to building multiplier.
///         Tax, deposits, and buyouts all use native ETH.
contract ClawSocietyManager is ReentrancyGuard, IERC721Receiver {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Seat {
        address holder;
        uint128 price;              // ETH (wei) — self-assessed
        uint128 deposit;            // ETH (wei) — drains via tax
        uint64 lastTaxTime;
        uint64 lastPriceChangeTime;
        uint8 buildingType;         // Immutable after init
    }

    struct AcquireParams {
        uint256 seatId;
        uint256 newPrice;
        uint256 maxPrice;       // Slippage protection (0 = no check for unclaimed)
        uint256 payment;        // ETH amount (deposit for claim, total for buyout)
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant TOTAL_SEATS = 100;
    uint256 public constant DEFAULT_TAX_RATE_BPS = 500;     // 5% per week
    uint256 public constant ONE_WEEK = 604_800;
    uint256 public constant PRICE_COOLDOWN = 1_200;          // 20 minutes
    uint256 public constant BUYOUT_FEE_BPS = 2_000;          // 20% of sale price
    uint256 public constant PROTOCOL_SHARE = 3_000;          // 30% of buyout fee
    uint256 public constant CREATOR_SHARE = 7_000;           // 70% of buyout fee
    uint256 public constant SERVER_FUND_BPS = 500;           // 5% of tax → server fund
    uint256 public constant MULTIPLIER_DENOM = 1_000;
    uint256 internal constant REWARD_PRECISION = 1e18;
    uint256 internal constant BPS = 10_000;

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public protocolFeeReceiver;
    address public creatorFeeReceiver;

    Seat[100] public seats;

    // Lazy reward accumulator (O(1) fee distribution)
    uint256 public globalRewardPerWeight;   // Scaled by REWARD_PRECISION
    uint256 public totalActiveWeight;       // Sum of multipliers of claimed seats
    mapping(uint256 => uint256) public seatRewardSnapshot;
    mapping(uint256 => uint256) public seatAccumulatedFees;

    // Server Fund
    uint256 public serverFundBalance;       // ETH accumulated
    uint256 public serverFundGoal = 1 ether;
    bool public societyAutonomous;

    // Forfeited ETH recovery
    uint256 public creatorPendingEth;

    // MemeStream NFT tracking
    address public memeStreamNFT;
    uint256 public memeStreamTokenId;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SeatClaimed(uint256 indexed seatId, address indexed holder, uint256 price, uint256 deposit);
    event SeatBoughtOut(uint256 indexed seatId, address indexed newHolder, address indexed oldHolder, uint256 price);
    event SeatAbandoned(uint256 indexed seatId, address indexed holder);
    event SeatForfeited(uint256 indexed seatId, address indexed holder);
    event PriceChanged(uint256 indexed seatId, uint256 newPrice);
    event DepositAdded(uint256 indexed seatId, uint256 amount);
    event DepositWithdrawn(uint256 indexed seatId, uint256 amount);
    event TaxCollected(uint256 indexed seatId, uint256 amount);
    event FeesDistributed(uint256 amount);
    event FeesClaimed(uint256 indexed seatId, address indexed holder, uint256 amount);
    event ServerFundContribution(uint256 amount, uint256 newBalance);
    event SocietyAutonomous();
    event MemeStreamReceived(address nftContract, uint256 tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProtocolFeeReceiverUpdated(address indexed previous, address indexed newReceiver);
    event CreatorFeeReceiverUpdated(address indexed previous, address indexed newReceiver);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidSeat();
    error SeatOccupied();
    error SeatEmpty();
    error NotHolder();
    error PriceCooldown();
    error InsufficientDeposit();
    error InsufficientPayment();
    error SlippageExceeded();
    error TransferFailed();
    error NoFeesToClaim();
    error OnlyOwner();
    error ZeroPrice();
    error ZeroAmount();
    error ZeroAddress();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier validSeat(uint256 seatId) {
        if (seatId >= TOTAL_SEATS) revert InvalidSeat();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _protocolFeeReceiver,
        address _creatorFeeReceiver
    ) {
        if (_protocolFeeReceiver == address(0)) revert ZeroAddress();
        if (_creatorFeeReceiver == address(0)) revert ZeroAddress();

        owner = msg.sender;
        protocolFeeReceiver = _protocolFeeReceiver;
        creatorFeeReceiver = _creatorFeeReceiver;

        // Initialize building types from layout
        uint8[100] memory layout = GridLayout.getLayout();
        for (uint256 i; i < TOTAL_SEATS; ++i) {
            seats[i].buildingType = layout[i];
        }
    }

    // ─── Claim / Buyout ───────────────────────────────────────────────────────

    /// @notice Claim an empty seat. Caller becomes holder, sets price, deposits ETH via msg.value.
    function claimSeat(
        uint256 seatId,
        uint256 price
    ) external payable nonReentrant validSeat(seatId) {
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder != address(0)) revert SeatOccupied();
        if (price == 0) revert ZeroPrice();
        if (msg.value == 0) revert ZeroAmount();

        s.holder = msg.sender;
        s.price = uint128(price);
        s.deposit = uint128(msg.value);
        s.lastTaxTime = uint64(block.timestamp);
        s.lastPriceChangeTime = uint64(block.timestamp);

        uint256 weight = GridLayout.getMultiplier(s.buildingType);
        totalActiveWeight += weight;

        // Snapshot so new holder doesn't claim past rewards
        seatRewardSnapshot[seatId] = globalRewardPerWeight;

        emit SeatClaimed(seatId, msg.sender, price, msg.value);
    }

    /// @notice Buy out an occupied seat. Pays current holder + fees.
    /// @param seatId Seat index
    /// @param newPrice New self-assessed price to set
    /// @param maxPrice Max price willing to pay (slippage protection)
    function buyoutSeat(
        uint256 seatId,
        uint256 newPrice,
        uint256 maxPrice
    ) external payable nonReentrant validSeat(seatId) {
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder == address(0)) revert SeatEmpty();
        if (s.holder == msg.sender) revert SeatOccupied();
        if (newPrice == 0) revert ZeroPrice();

        uint256 currentPrice = s.price;
        if (maxPrice > 0 && currentPrice > maxPrice) revert SlippageExceeded();
        if (msg.value < currentPrice) revert InsufficientPayment();
        if (msg.value == currentPrice) revert InsufficientDeposit();

        address oldHolder = s.holder;
        _settleBuyout(seatId, currentPrice);

        // Set up new holder
        s.holder = msg.sender;
        s.price = uint128(newPrice);
        s.deposit = uint128(msg.value - currentPrice);
        s.lastTaxTime = uint64(block.timestamp);
        s.lastPriceChangeTime = uint64(block.timestamp);
        seatRewardSnapshot[seatId] = globalRewardPerWeight;

        emit SeatBoughtOut(seatId, msg.sender, oldHolder, currentPrice);
    }

    /// @notice Batch acquire seats (claim empty or buyout occupied).
    function acquireBatch(AcquireParams[] calldata params) external payable nonReentrant {
        uint256 totalUsed;
        for (uint256 i; i < params.length; ++i) {
            AcquireParams calldata p = params[i];
            if (p.seatId >= TOTAL_SEATS) revert InvalidSeat();
            _applyTax(p.seatId);

            if (seats[p.seatId].holder == address(0)) {
                _batchClaim(p);
            } else {
                if (seats[p.seatId].holder == msg.sender) continue;
                _batchBuyout(p);
            }
            totalUsed += p.payment;
        }
        if (msg.value != totalUsed) revert InsufficientPayment();
    }

    // ─── Price Management ─────────────────────────────────────────────────────

    /// @notice Set a new self-assessed price (20-min cooldown).
    function setPrice(uint256 seatId, uint256 newPrice) external nonReentrant validSeat(seatId) {
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder != msg.sender) revert NotHolder();
        if (newPrice == 0) revert ZeroPrice();
        if (block.timestamp < s.lastPriceChangeTime + PRICE_COOLDOWN) revert PriceCooldown();

        s.price = uint128(newPrice);
        s.lastPriceChangeTime = uint64(block.timestamp);

        emit PriceChanged(seatId, newPrice);
    }

    // ─── Deposit Management ───────────────────────────────────────────────────

    /// @notice Add ETH to a seat's tax deposit.
    function addDeposit(uint256 seatId) external payable nonReentrant validSeat(seatId) {
        if (msg.value == 0) revert ZeroAmount();
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder != msg.sender) revert NotHolder();

        s.deposit += uint128(msg.value);

        emit DepositAdded(seatId, msg.value);
    }

    /// @notice Withdraw excess deposit ETH.
    function withdrawDeposit(uint256 seatId, uint256 amount) external nonReentrant validSeat(seatId) {
        if (amount == 0) revert ZeroAmount();
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder != msg.sender) revert NotHolder();
        if (s.deposit < amount) revert InsufficientDeposit();

        s.deposit -= uint128(amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit DepositWithdrawn(seatId, amount);
    }

    // ─── Exit ─────────────────────────────────────────────────────────────────

    /// @notice Abandon seat. Returns remaining deposit + claims ETH fees.
    function abandonSeat(uint256 seatId) external nonReentrant validSeat(seatId) {
        _applyTax(seatId);
        Seat storage s = seats[seatId];
        if (s.holder != msg.sender) revert NotHolder();

        _updateSeatFees(seatId);

        address holder = s.holder;
        uint256 remainingDeposit = s.deposit;
        uint256 pendingEth = seatAccumulatedFees[seatId];
        seatAccumulatedFees[seatId] = 0;

        uint256 weight = GridLayout.getMultiplier(s.buildingType);
        totalActiveWeight -= weight;

        s.holder = address(0);
        s.price = 0;
        s.deposit = 0;
        s.lastTaxTime = 0;
        s.lastPriceChangeTime = 0;
        seatRewardSnapshot[seatId] = 0;

        uint256 totalPayout = remainingDeposit + pendingEth;
        if (totalPayout > 0) {
            (bool ok,) = holder.call{value: totalPayout}("");
            if (!ok) revert TransferFailed();
        }

        emit SeatAbandoned(seatId, holder);
    }

    // ─── Fee Distribution & Claiming ──────────────────────────────────────────

    /// @notice Distribute ETH fees to all active seat holders (weighted by multiplier).
    ///         Called by keeper bot after claiming fees from Flaunch.
    function distributeFees() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (totalActiveWeight == 0) {
            // No active seats — send to creator as fallback
            (bool ok,) = creatorFeeReceiver.call{value: msg.value}("");
            if (!ok) revert TransferFailed();
            return;
        }

        globalRewardPerWeight += (msg.value * REWARD_PRECISION) / totalActiveWeight;
        emit FeesDistributed(msg.value);
    }

    /// @notice Claim accumulated ETH fees for one or more seats.
    function claimFees(uint256[] calldata seatIds) external nonReentrant {
        uint256 totalClaim;
        uint256[] memory amounts = new uint256[](seatIds.length);
        for (uint256 i; i < seatIds.length; ++i) {
            uint256 id = seatIds[i];
            if (id >= TOTAL_SEATS) revert InvalidSeat();
            Seat storage s = seats[id];
            if (s.holder != msg.sender) continue; // skip forfeited / not-owned

            _updateSeatFees(id);
            uint256 amount = seatAccumulatedFees[id];
            if (amount > 0) {
                seatAccumulatedFees[id] = 0;
                amounts[i] = amount;
                totalClaim += amount;
            }
        }
        if (totalClaim == 0) revert NoFeesToClaim();

        (bool ok,) = msg.sender.call{value: totalClaim}("");
        if (!ok) revert TransferFailed();

        for (uint256 i; i < seatIds.length; ++i) {
            if (amounts[i] > 0) {
                emit FeesClaimed(seatIds[i], msg.sender, amounts[i]);
            }
        }
    }

    /// @notice Force tax collection on any seats (permissionless, for keepers).
    function pokeTax(uint256[] calldata seatIds) external nonReentrant {
        for (uint256 i; i < seatIds.length; ++i) {
            if (seatIds[i] < TOTAL_SEATS) {
                _applyTax(seatIds[i]);
            }
        }
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Get pending (unclaimed) ETH fees for a seat.
    function pendingFees(uint256 seatId) external view validSeat(seatId) returns (uint256) {
        Seat storage s = seats[seatId];
        if (s.holder == address(0)) return 0;

        uint256 weight = GridLayout.getMultiplier(s.buildingType);
        uint256 pending = (weight * (globalRewardPerWeight - seatRewardSnapshot[seatId])) / REWARD_PRECISION;
        return seatAccumulatedFees[seatId] + pending;
    }

    /// @notice Get accrued (unpaid) tax for a seat since last collection.
    function accruedTax(uint256 seatId) external view validSeat(seatId) returns (uint256) {
        Seat storage s = seats[seatId];
        if (s.holder == address(0)) return 0;
        return _calculateTax(s.price, s.lastTaxTime);
    }

    /// @notice Get time until deposit runs out at current price.
    function depositRunway(uint256 seatId) external view validSeat(seatId) returns (uint256) {
        Seat storage s = seats[seatId];
        if (s.holder == address(0) || s.price == 0) return 0;

        uint256 taxOwed = _calculateTax(s.price, s.lastTaxTime);
        if (taxOwed >= s.deposit) return 0;

        uint256 remaining = s.deposit - taxOwed;
        // remaining / (price * taxRate / oneWeek) = remaining * oneWeek * BPS / (price * taxRate)
        uint256 ratePerSecond = (uint256(s.price) * DEFAULT_TAX_RATE_BPS);
        if (ratePerSecond == 0) return type(uint256).max;
        return (remaining * ONE_WEEK * BPS) / ratePerSecond;
    }

    /// @notice Get all 100 seats in one call (for frontend).
    function getAllSeats() external view returns (Seat[100] memory) {
        Seat[100] memory result;
        for (uint256 i; i < TOTAL_SEATS; ++i) {
            result[i] = seats[i];
        }
        return result;
    }

    /// @notice Get building multiplier for a seat.
    function getSeatMultiplier(uint256 seatId) external view validSeat(seatId) returns (uint256) {
        return GridLayout.getMultiplier(seats[seatId].buildingType);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setProtocolFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert ZeroAddress();
        address previous = protocolFeeReceiver;
        protocolFeeReceiver = _receiver;
        emit ProtocolFeeReceiverUpdated(previous, _receiver);
    }

    function setCreatorFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) revert ZeroAddress();
        address previous = creatorFeeReceiver;
        creatorFeeReceiver = _receiver;
        emit CreatorFeeReceiverUpdated(previous, _receiver);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Withdraw server fund ETH (only after goal reached, only owner).
    function withdrawServerFund(address to, uint256 amount) external nonReentrant onlyOwner {
        require(societyAutonomous, "Goal not reached");
        require(amount <= serverFundBalance, "Exceeds balance");
        serverFundBalance -= amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Withdraw forfeited ETH accumulated from seat forfeitures.
    function withdrawCreatorEth() external nonReentrant {
        uint256 amount = creatorPendingEth;
        if (amount == 0) revert ZeroAmount();
        creatorPendingEth = 0;
        (bool ok,) = creatorFeeReceiver.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function setServerFundGoal(uint256 _goal) external onlyOwner {
        serverFundGoal = _goal;
    }

    // ─── ERC721 Receiver ──────────────────────────────────────────────────────

    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        if (memeStreamNFT == address(0)) {
            memeStreamNFT = msg.sender;
            memeStreamTokenId = tokenId;
            emit MemeStreamReceived(msg.sender, tokenId);
            return IERC721Receiver.onERC721Received.selector;
        }
        revert("Unexpected NFT");
    }

    /// @notice Accept ETH (for fee distribution via direct transfer).
    receive() external payable {
        if (msg.value > 0 && totalActiveWeight > 0) {
            globalRewardPerWeight += (msg.value * REWARD_PRECISION) / totalActiveWeight;
            emit FeesDistributed(msg.value);
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _batchClaim(AcquireParams calldata p) internal {
        if (p.newPrice == 0) revert ZeroPrice();
        if (p.payment == 0) revert ZeroAmount();

        Seat storage s = seats[p.seatId];
        s.holder = msg.sender;
        s.price = uint128(p.newPrice);
        s.deposit = uint128(p.payment);
        s.lastTaxTime = uint64(block.timestamp);
        s.lastPriceChangeTime = uint64(block.timestamp);

        totalActiveWeight += GridLayout.getMultiplier(s.buildingType);
        seatRewardSnapshot[p.seatId] = globalRewardPerWeight;

        emit SeatClaimed(p.seatId, msg.sender, p.newPrice, p.payment);
    }

    function _batchBuyout(AcquireParams calldata p) internal {
        Seat storage s = seats[p.seatId];
        if (p.newPrice == 0) revert ZeroPrice();

        uint256 currentPrice = s.price;
        if (p.maxPrice > 0 && currentPrice > p.maxPrice) revert SlippageExceeded();
        if (p.payment < currentPrice) revert InsufficientPayment();
        if (p.payment == currentPrice) revert InsufficientDeposit();

        address oldHolder = s.holder;
        _settleBuyout(p.seatId, currentPrice);

        uint256 newDeposit = p.payment - currentPrice;
        s.holder = msg.sender;
        s.price = uint128(p.newPrice);
        s.deposit = uint128(newDeposit);
        s.lastTaxTime = uint64(block.timestamp);
        s.lastPriceChangeTime = uint64(block.timestamp);
        seatRewardSnapshot[p.seatId] = globalRewardPerWeight;

        emit SeatBoughtOut(p.seatId, msg.sender, oldHolder, currentPrice);
    }

    function _settleBuyout(uint256 seatId, uint256 currentPrice) internal {
        Seat storage s = seats[seatId];
        uint256 buyoutFee = (currentPrice * BUYOUT_FEE_BPS) / BPS;
        uint256 sellerProceeds = currentPrice - buyoutFee;
        uint256 protocolCut = (buyoutFee * PROTOCOL_SHARE) / BPS;
        uint256 creatorCut = buyoutFee - protocolCut;

        address oldHolder = s.holder;
        uint256 oldDeposit = s.deposit;

        _updateSeatFees(seatId);
        uint256 pendingEth = seatAccumulatedFees[seatId];
        seatAccumulatedFees[seatId] = 0;

        // Merge seller proceeds + old deposit + pending ETH fees into single transfer
        uint256 sellerTotal = sellerProceeds + oldDeposit + pendingEth;
        if (sellerTotal > 0) {
            (bool ok,) = oldHolder.call{value: sellerTotal}("");
            if (!ok) revert TransferFailed();
        }
        if (protocolCut > 0) {
            (bool ok,) = protocolFeeReceiver.call{value: protocolCut}("");
            if (!ok) revert TransferFailed();
        }
        if (creatorCut > 0) {
            (bool ok,) = creatorFeeReceiver.call{value: creatorCut}("");
            if (!ok) revert TransferFailed();
        }
    }

    function _applyTax(uint256 seatId) internal {
        Seat storage s = seats[seatId];
        if (s.holder == address(0)) return;

        uint256 taxOwed = _calculateTax(s.price, s.lastTaxTime);
        if (taxOwed == 0) return;

        // Update fees before potential forfeiture
        _updateSeatFees(seatId);

        if (taxOwed >= s.deposit) {
            // Forfeiture: deposit exhausted
            uint256 collected = s.deposit;
            _processTaxRevenue(collected);

            uint256 weight = GridLayout.getMultiplier(s.buildingType);
            totalActiveWeight -= weight;

            // Forfeit accumulated ETH fees → recoverable by creator
            creatorPendingEth += seatAccumulatedFees[seatId];
            seatAccumulatedFees[seatId] = 0;
            seatRewardSnapshot[seatId] = 0;

            address forfeited = s.holder;
            s.holder = address(0);
            s.price = 0;
            s.deposit = 0;
            s.lastTaxTime = 0;
            s.lastPriceChangeTime = 0;

            emit SeatForfeited(seatId, forfeited);
        } else {
            s.deposit -= uint128(taxOwed);
            s.lastTaxTime = uint64(block.timestamp);
            _processTaxRevenue(taxOwed);
            emit TaxCollected(seatId, taxOwed);
        }
    }

    function _calculateTax(uint256 price, uint256 lastTaxTime) internal view returns (uint256) {
        if (lastTaxTime == 0 || price == 0) return 0;
        uint256 elapsed = block.timestamp - lastTaxTime;
        if (elapsed == 0) return 0;
        return (price * DEFAULT_TAX_RATE_BPS * elapsed) / (ONE_WEEK * BPS);
    }

    function _processTaxRevenue(uint256 taxAmount) internal {
        uint256 serverCut = (taxAmount * SERVER_FUND_BPS) / BPS;
        serverFundBalance += serverCut;
        // Remaining 95% stays in contract as ETH reserves

        if (!societyAutonomous && serverFundBalance >= serverFundGoal) {
            societyAutonomous = true;
            emit SocietyAutonomous();
        }

        emit ServerFundContribution(serverCut, serverFundBalance);
    }

    function _updateSeatFees(uint256 seatId) internal {
        Seat storage s = seats[seatId];
        if (s.holder == address(0)) return;

        uint256 weight = GridLayout.getMultiplier(s.buildingType);
        uint256 pending = (weight * (globalRewardPerWeight - seatRewardSnapshot[seatId])) / REWARD_PRECISION;
        seatAccumulatedFees[seatId] += pending;
        seatRewardSnapshot[seatId] = globalRewardPerWeight;
    }
}
