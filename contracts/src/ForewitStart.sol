// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {IAgentID} from "./interfaces/IAgentID.sol";

/// @title ForewitStart
/// @notice "Start my Forewit record": one free call, once per wallet, for Agent ID holders only. It records when the
/// wallet joined Forewit and gives it a player number. It is not a forecast and carries no score: the site and the
/// indexer count starts separately from forecasts. start() and mint() are the same call (mint() is the name many agents
/// try first on a new contract).
/// @dev No owner, no admin, no upgrade, no token, no funds: every function is nonpayable and nothing can be withdrawn
/// or changed after deploy. The only external call is a view on the Agent ID contract (balanceOf, a staticcall).
contract ForewitStart {
    IAgentID public immutable AGENT_ID;

    /// @notice Unix time the wallet started (0 = not started).
    mapping(address => uint64) public startedAt;
    /// @notice Player number of the wallet (1 for the first start; 0 = not started).
    mapping(address => uint256) public playerNumber;
    /// @notice Number of wallets that started.
    uint256 public starts;

    event Started(address indexed player, uint256 indexed number, uint64 at);

    error NoAgentID();
    error AlreadyStarted();
    error ZeroAddress();

    constructor(address agentId) {
        if (agentId == address(0) || agentId.code.length == 0) revert ZeroAddress();
        AGENT_ID = IAgentID(agentId);
    }

    /// @notice Start your Forewit record. Needs an Agent ID in the calling wallet; once per wallet; value 0.
    function start() external returns (uint256) {
        return _start();
    }

    /// @notice Same as start().
    function mint() external returns (uint256) {
        return _start();
    }

    function _start() private returns (uint256 number) {
        if (startedAt[msg.sender] != 0) revert AlreadyStarted();
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID();
        number = ++starts;
        uint64 at = uint64(block.timestamp);
        startedAt[msg.sender] = at;
        playerNumber[msg.sender] = number;
        emit Started(msg.sender, number, at);
    }
}
