// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

/// @notice Test and testnet stand in for Gnosis Conditional Tokens, read side only, with the same getter semantics:
/// payoutNumerators reverts for an index at or above the slot count. Never deploy on mainnet.
contract MockConditionalTokens {
    mapping(bytes32 => uint256[]) internal _numerators;
    mapping(bytes32 => uint256) public payoutDenominator;

    error Prepared();
    error NotPrepared();
    error Resolved();
    error BadPayouts();

    /// @notice Prepare a condition with `slots` outcome slots.
    function prepare(bytes32 conditionId, uint256 slots) external {
        if (_numerators[conditionId].length != 0) revert Prepared();
        _numerators[conditionId] = new uint256[](slots);
    }

    /// @notice Resolve a condition with the given payout numerators (denominator is their sum).
    function resolve(bytes32 conditionId, uint256[] calldata payouts) external {
        uint256[] storage nums = _numerators[conditionId];
        if (nums.length == 0) revert NotPrepared();
        if (payoutDenominator[conditionId] != 0) revert Resolved();
        if (payouts.length != nums.length) revert BadPayouts();
        uint256 den;
        for (uint256 i; i < payouts.length; ++i) {
            nums[i] = payouts[i];
            den += payouts[i];
        }
        if (den == 0) revert BadPayouts();
        payoutDenominator[conditionId] = den;
    }

    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256) {
        return _numerators[conditionId].length;
    }

    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256) {
        return _numerators[conditionId][index];
    }
}
