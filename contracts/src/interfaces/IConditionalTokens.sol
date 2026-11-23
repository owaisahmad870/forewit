// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

/// @notice The three read functions of Gnosis Conditional Tokens used by ForecastLedger.
/// @dev Verified on all Predict.fun CTFs on BSC mainnet and testnet on 23 Nov 2026 (notes/knowledge.md).
/// payoutNumerators reverts for an unprepared condition or an index at or above the slot count.
interface IConditionalTokens {
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256);
    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256);
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);
}
