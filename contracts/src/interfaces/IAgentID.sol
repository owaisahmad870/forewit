// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

/// @notice The read functions of the SPACE ID Agent ID ERC721 used by ForecastLedger.
/// @dev Mainnet 0x60b9262456de011f7d15a54cdd8c48baaa8b022f. tokenId equals uint256(keccak256(bytes(label)))
/// for a label without ".ai" (verified on 4 holders, 23 Nov 2026).
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}
