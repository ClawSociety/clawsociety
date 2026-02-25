// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IClawSocietyManager {
    function seats(uint256 seatId)
        external
        view
        returns (
            address holder,
            uint128 price,
            uint128 deposit,
            uint64 lastTaxTime,
            uint64 lastPriceChangeTime,
            uint8 buildingType
        );

    function getSeatMultiplier(uint256 seatId) external view returns (uint256);
    function TOTAL_SEATS() external view returns (uint256);
    function MULTIPLIER_DENOM() external view returns (uint256);
}
