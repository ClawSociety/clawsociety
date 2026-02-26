// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title CloudFCPlayers — ERC721 Player NFTs with Packed Stats
/// @notice Each player has 5 immutable stats (SPD/PAS/SHO/DEF/STA, 0-100).
///         Stats packed into a single uint40 for gas-efficient reads.
contract CloudFCPlayers is ERC721Enumerable, Pausable {
    // ──────────────────────────── Errors ──────────────────────────────────

    error OnlyAdmin();
    error OnlyLocker();
    error OnlyMinter();
    error InvalidStats();
    error PlayerLocked();
    error AlreadyLocked();
    error NotLocked();
    error PlayerDoesNotExist();
    error InvalidAddress();
    error ArrayLengthMismatch();

    // ──────────────────────────── Events ──────────────────────────────────

    event PlayerMinted(uint256 indexed playerId, address indexed to, uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta);
    event PlayerLockChanged(uint256 indexed playerId, bool locked);
    event LockerUpdated(address indexed locker, bool authorized);
    event MinterUpdated(address indexed minter, bool authorized);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    // ──────────────────────────── State ───────────────────────────────────

    address public admin;
    uint256 private _nextId;

    /// @notice Packed stats: [speed(8) | passing(8) | shooting(8) | defense(8) | stamina(8)]
    mapping(uint256 => uint40) public packedStats;

    /// @notice Whether a player is locked in an active match (can't be transferred)
    mapping(uint256 => bool) public locked;

    /// @notice Addresses authorized to lock/unlock players (CloudFC contract)
    mapping(address => bool) public lockers;

    /// @notice Addresses authorized to mint players (Lootbox contract)
    mapping(address => bool) public minters;

    /// @notice Base URI for external image rendering (e.g. "https://clawsociety.fun/api/card/")
    string public imageBaseURI;

    // ──────────────────────────── Modifiers ───────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyLocker() {
        if (!lockers[msg.sender]) revert OnlyLocker();
        _;
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert OnlyMinter();
        _;
    }

    // ──────────────────────────── Constructor ─────────────────────────────

    constructor() ERC721("CloudFC Player", "CFCP") {
        admin = msg.sender;
    }

    // ──────────────────────────── Admin ───────────────────────────────────

    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        address old = admin;
        admin = newAdmin;
        emit AdminTransferred(old, newAdmin);
    }

    function setLocker(address locker, bool authorized) external onlyAdmin {
        lockers[locker] = authorized;
        emit LockerUpdated(locker, authorized);
    }

    function setMinter(address minter, bool authorized) external onlyAdmin {
        minters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function setImageBaseURI(string calldata _uri) external onlyAdmin {
        imageBaseURI = _uri;
    }

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    // ──────────────────────────── Minting ─────────────────────────────────

    /// @notice Mint a player with specified stats (admin only)
    function mint(address to, uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta)
        external
        onlyAdmin
        whenNotPaused
        returns (uint256 playerId)
    {
        if (spd > 100 || pas > 100 || sho > 100 || def > 100 || sta > 100) {
            revert InvalidStats();
        }

        playerId = _nextId++;
        packedStats[playerId] = _pack(spd, pas, sho, def, sta);
        _safeMint(to, playerId);

        emit PlayerMinted(playerId, to, spd, pas, sho, def, sta);
    }

    /// @notice Batch mint players
    function mintBatch(
        address[] calldata recipients,
        uint8[] calldata speeds,
        uint8[] calldata passings,
        uint8[] calldata shootings,
        uint8[] calldata defenses,
        uint8[] calldata staminas
    ) external onlyAdmin whenNotPaused {
        uint256 len = recipients.length;
        if (speeds.length != len || passings.length != len || shootings.length != len || defenses.length != len || staminas.length != len) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i; i < len; ++i) {
            if (speeds[i] > 100 || passings[i] > 100 || shootings[i] > 100 || defenses[i] > 100 || staminas[i] > 100) {
                revert InvalidStats();
            }
            uint256 playerId = _nextId++;
            packedStats[playerId] = _pack(speeds[i], passings[i], shootings[i], defenses[i], staminas[i]);
            _safeMint(recipients[i], playerId);
            emit PlayerMinted(playerId, recipients[i], speeds[i], passings[i], shootings[i], defenses[i], staminas[i]);
        }
    }

    /// @notice Mint a player with specified stats (authorized minter only)
    function mintByMinter(address to, uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta)
        external
        onlyMinter
        whenNotPaused
        returns (uint256 playerId)
    {
        if (spd > 100 || pas > 100 || sho > 100 || def > 100 || sta > 100) {
            revert InvalidStats();
        }

        playerId = _nextId++;
        packedStats[playerId] = _pack(spd, pas, sho, def, sta);
        _safeMint(to, playerId);

        emit PlayerMinted(playerId, to, spd, pas, sho, def, sta);
    }

    // ──────────────────────────── Locking ─────────────────────────────────

    /// @notice Lock a player (prevents transfer). Called by CloudFC when entering a match.
    function lockPlayer(uint256 playerId) external onlyLocker {
        if (!_exists(playerId)) revert PlayerDoesNotExist();
        if (locked[playerId]) revert AlreadyLocked();
        locked[playerId] = true;
        emit PlayerLockChanged(playerId, true);
    }

    /// @notice Unlock a player. Called by CloudFC when match resolves or is cancelled.
    function unlockPlayer(uint256 playerId) external onlyLocker {
        if (!locked[playerId]) revert NotLocked();
        locked[playerId] = false;
        emit PlayerLockChanged(playerId, false);
    }

    // ──────────────────────────── Metadata ──────────────────────────────

    /// @notice On-chain JSON metadata for marketplaces (OpenSea, etc.)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert PlayerDoesNotExist();
        (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = _unpack(packedStats[tokenId]);
        uint256 avg = (uint256(spd) + pas + sho + def + sta) / 5;

        string memory tier;
        if (avg >= 80) tier = "Diamond";
        else if (avg >= 65) tier = "Gold";
        else if (avg >= 45) tier = "Silver";
        else tier = "Bronze";

        string memory idStr = Strings.toString(tokenId);

        string memory image = bytes(imageBaseURI).length > 0
            ? string.concat(imageBaseURI, idStr)
            : "";

        string memory json = string.concat(
            '{"name":"CloudFC Player #', idStr,
            '","description":"A ', tier, ' tier player in CloudFC 5v5 street football.',
            '","image":"', image,
            '","attributes":[',
            _buildAttributes(spd, pas, sho, def, sta, avg, tier),
            ']}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _buildAttributes(
        uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta, uint256 avg, string memory tier
    ) private pure returns (string memory) {
        return string.concat(
            '{"trait_type":"Speed","value":', Strings.toString(spd), '},',
            '{"trait_type":"Passing","value":', Strings.toString(pas), '},',
            '{"trait_type":"Shooting","value":', Strings.toString(sho), '},',
            '{"trait_type":"Defense","value":', Strings.toString(def), '},',
            '{"trait_type":"Stamina","value":', Strings.toString(sta), '},',
            '{"trait_type":"Rating","value":', Strings.toString(avg), '},',
            '{"trait_type":"Tier","value":"', tier, '"}'
        );
    }

    // ──────────────────────────── View ────────────────────────────────────

    /// @notice Get unpacked stats for a player
    function getStats(uint256 playerId)
        external
        view
        returns (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta)
    {
        if (!_exists(playerId)) revert PlayerDoesNotExist();
        return _unpack(packedStats[playerId]);
    }

    /// @notice Get all 5 stats as an array
    function getStatsArray(uint256 playerId) external view returns (uint8[5] memory stats) {
        if (!_exists(playerId)) revert PlayerDoesNotExist();
        (stats[0], stats[1], stats[2], stats[3], stats[4]) = _unpack(packedStats[playerId]);
    }

    /// @notice Average rating (0-100)
    function playerRating(uint256 playerId) external view returns (uint8) {
        if (!_exists(playerId)) revert PlayerDoesNotExist();
        (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta) = _unpack(packedStats[playerId]);
        return uint8((uint256(spd) + pas + sho + def + sta) / 5);
    }

    /// @notice Total supply minted
    function nextId() external view returns (uint256) {
        return _nextId;
    }

    // ──────────────────────────── Transfer Override ───────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Enumerable)
        whenNotPaused
        returns (address)
    {
        if (locked[tokenId]) revert PlayerLocked();
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ──────────────────────────── Internal Helpers ────────────────────────

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _pack(uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta)
        internal
        pure
        returns (uint40)
    {
        return uint40(spd) << 32
            | uint40(pas) << 24
            | uint40(sho) << 16
            | uint40(def) << 8
            | uint40(sta);
    }

    function _unpack(uint40 packed)
        internal
        pure
        returns (uint8 spd, uint8 pas, uint8 sho, uint8 def, uint8 sta)
    {
        spd = uint8(packed >> 32);
        pas = uint8(packed >> 24);
        sho = uint8(packed >> 16);
        def = uint8(packed >> 8);
        sta = uint8(packed);
    }
}
