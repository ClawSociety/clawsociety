// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GridLayout
/// @notice Pure library that assigns building types to 100 seat indices (10x10 city grid).
/// @dev Building types: 0=ServerFarm, 1=Bank, 2=AILab, 3=Arena, 4=Market,
///      5=Factory, 6=Cafe, 7=Club, 8=Quarters, 9=Park
library GridLayout {
    /// @notice Returns the building type for each of the 100 seats.
    /// Layout: center = high-value, edges = low-value (city-like).
    ///
    /// Visual grid (10x10):
    ///   P  Q  Ca Q  Q  Q  Q  Q  P  P
    ///   P  Cl Ca Cl Ca Ca Cl Ca Cl P
    ///   P  Q  Ca F  Ca AI Ca F  Q  P
    ///   P  Cl Ca M  Ar Ar M  Ca Cl P
    ///   Q  Q  F  Ar AI B  AI F  Q  Q
    ///   Q  Q  F  Ar B  SF AI F  Q  Q
    ///   P  Cl Ca M  Ar Ar M  Ca Cl P
    ///   P  Q  Ca F  M  M  Ca F  Q  P
    ///   P  Cl F  Cl M  M  Cl F  Cl P
    ///   P  P  P  P  Q  Q  P  P  P  P
    function getLayout() internal pure returns (uint8[100] memory layout) {
        // Row 0
        layout[0]  = 9; // Park
        layout[1]  = 8; // Quarters
        layout[2]  = 6; // Cafe
        layout[3]  = 8; // Quarters
        layout[4]  = 8; // Quarters
        layout[5]  = 8; // Quarters
        layout[6]  = 8; // Quarters
        layout[7]  = 8; // Quarters
        layout[8]  = 9; // Park
        layout[9]  = 9; // Park

        // Row 1
        layout[10] = 9; // Park
        layout[11] = 7; // Club
        layout[12] = 6; // Cafe
        layout[13] = 7; // Club
        layout[14] = 6; // Cafe
        layout[15] = 6; // Cafe
        layout[16] = 7; // Club
        layout[17] = 6; // Cafe
        layout[18] = 7; // Club
        layout[19] = 9; // Park

        // Row 2
        layout[20] = 9; // Park
        layout[21] = 8; // Quarters
        layout[22] = 6; // Cafe
        layout[23] = 5; // Factory
        layout[24] = 6; // Cafe
        layout[25] = 2; // AI Lab
        layout[26] = 6; // Cafe
        layout[27] = 5; // Factory
        layout[28] = 8; // Quarters
        layout[29] = 9; // Park

        // Row 3
        layout[30] = 9; // Park
        layout[31] = 7; // Club
        layout[32] = 6; // Cafe
        layout[33] = 4; // Market
        layout[34] = 3; // Arena
        layout[35] = 3; // Arena
        layout[36] = 4; // Market
        layout[37] = 6; // Cafe
        layout[38] = 7; // Club
        layout[39] = 9; // Park

        // Row 4
        layout[40] = 8; // Quarters
        layout[41] = 8; // Quarters
        layout[42] = 5; // Factory
        layout[43] = 3; // Arena
        layout[44] = 2; // AI Lab
        layout[45] = 1; // Bank
        layout[46] = 2; // AI Lab
        layout[47] = 5; // Factory
        layout[48] = 8; // Quarters
        layout[49] = 8; // Quarters

        // Row 5
        layout[50] = 8; // Quarters
        layout[51] = 8; // Quarters
        layout[52] = 5; // Factory
        layout[53] = 3; // Arena
        layout[54] = 1; // Bank
        layout[55] = 0; // Server Farm (center!)
        layout[56] = 2; // AI Lab
        layout[57] = 5; // Factory
        layout[58] = 8; // Quarters
        layout[59] = 8; // Quarters

        // Row 6
        layout[60] = 9; // Park
        layout[61] = 7; // Club
        layout[62] = 6; // Cafe
        layout[63] = 4; // Market
        layout[64] = 3; // Arena
        layout[65] = 3; // Arena
        layout[66] = 4; // Market
        layout[67] = 6; // Cafe
        layout[68] = 7; // Club
        layout[69] = 9; // Park

        // Row 7
        layout[70] = 9; // Park
        layout[71] = 8; // Quarters
        layout[72] = 6; // Cafe
        layout[73] = 5; // Factory
        layout[74] = 4; // Market
        layout[75] = 4; // Market
        layout[76] = 6; // Cafe
        layout[77] = 5; // Factory
        layout[78] = 8; // Quarters
        layout[79] = 9; // Park

        // Row 8
        layout[80] = 9; // Park
        layout[81] = 7; // Club
        layout[82] = 5; // Factory
        layout[83] = 7; // Club
        layout[84] = 4; // Market
        layout[85] = 4; // Market
        layout[86] = 7; // Club
        layout[87] = 5; // Factory
        layout[88] = 7; // Club
        layout[89] = 9; // Park

        // Row 9
        layout[90] = 9; // Park
        layout[91] = 9; // Park
        layout[92] = 9; // Park
        layout[93] = 9; // Park
        layout[94] = 8; // Quarters
        layout[95] = 8; // Quarters
        layout[96] = 9; // Park
        layout[97] = 9; // Park
        layout[98] = 9; // Park
        layout[99] = 9; // Park
    }

    /// @notice Returns the multiplier (basis points, 1000 = 1.0x) for a building type.
    function getMultiplier(uint8 buildingType) internal pure returns (uint256) {
        if (buildingType == 0) return 2000; // Server Farm 2.0x
        if (buildingType == 1) return 1800; // Bank 1.8x
        if (buildingType == 2) return 1500; // AI Lab 1.5x
        if (buildingType == 3) return 1300; // Arena 1.3x
        if (buildingType == 4) return 1200; // Market 1.2x
        if (buildingType == 5) return 1100; // Factory 1.1x
        if (buildingType == 6) return 1000; // Cafe 1.0x
        if (buildingType == 7) return 900;  // Club 0.9x
        if (buildingType == 8) return 800;  // Quarters 0.8x
        if (buildingType == 9) return 700;  // Park 0.7x
        revert("Invalid building type");
    }
}
